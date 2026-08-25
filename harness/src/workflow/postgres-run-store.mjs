import { providerExecutionRecord, providerExecutionsByRun } from "./provider-execution-evidence-store.mjs";

function mapRun(row) {
  const metadata = row.task_metadata ?? row.metadata ?? {};
  return {
    id: row.id,
    taskId: row.task_id,
    state: row.state,
    status: row.status,
    policyVersion: row.policy_version,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(metadata.project ? { project: metadata.project } : {}),
    ...(metadata.query ? { query: metadata.query } : {}),
  };
}
function number(value) { return Number(value ?? 0); }
function canonical(value) { if (Array.isArray(value)) return value.map(canonical); if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])); return value; }
function statusFor(to, terminal) { return !terminal ? "running" : to === "failed" ? "failed" : to === "human-review" ? "blocked" : "completed"; }

export class PostgresRunStore {
  constructor(database) {
    if (!database?.connect) throw new TypeError("database connect function is required");
    this.database = database;
  }

  async #query(sql, params) {
    if (this.database.query) return this.database.query(sql, params);
    const client = await this.database.connect();
    try {
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  async createTask({ idempotencyKey, workflowVersion, metadata = {} }) {
    const result = await this.#query(
      `INSERT INTO control.tasks (idempotency_key, workflow_version, metadata)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING id, idempotency_key, workflow_version, metadata, created_at, (xmax <> 0) AS idempotent_replay`,
      [idempotencyKey, workflowVersion, JSON.stringify(metadata)],
    );
    const row = result.rows[0];
    if (Number(row.workflow_version) !== Number(workflowVersion) || JSON.stringify(canonical(row.metadata)) !== JSON.stringify(canonical(metadata))) {
      throw Object.assign(new Error("idempotency key already identifies a different task request"), { name: "IdempotencyConflictError", code: "IDEMPOTENCY_CONFLICT" });
    }
    return { id: row.id, idempotencyKey: row.idempotency_key, workflowVersion: row.workflow_version, metadata: row.metadata, createdAt: row.created_at, idempotentReplay: row.idempotent_replay === true };
  }

  async createRun({ taskId, initialState, policyVersion }) {
    const result = await this.#query(
      `INSERT INTO control.runs (task_id, state, status, policy_version)
       VALUES ($1, $2, 'running', $3)
       RETURNING *`,
      [taskId, initialState, policyVersion],
    );
    return mapRun(result.rows[0]);
  }

  async getTask(taskId) {
    const result = await this.#query(
      "SELECT id, idempotency_key, workflow_version, metadata, created_at FROM control.tasks WHERE id = $1",
      [taskId],
    );
    const row = result.rows[0];
    if (!row) throw new Error(`unknown task: ${taskId}`);
    return { id: row.id, idempotencyKey: row.idempotency_key, workflowVersion: row.workflow_version,
      metadata: row.metadata, createdAt: row.created_at };
  }

  async getRun(runId) {
    const result = await this.#query("SELECT * FROM control.runs WHERE id = $1", [runId]);
    if (!result.rows[0]) throw new Error(`unknown run: ${runId}`);
    return mapRun(result.rows[0]);
  }
  async getLatestRunForTask(taskId) {
    const result = await this.#query("SELECT * FROM control.runs WHERE task_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1", [taskId]);
    return result.rows[0] ? mapRun(result.rows[0]) : null;
  }

  async listRuns({ status = null, taskId = null, limit = 50, offset = 0 } = {}) {
    const boundedLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    const boundedOffset = Math.max(0, Number(offset) || 0);
    const result = await this.#query(
      `SELECT r.*, t.metadata AS task_metadata FROM control.runs r JOIN control.tasks t ON t.id = r.task_id
       WHERE ($1::text IS NULL OR r.status=$1) AND ($2::uuid IS NULL OR r.task_id=$2)
       ORDER BY r.created_at DESC,r.id DESC LIMIT $3 OFFSET $4`, [status, taskId, boundedLimit, boundedOffset],
    );
    return { items: result.rows.map(mapRun), limit: boundedLimit, offset: boundedOffset };
  }

  async transition(runId, { expectedVersion, outcome, to, terminal = false, evidence = {}, startedAt = new Date(), finishedAt = new Date() }) {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query(
        "SELECT state, version FROM control.runs WHERE id = $1 FOR UPDATE",
        [runId],
      );
      if (!current.rows[0]) throw new Error(`unknown run: ${runId}`);
      if (current.rows[0].version !== expectedVersion) {
        throw new Error(`stale run version: expected ${expectedVersion}, actual ${current.rows[0].version}`);
      }
      const updated = await client.query(
        `UPDATE control.runs
         SET state = $3, status = $4, version = version + 1, updated_at = now()
         WHERE id = $1 AND version = $2
         RETURNING *`,
        [runId, expectedVersion, to, statusFor(to, terminal)],
      );
      if (!updated.rows[0]) throw new Error(`stale run version: expected ${expectedVersion}`);
      await client.query(
        `INSERT INTO control.stages
           (run_id, sequence, state_from, state_to, outcome, evidence, started_at, finished_at)
         SELECT $1, COALESCE(MAX(sequence), 0) + 1, $2, $3, $4, $5::jsonb, $6, $7
         FROM control.stages WHERE run_id = $1
         RETURNING id`,
        [runId, current.rows[0].state, to, outcome, JSON.stringify(evidence), startedAt, finishedAt],
      );
      await client.query("COMMIT");
      return mapRun(updated.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listStages(runId) {
    const result = await this.#query(
      `SELECT sequence, state_from, state_to, outcome, evidence, started_at, finished_at
       FROM control.stages WHERE run_id = $1 ORDER BY sequence`,
      [runId],
    );
    return result.rows;
  }

  // Provider attempts are evidence attached to a run, not a second run state.
  record(input) { return providerExecutionRecord(this.database, input); }
  async listByRun(runId) { return (await providerExecutionsByRun(this.database, runId)).rows; }

  async getContext(contextId) {
    const result = await this.#query(
      `SELECT run_id,sequence,evidence->>'contextId' AS context_id,evidence->'contextArtifacts' AS artifacts,
              (evidence->>'contextTokenCount')::bigint AS token_count,(evidence->>'contextBudget')::bigint AS budget,
              evidence->'contextEnvelope' AS envelope,evidence->'contextMetrics' AS metrics,
              evidence->'contextMetadata' AS metadata,finished_at
       FROM control.stages WHERE evidence->>'contextId'=$1 ORDER BY finished_at DESC LIMIT 1`, [contextId],
    );
    if (!result.rows[0]) throw new Error(`unknown context: ${contextId}`);
    return { contextId: result.rows[0].context_id, runId: result.rows[0].run_id, sequence: result.rows[0].sequence,
      tokenCount: number(result.rows[0].token_count), budget: number(result.rows[0].budget), artifacts: result.rows[0].artifacts ?? [],
      envelope: result.rows[0].envelope ?? {}, metrics: result.rows[0].metrics ?? {}, metadata: result.rows[0].metadata ?? {},
      compiledAt: result.rows[0].finished_at };
  }

  async cancelRun(runId) {
    const result = await this.#query(
      `UPDATE control.runs SET status='cancelled', version=version+1, updated_at=now()
       WHERE id=$1 AND status='running' RETURNING *`, [runId],
    );
    if (!result.rows[0]) {
      const current = await this.getRun(runId);
      if (current.status === "cancelled") return current;
      throw new Error(`run cannot be cancelled from status: ${current.status}`);
    }
    return mapRun(result.rows[0]);
  }
}
