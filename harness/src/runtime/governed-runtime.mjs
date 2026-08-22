import { WorkflowExecutor } from "../workflow/executor.mjs";

export class GovernedRuntime {
  constructor({ definition, store, handlers, contextProvider = null, telemetry = null, budgetAuthority = null, preflight = null }) {
    this.definition = definition;
    this.store = store;
    this.budgetAuthority = budgetAuthority;
    this.preflight = preflight;
    this.executor = new WorkflowExecutor({ definition, store, handlers, contextProvider, telemetry });
  }

  async start({ idempotencyKey, metadata = {} }) {
    if (!idempotencyKey) throw new TypeError("idempotencyKey is required");
    if (this.preflight) await this.preflight({ id: null, metadata: structuredClone(metadata) });
    const task = await this.store.createTask({
      idempotencyKey,
      workflowVersion: this.definition.version,
      metadata,
    });
    if (this.budgetAuthority) {
      await this.budgetAuthority.reconcile();
      await this.budgetAuthority.ensure(task.id);
    }
    const created = await this.store.createRun({
      taskId: task.id,
      initialState: this.definition.initial,
      policyVersion: this.definition.version,
    });
    const run = await this.executor.execute(created.id);
    return { task, run, stages: await this.store.listStages(run.id) };
  }

  async resume(runId) {
    if (this.budgetAuthority) await this.budgetAuthority.reconcile();
    const run = await this.executor.execute(runId);
    return { run, stages: await this.store.listStages(run.id) };
  }

  async getRun(runId) { const run = await this.store.getRun(runId); return { run, stages: await this.store.listStages(runId) }; }
  async cancelRun(runId) { const run = await this.store.cancelRun(runId); if (this.budgetAuthority) await this.budgetAuthority.cancel(run.taskId); return { run, stages: await this.store.listStages(runId) }; }
  getBudget(taskId) { if (!this.budgetAuthority) throw new Error("budget authority unavailable"); return this.budgetAuthority.get(taskId); }
  getBudgetEvents(taskId) { if (!this.budgetAuthority) throw new Error("budget authority unavailable"); return this.budgetAuthority.events(taskId); }
  cancelBudget(taskId) { if (!this.budgetAuthority) throw new Error("budget authority unavailable"); return this.budgetAuthority.cancel(taskId); }
}
