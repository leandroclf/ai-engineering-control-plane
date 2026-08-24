import test from "node:test";
import assert from "node:assert/strict";
import { ClaudeCodeAgentProvider } from "../../../harness/src/providers/adapters/claude-code-agent-provider.mjs";

test("Claude Code adapter uses headless JSON and schema flags", async () => {
  let call;
  const provider = new ClaudeCodeAgentProvider({ executable: "claude", host: { execute: async (request) => { call = request; return { structured: { outcome: "pass", summary: "ok", artifacts: [] }, usage: { billingMode: "subscription-credit", monetaryCostKnown: false }, durationMs: 1, terminationReason: "completed", requestId: "pex" }; }, cancel: () => true }, environment: {} });
  await provider.execute({ agent: "code-reviewer", prompt: "literal ; syntax", schema: { type: "object" }, worktree: { root: "/workspace/project", checkpoint: "/workspace/project" }, constraints: { timeoutMs: 1000, mutation: "read-only", network: "provider-only" }, invocation: { taskId: "t", runId: "r", stage: "s", reservationId: "b", logicalInvocationId: "l" } });
  assert.deepEqual(call.args.slice(0, 5), ["-p", "literal ; syntax", "--output-format", "json", "--json-schema"]);
});
