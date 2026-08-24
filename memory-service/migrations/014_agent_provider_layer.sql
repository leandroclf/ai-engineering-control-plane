CREATE TABLE IF NOT EXISTS control.agent_provider_executions (
  execution_id TEXT PRIMARY KEY,
  logical_invocation_id UUID NOT NULL,
  reservation_id UUID,
  task_id UUID NOT NULL REFERENCES control.tasks(id) ON DELETE CASCADE,
  run_id UUID REFERENCES control.runs(id) ON DELETE SET NULL,
  stage TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_family TEXT NOT NULL,
  runtime TEXT NOT NULL,
  auth_mode TEXT NOT NULL,
  billing_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  termination_reason TEXT NOT NULL,
  input_tokens BIGINT CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens BIGINT CHECK (output_tokens IS NULL OR output_tokens >= 0),
  cached_input_tokens BIGINT CHECK (cached_input_tokens IS NULL OR cached_input_tokens >= 0),
  provider_reported_cost_usd NUMERIC(14,6) CHECK (provider_reported_cost_usd IS NULL OR provider_reported_cost_usd >= 0),
  monetary_cost_known BOOLEAN NOT NULL DEFAULT false,
  agent_turns INTEGER CHECK (agent_turns IS NULL OR agent_turns >= 0),
  wall_time_ms BIGINT CHECK (wall_time_ms IS NULL OR wall_time_ms >= 0),
  mutation_started BOOLEAN NOT NULL DEFAULT false,
  before_tree TEXT,
  after_tree TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS agent_provider_executions_run_idx ON control.agent_provider_executions(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_provider_executions_task_idx ON control.agent_provider_executions(task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS control.provider_quota_limits (
  provider_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  max_concurrent INTEGER NOT NULL CHECK (max_concurrent > 0),
  max_calls_per_task INTEGER NOT NULL CHECK (max_calls_per_task > 0),
  max_calls_per_run INTEGER NOT NULL CHECK (max_calls_per_run > 0),
  max_physical_attempts INTEGER NOT NULL CHECK (max_physical_attempts > 0),
  max_wall_time_per_invocation_ms BIGINT NOT NULL CHECK (max_wall_time_per_invocation_ms > 0),
  active_reservations INTEGER NOT NULL DEFAULT 0 CHECK (active_reservations >= 0),
  used_calls INTEGER NOT NULL DEFAULT 0 CHECK (used_calls >= 0),
  used_physical_attempts INTEGER NOT NULL DEFAULT 0 CHECK (used_physical_attempts >= 0),
  used_wall_time_ms BIGINT NOT NULL DEFAULT 0 CHECK (used_wall_time_ms >= 0),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, principal_id)
);

CREATE TABLE IF NOT EXISTS control.provider_quota_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  task_id UUID REFERENCES control.tasks(id) ON DELETE CASCADE,
  run_id UUID REFERENCES control.runs(id) ON DELETE SET NULL,
  reserved_calls INTEGER NOT NULL CHECK (reserved_calls > 0),
  reserved_physical_attempts INTEGER NOT NULL CHECK (reserved_physical_attempts > 0),
  reserved_wall_time_ms BIGINT NOT NULL CHECK (reserved_wall_time_ms > 0),
  state TEXT NOT NULL CHECK (state IN ('RESERVED','COMMITTED','RELEASED','EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS provider_quota_reservations_scope_idx ON control.provider_quota_reservations(provider_id, principal_id, state);
