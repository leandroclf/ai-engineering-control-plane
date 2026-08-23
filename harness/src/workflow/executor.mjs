import { Workflow } from "./workflow.mjs";
import { redactText } from "../security/redact.mjs";

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
      let result;
      try {
        result = await handler({ run: structuredClone(run), task: task ? structuredClone(task) : null, state: run.state, context });
      } catch (error) {
        const failureOutcome = Object.keys(stateDefinition.next).find((outcome) => ["failed", "error", "blocked"].includes(outcome));
        const failureState = failureOutcome ? stateDefinition.next[failureOutcome] : null;
        if (failureOutcome && failureState && this.workflow.isTerminal(failureState)) {
          run = await this.store.transition(run.id, {
            expectedVersion: run.version,
            outcome: failureOutcome,
            to: failureState,
            terminal: true,
            evidence: { error: { name: error.name ?? "Error", code: error.code ?? null, message: redactText(error.message).slice(0, 240) } },
            startedAt,
            finishedAt: new Date(),
          });
        }
        throw error;
      }
      const outcome = typeof result === "string" ? result : result?.outcome;
      const next = this.workflow.transition(run.state, outcome);
      const evidence = context ? {
        contextId: context.contextId,
        contextTokenCount: context.tokenCount,
        contextBudget: context.budget,
        contextArtifacts: context.artifacts.map(({ id, reason, provenance }) => ({ id, reason, provenance })),
        contextEnvelope: context.envelope,
        contextMetrics: context.metrics,
        contextMetadata: context.metadata,
      } : {};
      if (typeof result === "object" && result?.evidence) evidence.handler = structuredClone(result.evidence);
      if (this.telemetry) {
        evidence.telemetryExported = await this.telemetry.stage({
          taskId: task?.id ?? run.taskId,
          runId: run.id,
          stage: run.state,
          attempt: run.version,
          outcome,
          ...(this.telemetry.acceptsTiming ? { startedAt, finishedAt: new Date() } : {}),
          ...(result?.evidence?.usage ? { usage: result.evidence.usage } : {}),
          ...(result?.evidence?.budget ? { budget: result.evidence.budget } : {}),
          ...(stateDefinition.agent ? { agent: stateDefinition.agent } : {}),
          ...(context?.contextId ? { contextId: context.contextId } : {}),
          ...(context?.metrics ? { contextMetrics: context.metrics } : {}),
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
