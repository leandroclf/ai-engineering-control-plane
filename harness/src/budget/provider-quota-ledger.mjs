import { randomUUID } from "node:crypto";
import { ProviderError, PROVIDER_ERROR_CODES } from "../providers/provider-errors.mjs";

function keyOf({ providerId, principalId = "local", taskId = "unknown", runId = "unknown" }) { return `${providerId}:${principalId}:${taskId}:${runId}`; }
function limit(value, fallback) { return Number.isInteger(value) && value > 0 ? value : fallback; }

export class ProviderQuotaAuthority {
  constructor({ policies = {}, environment = process.env } = {}) {
    this.policies = structuredClone(policies);
    this.environment = environment;
    this.reservations = new Map();
    this.usage = new Map();
    this.taskUsage = new Map();
  }

  policy(providerId) {
    const configured = this.policies[providerId] ?? {};
    return Object.freeze({
      maxConcurrent: limit(configured.maxConcurrent, 1),
      maxCallsPerTask: limit(configured.maxCallsPerTask, 10),
      maxCallsPerRun: limit(configured.maxCallsPerRun, 20),
      maxPhysicalAttempts: limit(configured.maxPhysicalAttempts, 1),
      maxWallTimePerInvocationMs: limit(configured.maxWallTimePerInvocationMs, 900_000),
      windowMs: limit(configured.windowMs, 0),
    });
  }

  #records({ providerId, principalId = "local", taskId = "unknown", runId = "unknown" }) {
    const key = keyOf({ providerId, principalId, taskId, runId });
    const record = this.usage.get(key) ?? { calls: 0, physicalAttempts: 0, wallTimeMs: 0, active: 0, windowStartedAt: Date.now() };
    if (this.policy(providerId).windowMs && Date.now() - record.windowStartedAt >= this.policy(providerId).windowMs) Object.assign(record, { calls: 0, physicalAttempts: 0, wallTimeMs: 0, windowStartedAt: Date.now() });
    this.usage.set(key, record);
    return record;
  }

  #taskRecords({ providerId, principalId = "local", taskId = "unknown" }) {
    const key = `${providerId}:${principalId}:${taskId}`;
    const record = this.taskUsage.get(key) ?? { calls: 0, physicalAttempts: 0, wallTimeMs: 0 };
    this.taskUsage.set(key, record);
    return record;
  }

  async reserve(input) {
    const providerId = String(input?.providerId ?? "");
    if (!providerId) throw new TypeError("providerId is required");
    const policy = this.policy(providerId);
    const record = this.#records(input);
    const taskRecord = this.#taskRecords(input);
    const calls = Math.max(1, Number(input.calls ?? 1));
    const physicalAttempts = Math.max(1, Number(input.physicalAttempts ?? 1));
    const wallTimeMs = Math.max(0, Number(input.wallTimeMs ?? policy.maxWallTimePerInvocationMs));
    if (record.active + 1 > policy.maxConcurrent || taskRecord.calls + calls > policy.maxCallsPerTask || record.calls + calls > policy.maxCallsPerRun || record.physicalAttempts + physicalAttempts > policy.maxPhysicalAttempts * policy.maxCallsPerRun || record.wallTimeMs + wallTimeMs > policy.maxWallTimePerInvocationMs * policy.maxCallsPerRun) {
      throw new ProviderError(PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED, `shadow quota exhausted for ${providerId}`, { retryable: true, details: { providerId, policy } });
    }
    const reservation = Object.freeze({ id: `pqr_${randomUUID()}`, providerId, principalId: input.principalId ?? "local", taskId: input.taskId ?? "unknown", runId: input.runId ?? "unknown", calls, physicalAttempts, wallTimeMs, state: "RESERVED", createdAt: new Date().toISOString() });
    this.reservations.set(reservation.id, reservation);
    record.active += 1;
    return reservation;
  }

  isEligible(providerId, input = {}) {
    const policy = this.policy(providerId);
    const record = this.#records({ providerId, ...input });
    const taskRecord = this.#taskRecords({ providerId, ...input });
    return record.active < policy.maxConcurrent && record.calls < policy.maxCallsPerRun && taskRecord.calls < policy.maxCallsPerTask && record.physicalAttempts < policy.maxPhysicalAttempts * policy.maxCallsPerRun;
  }

  async commit(id, usage = {}) { return this.#settle(id, "COMMITTED", usage); }
  async release(id) { return this.#settle(id, "RELEASED", {}); }
  async #settle(id, state, usage) {
    const reservation = this.reservations.get(id);
    if (!reservation) throw new Error(`unknown provider quota reservation: ${id}`);
    if (reservation.state !== "RESERVED") return reservation;
    const record = this.#records(reservation);
    const taskRecord = this.#taskRecords(reservation);
    record.active = Math.max(0, record.active - 1);
    if (state === "COMMITTED") {
      record.calls += Math.max(1, Number(usage.calls ?? reservation.calls));
      record.physicalAttempts += Math.max(1, Number(usage.physicalAttempts ?? reservation.physicalAttempts));
      record.wallTimeMs += Math.max(0, Number(usage.wallTimeMs ?? reservation.wallTimeMs));
      taskRecord.calls += Math.max(1, Number(usage.calls ?? reservation.calls));
      taskRecord.physicalAttempts += Math.max(1, Number(usage.physicalAttempts ?? reservation.physicalAttempts));
      taskRecord.wallTimeMs += Math.max(0, Number(usage.wallTimeMs ?? reservation.wallTimeMs));
    }
    const settled = Object.freeze({ ...reservation, state, settledAt: new Date().toISOString() });
    this.reservations.set(id, settled);
    return settled;
  }

  snapshot({ providerId = null, principalId = null, taskId = null, runId = null } = {}) {
    const items = [...this.usage.entries()].filter(([key]) => [providerId, principalId, taskId, runId].every((part) => part === null || key.includes(String(part)))).map(([, value]) => ({ ...value }));
    const policy = providerId ? this.policy(providerId) : null;
    return { source: "aicp-shadow-ledger", providerId, policy, items, reservations: [...this.reservations.values()].filter((item) => item.state === "RESERVED") };
  }
}

export class PostgresProviderQuotaAuthority {
  constructor({ database, policies = {} } = {}) { if (!database?.connect) throw new TypeError("database connect function is required"); this.database = database; this.policies = structuredClone(policies); }
  policy(providerId) { const configured = this.policies[providerId] ?? {}; return { maxConcurrent: limit(configured.maxConcurrent, 1), maxCallsPerTask: limit(configured.maxCallsPerTask, 10), maxCallsPerRun: limit(configured.maxCallsPerRun, 20), maxPhysicalAttempts: limit(configured.maxPhysicalAttempts, 1), maxWallTimePerInvocationMs: limit(configured.maxWallTimePerInvocationMs, 900000) }; }
  async #transact(callback) { const client = await this.database.connect(); try { await client.query("BEGIN"); const result = await callback(client); await client.query("COMMIT"); return result; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); } }
  async reserve(input) {
    const providerId = String(input?.providerId ?? ""); const principalId = String(input?.principalId ?? "local"); const taskId = input.taskId ?? null; const runId = input.runId ?? null;
    const policy = this.policy(providerId); const calls = Math.max(1, Number(input.calls ?? 1)); const physicalAttempts = Math.max(1, Number(input.physicalAttempts ?? 1)); const wallTimeMs = Math.max(1, Number(input.wallTimeMs ?? policy.maxWallTimePerInvocationMs));
    return this.#transact(async (client) => {
      await client.query(`INSERT INTO control.provider_quota_limits(provider_id,principal_id,max_concurrent,max_calls_per_task,max_calls_per_run,max_physical_attempts,max_wall_time_per_invocation_ms) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(provider_id,principal_id) DO NOTHING`, [providerId, principalId, policy.maxConcurrent, policy.maxCallsPerTask, policy.maxCallsPerRun, policy.maxPhysicalAttempts, policy.maxWallTimePerInvocationMs]);
      const locked = (await client.query("SELECT * FROM control.provider_quota_limits WHERE provider_id=$1 AND principal_id=$2 FOR UPDATE", [providerId, principalId])).rows[0];
      const taskUsed = taskId ? Number((await client.query("SELECT COALESCE(SUM(reserved_calls),0) AS used FROM control.provider_quota_reservations WHERE provider_id=$1 AND principal_id=$2 AND task_id=$3 AND state IN ('RESERVED','COMMITTED')", [providerId, principalId, taskId])).rows[0].used) : 0;
      const runUsed = runId ? Number((await client.query("SELECT COALESCE(SUM(reserved_calls),0) AS used FROM control.provider_quota_reservations WHERE provider_id=$1 AND principal_id=$2 AND run_id=$3 AND state IN ('RESERVED','COMMITTED')", [providerId, principalId, runId])).rows[0].used) : 0;
      if (Number(locked.active_reservations) + 1 > Number(locked.max_concurrent) || taskUsed + calls > Number(locked.max_calls_per_task) || runUsed + calls > Number(locked.max_calls_per_run) || Number(locked.used_physical_attempts) + physicalAttempts > Number(locked.max_physical_attempts) * Number(locked.max_calls_per_run)) throw new ProviderError(PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED, `shadow quota exhausted for ${providerId}`, { retryable: true });
      const inserted = (await client.query("INSERT INTO control.provider_quota_reservations(provider_id,principal_id,task_id,run_id,reserved_calls,reserved_physical_attempts,reserved_wall_time_ms,state) VALUES($1,$2,$3,$4,$5,$6,$7,'RESERVED') RETURNING *", [providerId, principalId, taskId, runId, calls, physicalAttempts, wallTimeMs])).rows[0];
      await client.query("UPDATE control.provider_quota_limits SET active_reservations=active_reservations+1,version=version+1,updated_at=now() WHERE provider_id=$1 AND principal_id=$2", [providerId, principalId]);
      return { id: inserted.id, providerId, principalId, taskId, runId, calls, physicalAttempts, wallTimeMs, state: inserted.state, createdAt: inserted.created_at };
    });
  }
  async #settle(id, state, usage = {}) { return this.#transact(async (client) => { const found = (await client.query("SELECT * FROM control.provider_quota_reservations WHERE id=$1 FOR UPDATE", [id])).rows[0]; if (!found) throw new Error(`unknown provider quota reservation: ${id}`); if (found.state !== "RESERVED") return found; const physical = Math.max(1, Number(usage.physicalAttempts ?? found.reserved_physical_attempts)); const calls = Math.max(1, Number(usage.calls ?? found.reserved_calls)); const wall = Math.max(0, Number(usage.wallTimeMs ?? found.reserved_wall_time_ms)); await client.query("UPDATE control.provider_quota_limits SET active_reservations=GREATEST(0,active_reservations-1),used_calls=used_calls+$3,used_physical_attempts=used_physical_attempts+$4,used_wall_time_ms=used_wall_time_ms+$5,version=version+1,updated_at=now() WHERE provider_id=$1 AND principal_id=$2", [found.provider_id, found.principal_id, state === "COMMITTED" ? calls : 0, state === "COMMITTED" ? physical : 0, state === "COMMITTED" ? wall : 0]); const result = (await client.query("UPDATE control.provider_quota_reservations SET state=$2,settled_at=now() WHERE id=$1 RETURNING *", [id, state])).rows[0]; return result; }); }
  commit(id, usage) { return this.#settle(id, "COMMITTED", usage); }
  release(id) { return this.#settle(id, "RELEASED"); }
  async isEligible(providerId, { principalId = "local" } = {}) { const row = (await this.database.query("SELECT * FROM control.provider_quota_limits WHERE provider_id=$1 AND principal_id=$2", [providerId, principalId])).rows[0]; if (!row) return true; return Number(row.active_reservations) < Number(row.max_concurrent) && Number(row.used_calls) < Number(row.max_calls_per_run); }
  async snapshot({ providerId = null, principalId = null, taskId = null, runId = null } = {}) { const clauses = []; const values = []; for (const [name, value] of [["provider_id", providerId], ["principal_id", principalId], ["task_id", taskId], ["run_id", runId]]) if (value !== null && value !== undefined) { values.push(value); clauses.push(`${name}=$${values.length}`); } const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""; const result = await this.database.query(`SELECT * FROM control.provider_quota_reservations ${where} ORDER BY created_at DESC`, values); return { source: "aicp-shadow-ledger", providerId, items: result.rows.map((row) => ({ id: row.id, providerId: row.provider_id, principalId: row.principal_id, taskId: row.task_id, runId: row.run_id, state: row.state, calls: row.reserved_calls, physicalAttempts: row.reserved_physical_attempts, wallTimeMs: row.reserved_wall_time_ms, createdAt: row.created_at })), reservations: result.rows.filter((row) => row.state === "RESERVED") }; }
}
