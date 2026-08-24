import test from "node:test";
import assert from "node:assert/strict";
import { CodexAgentProvider } from "../../../harness/src/providers/adapters/codex-agent-provider.mjs";

test("Codex adapter builds official structured CLI argv without a shell", async () => {
  let call;
  const provider = new CodexAgentProvider({ executable: "codex", host: { execute: async (request) => { call = request; return { structured: { outcome: "pass", summary: "ok", artifacts: [] }, usage: { billingMode: "subscription", monetaryCostKnown: false }, durationMs: 1, terminationReason: "completed", requestId: "pex" }; }, cancel: () => true }, environment: {} });
  await provider.execute({ agent: "implementer", prompt: "literal ; syntax", schema: { type: "object" }, worktree: { root: "/workspace/project", checkpoint: "/workspace/project" }, constraints: { timeoutMs: 1000, mutation: "read-only", network: "provider-only" }, invocation: { taskId: "t", runId: "r", stage: "s", reservationId: "b", logicalInvocationId: "l" } });
  assert.deepEqual(call.args.slice(0, 8), ["exec", "--ephemeral", "--json", "--sandbox", "read-only", "--ignore-user-config", "--ignore-rules", "--output-schema"]);
  assert.equal(call.args.at(-1), "literal ; syntax");
});
