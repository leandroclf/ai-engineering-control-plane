import { randomUUID } from "node:crypto";

export class AgentHarnessLoop {
  constructor({ router, evaluator, recovery, memory, telemetry, policy, limits = {} }) {
    this.router = router; this.evaluator = evaluator; this.recovery = recovery; this.memory = memory; this.telemetry = telemetry; this.policy = policy;
    this.limits = { maxSteps: 20, maxRetries: 2, maxExecutionTimeMs: 120_000, ...limits };
  }
  async run({ taskId = randomUUID(), agentId = "agent", projectId = "local", steps, expected, context = {} }) {
    const traceId = randomUUID(); const started = Date.now(); const actions = []; const observations = []; let retries = 0;
    if (!Array.isArray(steps) || !steps.length) throw new Error("HARNESS_STEPS_REQUIRED");
    for (let index = 0; index < Math.min(steps.length, this.limits.maxSteps); index += 1) {
      if (Date.now() - started > this.limits.maxExecutionTimeMs) throw new Error("HARNESS_EXECUTION_TIMEOUT");
      const step = steps[index]; this.policy?.authorize(step.requiredLevel ?? 0, { humanApproval: context.humanApproval });
      try {
        const executed = await this.router.execute(step, { ...context, taskId, traceId, agentId, projectId });
        actions.push(executed); observations.push(executed.result);
        await this.telemetry?.stage?.({ traceId, taskId, agentId, projectId, stage: "capability", capability: step.capability, durationMs: executed.durationMs });
      } catch (error) {
        if (retries >= this.limits.maxRetries || !this.recovery) throw error;
        retries += 1; const recovered = await this.recovery.recover({ error, step, attempt: retries, context: { traceId, taskId } });
        if (!recovered?.retry) throw error;
        index -= 1;
      }
    }
    const evaluation = await this.evaluator.evaluate({ result: { status: "success", actions }, observations, expected });
    const result = { traceId, taskId, agentId, projectId, status: evaluation.status === "ACCEPT" ? "success" : "failed", actions, observations, retries, evaluation, durationMs: Date.now() - started };
    await this.memory?.record?.({ kind: "episodic", taskId, traceId, result });
    return result;
  }
}
