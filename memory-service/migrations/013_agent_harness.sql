CREATE SCHEMA IF NOT EXISTS agent_harness;

CREATE TABLE IF NOT EXISTS agent_harness.skills (
  skill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  domain TEXT,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'EXPERIMENTAL' CHECK (status IN ('EXPERIMENTAL','VALIDATED','PROMOTED','DEPRECATED','REJECTED')),
  created_by TEXT NOT NULL,
  success_rate NUMERIC(5,4) CHECK (success_rate IS NULL OR success_rate BETWEEN 0 AND 1),
  fingerprint TEXT NOT NULL,
  lifecycle JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, version)
);

CREATE TABLE IF NOT EXISTS agent_harness.execution_episodes (
  episode_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID,
  trace_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS','FAILED','RETRYING','ESCALATED')),
  retries INTEGER NOT NULL DEFAULT 0 CHECK (retries >= 0),
  duration_ms BIGINT CHECK (duration_ms IS NULL OR duration_ms >= 0),
  evaluation JSONB NOT NULL DEFAULT '{}'::jsonb,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  observations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trace_id)
);

CREATE TABLE IF NOT EXISTS agent_harness.failure_patterns (
  pattern_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  signature TEXT NOT NULL,
  symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  diagnostics JSONB NOT NULL DEFAULT '[]'::jsonb,
  recovery JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(5,4) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  status TEXT NOT NULL DEFAULT 'EXPERIMENTAL' CHECK (status IN ('EXPERIMENTAL','VALIDATED','PROMOTED','DEPRECATED','REJECTED')),
  source_trace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_harness.browser_sessions (
  session_id TEXT PRIMARY KEY,
  profile_id TEXT,
  agent_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','CLOSED','EXPIRED','REVOKED')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS execution_episodes_project_idx ON agent_harness.execution_episodes(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS browser_sessions_scope_idx ON agent_harness.browser_sessions(agent_id, project_id, status);
