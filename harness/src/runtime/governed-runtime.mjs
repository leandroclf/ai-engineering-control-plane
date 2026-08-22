import { WorkflowExecutor } from "../workflow/executor.mjs";

export class GovernedRuntime {
  constructor({ definition, store, handlers, contextProvider = null, telemetry = null, budgetAuthority = null, preflight = null, readiness = null, capabilities = null, metadata = {} }) {
    this.definition = definition;
    this.store = store;
    this.budgetAuthority = budgetAuthority;
    this.preflight = preflight;
    this.readiness = readiness;
    this.capabilityProvider = capabilities;
    this.metadata = metadata;
    this.executor = new WorkflowExecutor({ definition, store, handlers, contextProvider, telemetry });
  }

  async start({ idempotencyKey, metadata = {}, constraints = {} }) {
    if (!idempotencyKey) throw new TypeError("idempotencyKey is required");
    if (this.preflight) await this.preflight({ id: null, metadata: structuredClone(metadata) });
    const task = await this.store.createTask({
      idempotencyKey,
      workflowVersion: this.definition.version,
      metadata,
    });
    if (this.budgetAuthority) {
      await this.budgetAuthority.reconcile();
      await this.budgetAuthority.ensure(task.id, constraints);
    }
    if (task.idempotentReplay && this.store.getLatestRunForTask) {
      const existing = await this.store.getLatestRunForTask(task.id);
      if (existing) return { task, run: existing, stages: await this.store.listStages(existing.id), links: this.#links(existing.id), idempotentReplay: true };
    }
    const created = await this.store.createRun({
      taskId: task.id,
      initialState: this.definition.initial,
      policyVersion: this.definition.version,
    });
    const run = await this.executor.execute(created.id);
    return { task, run, stages: await this.store.listStages(run.id), links: this.#links(run.id) };
  }

  async resume(runId) {
    if (this.budgetAuthority) await this.budgetAuthority.reconcile();
    const run = await this.executor.execute(runId);
    return { run, stages: await this.store.listStages(run.id) };
  }

  async getRun(runId) { const run = await this.store.getRun(runId); return { run, stages: await this.store.listStages(runId) }; }
  listRuns(filters) { return this.store.listRuns(filters); }
  getTask(taskId) { return this.store.getTask(taskId); }
  async getAudit(runId) {
    const run = await this.store.getRun(runId);
    const stages = await this.store.listStages(runId);
    const budget = this.budgetAuthority ? await this.budgetAuthority.events(run.taskId) : [];
    return { runId, taskId: run.taskId, items: [
      ...stages.map((stage) => ({ type: "STAGE", occurredAt: stage.finished_at ?? stage.finishedAt, data: stage })),
      ...budget.filter((event) => !event.runId || event.runId === runId).map((event) => ({ type: `BUDGET_${event.eventType}`, occurredAt: event.createdAt, data: event })),
    ].sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt))) };
  }
  async getGates(runId) { const stages = await this.store.listStages(runId); return { items: stages.flatMap((stage) => stage.evidence?.handler?.gates ?? stage.evidence?.gates ?? []) }; }
  async getFindings(runId) { const gates = await this.getGates(runId); return { items: gates.items.flatMap((gate) => gate.findings ?? gate.evidence?.findings ?? []) }; }
  async ready() { return this.readiness ? this.readiness() : { status: "ready", checks: { runtime: "ok" }, versions: this.metadata.versions ?? {} }; }
  capabilities(request) { return this.capabilityProvider ? this.capabilityProvider(request) : { status: "unavailable", items: [] }; }
  workflows() { return { items: [{ name: this.definition.name, version: this.definition.version, initial: this.definition.initial, terminal: this.definition.terminal }] }; }
  policies() { return { items: this.metadata.policies ?? [] }; }
  models() { return { items: this.metadata.models ?? [] }; }
  getContext(contextId) { return this.store.getContext(contextId); }
  async cancelRun(runId) { const run = await this.store.cancelRun(runId); if (this.budgetAuthority) await this.budgetAuthority.cancel(run.taskId); return { run, stages: await this.store.listStages(runId) }; }
  getBudget(taskId) { if (!this.budgetAuthority) throw new Error("budget authority unavailable"); return this.budgetAuthority.get(taskId); }
  getBudgetEvents(taskId) { if (!this.budgetAuthority) throw new Error("budget authority unavailable"); return this.budgetAuthority.events(taskId); }
  cancelBudget(taskId) { if (!this.budgetAuthority) throw new Error("budget authority unavailable"); return this.budgetAuthority.cancel(taskId); }
  #links(runId) { return { self: `/v1/runs/${runId}`, stages: `/v1/runs/${runId}/stages`, audit: `/v1/runs/${runId}/audit`, gates: `/v1/runs/${runId}/gates`, findings: `/v1/runs/${runId}/findings` }; }
}
