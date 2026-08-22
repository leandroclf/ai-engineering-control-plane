import { Workflow } from "./workflow.mjs";

export class WorkflowExecutor {
  constructor({ definition, store, handlers }) {
    this.workflow = new Workflow(definition);
    this.store = store;
    this.handlers = handlers;
  }

  async execute(runId) {
    let run = await this.store.getRun(runId);
    while (!this.workflow.isTerminal(run.state)) {
      const handler = this.handlers[run.state];
      if (!handler) throw new Error(`missing handler for workflow state: ${run.state}`);
      const outcome = await handler({ run: structuredClone(run), state: run.state });
      const next = this.workflow.transition(run.state, outcome);
      run = await this.store.transition(run.id, {
        expectedVersion: run.version,
        outcome,
        to: next,
        terminal: this.workflow.isTerminal(next),
      });
    }
    return run;
  }
}
