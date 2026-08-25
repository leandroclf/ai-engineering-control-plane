import { normalizeProviderUsage } from "../telemetry/provider-usage.mjs";

export const FALLBACK_PROVIDER_ERROR_CODES = Object.freeze(new Set([
  "PROVIDER_UNAVAILABLE",
  "AUTH_REQUIRED",
  "RATE_LIMITED",
  "QUOTA_EXHAUSTED",
  "TRANSIENT_PROVIDER_ERROR",
]));

export function isFallbackEligible(error) {
  return FALLBACK_PROVIDER_ERROR_CODES.has(error?.code);
}

export function normalizeAgentResult(result, descriptor) {
  return Object.freeze({
    ...result,
    usage: normalizeProviderUsage(result?.usage ?? {}, descriptor),
  });
}
