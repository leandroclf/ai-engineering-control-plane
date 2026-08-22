CREATE TABLE IF NOT EXISTS control.task_budgets (
  task_id UUID PRIMARY KEY REFERENCES control.tasks(id) ON DELETE CASCADE,
  max_calls INTEGER NOT NULL CHECK (max_calls >= 0),
  max_input_tokens BIGINT NOT NULL CHECK (max_input_tokens >= 0),
  max_output_tokens BIGINT NOT NULL CHECK (max_output_tokens >= 0),
  max_cost_usd NUMERIC(14,6) NOT NULL CHECK (max_cost_usd >= 0),
  max_iterations INTEGER NOT NULL CHECK (max_iterations >= 0),
  used_calls INTEGER NOT NULL DEFAULT 0 CHECK (used_calls >= 0),
  used_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (used_input_tokens >= 0),
  used_output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (used_output_tokens >= 0),
  used_cost_usd NUMERIC(14,6) NOT NULL DEFAULT 0 CHECK (used_cost_usd >= 0),
  used_iterations INTEGER NOT NULL DEFAULT 0 CHECK (used_iterations >= 0),
  reserved_calls INTEGER NOT NULL DEFAULT 0 CHECK (reserved_calls >= 0),
  reserved_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (reserved_input_tokens >= 0),
  reserved_output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (reserved_output_tokens >= 0),
  reserved_cost_usd NUMERIC(14,6) NOT NULL DEFAULT 0 CHECK (reserved_cost_usd >= 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXHAUSTED','CANCELLED')),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS control.budget_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES control.task_budgets(task_id) ON DELETE CASCADE,
  run_id UUID REFERENCES control.runs(id) ON DELETE SET NULL,
  stage TEXT NOT NULL,
  invocation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  reserved_calls INTEGER NOT NULL DEFAULT 1 CHECK (reserved_calls >= 0),
  reserved_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (reserved_input_tokens >= 0),
  reserved_output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (reserved_output_tokens >= 0),
  reserved_cost_usd NUMERIC(14,6) NOT NULL DEFAULT 0 CHECK (reserved_cost_usd >= 0),
  actual_input_tokens BIGINT,
  actual_output_tokens BIGINT,
  actual_cost_usd NUMERIC(14,6),
  state TEXT NOT NULL CHECK (state IN ('RESERVED','COMMITTED','RELEASED','EXPIRED')),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  committed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS budget_reservations_task_state_idx
  ON control.budget_reservations(task_id, state);

CREATE TABLE IF NOT EXISTS control.budget_events (
  id BIGSERIAL PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES control.tasks(id) ON DELETE CASCADE,
  run_id UUID REFERENCES control.runs(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES control.budget_reservations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_events_task_idx ON control.budget_events(task_id, created_at);

ALTER TABLE control.runs DROP CONSTRAINT IF EXISTS runs_status_check;
ALTER TABLE control.runs ADD CONSTRAINT runs_status_check
  CHECK (status IN ('running','completed','failed','blocked','cancelled'));
