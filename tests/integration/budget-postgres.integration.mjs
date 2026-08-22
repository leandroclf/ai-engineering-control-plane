import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { PostgresBudgetStore } from "../../harness/src/budget/postgres-budget-store.mjs";

const { Pool } = pg;
test("two concurrent connections cannot reserve the last call twice", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  const key = `budget-it-${Date.now()}-${Math.random()}`;
  try {
    const task = await pool.query("INSERT INTO control.tasks(idempotency_key,workflow_version) VALUES($1,1) RETURNING id", [key]);
    const taskId = task.rows[0].id;
    const store = new PostgresBudgetStore(pool);
    await store.ensure(taskId, { maxCalls: 1, maxInputTokens: 100, maxOutputTokens: 100, maxCostUsd: 1, maxIterations: 1 });
    const attempts = await Promise.allSettled(["a", "b"].map((suffix) => store.reserve({ taskId, stage: "implement", estimatedUsage: { calls: 1 }, idempotencyKey: `${key}:${suffix}` })));
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === "rejected" && attempt.reason.name === "BudgetExceededError").length, 1);
    const budget = await store.get(taskId);
    assert.equal(budget.reserved.calls, 1);
    await pool.query("DELETE FROM control.tasks WHERE id=$1", [taskId]);
  } finally { await pool.end(); }
});

test("reservation lifecycle is idempotent and reconciles actual usage", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const key = `budget-lifecycle-${Date.now()}-${Math.random()}`;
  try {
    const task = await pool.query("INSERT INTO control.tasks(idempotency_key,workflow_version) VALUES($1,1) RETURNING id", [key]);
    const taskId = task.rows[0].id;
    const store = new PostgresBudgetStore(pool);
    await store.ensure(taskId, { maxCalls: 5, maxInputTokens: 1000, maxOutputTokens: 1000, maxCostUsd: 5, maxIterations: 2 });
    const reserved = await store.reserve({ taskId, stage: "discover", estimatedUsage: { calls: 1, inputTokens: 100, outputTokens: 50, costUsd: 1 }, idempotencyKey: `${key}:same` });
    const replay = await store.reserve({ taskId, stage: "discover", estimatedUsage: { calls: 1 }, idempotencyKey: `${key}:same` });
    assert.equal(replay.id, reserved.id);
    assert.equal(replay.idempotentReplay, true);
    await store.commit(reserved.id, { inputTokens: 40, outputTokens: 10, costUsd: 0.25 });
    let budget = await store.get(taskId);
    assert.deepEqual({ calls: budget.used.calls, input: budget.used.inputTokens, output: budget.used.outputTokens, cost: budget.used.costUsd }, { calls: 1, input: 40, output: 10, cost: 0.25 });
    assert.equal(budget.reserved.calls, 0);
    const released = await store.reserve({ taskId, stage: "plan", estimatedUsage: { calls: 1, inputTokens: 10 }, idempotencyKey: `${key}:release` });
    await store.release(released.id);
    budget = await store.get(taskId);
    assert.equal(budget.reserved.calls, 0);
    await store.reserve({ taskId, stage: "plan", estimatedUsage: { calls: 1 }, idempotencyKey: `${key}:stale`, ttlSeconds: -1 });
    assert.equal(await store.expireStale(), 1);
    await store.consumeIteration(taskId, null);
    await store.consumeIteration(taskId, null);
    await assert.rejects(store.consumeIteration(taskId, null), (error) => error.name === "BudgetExceededError");
    await store.reserve({ taskId, stage: "implement", estimatedUsage: { calls: 1, inputTokens: 5 }, idempotencyKey: `${key}:active-at-cancel` });
    await store.cancel(taskId);
    assert.equal((await store.get(taskId)).reserved.calls, 0);
    await assert.rejects(store.reserve({ taskId, stage: "implement", estimatedUsage: { calls: 1 }, idempotencyKey: `${key}:cancelled` }), (error) => error.name === "BudgetExceededError");
    assert.ok((await store.events(taskId)).length >= 8);
    await pool.query("DELETE FROM control.tasks WHERE id=$1", [taskId]);
  } finally { await pool.end(); }
});

test("actual usage above reservation is committed and emits blocking drift evidence", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const key = `budget-drift-${Date.now()}-${Math.random()}`;
  try {
    const task = await pool.query("INSERT INTO control.tasks(idempotency_key,workflow_version) VALUES($1,1) RETURNING id", [key]);
    const taskId = task.rows[0].id;
    const store = new PostgresBudgetStore(pool);
    await store.ensure(taskId, { maxCalls: 2, maxInputTokens: 1000, maxOutputTokens: 1000, maxCostUsd: 5, maxIterations: 1 });
    const reservation = await store.reserve({ taskId, stage: "implement", estimatedUsage: { calls: 1, inputTokens: 10, outputTokens: 5, costUsd: 0.1 }, idempotencyKey: `${key}:drift` });
    const settlement = await store.commit(reservation.id, { inputTokens: 20, outputTokens: 6, costUsd: 0.2 });
    assert.equal(settlement.drift.exceeded, true);
    assert.equal(settlement.drift.inputRatio, 2);
    assert.ok((await store.events(taskId)).some((event) => event.eventType === "BUDGET_RESERVATION_DRIFT"));
    await pool.query("DELETE FROM control.tasks WHERE id=$1", [taskId]);
  } finally { await pool.end(); }
});

test("physical retries are persisted and charged to one logical invocation", async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  const key = `budget-physical-${Date.now()}-${Math.random()}`;
  try {
    const task = await pool.query("INSERT INTO control.tasks(idempotency_key,workflow_version) VALUES($1,1) RETURNING id", [key]);
    const taskId = task.rows[0].id;
    const store = new PostgresBudgetStore(pool);
    await store.ensure(taskId, { maxCalls: 2, maxInputTokens: 1000, maxOutputTokens: 1000, maxCostUsd: 5, maxIterations: 1 });
    const reservation = await store.reserve({ taskId, stage: "implement", modelAlias: "coding-strong", estimatedUsage: { calls: 1, inputTokens: 500, outputTokens: 200, costUsd: 2 }, idempotencyKey: `${key}:physical` });
    await store.commit(reservation.id, { providerAttempts: [
      { attempt: 1, provider: "openai", model: "strong-a", providerRequestId: `${key}:1`, pricingKnown: true, status: "failed", inputTokens: 100, costUsd: 0.1 },
      { attempt: 2, provider: "anthropic", model: "strong-b", providerRequestId: `${key}:2`, pricingKnown: true, status: "succeeded", inputTokens: 120, outputTokens: 20, costUsd: 0.3 },
    ] });
    const budget = await store.get(taskId);
    assert.equal(budget.used.calls, 1);
    assert.equal(budget.used.physicalAttempts, 2);
    assert.equal(budget.used.costUsd, 0.4);
    const attempts = await pool.query("SELECT attempt,fallback FROM control.provider_attempts WHERE reservation_id=$1 ORDER BY attempt", [reservation.id]);
    assert.deepEqual(attempts.rows, [{ attempt: 1, fallback: false }, { attempt: 2, fallback: true }]);
    assert.ok((await store.events(taskId)).some((event) => event.eventType === "PHYSICAL_USAGE_RECONCILED"));
    await pool.query("DELETE FROM control.tasks WHERE id=$1", [taskId]);
  } finally { await pool.end(); }
});
