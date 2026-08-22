export class BudgetExceededError extends Error {
  constructor(limit) {
    super(`task budget exceeded: ${limit}`);
    this.name = "BudgetExceededError";
    this.limit = limit;
  }
}

export class TaskBudget {
  constructor(limits) {
    this.limits = { ...limits };
    this.usage = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  }

  consume({ inputTokens = 0, outputTokens = 0, costUsd = 0 }) {
    const next = {
      calls: this.usage.calls + 1,
      inputTokens: this.usage.inputTokens + inputTokens,
      outputTokens: this.usage.outputTokens + outputTokens,
      costUsd: this.usage.costUsd + costUsd,
    };
    const checks = [
      ["maxCalls", next.calls],
      ["maxInputTokens", next.inputTokens],
      ["maxOutputTokens", next.outputTokens],
      ["maxCostUsd", next.costUsd],
    ];
    for (const [limit, value] of checks) {
      if (this.limits[limit] !== undefined && value > this.limits[limit]) {
        throw new BudgetExceededError(limit);
      }
    }
    this.usage = next;
    return { ...this.usage };
  }
}
