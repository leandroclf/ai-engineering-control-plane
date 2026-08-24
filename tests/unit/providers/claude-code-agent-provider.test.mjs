import test from "node:test";
import assert from "node:assert/strict";
import { ClaudeCodeAgentProvider } from "../../../harness/src/providers/adapters/claude-code-agent-provider.mjs";
import { officialAuthCommand } from "../../../harness/src/cli/providers.mjs";

test("Claude Code auth commands use the official auth namespace", () => {
  assert.deepEqual(officialAuthCommand("claude-code", "login"), { executable: "claude", args: ["auth", "login"] });
  assert.deepEqual(officialAuthCommand("claude-code", "logout"), { executable: "claude", args: ["auth", "logout"] });
});

test("Claude Code doctor reports sanitized auth status", async () => {
  const calls = [];
  const provider = new ClaudeCodeAgentProvider({
    executable: "claude",
    host: {
      supervisor: {
        execute: async (request) => {
          calls.push(request);
          if (request.args[0] === "--version") return { code: 0, stdout: "2.1.241 (Claude Code)\n" };
          return { code: 0, stdout: '{"loggedIn":true,"email":"secret@example.com","orgName":"private"}\n' };
        },
      },
      execute: async () => { throw new Error("not used"); },
      cancel: () => true,
    },
    environment: {},
  });

  const health = await provider.health();
  assert.equal(health.auth.status, "authenticated");
  assert.equal(health.auth.email, undefined);
  assert.deepEqual(calls.map((call) => call.args), [["--version"], ["auth", "status", "--json"]]);
});

test("Claude Code adapter uses headless JSON and schema flags", async () => {
  let call;
  const provider = new ClaudeCodeAgentProvider({ executable: "claude", host: { execute: async (request) => { call = request; return { structured: { outcome: "pass", summary: "ok", artifacts: [] }, usage: { billingMode: "subscription-credit", monetaryCostKnown: false }, durationMs: 1, terminationReason: "completed", requestId: "pex" }; }, cancel: () => true }, environment: {} });
  await provider.execute({ agent: "code-reviewer", prompt: "literal ; syntax", schema: { type: "object" }, worktree: { root: "/workspace/project", checkpoint: "/workspace/project" }, constraints: { timeoutMs: 1000, mutation: "read-only", network: "provider-only" }, invocation: { taskId: "t", runId: "r", stage: "s", reservationId: "b", logicalInvocationId: "l" } });
  assert.deepEqual(call.args.slice(0, 5), ["-p", "literal ; syntax", "--output-format", "json", "--json-schema"]);
  assert.deepEqual(JSON.parse(call.args[5]), { type: "object" });
});

test("Claude Code read-only requests use plan mode and read-only tools", async () => {
  let call;
  const provider = new ClaudeCodeAgentProvider({
    executable: "claude",
    host: {
      execute: async (request) => {
        call = request;
        return { structured: { outcome: "pass", summary: "ok", artifacts: [] }, usage: { billingMode: "subscription-credit", monetaryCostKnown: false }, durationMs: 1, terminationReason: "completed", requestId: "pex" };
      },
      cancel: () => true,
    },
    environment: {},
  });
  await provider.execute({ agent: "architect", prompt: "inspect", schema: { type: "object" }, worktree: { root: "/workspace/project", checkpoint: "/workspace/project" }, constraints: { timeoutMs: 1000, mutation: "read-only", network: "provider-only" }, invocation: { taskId: "t", runId: "r", stage: "s", reservationId: "b", logicalInvocationId: "l" } });
  assert.deepEqual(call.args.slice(-5), ["--permission-mode", "plan", "--tools", "Read,Glob,Grep", "--no-session-persistence"]);
});
