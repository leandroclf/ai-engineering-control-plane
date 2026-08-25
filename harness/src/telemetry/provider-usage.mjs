import { normalizeUsage } from "../budget/budget-policy.mjs";

export function normalizeProviderUsage(usage = {}, descriptor = {}) {
  const billingMode = descriptor.billingMode ?? usage.billingMode ?? "unknown";
  const monetaryCostKnown = billingMode === "api-metered"
    ? usage.monetaryCostKnown !== false
    : usage.monetaryCostKnown === true && Number.isFinite(Number(usage.providerReportedCostUsd));
  const providerReportedCostUsd = usage.providerReportedCostUsd === null || usage.providerReportedCostUsd === undefined
    ? null
    : Number(usage.providerReportedCostUsd);
  if (providerReportedCostUsd !== null && (!Number.isFinite(providerReportedCostUsd) || providerReportedCostUsd < 0)) throw new TypeError("providerReportedCostUsd must be non-negative");
  const normalized = normalizeUsage({ calls: usage.calls ?? 1, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd: monetaryCostKnown ? (providerReportedCostUsd ?? usage.costUsd) : 0 });
  return Object.freeze({
    ...normalized,
    billingMode,
    monetaryCostKnown,
    providerReportedCostUsd,
    cachedInputTokens: Math.max(0, Number(usage.cachedInputTokens ?? usage.cacheReadTokens ?? 0)),
    agentTurns: usage.agentTurns === undefined ? undefined : Math.max(0, Number(usage.agentTurns)),
    wallTimeMs: Math.max(0, Number(usage.wallTimeMs ?? 0)),
    ...(usage.providerAttempts ? { providerAttempts: usage.providerAttempts } : {}),
  });
}
