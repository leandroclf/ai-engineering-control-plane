import { normalizeUsage } from "./budget-policy.mjs";

function finiteNonNegative(value, name) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed < 0) throw new TypeError(`invalid provider attempt ${name}`);
  return parsed;
}

export function reconcilePhysicalUsage(logicalUsage = {}, providerAttempts = []) {
  if (!Array.isArray(providerAttempts)) throw new TypeError("providerAttempts must be an array");
  if (!providerAttempts.length) return {
    actualUsage: normalizeUsage(logicalUsage),
    physicalAttempts: [],
    fallbackCostDelta: 0,
  };
  const seen = new Set();
  const normalized = providerAttempts.map((attempt, index) => {
    const attemptNumber = Number(attempt.attempt ?? index + 1);
    if (!Number.isInteger(attemptNumber) || attemptNumber < 1 || seen.has(attemptNumber)) throw new TypeError("provider attempt numbers must be unique positive integers");
    seen.add(attemptNumber);
    if (!attempt.provider || !attempt.model || !attempt.providerRequestId) throw new TypeError("provider, model and providerRequestId are required for physical reconciliation");
    if (attempt.pricingKnown !== true) throw Object.assign(new Error(`PRICING_UNKNOWN:${attempt.provider}/${attempt.model}`), { name: "PricingUnknownError" });
    return Object.freeze({
      attempt: attemptNumber,
      provider: String(attempt.provider),
      model: String(attempt.model),
      providerRequestId: String(attempt.providerRequestId),
      fallback: attemptNumber > 1 || attempt.fallback === true,
      inputTokens: finiteNonNegative(attempt.inputTokens, "inputTokens"),
      outputTokens: finiteNonNegative(attempt.outputTokens, "outputTokens"),
      cachedInputTokens: finiteNonNegative(attempt.cachedInputTokens, "cachedInputTokens"),
      costUsd: finiteNonNegative(attempt.costUsd, "costUsd"),
      durationMs: finiteNonNegative(attempt.durationMs, "durationMs"),
      status: attempt.status === "failed" ? "failed" : "succeeded",
    });
  }).sort((left, right) => left.attempt - right.attempt);
  const actualUsage = normalizeUsage({
    calls: 1,
    inputTokens: normalized.reduce((sum, item) => sum + item.inputTokens, 0),
    outputTokens: normalized.reduce((sum, item) => sum + item.outputTokens, 0),
    costUsd: normalized.reduce((sum, item) => sum + item.costUsd, 0),
  });
  return {
    actualUsage,
    physicalAttempts: normalized,
    fallbackCostDelta: normalized.slice(1).reduce((sum, item) => sum + item.costUsd, 0),
  };
}

