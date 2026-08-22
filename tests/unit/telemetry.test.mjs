import test from "node:test";
import assert from "node:assert/strict";

import { OtlpHttpTelemetry } from "../../harness/src/telemetry/otlp-http-telemetry.mjs";

test("OTLP telemetry correlates stage metadata and excludes sensitive payloads", async () => {
  const payloads = [];
  const telemetry = new OtlpHttpTelemetry({
    endpoint: "http://collector:4318",
    transport: async (url, options) => { payloads.push([url, JSON.parse(options.body)]); return { ok: true }; },
  });

  const exported = await telemetry.stage({
    taskId: "task-1", runId: "run-1", stage: "verify", outcome: "pass",
    contextId: "ctx_1", prompt: "private prompt", source: "private source", secret: "sk-secret",
  });

  assert.equal(exported, true);
  assert.equal(payloads[0][0], "http://collector:4318/v1/traces");
  const encoded = JSON.stringify(payloads[0][1]);
  assert.match(encoded, /task-1/);
  assert.match(encoded, /run-1/);
  assert.match(encoded, /verify/);
  assert.doesNotMatch(encoded, /private prompt|private source|sk-secret/);
  const spans = payloads[0][1].resourceSpans[0].scopeSpans[0].spans;
  assert.deepEqual(spans.map((span) => span.name), ["aicp.run", "aicp.stage.verify", "aicp.context.compile", "aicp.retrieval.exact", "aicp.retrieval.lexical", "aicp.retrieval.vector", "aicp.retrieval.graph", "aicp.context.pack", "aicp.gate.verify"]);
  assert.equal(spans[1].parentSpanId, spans[0].spanId);
  assert.equal(spans[2].parentSpanId, spans[1].spanId);
});

test("OTLP telemetry correlates run stage generation and physical fallback attempts", async () => {
  const payloads = [];
  const telemetry = new OtlpHttpTelemetry({ endpoint: "http://collector:4318", transport: async (url, options) => { payloads.push([url, JSON.parse(options.body)]); return { ok: true }; } });
  await telemetry.stage({
    taskId: "task-1", runId: "run-1", stage: "implement", attempt: 2, outcome: "pass", agent: "implementer",
    budget: { reservationId: "reservation-1", logicalInvocationId: "logical-1" },
    usage: { inputTokens: 30, outputTokens: 4, providerAttempts: [
      { attempt: 1, provider: "openai", model: "model-a", status: "failed", inputTokens: 10, costUsd: .01 },
      { attempt: 2, provider: "anthropic", model: "model-b", status: "succeeded", inputTokens: 20, outputTokens: 4, costUsd: .02, fallback: true },
    ] },
  });
  const spans = payloads[0][1].resourceSpans[0].scopeSpans[0].spans;
  const byName = Object.fromEntries(spans.map((span) => [span.name, span]));
  assert.equal(byName["aicp.stage.implement"].parentSpanId, byName["aicp.run"].spanId);
  assert.equal(byName["aicp.agent.invoke"].parentSpanId, byName["aicp.stage.implement"].spanId);
  assert.equal(byName["gen_ai.chat"].parentSpanId, byName["aicp.agent.invoke"].spanId);
  assert.equal(byName["aicp.provider.fallback"].parentSpanId, byName["gen_ai.chat"].spanId);
  assert.match(JSON.stringify(payloads[0][1]), /logical-1/);
});
