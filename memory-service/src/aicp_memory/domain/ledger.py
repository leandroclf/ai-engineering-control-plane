from dataclasses import dataclass, replace
from datetime import datetime, timezone
from uuid import uuid4


@dataclass(frozen=True)
class Memory:
    id: str
    scope: str
    canonical_key: str
    summary: str
    authority: str
    source_hash: str | None
    status: str = "CANDIDATE"


@dataclass(frozen=True)
class MemoryEvent:
    memory_id: str
    event_type: str
    actor: str
    occurred_at: datetime


class MemoryLedger:
    def __init__(self):
        self._memories: dict[str, Memory] = {}
        self.events: list[MemoryEvent] = []

    def create_candidate(self, *, scope, canonical_key, summary, authority, source_hash=None):
        memory = Memory(str(uuid4()), scope, canonical_key, summary, authority, source_hash)
        self._memories[memory.id] = memory
        self._append(memory.id, "CREATED", "system")
        return memory

    def promote(self, memory_id, target_scope, actor):
        current = self.get(memory_id)
        if current.status != "CANDIDATE":
            raise ValueError("only candidate memory can be promoted")
        promoted = replace(current, scope=target_scope, status="ACTIVE")
        self._memories[memory_id] = promoted
        self._append(memory_id, "PROMOTED", actor)
        return promoted

    def invalidate_stale_source(self, memory_id, current_source_hash, actor):
        current = self.get(memory_id)
        if current.source_hash == current_source_hash:
            return current
        invalidated = replace(current, status="INVALIDATED")
        self._memories[memory_id] = invalidated
        self._append(memory_id, "INVALIDATED", actor)
        return invalidated

    def search_active(self, scopes):
        allowed = set(scopes)
        return [memory for memory in self._memories.values() if memory.status == "ACTIVE" and memory.scope in allowed]

    def get(self, memory_id):
        return self._memories[memory_id]

    def _append(self, memory_id, event_type, actor):
        self.events.append(MemoryEvent(memory_id, event_type, actor, datetime.now(timezone.utc)))
