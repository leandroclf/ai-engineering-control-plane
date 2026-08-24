export class ProviderError extends Error {
  constructor(code, message, { retryable = false, cause = undefined, details = {} } = {}) {
    super(message, { cause });
    this.name = "ProviderError";
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export const PROVIDER_ERROR_CODES = Object.freeze({
  AUTH_REQUIRED: "AUTH_REQUIRED",
  POLICY_DENIED: "POLICY_DENIED",
  QUOTA_EXHAUSTED: "QUOTA_EXHAUSTED",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PROVIDER_OUTPUT_LIMIT_EXCEEDED: "PROVIDER_OUTPUT_LIMIT_EXCEEDED",
  PROVIDER_CHECKPOINT_FAILED: "PROVIDER_FALLBACK_CHECKPOINT_FAILED",
  PROVIDER_INVALID_OUTPUT: "PROVIDER_INVALID_OUTPUT",
  PROVIDER_CANCELLED: "PROVIDER_CANCELLED",
  PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT",
});

export function providerError(code, message, options) {
  return new ProviderError(code, message, options);
}
