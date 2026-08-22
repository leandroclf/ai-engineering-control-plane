ALTER TABLE memory.memories
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS policy_version TEXT,
  ADD COLUMN IF NOT EXISTS schema_version TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS memories_idempotency_key_idx
  ON memory.memories(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS memories_current_idx
  ON memory.memories(scope_id, canonical_key, status, version DESC);
CREATE INDEX IF NOT EXISTS memories_expiry_idx
  ON memory.memories(expires_at)
  WHERE expires_at IS NOT NULL AND status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS memories_payload_idx
  ON memory.memories USING GIN(payload);
CREATE INDEX IF NOT EXISTS source_refs_repo_path_idx
  ON memory.source_refs(repo_id, path);

CREATE TABLE IF NOT EXISTS memory.index_files (
  repository_id TEXT NOT NULL,
  path TEXT NOT NULL,
  git_blob_oid TEXT,
  fallback_sha256 TEXT,
  parser_version TEXT NOT NULL,
  index_schema_version TEXT NOT NULL,
  indexed_commit TEXT,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (repository_id, path)
);

CREATE TABLE IF NOT EXISTS memory.index_symbols (
  repository_id TEXT NOT NULL,
  path TEXT NOT NULL,
  qualified_name TEXT NOT NULL,
  symbol_kind TEXT NOT NULL,
  line_start INTEGER NOT NULL CHECK (line_start > 0),
  line_end INTEGER NOT NULL CHECK (line_end >= line_start),
  content_hash TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (repository_id, path, qualified_name)
);

CREATE TABLE IF NOT EXISTS memory.index_chunks (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL,
  path TEXT NOT NULL,
  symbol TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  token_count INTEGER NOT NULL CHECK (token_count >= 0),
  embedding JSONB,
  embedding_model TEXT,
  embedding_dimensions INTEGER,
  embedded_content_hash TEXT,
  search_document TSVECTOR GENERATED ALWAYS AS
    (to_tsvector('simple', coalesce(symbol, '') || ' ' || content)) STORED,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS index_chunks_repo_path_idx
  ON memory.index_chunks(repository_id, path);
CREATE INDEX IF NOT EXISTS index_chunks_search_idx
  ON memory.index_chunks USING GIN(search_document);

CREATE OR REPLACE FUNCTION memory.reject_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'memory events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS memory_events_append_only ON memory.memory_events;
CREATE TRIGGER memory_events_append_only
BEFORE UPDATE OR DELETE ON memory.memory_events
FOR EACH ROW EXECUTE FUNCTION memory.reject_event_mutation();
