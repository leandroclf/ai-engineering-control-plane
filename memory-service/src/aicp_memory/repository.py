from datetime import datetime, timedelta, timezone
from hashlib import sha256
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

    def create_skill(self, skill):
        from aicp_memory.domain.ledger import MemoryLedger
        MemoryLedger._reject_sensitive(skill["name"], skill)
        with self._connect() as connection, connection.cursor() as cursor:
            row = cursor.execute("""INSERT INTO agent_harness.skills(name,version,domain,capabilities,metadata,created_by,fingerprint)
              VALUES(%s,%s,%s,%s::jsonb,%s::jsonb,%s,%s)
              ON CONFLICT(name,version) DO UPDATE SET updated_at=now() RETURNING *""",
              (skill["name"], skill["version"], skill.get("domain"), json.dumps(skill.get("capabilities", [])), json.dumps(skill.get("metadata", {})), skill["created_by"], skill["fingerprint"])).fetchone()
        return dict(row)

    def list_skills(self, status=None, capability=None):
        query = "SELECT * FROM agent_harness.skills WHERE (%s::text IS NULL OR status=%s::text) AND (%s::text IS NULL OR capabilities @> %s::jsonb) ORDER BY name,version"
        with self._connect() as connection, connection.cursor() as cursor:
            return [dict(row) for row in cursor.execute(query, (status, status, capability, json.dumps([capability]) if capability else json.dumps([]))).fetchall()]

    def transition_skill(self, name, version, status, actor, evidence):
        with self._connect() as connection, connection.cursor() as cursor:
            row = cursor.execute("""UPDATE agent_harness.skills SET status=%s, lifecycle=lifecycle || %s::jsonb, updated_at=now()
              WHERE name=%s AND version=%s AND ((status='EXPERIMENTAL' AND %s IN ('VALIDATED','REJECTED')) OR (status='VALIDATED' AND %s IN ('PROMOTED','DEPRECATED')) OR (status='PROMOTED' AND %s='DEPRECATED')) RETURNING *""",
              (status, json.dumps([{ "status": status, "actor": actor, "evidence": evidence }]), name, version, status, status, status)).fetchone()
            if not row: raise ValueError("invalid skill transition")
        return dict(row)

    def record_episode(self, episode):
        from aicp_memory.domain.ledger import MemoryLedger
        MemoryLedger._reject_sensitive(episode["trace_id"], episode)
        with self._connect() as connection, connection.cursor() as cursor:
            row = cursor.execute("""INSERT INTO agent_harness.execution_episodes(task_id,trace_id,agent_id,project_id,status,retries,duration_ms,evaluation,actions,observations)
              VALUES(%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s::jsonb,%s::jsonb) ON CONFLICT(trace_id) DO UPDATE SET status=EXCLUDED.status,evaluation=EXCLUDED.evaluation RETURNING *""",
              (episode.get("task_id"), episode["trace_id"], episode["agent_id"], episode["project_id"], episode["status"], episode.get("retries", 0), episode.get("duration_ms"), json.dumps(episode.get("evaluation", {})), json.dumps(episode.get("actions", [])), json.dumps(episode.get("observations", [])))).fetchone()
        return dict(row)

    def list_episodes(self, project_id=None):
        with self._connect() as connection, connection.cursor() as cursor:
            return [dict(row) for row in cursor.execute("SELECT * FROM agent_harness.execution_episodes WHERE %s::text IS NULL OR project_id=%s::text ORDER BY created_at DESC", (project_id, project_id)).fetchall()]

    def record_failure_pattern(self, pattern):
        from aicp_memory.domain.ledger import MemoryLedger
        MemoryLedger._reject_sensitive(pattern["name"], pattern)
        with self._connect() as connection, connection.cursor() as cursor:
            row = cursor.execute("""INSERT INTO agent_harness.failure_patterns(name,signature,symptoms,diagnostics,recovery,confidence,status,source_trace_id)
              VALUES(%s,%s,%s::jsonb,%s::jsonb,%s::jsonb,%s,%s,%s) ON CONFLICT(name) DO UPDATE SET confidence=EXCLUDED.confidence,recovery=EXCLUDED.recovery,updated_at=now() RETURNING *""",
              (pattern["name"], pattern["signature"], json.dumps(pattern.get("symptoms", [])), json.dumps(pattern.get("diagnostics", [])), json.dumps(pattern.get("recovery", {})), pattern.get("confidence", 0), pattern.get("status", "EXPERIMENTAL"), pattern.get("source_trace_id"))).fetchone()
        return dict(row)

    def list_failure_patterns(self, status=None):
        with self._connect() as connection, connection.cursor() as cursor:
            return [dict(row) for row in cursor.execute("SELECT * FROM agent_harness.failure_patterns WHERE %s::text IS NULL OR status=%s::text ORDER BY confidence DESC,name", (status, status)).fetchall()]

    def upsert_browser_session(self, session):
        safe = {key: value for key, value in session.items() if key not in {"token", "password", "secret", "credentials"}}
        from aicp_memory.domain.ledger import MemoryLedger
        MemoryLedger._reject_sensitive(safe["session_id"], safe)
        with self._connect() as connection, connection.cursor() as cursor:
            row = cursor.execute("""INSERT INTO agent_harness.browser_sessions(session_id,profile_id,agent_id,project_id,status,metadata,expires_at)
              VALUES(%s,%s,%s,%s,%s,%s::jsonb,%s) ON CONFLICT(session_id) DO UPDATE SET status=EXCLUDED.status,metadata=EXCLUDED.metadata,expires_at=EXCLUDED.expires_at RETURNING *""",
              (safe["session_id"], safe.get("profile_id"), safe["agent_id"], safe["project_id"], safe.get("status", "ACTIVE"), json.dumps(safe.get("metadata", {})), safe.get("expires_at"))).fetchone()
        return dict(row)

    def list_browser_sessions(self, agent_id=None, project_id=None):
        with self._connect() as connection, connection.cursor() as cursor:
            return [dict(row) for row in cursor.execute("SELECT * FROM agent_harness.browser_sessions WHERE (%s::text IS NULL OR agent_id=%s::text) AND (%s::text IS NULL OR project_id=%s::text) ORDER BY created_at DESC", (agent_id, agent_id, project_id, project_id)).fetchall()]

    @staticmethod
    def _scope_id(cursor, scope, parent_scope=None):
        scope_type, scope_key = _scope_parts(scope)
        parent_id = None
        parent_path = ""
        if parent_scope:
            parent_id = PostgresMemoryRepository._scope_id(cursor, parent_scope)
            parent_path = cursor.execute("SELECT canonical_path FROM memory.scopes WHERE id=%s", (parent_id,)).fetchone()["canonical_path"]
        canonical_path = parent_path + "/" + scope_type.lower() + "/" + scope_key.strip("/")
        row = cursor.execute(
            """INSERT INTO memory.scopes(scope_type, scope_key, canonical_path, parent_id)
               VALUES (%s, %s, %s, %s) ON CONFLICT(canonical_path)
               DO UPDATE SET parent_id = EXCLUDED.parent_id RETURNING id""",
            (scope_type, scope_key, canonical_path, parent_id),
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
        idempotency_key=None, policy_version=None, schema_version=None, source_refs=None, parent_scope=None,
    ):
        from aicp_memory.domain.ledger import MemoryLedger
        MemoryLedger._reject_sensitive(summary, payload)
        if expires_at is None and authority == "LLM_INFERENCE":
            expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        with self._connect() as connection, connection.cursor() as cursor:
            if idempotency_key:
                existing = cursor.execute(
                    MEMORY_SELECT + " WHERE m.idempotency_key = %s", (idempotency_key,),
                ).fetchone()
                if existing:
                    return _memory(existing)
            scope_id = self._scope_id(cursor, scope, parent_scope)
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
            for source in source_refs or []:
                cursor.execute(
                    """INSERT INTO memory.source_refs(memory_id,repo_id,commit_sha,path,symbol,line_start,line_end,content_hash,metadata)
                       VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)""",
                    (row["id"], source.get("repository") or source.get("repo_id"), source.get("commit") or source.get("commit_sha"),
                     source.get("path"), source.get("symbol"), source.get("line_start"), source.get("line_end"),
                     source.get("content_hash"), json.dumps(source.get("metadata") or {})),
                )
            result = cursor.execute(MEMORY_SELECT + " WHERE m.id = %s", (row["id"],)).fetchone()
        return _memory(result)

    def get(self, memory_id):
        with self._connect() as connection, connection.cursor() as cursor:
            row = cursor.execute(MEMORY_SELECT + " WHERE m.id = %s", (memory_id,)).fetchone()
        if not row:
            raise KeyError(memory_id)
        return _memory(row)

    def promote(self, memory_id, target_scope, actor, authorized_scopes=None):
        from aicp_memory.domain.ledger import MemoryPromotionPolicy
        if authorized_scopes is not None and target_scope not in authorized_scopes:
            raise AuthorizationError(f"scope not authorized: {target_scope}")
        with self._connect() as connection, connection.cursor() as cursor:
            current = cursor.execute(MEMORY_SELECT + " WHERE m.id = %s FOR UPDATE", (memory_id,)).fetchone()
            if not current or current["status"] != "CANDIDATE":
                raise ValueError("only candidate memory can be promoted")
            if current["expires_at"] and current["expires_at"] <= datetime.now(timezone.utc):
                cursor.execute("UPDATE memory.memories SET status='EXPIRED', updated_at=now() WHERE id=%s", (memory_id,))
                self._event(cursor, memory_id, "EXPIRED", "system:expiry", "TTL_EXPIRED")
                raise ValueError("expired candidate memory cannot be promoted")
            MemoryPromotionPolicy.validate(_memory(current))
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
                   WHERE status IN ('CANDIDATE','ACTIVE') AND expires_at <= now() RETURNING id"""
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

    def index_state(self, repository):
        with self._connect() as connection, connection.cursor() as cursor:
            rows = cursor.execute(
                """SELECT path, git_blob_oid AS oid, parser_version, index_schema_version AS schema_version,
                          indexed_commit AS commit
                   FROM memory.index_files WHERE repository_id=%s ORDER BY path""",
                (repository,),
            ).fetchall()
        return {"repository": repository, "files": rows}

    def cached_embedding(self, chunk_id, content_hash, model, dimensions):
        with self._connect() as connection, connection.cursor() as cursor:
            row = cursor.execute(
                """SELECT embedding FROM memory.index_chunks
                   WHERE id=%s AND embedded_content_hash=%s AND embedding_model=%s
                     AND embedding_dimensions=%s""",
                (chunk_id, content_hash, model, dimensions),
            ).fetchone()
        return row["embedding"] if row else None

    def sync_index(self, repository, payload, rebuild=False):
        with self._connect() as connection, connection.cursor() as cursor:
            invalidated = self._invalidate_changed_sources(cursor, repository, payload)
            if rebuild:
                cursor.execute("DELETE FROM memory.index_chunks WHERE repository_id=%s", (repository,))
                cursor.execute("DELETE FROM memory.index_symbols WHERE repository_id=%s", (repository,))
                cursor.execute("DELETE FROM memory.index_references WHERE repository_id=%s", (repository,))
                cursor.execute("DELETE FROM memory.index_files WHERE repository_id=%s", (repository,))
            paths = sorted(set(payload.get("deleted", [])) | {item["path"] for item in payload.get("files", [])})
            if paths:
                cursor.execute("DELETE FROM memory.index_chunks WHERE repository_id=%s AND path=ANY(%s)", (repository, paths))
                cursor.execute("DELETE FROM memory.index_symbols WHERE repository_id=%s AND path=ANY(%s)", (repository, paths))
                cursor.execute("DELETE FROM memory.index_references WHERE repository_id=%s AND path=ANY(%s)", (repository, paths))
                cursor.execute("DELETE FROM memory.index_files WHERE repository_id=%s AND path=ANY(%s)", (repository, paths))
            for source_file in payload.get("files", []):
                cursor.execute(
                    """INSERT INTO memory.index_files
                       (repository_id,path,git_blob_oid,parser_version,index_schema_version,indexed_commit)
                       VALUES (%s,%s,%s,%s,%s,%s)""",
                    (repository, source_file["path"], source_file["oid"], payload["parser_version"],
                     payload["schema_version"], payload.get("commit")),
                )
                occurrences = {}
                for symbol in source_file.get("symbols", []):
                    semantic_key = (symbol.get("language", "javascript"), symbol.get("semanticContainer", source_file["path"]),
                                    symbol["qualifiedName"], symbol["kind"], symbol.get("signatureHash", ""))
                    occurrences[semantic_key] = occurrences.get(semantic_key, 0) + 1
                    symbol_identity = "\0".join((repository, symbol.get("language", "javascript"),
                        symbol.get("semanticContainer", source_file["path"]), symbol["qualifiedName"],
                        symbol["kind"], symbol.get("signatureHash", ""), str(occurrences[semantic_key])))
                    cursor.execute(
                        """INSERT INTO memory.index_symbols
                           (repository_id,path,qualified_name,symbol_kind,line_start,line_end,content_hash,parser_version,metadata,symbol_id)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s)""",
                        (repository, source_file["path"], symbol["qualifiedName"], symbol["kind"],
                         symbol["lineStart"], symbol["lineEnd"], source_file["oid"], payload["parser_version"], "{}",
                         sha256(symbol_identity.encode()).hexdigest()),
                    )

                for reference in source_file.get("references", []):
                    cursor.execute(
                        """INSERT INTO memory.index_references
                           (repository_id,path,target,line,reference_kind)
                           VALUES (%s,%s,%s,%s,%s)""",
                        (repository, source_file["path"], reference["target"], reference["line"],
                         reference.get("kind", "import")),
                    )
                for chunk in source_file.get("chunks", []):
                    cursor.execute(
                        """INSERT INTO memory.index_chunks
                           (id,repository_id,path,symbol,content,content_hash,token_count,embedding,
                            embedding_model,embedding_dimensions,embedded_content_hash,metadata)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb,%s,%s,%s,%s::jsonb)""",
                        (chunk["id"], repository, source_file["path"], chunk.get("symbol"), chunk["content"],
                         chunk["content_hash"], chunk["token_count"], json.dumps(chunk["embedding"]),
                         chunk["embedding_model"], chunk["embedding_dimensions"], chunk["content_hash"],
                        json.dumps(chunk.get("provenance") or {})),
                    )
        return invalidated

    def invalidate_changed_sources(self, repository, payload):
        with self._connect() as connection, connection.cursor() as cursor:
            return self._invalidate_changed_sources(cursor, repository, payload)

    def _invalidate_changed_sources(self, cursor, repository, payload):
        changed = {item["path"]: item.get("oid") for item in payload.get("files", [])}
        deleted = set(payload.get("deleted", []))
        if not changed and not deleted:
            return 0
        result = cursor.execute(
            """SELECT DISTINCT m.id, sr.path, sr.content_hash
               FROM memory.memories m JOIN memory.source_refs sr ON sr.memory_id=m.id
               WHERE m.status IN ('CANDIDATE','ACTIVE') AND sr.repo_id=%s
                 AND (sr.path=ANY(%s) OR sr.path=ANY(%s)) FOR UPDATE OF m""",
            (repository, list(changed), list(deleted)),
        )
        rows = result.fetchall() if hasattr(result, "fetchall") else []
        invalidated = 0
        for row in rows:
            current_hash = changed.get(row["path"])
            if row["path"] in deleted or current_hash != row["content_hash"]:
                cursor.execute("UPDATE memory.memories SET status='INVALIDATED',updated_at=now() WHERE id=%s", (row["id"],))
                cursor.execute("""INSERT INTO memory.reconciliation_events(memory_id,source_hash_before,source_hash_after,outcome,reason)
                    VALUES(%s,%s,%s,'INVALIDATED',%s)""", (row["id"], row["content_hash"], current_hash,
                    "SOURCE_DELETED" if row["path"] in deleted else "SOURCE_HASH_CHANGED"))
                self._event(cursor, row["id"], "INVALIDATED", "system:index-sync",
                            "SOURCE_DELETED" if row["path"] in deleted else "SOURCE_HASH_CHANGED")
                invalidated += 1
        return invalidated

    def retrieve_chunks(self, repository, query, exact_symbols=None, limit=50):
        with self._connect() as connection, connection.cursor() as cursor:
            rows = cursor.execute(
                """SELECT id,path,symbol,content,content_hash,token_count,embedding
                   FROM memory.index_chunks WHERE repository_id=%s
                   ORDER BY CASE WHEN lower(coalesce(symbol, '')) = ANY(%s) THEN 0 ELSE 1 END,
                            ts_rank(search_document, plainto_tsquery('simple', %s)) DESC, id
                   LIMIT %s""",
                (repository, list(exact_symbols or []), query, limit),
            ).fetchall()
        return rows
