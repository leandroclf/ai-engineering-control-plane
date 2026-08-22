export const DEFAULT_BUDGET_LIMITS = Object.freeze({
  maxCalls: 20,
  maxInputTokens: 180_000,
  maxOutputTokens: 40_000,
  maxCostUsd: 10,
  maxIterations: 2,
});

export function normalizeUsage(value = {}) {
  const usage = {
    calls: Number(value.calls ?? 1),
    inputTokens: Number(value.inputTokens ?? 0),
    outputTokens: Number(value.outputTokens ?? 0),
    costUsd: Number(value.costUsd ?? 0),
    iterations: Number(value.iterations ?? 0),
  };
  for (const [name, amount] of Object.entries(usage)) {
    if (!Number.isFinite(amount) || amount < 0) throw new TypeError(`invalid usage.${name}`);
  }
  return usage;
}

export function reservationUpperBound({ contextBudget = 0, maxOutputTokens = 4_096, maxCostUsd = 1 } = {}) {
  return normalizeUsage({ calls: 1, inputTokens: contextBudget, outputTokens: maxOutputTokens, costUsd: maxCostUsd });
}
