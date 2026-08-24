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
    def __init__(self, ledger, authorizer, context_service=None):
        self.ledger = ledger
        self.authorizer = authorizer
        self.context_service = context_service

    def _agent_harness_route(self, method, path, principal, payload, query):
        if path == "/v1/agent-harness/skills" and method == "POST":
            principal.require("create", payload.get("scope", "PROJECT:local"))
            skill_payload = {key: value for key, value in payload.items() if key != "scope"}
            return Response(201, self.ledger.create_skill(**skill_payload))
        if path == "/v1/agent-harness/skills" and method == "GET":
            principal.require("read", query.get("scope", ["PROJECT:local"])[0])
            return Response(200, {"items": self.ledger.list_skills(query.get("status", [None])[0], query.get("capability", [None])[0])})
        if path.startswith("/v1/agent-harness/skills/") and path.endswith(":transition") and method == "POST":
            name, version = path.removeprefix("/v1/agent-harness/skills/").removesuffix(":transition").rsplit("@", 1)
            principal.require("promote", payload.get("scope", "PROJECT:local"))
            return Response(200, self.ledger.transition_skill(name, version, payload["status"], principal.actor_id, payload.get("evidence", [])))
        if path == "/v1/agent-harness/episodes" and method == "POST":
            principal.require("create", f"PROJECT:{payload['project_id']}")
            return Response(201, self.ledger.record_episode(payload))
        if path == "/v1/agent-harness/episodes" and method == "GET":
            project_id = query.get("project_id", [None])[0]
            principal.require("read", f"PROJECT:{project_id or 'local'}")
            return Response(200, {"items": self.ledger.list_episodes(project_id)})
        if path == "/v1/agent-harness/failure-patterns" and method == "POST":
            principal.require("create", payload.get("scope", "PROJECT:local"))
            pattern_payload = {key: value for key, value in payload.items() if key != "scope"}
            return Response(201, self.ledger.record_failure_pattern(pattern_payload))
        if path == "/v1/agent-harness/failure-patterns" and method == "GET":
            principal.require("read", query.get("scope", ["PROJECT:local"])[0])
            return Response(200, {"items": self.ledger.list_failure_patterns(query.get("status", [None])[0])})
        if path == "/v1/agent-harness/browser-sessions" and method == "POST":
            principal.require("create", f"PROJECT:{payload['project_id']}")
            return Response(201, self.ledger.upsert_browser_session(payload))
        if path == "/v1/agent-harness/browser-sessions" and method == "GET":
            project_id = query.get("project_id", [None])[0]
            principal.require("read", f"PROJECT:{project_id or 'local'}")
            return Response(200, {"items": self.ledger.list_browser_sessions(query.get("agent_id", [None])[0], project_id)})
        return None

    def handle(self, method, target, headers, raw_body):
        try:
            principal = self.authorizer.authenticate({key.lower(): value for key, value in headers.items()})
            parsed = urlsplit(target)
            payload = json.loads(raw_body or b"{}")
            harness_response = self._agent_harness_route(method, parsed.path, principal, payload, parse_qs(parsed.query))
            if harness_response is not None:
                return harness_response
            if method == "POST" and parsed.path == "/v1/memories":
                return self._create(principal, payload)
            if method == "GET" and parsed.path == "/v1/memories/search":
                return self._search(principal, parse_qs(parsed.query))
            if method == "POST" and parsed.path == "/v1/context:compile":
                return self._compile_context(principal, payload)
            if method == "POST" and parsed.path == "/v1/context:impact":
                return self._impact_context(principal, payload)
            if parsed.path.startswith("/v1/index/repositories/"):
                return self._index_route(method, parsed.path.removeprefix("/v1/index/repositories/"), principal, payload)
            if parsed.path.startswith("/v1/memories/"):
                return self._memory_route(method, parsed.path.removeprefix("/v1/memories/"), principal, payload)
            return Response(404, {"error": "NOT_FOUND"})
        except AuthorizationError as error:
            return Response(403, {"error": "FORBIDDEN", "message": str(error)})
        except (KeyError, ValueError, SensitiveDataError, json.JSONDecodeError) as error:
            return Response(400, {"error": "INVALID_REQUEST", "message": str(error)})
        except LookupError as error:
            return Response(401, {"error": "UNAUTHENTICATED", "message": str(error)})
        except RuntimeError:
            return Response(503, {"error": "DEPENDENCY_UNAVAILABLE"})

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
            source_refs=payload.get("source_refs"), parent_scope=payload.get("parent_scope"),
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

    def _index_route(self, method, suffix, principal, payload):
        repository, separator, operation = suffix.rpartition(":")
        if not separator:
            repository = suffix
            operation = "state"
        scope = f"REPOSITORY:{repository}"
        if operation == "state" and method == "GET":
            principal.require("read", scope)
            return Response(200, self.context_service.index_state(repository))
        if operation in {"sync", "rebuild"} and method == "POST":
            principal.require("index", scope)
            return Response(200, self.context_service.sync(repository, payload, rebuild=operation == "rebuild"))
        return Response(404, {"error": "NOT_FOUND"})

    def _compile_context(self, principal, payload):
        principal.require("compile", f"REPOSITORY:{payload['repository']}")
        scopes = payload.get("scopes", [])
        for scope in scopes:
            principal.require("read", scope)
        return Response(200, self.context_service.compile(payload, scopes))

    def _impact_context(self, principal, payload):
        repository = payload["repository"]
        principal.require("read", f"REPOSITORY:{repository}")
        return Response(200, self.context_service.impact(repository, payload["path"]))
