ALTER TABLE control.task_budgets
  ADD COLUMN IF NOT EXISTS used_physical_attempts BIGINT NOT NULL DEFAULT 0 CHECK (used_physical_attempts >= 0);

ALTER TABLE control.budget_reservations
  ADD COLUMN IF NOT EXISTS logical_invocation_id UUID,
  ADD COLUMN IF NOT EXISTS model_alias TEXT,
  ADD COLUMN IF NOT EXISTS physical_attempts INTEGER NOT NULL DEFAULT 0 CHECK (physical_attempts >= 0),
  ADD COLUMN IF NOT EXISTS fallback_cost_delta NUMERIC(14,6) NOT NULL DEFAULT 0 CHECK (fallback_cost_delta >= 0);

UPDATE control.budget_reservations
SET logical_invocation_id = invocation_id
WHERE logical_invocation_id IS NULL;

ALTER TABLE control.budget_reservations
  ALTER COLUMN logical_invocation_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS control.provider_attempts (
  id BIGSERIAL PRIMARY KEY,
  reservation_id UUID NOT NULL REFERENCES control.budget_reservations(id) ON DELETE CASCADE,
  logical_invocation_id UUID NOT NULL,
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  provider_request_id TEXT NOT NULL,
  fallback BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('succeeded','failed')),
  input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens BIGINT NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cached_input_tokens BIGINT NOT NULL DEFAULT 0 CHECK (cached_input_tokens >= 0),
  cost_usd NUMERIC(14,6) NOT NULL DEFAULT 0 CHECK (cost_usd >= 0),
  duration_ms BIGINT NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, attempt),
  UNIQUE (provider, provider_request_id)
);

CREATE INDEX IF NOT EXISTS provider_attempts_logical_invocation_idx
  ON control.provider_attempts(logical_invocation_id, attempt);

