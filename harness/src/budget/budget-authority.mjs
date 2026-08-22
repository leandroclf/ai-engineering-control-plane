import { randomUUID } from "node:crypto";
import { DEFAULT_BUDGET_LIMITS, reservationUpperBound } from "./budget-policy.mjs";

export class BudgetAuthority {
  constructor({ store, limits = DEFAULT_BUDGET_LIMITS, reservation = {}, estimator = null }) { this.store = store; this.limits = limits; this.reservation = reservation; this.estimator = estimator; }
  ensure(taskId, overrides = {}) { return this.store.ensure(taskId, { ...this.limits, ...overrides }); }
  get(taskId) { return this.store.get(taskId); }
  events(taskId) { return this.store.events(taskId); }
  cancel(taskId) { return this.store.cancel(taskId); }
  reconcile() { return this.store.expireStale(); }
  async reserve({ taskId, runId, stage, contextBudget = 0, attempt = 1, invocation = null }) {
    const estimatedUsage = invocation && this.estimator
      ? await this.estimator.estimate(invocation)
      : reservationUpperBound({ contextBudget, ...this.reservation });
    return this.store.reserve({ taskId, runId, stage, estimatedUsage, idempotencyKey: `${taskId}:${runId}:${stage}:${attempt}`, logicalInvocationId: randomUUID(), modelAlias: invocation?.alias ?? null });
  }
  commit({ reservationId, actualUsage }) { return this.store.commit(reservationId, actualUsage); }
  release({ reservationId }) { return this.store.release(reservationId); }
  consumeIteration(taskId, runId) { return this.store.consumeIteration(taskId, runId); }
}
