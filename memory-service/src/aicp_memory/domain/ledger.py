from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
import re
from uuid import uuid4


class AuthorizationError(PermissionError):
    pass


class SensitiveDataError(ValueError):
    pass


SECRET_PATTERNS = (
    re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"\bgh[opusr]_[A-Za-z0-9]{12,}\b"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
)


@dataclass(frozen=True)
class Memory:
    id: str
    scope: str
    canonical_key: str
    summary: str
    authority: str
    source_hash: str | None
    status: str = "CANDIDATE"
    kind: str = "FACT"
    version: int = 1
    payload: dict | None = None
    confidence: float | None = None
    expires_at: datetime | None = None
    supersedes_id: str | None = None
    policy_version: str | None = None
    schema_version: str | None = None

    def to_dict(self):
        value = asdict(self)
        if self.expires_at:
            value["expires_at"] = self.expires_at.isoformat()
        return value


@dataclass(frozen=True)
class MemoryEvent:
    memory_id: str
    event_type: str
    actor: str
    occurred_at: datetime
    reason: str | None = None


class MemoryLedger:
    def __init__(self, clock=None):
        self._memories: dict[str, Memory] = {}
        self._idempotency: dict[str, str] = {}
        self.events: list[MemoryEvent] = []
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def create_candidate(
        self, *, scope, canonical_key, summary, authority, source_hash=None,
        kind="FACT", payload=None, confidence=None, expires_at=None,
        idempotency_key=None, policy_version=None, schema_version=None,
    ):
        if idempotency_key and idempotency_key in self._idempotency:
            return self.get(self._idempotency[idempotency_key])
        self._reject_sensitive(summary, payload)
        memory = Memory(
            str(uuid4()), scope, canonical_key, summary, authority, source_hash,
            kind=kind, payload=payload or {}, confidence=confidence,
            expires_at=expires_at, policy_version=policy_version,
            schema_version=schema_version,
        )
        self._memories[memory.id] = memory
        if idempotency_key:
            self._idempotency[idempotency_key] = memory.id
        self._append(memory.id, "CREATED", "system")
        return memory

    def promote(self, memory_id, target_scope, actor, authorized_scopes=None):
        self._authorize(target_scope, authorized_scopes)
        current = self.get(memory_id)
        if current.status != "CANDIDATE":
            raise ValueError("only candidate memory can be promoted")
        promoted = replace(current, scope=target_scope, status="ACTIVE")
        self._memories[memory_id] = promoted
        self._append(memory_id, "PROMOTED", actor)
        return promoted

    def invalidate(self, memory_id, actor, reason):
        current = self.get(memory_id)
        if current.status not in {"CANDIDATE", "ACTIVE"}:
            raise ValueError("only current memory can be invalidated")
        invalidated = replace(current, status="INVALIDATED")
        self._memories[memory_id] = invalidated
        self._append(memory_id, "INVALIDATED", actor, reason)
        return invalidated

    def invalidate_stale_source(self, memory_id, current_source_hash, actor):
        current = self.get(memory_id)
        if current.source_hash == current_source_hash:
            return current
        return self.invalidate(memory_id, actor, "SOURCE_HASH_CHANGED")

    def supersede(self, memory_id, *, summary, actor, source_hash=None, payload=None):
        current = self.get(memory_id)
        if current.status != "ACTIVE":
            raise ValueError("only active memory can be superseded")
        self._reject_sensitive(summary, payload)
        old = replace(current, status="SUPERSEDED")
        new = replace(
            current, id=str(uuid4()), summary=summary,
            source_hash=source_hash if source_hash is not None else current.source_hash,
            payload=payload if payload is not None else current.payload,
            status="ACTIVE", version=current.version + 1, supersedes_id=current.id,
        )
        self._memories[old.id] = old
        self._memories[new.id] = new
        self._append(old.id, "SUPERSEDED", actor, f"SUPERSEDED_BY:{new.id}")
        self._append(new.id, "CREATED", actor, f"SUPERSEDES:{old.id}")
        return new

    def search_active(self, scopes):
        allowed = set(scopes)
        self.expire_due()
        return sorted(
            (memory for memory in self._memories.values() if memory.status == "ACTIVE" and memory.scope in allowed),
            key=lambda memory: (memory.scope, memory.canonical_key, -memory.version),
        )

    def expire_due(self):
        now = self._clock()
        for memory_id, current in list(self._memories.items()):
            if current.status == "ACTIVE" and current.expires_at and current.expires_at <= now:
                self._memories[memory_id] = replace(current, status="EXPIRED")
                self._append(memory_id, "EXPIRED", "system:expiry", "TTL_EXPIRED")

    def get(self, memory_id):
        return self._memories[memory_id]

    def _append(self, memory_id, event_type, actor, reason=None):
        self.events.append(MemoryEvent(memory_id, event_type, actor, self._clock(), reason))

    @staticmethod
    def _authorize(scope, authorized_scopes):
        if authorized_scopes is not None and scope not in authorized_scopes:
            raise AuthorizationError(f"scope not authorized: {scope}")

    @staticmethod
    def _reject_sensitive(summary, payload):
        candidate = f"{summary}\n{payload or {}}"
        if any(pattern.search(candidate) for pattern in SECRET_PATTERNS):
            raise SensitiveDataError("credential-like material cannot be persisted")
