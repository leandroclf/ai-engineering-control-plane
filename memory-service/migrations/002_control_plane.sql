CREATE SCHEMA IF NOT EXISTS control;

CREATE TABLE IF NOT EXISTS control.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  workflow_version INTEGER NOT NULL CHECK (workflow_version > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS control.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES control.tasks(id),
  state TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'blocked')),
  policy_version INTEGER NOT NULL CHECK (policy_version > 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS control.stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES control.runs(id),
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  state_from TEXT NOT NULL,
  state_to TEXT NOT NULL,
  outcome TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  UNIQUE (run_id, sequence)
);

CREATE INDEX IF NOT EXISTS runs_task_id_idx ON control.runs(task_id);
CREATE INDEX IF NOT EXISTS stages_run_id_idx ON control.stages(run_id, sequence);
