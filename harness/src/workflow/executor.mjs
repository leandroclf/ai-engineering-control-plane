import { Workflow } from "./workflow.mjs";

export class WorkflowExecutor {
  constructor({ definition, store, handlers, contextProvider = null, telemetry = null }) {
    this.workflow = new Workflow(definition);
    this.store = store;
    this.handlers = handlers;
    this.contextProvider = contextProvider;
    this.telemetry = telemetry;
  }

  async execute(runId) {
    let run = await this.store.getRun(runId);
    const task = this.contextProvider ? await this.store.getTask(run.taskId) : null;
    while (!this.workflow.isTerminal(run.state)) {
      if (run.status === "cancelled") return run;
      const startedAt = new Date();
      const handler = this.handlers[run.state];
      if (!handler) throw new Error(`missing handler for workflow state: ${run.state}`);
      const stateDefinition = this.workflow.definition.states[run.state];
      const context = this.contextProvider && stateDefinition.context
        ? await this.contextProvider.load({ task, state: run.state, policy: stateDefinition.context })
        : null;
      const result = await handler({ run: structuredClone(run), task: task ? structuredClone(task) : null, state: run.state, context });
      const outcome = typeof result === "string" ? result : result?.outcome;
      const next = this.workflow.transition(run.state, outcome);
      const evidence = context ? {
        contextId: context.contextId,
        contextTokenCount: context.tokenCount,
        contextBudget: context.budget,
        contextArtifacts: context.artifacts.map(({ id, reason, provenance }) => ({ id, reason, provenance })),
      } : {};
      if (typeof result === "object" && result?.evidence) evidence.handler = structuredClone(result.evidence);
      if (this.telemetry) {
        evidence.telemetryExported = await this.telemetry.stage({
          taskId: task?.id ?? run.taskId,
          runId: run.id,
          stage: run.state,
          outcome,
          ...(this.telemetry.acceptsTiming ? { startedAt, finishedAt: new Date() } : {}),
          ...(result?.evidence?.usage ? { usage: result.evidence.usage } : {}),
          ...(context?.contextId ? { contextId: context.contextId } : {}),
        });
      }
      run = await this.store.transition(run.id, {
        expectedVersion: run.version,
        outcome,
        to: next,
        terminal: this.workflow.isTerminal(next),
        evidence,
        startedAt,
        finishedAt: new Date(),
      });
    }
    return run;
  }
}
