import { ProviderError, PROVIDER_ERROR_CODES } from "../provider-errors.mjs";
import { assertStructuredOutput } from "../provider-contract.mjs";

function parseLines(output, maxBytes = 2 * 1024 * 1024) {
  if (Buffer.byteLength(output ?? "", "utf8") > maxBytes) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_OUTPUT_LIMIT_EXCEEDED, "Codex JSONL output exceeded the parser limit");
  const events = [];
  for (const [index, line] of String(output ?? "").split(/\r?\n/).filter((value) => value.trim()).entries()) {
    try { events.push(JSON.parse(line)); }
    catch { throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, `invalid Codex JSONL event at line ${index + 1}`); }
  }
  return events;
}

export function parseCodexJsonl(output, { request, durationMs = 0 } = {}) {
  const events = parseLines(output);
  const last = events.at(-1) ?? {};
  const decode = (value) => { if (typeof value !== "string") return value; try { return JSON.parse(value); } catch { return undefined; } };
  const structured = events.map((event) => decode(event.structured ?? event.structured_output ?? event.output?.structured ?? event.result?.structured ?? event.result ?? event.item?.structured ?? event.item?.text ?? event.item?.content)).find((value) => value !== undefined)
    ?? decode(last.type === "result" ? last.result : undefined);
  if (!structured || typeof structured !== "object") throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, "Codex did not return structured output");
  assertStructuredOutput(structured, request?.schema);
  const usageEvent = [...events].reverse().find((event) => event.usage || event.type === "turn.completed" || event.type === "thread.completed") ?? {};
  const usage = usageEvent.usage ?? {};
  const failed = events.some((event) => event.type === "error" || event.status === "failed");
  if (failed) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_UNAVAILABLE, "Codex returned a failed execution event", { retryable: true });
  return {
    structured,
    usage: {
      calls: 1,
      inputTokens: usage.input_tokens ?? usage.inputTokens ?? 0,
      outputTokens: usage.output_tokens ?? usage.outputTokens ?? 0,
      cachedInputTokens: usage.cached_input_tokens ?? usage.cachedInputTokens ?? 0,
      agentTurns: events.filter((event) => event.type === "turn.started").length || undefined,
      wallTimeMs: durationMs,
      monetaryCostKnown: false,
      billingMode: "subscription",
    },
    terminationReason: "completed",
    events: events.map((event) => ({ type: event.type ?? "unknown", status: event.status ?? null })).slice(-100),
    requestId: last.id ?? last.thread_id ?? null,
  };
}
