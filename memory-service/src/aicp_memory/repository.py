from datetime import datetime, timezone
import json

from aicp_memory.domain.ledger import AuthorizationError, Memory, SensitiveDataError


def _scope_parts(scope):
    scope_type, separator, scope_key = scope.partition(":")
    if not separator or not scope_key:
        raise ValueError("scope must use TYPE:key format")
    return scope_type, scope_key


def _memory(row):
    return Memory(
        id=str(row["id"]), scope=row["scope"], canonical_key=row["canonical_key"],
        summary=row["summary"], authority=row["authority"], source_hash=row["source_hash"],
        status=row["status"], kind=row["kind"], version=row["version"],
        payload=row["payload"], confidence=float(row["confidence"]) if row["confidence"] is not None else None,
        expires_at=row["expires_at"], supersedes_id=str(row["supersedes_id"]) if row["supersedes_id"] else None,
        policy_version=row["policy_version"], schema_version=row["schema_version"],
    )


MEMORY_SELECT = """
SELECT m.*, s.scope_type || ':' || s.scope_key AS scope
FROM memory.memories m JOIN memory.scopes s ON s.id = m.scope_id
"""


class PostgresMemoryRepository:
    def __init__(self, database_url, connect=None):
        self.database_url = database_url
        self._connect_override = connect

    def _connect(self):
        if self._connect_override:
            return self._connect_override()
        import psycopg
        from psycopg.rows import dict_row
        return psycopg.connect(self.database_url, row_factory=dict_row)

    def ready(self):
        with self._connect() as connection, connection.cursor() as cursor:
            return cursor.execute("SELECT 1 AS ready").fetchone()["ready"] == 1

    @staticmethod
    def _scope_id(cursor, scope):
        scope_type, scope_key = _scope_parts(scope)
        row = cursor.execute(
            """INSERT INTO memory.scopes(scope_type, scope_key)
               VALUES (%s, %s) ON CONFLICT(scope_type, scope_key)
               DO UPDATE SET scope_key = EXCLUDED.scope_key RETURNING id""",
            (scope_type, scope_key),
        ).fetchone()
        return row["id"]

    @staticmethod
    def _event(cursor, memory_id, event_type, actor, reason=None, payload=None):
        actor_type, separator, actor_id = actor.partition(":")
        cursor.execute(
            """INSERT INTO memory.memory_events
               (memory_id, event_type, actor_type, actor_id, reason, payload)
               VALUES (%s, %s, %s, %s, %s, %s::jsonb)""",
            (memory_id, event_type, actor_type if separator else "service", actor_id if separator else actor,
             reason, json.dumps(payload or {})),
        )

    def create_candidate(
        self, *, scope, canonical_key, summary, authority, source_hash=None,
        kind="FACT", payload=None, confidence=None, expires_at=None,
        idempotency_key=None, policy_version=None, schema_version=None,
    ):
        from aicp_memory.domain.ledger import MemoryLedger
        MemoryLedger._reject_sensitive(summary, payload)
        with self._connect() as connection, connection.cursor() as cursor:
            if idempotency_key:
                existing = cursor.execute(
                    MEMORY_SELECT + " WHERE m.idempotency_key = %s", (idempotency_key,),
                ).fetchone()
                if existing:
                    return _memory(existing)
            scope_id = self._scope_id(cursor, scope)
            row = cursor.execute(
                """INSERT INTO memory.memories
                   (scope_id, canonical_key, kind, status, summary, payload, confidence,
                    authority, source_hash, expires_at, idempotency_key, policy_version, schema_version)
                   VALUES (%s, %s, %s, 'CANDIDATE', %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (scope_id, canonical_key, kind, summary, json.dumps(payload or {}), confidence,
                 authority, source_hash, expires_at, idempotency_key, policy_version, schema_version),
            ).fetchone()
            self._event(cursor, row["id"], "CREATED", "service:memory-api")
            result = cursor.execute(MEMORY_SELECT + " WHERE m.id = %s", (row["id"],)).fetchone()
        return _memory(result)

    def get(self, memory_id):
        with self._connect() as connection, connection.cursor() as cursor:
            row = cursor.execute(MEMORY_SELECT + " WHERE m.id = %s", (memory_id,)).fetchone()
        if not row:
            raise KeyError(memory_id)
        return _memory(row)

    def promote(self, memory_id, target_scope, actor, authorized_scopes=None):
        if authorized_scopes is not None and target_scope not in authorized_scopes:
            raise AuthorizationError(f"scope not authorized: {target_scope}")
        with self._connect() as connection, connection.cursor() as cursor:
            current = cursor.execute(MEMORY_SELECT + " WHERE m.id = %s FOR UPDATE", (memory_id,)).fetchone()
            if not current or current["status"] != "CANDIDATE":
                raise ValueError("only candidate memory can be promoted")
            scope_id = self._scope_id(cursor, target_scope)
            cursor.execute("UPDATE memory.memories SET scope_id=%s, status='ACTIVE', updated_at=now() WHERE id=%s", (scope_id, memory_id))
            self._event(cursor, memory_id, "PROMOTED", actor)
            result = cursor.execute(MEMORY_SELECT + " WHERE m.id = %s", (memory_id,)).fetchone()
        return _memory(result)

    def invalidate(self, memory_id, actor, reason):
        with self._connect() as connection, connection.cursor() as cursor:
            row = cursor.execute(
                """UPDATE memory.memories SET status='INVALIDATED', updated_at=now()
                   WHERE id=%s AND status IN ('CANDIDATE','ACTIVE') RETURNING id""", (memory_id,),
            ).fetchone()
            if not row:
                raise ValueError("only current memory can be invalidated")
            self._event(cursor, memory_id, "INVALIDATED", actor, reason)
            result = cursor.execute(MEMORY_SELECT + " WHERE m.id = %s", (memory_id,)).fetchone()
        return _memory(result)

    def invalidate_stale_source(self, memory_id, current_source_hash, actor):
        current = self.get(memory_id)
        return current if current.source_hash == current_source_hash else self.invalidate(memory_id, actor, "SOURCE_HASH_CHANGED")

    def supersede(self, memory_id, *, summary, actor, source_hash=None, payload=None):
        from aicp_memory.domain.ledger import MemoryLedger
        MemoryLedger._reject_sensitive(summary, payload)
        with self._connect() as connection, connection.cursor() as cursor:
            current = cursor.execute(MEMORY_SELECT + " WHERE m.id = %s FOR UPDATE", (memory_id,)).fetchone()
            if not current or current["status"] != "ACTIVE":
                raise ValueError("only active memory can be superseded")
            cursor.execute("UPDATE memory.memories SET status='SUPERSEDED', updated_at=now() WHERE id=%s", (memory_id,))
            new = cursor.execute(
                """INSERT INTO memory.memories
                   (scope_id, canonical_key, kind, status, version, summary, payload, confidence,
                    authority, source_hash, expires_at, supersedes_id, policy_version, schema_version)
                   VALUES (%s,%s,%s,'ACTIVE',%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                (current["scope_id"], current["canonical_key"], current["kind"], current["version"] + 1,
                 summary, json.dumps(payload if payload is not None else current["payload"]), current["confidence"],
                 current["authority"], source_hash if source_hash is not None else current["source_hash"],
                 current["expires_at"], memory_id, current["policy_version"], current["schema_version"]),
            ).fetchone()
            self._event(cursor, memory_id, "SUPERSEDED", actor, f"SUPERSEDED_BY:{new['id']}")
            self._event(cursor, new["id"], "CREATED", actor, f"SUPERSEDES:{memory_id}")
            result = cursor.execute(MEMORY_SELECT + " WHERE m.id = %s", (new["id"],)).fetchone()
        return _memory(result)

    def expire_due(self):
        with self._connect() as connection, connection.cursor() as cursor:
            rows = cursor.execute(
                """UPDATE memory.memories SET status='EXPIRED', updated_at=now()
                   WHERE status='ACTIVE' AND expires_at <= now() RETURNING id"""
            ).fetchall()
            for row in rows:
                self._event(cursor, row["id"], "EXPIRED", "system:expiry", "TTL_EXPIRED")

    def search_active(self, scopes):
        self.expire_due()
        if not scopes:
            return []
        with self._connect() as connection, connection.cursor() as cursor:
            rows = cursor.execute(
                MEMORY_SELECT + """ WHERE m.status='ACTIVE'
                  AND (s.scope_type || ':' || s.scope_key) = ANY(%s)
                  ORDER BY s.scope_type, s.scope_key, m.canonical_key, m.version DESC""",
                (list(scopes),),
            ).fetchall()
        return [_memory(row) for row in rows]
