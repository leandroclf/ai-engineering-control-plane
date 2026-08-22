CREATE TABLE IF NOT EXISTS memory.index_references (
  repository_id TEXT NOT NULL,
  path TEXT NOT NULL,
  target TEXT NOT NULL,
  line INTEGER NOT NULL CHECK (line > 0),
  reference_kind TEXT NOT NULL DEFAULT 'import',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (repository_id, path, target, line),
  FOREIGN KEY (repository_id, path)
    REFERENCES memory.index_files(repository_id, path) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS index_references_target_idx
  ON memory.index_references(repository_id, target);
