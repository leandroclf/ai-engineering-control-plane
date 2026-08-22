import { BudgetExceededError } from "./task-budget.mjs";
import { normalizeUsage } from "./budget-policy.mjs";

function number(value) { return Number(value ?? 0); }
function mapBudget(row) {
  const limits = { calls: row.max_calls, inputTokens: number(row.max_input_tokens), outputTokens: number(row.max_output_tokens), costUsd: number(row.max_cost_usd), iterations: row.max_iterations };
  const used = { calls: row.used_calls, inputTokens: number(row.used_input_tokens), outputTokens: number(row.used_output_tokens), costUsd: number(row.used_cost_usd), iterations: row.used_iterations };
  const reserved = { calls: row.reserved_calls, inputTokens: number(row.reserved_input_tokens), outputTokens: number(row.reserved_output_tokens), costUsd: number(row.reserved_cost_usd), iterations: 0 };
  return { taskId: row.task_id, limits, used, reserved, remaining: Object.fromEntries(Object.keys(limits).map((key) => [key, Math.max(0, limits[key] - used[key] - reserved[key])])), status: row.status, version: number(row.version) };
}

export class PostgresBudgetStore {
  constructor(database) { if (!database?.connect) throw new TypeError("database connect function is required"); this.database = database; }

  async transact(callback) {
    const client = await this.database.connect();
    try { await client.query("BEGIN"); const result = await callback(client); await client.query("COMMIT"); return result; }
    catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async ensure(taskId, limits) {
    const values = [taskId, limits.maxCalls, limits.maxInputTokens, limits.maxOutputTokens, limits.maxCostUsd, limits.maxIterations];
    const result = await this.database.query(
      `INSERT INTO control.task_budgets(task_id,max_calls,max_input_tokens,max_output_tokens,max_cost_usd,max_iterations)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(task_id) DO NOTHING RETURNING *`, values,
    );
    return result.rows[0] ? mapBudget(result.rows[0]) : this.get(taskId);
  }

  async get(taskId) {
    const result = await this.database.query("SELECT * FROM control.task_budgets WHERE task_id=$1", [taskId]);
    if (!result.rows[0]) throw new Error(`unknown task budget: ${taskId}`);
    return mapBudget(result.rows[0]);
  }

  async events(taskId) {
    const result = await this.database.query("SELECT id,event_type,payload,run_id,reservation_id,created_at FROM control.budget_events WHERE task_id=$1 ORDER BY id", [taskId]);
    return result.rows.map((row) => ({ id: String(row.id), eventType: row.event_type, payload: row.payload, runId: row.run_id, reservationId: row.reservation_id, createdAt: row.created_at }));
  }

  async reserve({ taskId, runId, stage, estimatedUsage, idempotencyKey, ttlSeconds = 900 }) {
    const usage = normalizeUsage(estimatedUsage);
    return this.transact(async (client) => {
      const duplicate = await client.query("SELECT * FROM control.budget_reservations WHERE idempotency_key=$1", [idempotencyKey]);
      if (duplicate.rows[0]) return { ...duplicate.rows[0], idempotentReplay: true };
      const locked = await client.query("SELECT * FROM control.task_budgets WHERE task_id=$1 FOR UPDATE", [taskId]);
      const budget = locked.rows[0];
      if (!budget) throw new Error(`unknown task budget: ${taskId}`);
      if (budget.status !== "ACTIVE") throw new BudgetExceededError(`status:${budget.status}`);
      const checks = [
        ["maxCalls", number(budget.used_calls) + number(budget.reserved_calls) + usage.calls, number(budget.max_calls)],
        ["maxInputTokens", number(budget.used_input_tokens) + number(budget.reserved_input_tokens) + usage.inputTokens, number(budget.max_input_tokens)],
        ["maxOutputTokens", number(budget.used_output_tokens) + number(budget.reserved_output_tokens) + usage.outputTokens, number(budget.max_output_tokens)],
        ["maxCostUsd", number(budget.used_cost_usd) + number(budget.reserved_cost_usd) + usage.costUsd, number(budget.max_cost_usd)],
      ];
      const exceeded = checks.find(([, next, maximum]) => next > maximum);
      if (exceeded) throw new BudgetExceededError(exceeded[0]);
      const inserted = await client.query(
        `INSERT INTO control.budget_reservations(task_id,run_id,stage,reserved_calls,reserved_input_tokens,reserved_output_tokens,reserved_cost_usd,state,idempotency_key,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,'RESERVED',$8,now()+($9*interval '1 second')) RETURNING *`,
        [taskId, runId, stage, usage.calls, usage.inputTokens, usage.outputTokens, usage.costUsd, idempotencyKey, ttlSeconds],
      );
      await client.query(`UPDATE control.task_budgets SET reserved_calls=reserved_calls+$2,reserved_input_tokens=reserved_input_tokens+$3,reserved_output_tokens=reserved_output_tokens+$4,reserved_cost_usd=reserved_cost_usd+$5,version=version+1,updated_at=now() WHERE task_id=$1`, [taskId, usage.calls, usage.inputTokens, usage.outputTokens, usage.costUsd]);
      await client.query("INSERT INTO control.budget_events(task_id,run_id,reservation_id,event_type,payload) VALUES($1,$2,$3,'RESERVED',$4::jsonb)", [taskId, runId, inserted.rows[0].id, JSON.stringify(usage)]);
      return inserted.rows[0];
    });
  }

  async settle(reservationId, state, actualUsage = {}) {
    return this.transact(async (client) => {
      const found = await client.query("SELECT * FROM control.budget_reservations WHERE id=$1 FOR UPDATE", [reservationId]);
      const reservation = found.rows[0];
      if (!reservation) throw new Error(`unknown budget reservation: ${reservationId}`);
      if (reservation.state !== "RESERVED") return reservation;
      const actual = state === "COMMITTED" ? normalizeUsage({ ...actualUsage, calls: reservation.reserved_calls }) : normalizeUsage({ calls: 0 });
      await client.query("SELECT task_id FROM control.task_budgets WHERE task_id=$1 FOR UPDATE", [reservation.task_id]);
      await client.query(
        `UPDATE control.task_budgets SET reserved_calls=reserved_calls-$2,reserved_input_tokens=reserved_input_tokens-$3,reserved_output_tokens=reserved_output_tokens-$4,reserved_cost_usd=reserved_cost_usd-$5,
         used_calls=used_calls+$6,used_input_tokens=used_input_tokens+$7,used_output_tokens=used_output_tokens+$8,used_cost_usd=used_cost_usd+$9,version=version+1,updated_at=now() WHERE task_id=$1`,
        [reservation.task_id, reservation.reserved_calls, reservation.reserved_input_tokens, reservation.reserved_output_tokens, reservation.reserved_cost_usd, actual.calls, actual.inputTokens, actual.outputTokens, actual.costUsd],
      );
      if (state === "COMMITTED") {
        await client.query(`UPDATE control.task_budgets SET status='EXHAUSTED',updated_at=now()
          WHERE task_id=$1 AND status='ACTIVE' AND
          (used_calls>=max_calls OR used_input_tokens>=max_input_tokens OR used_output_tokens>=max_output_tokens OR used_cost_usd>=max_cost_usd)`, [reservation.task_id]);
      }
      const drift = state === "COMMITTED" ? {
        exceeded: actual.inputTokens > number(reservation.reserved_input_tokens) || actual.outputTokens > number(reservation.reserved_output_tokens) || actual.costUsd > number(reservation.reserved_cost_usd),
        inputRatio: number(reservation.reserved_input_tokens) ? actual.inputTokens / number(reservation.reserved_input_tokens) : actual.inputTokens ? Infinity : 0,
        outputRatio: number(reservation.reserved_output_tokens) ? actual.outputTokens / number(reservation.reserved_output_tokens) : actual.outputTokens ? Infinity : 0,
        costRatio: number(reservation.reserved_cost_usd) ? actual.costUsd / number(reservation.reserved_cost_usd) : actual.costUsd ? Infinity : 0,
      } : null;
      const updated = await client.query(`UPDATE control.budget_reservations SET state=$2,actual_input_tokens=$3,actual_output_tokens=$4,actual_cost_usd=$5,committed_at=CASE WHEN $2='COMMITTED' THEN now() ELSE NULL END WHERE id=$1 RETURNING *`, [reservationId, state, actual.inputTokens, actual.outputTokens, actual.costUsd]);
      await client.query("INSERT INTO control.budget_events(task_id,run_id,reservation_id,event_type,payload) VALUES($1,$2,$3,$4,$5::jsonb)", [reservation.task_id, reservation.run_id, reservationId, state, JSON.stringify(actual)]);
      if (drift?.exceeded) await client.query("INSERT INTO control.budget_events(task_id,run_id,reservation_id,event_type,payload) VALUES($1,$2,$3,'BUDGET_RESERVATION_DRIFT',$4::jsonb)", [reservation.task_id, reservation.run_id, reservationId, JSON.stringify({ reserved: { inputTokens: number(reservation.reserved_input_tokens), outputTokens: number(reservation.reserved_output_tokens), costUsd: number(reservation.reserved_cost_usd) }, actual, drift })]);
      return { ...updated.rows[0], drift };
    });
  }

  commit(reservationId, actualUsage) { return this.settle(reservationId, "COMMITTED", actualUsage); }
  release(reservationId) { return this.settle(reservationId, "RELEASED"); }

  async expireStale() {
    const result = await this.database.query("SELECT id FROM control.budget_reservations WHERE state='RESERVED' AND expires_at<now() ORDER BY created_at");
    for (const row of result.rows) await this.settle(row.id, "EXPIRED");
    return result.rowCount;
  }

  async cancel(taskId) {
    await this.expireStale();
    return this.transact(async (client) => {
      const locked = await client.query("SELECT * FROM control.task_budgets WHERE task_id=$1 FOR UPDATE", [taskId]);
      if (!locked.rows[0]) throw new Error(`unknown task budget: ${taskId}`);
      const active = await client.query("SELECT * FROM control.budget_reservations WHERE task_id=$1 AND state='RESERVED' FOR UPDATE", [taskId]);
      for (const reservation of active.rows) {
        await client.query("UPDATE control.budget_reservations SET state='RELEASED' WHERE id=$1", [reservation.id]);
        await client.query("INSERT INTO control.budget_events(task_id,run_id,reservation_id,event_type,payload) VALUES($1,$2,$3,'RELEASED','{}')", [taskId, reservation.run_id, reservation.id]);
      }
      const result = await client.query("UPDATE control.task_budgets SET status='CANCELLED',reserved_calls=0,reserved_input_tokens=0,reserved_output_tokens=0,reserved_cost_usd=0,version=version+1,updated_at=now() WHERE task_id=$1 RETURNING *", [taskId]);
      await client.query("INSERT INTO control.budget_events(task_id,event_type,payload) VALUES($1,'CANCELLED','{}')", [taskId]);
      return mapBudget(result.rows[0]);
    });
  }

  async consumeIteration(taskId, runId) {
    return this.transact(async (client) => {
      const locked = await client.query("SELECT * FROM control.task_budgets WHERE task_id=$1 FOR UPDATE", [taskId]);
      const budget = locked.rows[0];
      if (!budget || budget.status !== "ACTIVE" || number(budget.used_iterations) + 1 > number(budget.max_iterations)) {
        throw new BudgetExceededError("maxIterations");
      }
      const updated = await client.query("UPDATE control.task_budgets SET used_iterations=used_iterations+1,version=version+1,updated_at=now() WHERE task_id=$1 RETURNING *", [taskId]);
      await client.query("INSERT INTO control.budget_events(task_id,run_id,event_type,payload) VALUES($1,$2,'ITERATION_CONSUMED',$3::jsonb)", [taskId, runId, JSON.stringify({ iterations: 1 })]);
      return mapBudget(updated.rows[0]);
    });
  }
}
