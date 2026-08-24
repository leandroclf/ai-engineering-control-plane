import test from "node:test";
import assert from "node:assert/strict";
import { OpenCodeAgentProvider } from "../../../harness/src/providers/adapters/opencode-agent-provider.mjs";

test("OpenCodeAgentProvider preserves controller structured execution and usage", async () => {
  const controller = {
    runDetailed: async (request) => ({
      structured: { outcome: "pass", summary: "ok", artifacts: [] },
      usage: { inputTokens: 1, outputTokens: 2, costUsd: 0.1, provider: "openai" },
      request,
    }),
  };
  const provider = new OpenCodeAgentProvider({ controller });
  const result = await provider.execute({ agent: "architect", prompt: "test", schema: { type: "object" }, worktree: { root: "/workspace/project", checkpoint: "/workspace/project" }, constraints: { timeoutMs: 1000, mutation: "read-only", network: "provider-only" }, invocation: { taskId: "t", runId: "r", stage: "s", reservationId: "b", logicalInvocationId: "l" } });
  assert.equal(result.provider.providerId, "opencode-litellm");
  assert.equal(result.usage.costUsd, 0.1);
});
