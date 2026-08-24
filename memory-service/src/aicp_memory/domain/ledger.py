from dataclasses import asdict, dataclass, replace
from datetime import datetime, timedelta, timezone
import re
from uuid import uuid4


class AuthorizationError(PermissionError):
    pass


class SensitiveDataError(ValueError):
    pass


class MemoryPromotionPolicy:
    MIN_LLM_CONFIDENCE = .80

    @classmethod
    def validate(cls, memory):
        if memory.authority == "LLM_INFERENCE" and memory.kind == "POLICY":
            raise ValueError("LLM inference cannot be promoted as policy")
        if memory.authority == "LLM_INFERENCE" and (memory.confidence or 0) < cls.MIN_LLM_CONFIDENCE:
            raise ValueError("LLM inference lacks promotion confidence")


SECRET_PATTERNS = (
    re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"\bgh[opusr]_[A-Za-z0-9]{12,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{12,}\b"),
    re.compile(r"\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b", re.IGNORECASE),
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
        idempotency_key=None, policy_version=None, schema_version=None, source_refs=None, parent_scope=None,
    ):
        if idempotency_key and idempotency_key in self._idempotency:
            return self.get(self._idempotency[idempotency_key])
        self._reject_sensitive(summary, payload)
        if expires_at is None and authority == "LLM_INFERENCE":
            expires_at = self._clock() + timedelta(days=7)
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
        MemoryPromotionPolicy.validate(current)
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
            if current.status in {"CANDIDATE", "ACTIVE"} and current.expires_at and current.expires_at <= now:
                self._memories[memory_id] = replace(current, status="EXPIRED")
                self._append(memory_id, "EXPIRED", "system:expiry", "TTL_EXPIRED")

    def get(self, memory_id):
        return self._memories[memory_id]

    def create_skill(self, *, name, version, created_by, capabilities=None, domain=None, metadata=None, fingerprint=""):
        if not name or not version or not created_by:
            raise ValueError("skill name, version and created_by are required")
        self._reject_sensitive(name, {"metadata": metadata or {}, "capabilities": capabilities or []})
        skill = {"name": name, "version": version, "created_by": created_by, "capabilities": capabilities or [],
                 "domain": domain, "metadata": metadata or {}, "status": "EXPERIMENTAL", "fingerprint": fingerprint,
                 "lifecycle": []}
        self._skills = getattr(self, "_skills", {})
        self._skills[f"{name}@{version}"] = skill
        return skill

    def list_skills(self, *, status=None, capability=None):
        skills = list(getattr(self, "_skills", {}).values())
        return [skill for skill in skills if (status is None or skill["status"] == status) and
                (capability is None or capability in skill["capabilities"])]

    def transition_skill(self, name, version, status, actor, evidence=None):
        transitions = {"EXPERIMENTAL": {"VALIDATED", "REJECTED"}, "VALIDATED": {"PROMOTED", "DEPRECATED"},
                       "PROMOTED": {"DEPRECATED"}, "DEPRECATED": set(), "REJECTED": set()}
        skill = getattr(self, "_skills", {}).get(f"{name}@{version}")
        if not skill or status not in transitions[skill["status"]]:
            raise ValueError("invalid skill transition")
        if status in {"VALIDATED", "PROMOTED"} and not evidence:
            raise ValueError("skill transition requires evidence")
        skill["status"] = status
        skill["lifecycle"].append({"status": status, "actor": actor, "evidence": evidence or []})
        return skill

    def record_episode(self, episode):
        self._reject_sensitive(episode.get("trace_id", ""), episode)
        self._episodes = getattr(self, "_episodes", {})
        if not episode.get("trace_id"):
            raise ValueError("trace_id is required")
        self._episodes[episode["trace_id"]] = dict(episode)
        return self._episodes[episode["trace_id"]]

    def list_episodes(self, project_id=None):
        return [item for item in getattr(self, "_episodes", {}).values() if project_id is None or item.get("project_id") == project_id]

    def record_failure_pattern(self, pattern):
        if not pattern.get("name") or not pattern.get("signature"):
            raise ValueError("failure pattern name and signature are required")
        self._reject_sensitive(pattern["name"], pattern)
        self._failure_patterns = getattr(self, "_failure_patterns", {})
        self._failure_patterns[pattern["name"]] = {**pattern, "status": pattern.get("status", "EXPERIMENTAL")}
        return self._failure_patterns[pattern["name"]]

    def list_failure_patterns(self, status=None):
        return [item for item in getattr(self, "_failure_patterns", {}).values() if status is None or item["status"] == status]

    def upsert_browser_session(self, session):
        if not session.get("session_id") or not session.get("agent_id") or not session.get("project_id"):
            raise ValueError("session_id, agent_id and project_id are required")
        safe = {key: value for key, value in session.items() if key not in {"token", "password", "secret", "credentials"}}
        self._reject_sensitive(safe["session_id"], safe)
        self._browser_sessions = getattr(self, "_browser_sessions", {})
        self._browser_sessions[safe["session_id"]] = safe
        return safe

    def list_browser_sessions(self, agent_id=None, project_id=None):
        return [item for item in getattr(self, "_browser_sessions", {}).values()
                if (agent_id is None or item.get("agent_id") == agent_id) and (project_id is None or item.get("project_id") == project_id)]

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
