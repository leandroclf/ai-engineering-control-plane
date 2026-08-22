ALTER TABLE memory.scopes DROP CONSTRAINT IF EXISTS scopes_scope_type_check;
ALTER TABLE memory.scopes ADD CONSTRAINT scopes_scope_type_check
  CHECK (scope_type IN ('GLOBAL','ORGANIZATION','SOLUTION','PROJECT','REPOSITORY','AGENT','TASK','RUN','EXECUTION'));
ALTER TABLE memory.scopes ADD COLUMN IF NOT EXISTS canonical_path TEXT;
UPDATE memory.scopes SET canonical_path = '/' || lower(scope_type) || '/' || scope_key
 WHERE canonical_path IS NULL;
ALTER TABLE memory.scopes ALTER COLUMN canonical_path SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS memory_scope_path_uq ON memory.scopes(canonical_path);
ALTER TABLE memory.scopes DROP CONSTRAINT IF EXISTS scopes_scope_type_scope_key_key;

ALTER TABLE memory.index_symbols ADD COLUMN IF NOT EXISTS symbol_id TEXT;
WITH identities AS (
  SELECT ctid, repository_id, path, qualified_name, symbol_kind, metadata,
    row_number() OVER (PARTITION BY repository_id,
      coalesce(metadata->>'language','unknown'), coalesce(metadata->>'semantic_container',path),
      qualified_name, symbol_kind, coalesce(metadata->>'signature_hash','') ORDER BY line_start) AS occurrence
  FROM memory.index_symbols
)
UPDATE memory.index_symbols target SET symbol_id = encode(digest(
  source.repository_id || E'\x1f' || coalesce(source.metadata->>'language','unknown') || E'\x1f' ||
  coalesce(source.metadata->>'semantic_container',source.path) || E'\x1f' || source.qualified_name || E'\x1f' ||
  source.symbol_kind || E'\x1f' || coalesce(source.metadata->>'signature_hash','') || E'\x1f' || source.occurrence, 'sha256'), 'hex')
FROM identities source WHERE target.ctid=source.ctid;
ALTER TABLE memory.index_symbols ALTER COLUMN symbol_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS index_symbols_stable_id_uq ON memory.index_symbols(symbol_id);
