import { randomUUID } from "node:crypto";
import { DEFAULT_BUDGET_LIMITS, reservationUpperBound } from "./budget-policy.mjs";

export class BudgetAuthority {
  constructor({ store, limits = DEFAULT_BUDGET_LIMITS, reservation = {} }) { this.store = store; this.limits = limits; this.reservation = reservation; }
  ensure(taskId) { return this.store.ensure(taskId, this.limits); }
  get(taskId) { return this.store.get(taskId); }
  events(taskId) { return this.store.events(taskId); }
  cancel(taskId) { return this.store.cancel(taskId); }
  reconcile() { return this.store.expireStale(); }
  reserve({ taskId, runId, stage, contextBudget = 0, attempt = 1 }) {
    return this.store.reserve({ taskId, runId, stage, estimatedUsage: reservationUpperBound({ contextBudget, ...this.reservation }), idempotencyKey: `${taskId}:${runId}:${stage}:${attempt}`, invocationId: randomUUID() });
  }
  commit({ reservationId, actualUsage }) { return this.store.commit(reservationId, actualUsage); }
  release({ reservationId }) { return this.store.release(reservationId); }
  consumeIteration(taskId, runId) { return this.store.consumeIteration(taskId, runId); }
}
