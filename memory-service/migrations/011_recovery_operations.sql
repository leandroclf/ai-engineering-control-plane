CREATE SCHEMA IF NOT EXISTS operations;

CREATE TABLE IF NOT EXISTS operations.backup_runs (
  backup_id UUID PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('RUNNING','SUCCESS','FAILED')),
  manifest_hash TEXT,
  destination_class TEXT,
  encrypted BOOLEAN NOT NULL,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0)
);

CREATE TABLE IF NOT EXISTS operations.restore_drills (
  drill_id UUID PRIMARY KEY,
  backup_id UUID REFERENCES operations.backup_runs(backup_id),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('RUNNING','SUCCESS','FAILED')),
  postgres_verified BOOLEAN NOT NULL DEFAULT false,
  graph_rebuilt BOOLEAN NOT NULL DEFAULT false,
  context_verified BOOLEAN NOT NULL DEFAULT false,
  smoke_run_verified BOOLEAN NOT NULL DEFAULT false
);

CREATE OR REPLACE VIEW operations.last_successful_restore AS
SELECT drill_id, backup_id, finished_at AS last_successful_restore_at
FROM operations.restore_drills WHERE status='SUCCESS'
ORDER BY finished_at DESC LIMIT 1;
