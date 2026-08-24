import { ProviderError, PROVIDER_ERROR_CODES } from "../provider-errors.mjs";
import { assertStructuredOutput } from "../provider-contract.mjs";

export function parseClaudeJson(output, { request, durationMs = 0 } = {}) {
  if (Buffer.byteLength(output ?? "", "utf8") > 2 * 1024 * 1024) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_OUTPUT_LIMIT_EXCEEDED, "Claude output exceeded the parser limit");
  let payload;
  try { payload = JSON.parse(String(output ?? "")); }
  catch { throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, "invalid Claude JSON output"); }
  if (payload?.is_error || payload?.error) {
    const message = JSON.stringify(payload.error ?? payload.message ?? "provider error").toLowerCase();
    if (/auth|login|credential/.test(message)) throw new ProviderError(PROVIDER_ERROR_CODES.AUTH_REQUIRED, "Claude authentication is required");
    if (/quota|rate.?limit|credit/.test(message)) throw new ProviderError(PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED, "Claude subscription quota is unavailable", { retryable: true });
    throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_UNAVAILABLE, "Claude returned an error", { retryable: true });
  }
  const decode = (value) => { if (typeof value !== "string") return value; try { return JSON.parse(value); } catch { return undefined; } };
  const structured = decode(payload.structured_output ?? payload.structured ?? payload.result?.structured ?? (payload.result && typeof payload.result === "object" && !Array.isArray(payload.result) ? payload.result : payload.result));
  if (!structured || typeof structured !== "object") throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, "Claude did not return structured output");
  assertStructuredOutput(structured, request?.schema);
  const usage = payload.usage ?? {};
  return {
    structured,
    usage: {
      calls: 1,
      inputTokens: usage.input_tokens ?? usage.inputTokens ?? 0,
      outputTokens: usage.output_tokens ?? usage.outputTokens ?? 0,
      cachedInputTokens: usage.cache_read_input_tokens ?? usage.cachedInputTokens ?? 0,
      agentTurns: payload.num_turns ?? payload.agent_turns,
      wallTimeMs: durationMs,
      providerReportedCostUsd: payload.total_cost_usd ?? null,
      monetaryCostKnown: payload.total_cost_usd !== undefined,
      billingMode: "subscription-credit",
    },
    terminationReason: "completed",
    requestId: payload.session_id ?? payload.request_id ?? null,
  };
}
