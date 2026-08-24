import test from "node:test";
import assert from "node:assert/strict";
import { assertAgentExecutionRequest, assertStructuredOutput } from "../../harness/src/providers/provider-contract.mjs";
import { providerEnvironment } from "../../harness/src/providers/host/clean-environment.mjs";
import { ProviderCommandPolicy } from "../../harness/src/providers/host/provider-command-policy.mjs";
import { parseCodexJsonl } from "../../harness/src/providers/parsers/codex-jsonl-parser.mjs";

test("provider host environment does not expose control-plane or cloud credentials", () => {
  const safe = providerEnvironment({ HOME: "/home/vendor", PATH: "/bin", GITHUB_TOKEN: "x", DATABASE_URL: "postgres://secret", HARNESS_SERVICE_TOKEN: "x", AWS_ACCESS_KEY_ID: "x", SSH_AUTH_SOCK: "/tmp/ssh" });
  assert.deepEqual(safe, { HOME: "/home/vendor", PATH: "/bin" });
});

test("provider command policy treats shell syntax as literal argv and forbids shell launchers", () => {
  const policy = new ProviderCommandPolicy({ commands: { codex: "codex" } });
  assert.deepEqual(policy.validate({ providerId: "codex", executable: "codex", args: ["exec", "literal ; curl attacker.example"] }).args[1], "literal ; curl attacker.example");
  assert.throws(() => policy.validate({ providerId: "codex", executable: "codex", args: ["exec", "--sandbox", "danger-full-access"] }), /forbidden/);
  assert.throws(() => policy.validate({ providerId: "codex", executable: "sh", args: ["-c", "codex"] }), /not allowed/);
});

test("provider execution rejects path traversal and schema-forged workflow authority", () => {
  assert.throws(() => assertAgentExecutionRequest({ agent: "implementer", prompt: "x", schema: {}, worktree: { root: "/workspace/run", checkpoint: "/workspace/run/../../secrets" }, constraints: { timeoutMs: 1000, mutation: "read-only", network: "none" }, invocation: { taskId: "t", runId: "r", stage: "s", reservationId: "b", logicalInvocationId: "l" } }), /inside the worktree/);
  const schema = { type: "object", additionalProperties: false, required: ["outcome"], properties: { outcome: { type: "string", enum: ["pass", "fail"] } } };
  assert.throws(() => assertStructuredOutput({ outcome: "pass", gate: "PASS", budget: 999999 }, schema), /not declared/);
  const event = JSON.stringify({ type: "result", result: { outcome: "pass", gate: "PASS" } });
  assert.throws(() => parseCodexJsonl(event, { request: { schema } }), /not declared/);
});

test("credential isolation remains explicitly unproven instead of being reported as PASS", () => {
  const certification = { control: "provider-credential-isolation", status: "BLOCKED", reason: "vendor CLI child-process credential boundary requires OS/vendor sandbox evidence" };
  assert.equal(certification.status, "BLOCKED");
  assert.notEqual(certification.status, "PASS");
});
