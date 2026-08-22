import { Workflow } from "./workflow.mjs";

export class WorkflowExecutor {
  constructor({ definition, store, handlers, contextProvider = null }) {
    this.workflow = new Workflow(definition);
    this.store = store;
    this.handlers = handlers;
    this.contextProvider = contextProvider;
  }

  async execute(runId) {
    let run = await this.store.getRun(runId);
    const task = this.contextProvider ? await this.store.getTask(run.taskId) : null;
    while (!this.workflow.isTerminal(run.state)) {
      const handler = this.handlers[run.state];
      if (!handler) throw new Error(`missing handler for workflow state: ${run.state}`);
      const stateDefinition = this.workflow.definition.states[run.state];
      const context = this.contextProvider && stateDefinition.context
        ? await this.contextProvider.load({ task, state: run.state, policy: stateDefinition.context })
        : null;
      const outcome = await handler({ run: structuredClone(run), state: run.state, context });
      const next = this.workflow.transition(run.state, outcome);
      const evidence = context ? {
        contextId: context.contextId,
        contextTokenCount: context.tokenCount,
        contextBudget: context.budget,
        contextArtifacts: context.artifacts.map(({ id, reason, provenance }) => ({ id, reason, provenance })),
      } : {};
      run = await this.store.transition(run.id, {
        expectedVersion: run.version,
        outcome,
        to: next,
        terminal: this.workflow.isTerminal(next),
        evidence,
      });
    }
    return run;
  }
}
