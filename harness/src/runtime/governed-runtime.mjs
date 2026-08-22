import { WorkflowExecutor } from "../workflow/executor.mjs";

export class GovernedRuntime {
  constructor({ definition, store, handlers, contextProvider = null, telemetry = null }) {
    this.definition = definition;
    this.store = store;
    this.executor = new WorkflowExecutor({ definition, store, handlers, contextProvider, telemetry });
  }

  async start({ idempotencyKey, metadata = {} }) {
    if (!idempotencyKey) throw new TypeError("idempotencyKey is required");
    const task = await this.store.createTask({
      idempotencyKey,
      workflowVersion: this.definition.version,
      metadata,
    });
    const created = await this.store.createRun({
      taskId: task.id,
      initialState: this.definition.initial,
      policyVersion: this.definition.version,
    });
    const run = await this.executor.execute(created.id);
    return { task, run, stages: await this.store.listStages(run.id) };
  }

  async resume(runId) {
    const run = await this.executor.execute(runId);
    return { run, stages: await this.store.listStages(run.id) };
  }
}
