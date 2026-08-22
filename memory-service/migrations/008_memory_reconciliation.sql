CREATE TABLE IF NOT EXISTS memory.reconciliation_events (
  id BIGSERIAL PRIMARY KEY,
  memory_id UUID NOT NULL REFERENCES memory.memories(id) ON DELETE CASCADE,
  source_hash_before TEXT,
  source_hash_after TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('UNCHANGED','INVALIDATED','SUPERSEDED','REVIEW_REQUIRED')),
  reason TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reconciliation_events_memory_time_idx ON memory.reconciliation_events(memory_id, occurred_at);
