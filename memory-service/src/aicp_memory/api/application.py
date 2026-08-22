from dataclasses import dataclass
from datetime import datetime
import json
from urllib.parse import parse_qs, urlsplit

from aicp_memory.domain.ledger import AuthorizationError, SensitiveDataError


@dataclass(frozen=True)
class Response:
    status: int
    body: dict


class MemoryApplication:
    def __init__(self, ledger, authorizer):
        self.ledger = ledger
        self.authorizer = authorizer

    def handle(self, method, target, headers, raw_body):
        try:
            principal = self.authorizer.authenticate({key.lower(): value for key, value in headers.items()})
            parsed = urlsplit(target)
            payload = json.loads(raw_body or b"{}")
            if method == "POST" and parsed.path == "/v1/memories":
                return self._create(principal, payload)
            if method == "GET" and parsed.path == "/v1/memories/search":
                return self._search(principal, parse_qs(parsed.query))
            if parsed.path.startswith("/v1/memories/"):
                return self._memory_route(method, parsed.path.removeprefix("/v1/memories/"), principal, payload)
            return Response(404, {"error": "NOT_FOUND"})
        except LookupError as error:
            return Response(401, {"error": "UNAUTHENTICATED", "message": str(error)})
        except AuthorizationError as error:
            return Response(403, {"error": "FORBIDDEN", "message": str(error)})
        except (KeyError, ValueError, SensitiveDataError, json.JSONDecodeError) as error:
            return Response(400, {"error": "INVALID_REQUEST", "message": str(error)})

    def _create(self, principal, payload):
        scope = payload["scope"]
        principal.require("create", scope)
        expires_at = datetime.fromisoformat(payload["expires_at"]) if payload.get("expires_at") else None
        memory = self.ledger.create_candidate(
            scope=scope, canonical_key=payload["canonical_key"], summary=payload["summary"],
            authority=payload["authority"], kind=payload.get("kind", "FACT"),
            source_hash=payload.get("source_hash"), payload=payload.get("payload"),
            confidence=payload.get("confidence"), expires_at=expires_at,
            idempotency_key=payload.get("idempotency_key"),
            policy_version=payload.get("policy_version"), schema_version=payload.get("schema_version"),
        )
        return Response(201, memory.to_dict())

    def _search(self, principal, query):
        scopes = query.get("scope", [])
        for scope in scopes:
            principal.require("read", scope)
        return Response(200, {"items": [item.to_dict() for item in self.ledger.search_active(scopes)]})

    def _memory_route(self, method, suffix, principal, payload):
        if method == "GET" and ":" not in suffix:
            memory = self.ledger.get(suffix)
            principal.require("read", memory.scope)
            return Response(200, memory.to_dict())
        memory_id, operation = suffix.rsplit(":", 1)
        current = self.ledger.get(memory_id)
        if operation == "promote" and method == "POST":
            target = payload["target_scope"]
            principal.require("promote", current.scope)
            principal.require("promote", target)
            memory = self.ledger.promote(memory_id, target, principal.actor_id, principal.scopes)
        elif operation == "invalidate" and method == "POST":
            principal.require("invalidate", current.scope)
            memory = self.ledger.invalidate(memory_id, principal.actor_id, payload["reason"])
        elif operation == "supersede" and method == "POST":
            principal.require("supersede", current.scope)
            memory = self.ledger.supersede(
                memory_id, summary=payload["summary"], actor=principal.actor_id,
                source_hash=payload.get("source_hash"), payload=payload.get("payload"),
            )
        else:
            return Response(404, {"error": "NOT_FOUND"})
        return Response(200, memory.to_dict())
