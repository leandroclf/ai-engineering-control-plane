CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS memory;

CREATE TABLE IF NOT EXISTS memory.scopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('GLOBAL','ORGANIZATION','SOLUTION','PROJECT','REPOSITORY','AGENT','EXECUTION')),
  scope_key TEXT NOT NULL,
  parent_id UUID REFERENCES memory.scopes(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope_type, scope_key)
);

CREATE TABLE IF NOT EXISTS memory.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id UUID NOT NULL REFERENCES memory.scopes(id),
  canonical_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('FACT','DECISION','CONSTRAINT','PREFERENCE','FINDING','SUMMARY','POLICY','INFERENCE')),
  status TEXT NOT NULL CHECK (status IN ('CANDIDATE','ACTIVE','INVALIDATED','SUPERSEDED','EXPIRED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  summary TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5,4) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  authority TEXT NOT NULL CHECK (authority IN ('HUMAN','POLICY','SOURCE_CODE','CI','SCANNER','LLM_INFERENCE')),
  source_hash TEXT,
  expires_at TIMESTAMPTZ,
  supersedes_id UUID REFERENCES memory.memories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope_id, canonical_key, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_memory_per_key ON memory.memories(scope_id, canonical_key) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS memory.source_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES memory.memories(id) ON DELETE CASCADE,
  repo_id TEXT, commit_sha TEXT, path TEXT, symbol TEXT,
  line_start INTEGER, line_end INTEGER, content_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS memory.memory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES memory.memories(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('CREATED','PROMOTED','UPDATED','INVALIDATED','SUPERSEDED','EXPIRED','RESTORED')),
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  reason TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE DELETE ON memory.memory_events FROM PUBLIC;
