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
});
