import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { ProviderHost } from "../../harness/src/providers/host/provider-host.mjs";
import { ProviderCommandPolicy } from "../../harness/src/providers/host/provider-command-policy.mjs";
import { ProviderProcessSupervisor } from "../../harness/src/providers/host/provider-process-supervisor.mjs";
import { parseCodexJsonl } from "../../harness/src/providers/parsers/codex-jsonl-parser.mjs";
import { parseClaudeJson } from "../../harness/src/providers/parsers/claude-json-parser.mjs";
import { CodexAgentProvider } from "../../harness/src/providers/adapters/codex-agent-provider.mjs";
import { ClaudeCodeAgentProvider } from "../../harness/src/providers/adapters/claude-code-agent-provider.mjs";

const roots = [];
after(async () => { await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))); });
function request(root) { return { agent: "implementer", prompt: "literal ; no shell", schema: { type: "object" }, worktree: { root, checkpoint: root }, constraints: { timeoutMs: 5000, mutation: "read-only", network: "provider-only" }, invocation: { taskId: "task", runId: "run", stage: "implement", reservationId: "reservation", logicalInvocationId: `invocation-${Date.now()}-${Math.random()}` } }; }

test("fake Codex and Claude adapters execute through bounded argv and structured parsers", async () => {
  const root = await mkdtemp(`${tmpdir()}/aicp-provider-`); roots.push(root);
  const codexPath = resolve("tests/fixtures/providers/fake-codex.mjs");
  const claudePath = resolve("tests/fixtures/providers/fake-claude.mjs");
  const supervisor = new ProviderProcessSupervisor();
  const host = new ProviderHost({ supervisor, commandPolicy: new ProviderCommandPolicy({ commands: { "codex-subscription": codexPath, "claude-code-subscription": claudePath } }), environment: { ...process.env, FAKE_PROVIDER_MODE: "success" } });
  const codex = new CodexAgentProvider({ host, executable: codexPath, environment: { ...process.env, FAKE_PROVIDER_MODE: "success" } });
  const claude = new ClaudeCodeAgentProvider({ host, executable: claudePath, environment: { ...process.env, FAKE_PROVIDER_MODE: "success" } });
  const codexResult = await codex.execute(request(root));
  const claudeResult = await claude.execute(request(root));
  assert.equal(codexResult.structured.outcome, "pass");
  assert.equal(codexResult.usage.monetaryCostKnown, false);
  assert.equal(claudeResult.structured.outcome, "pass");
  assert.equal(claudeResult.usage.providerReportedCostUsd, 0.12);
});

test("provider host fails closed on auth, malformed output and output bombs", async () => {
  const root = await mkdtemp(`${tmpdir()}/aicp-provider-`); roots.push(root);
  const codexPath = resolve("tests/fixtures/providers/fake-codex.mjs");
  const supervisor = new ProviderProcessSupervisor({ maxOutputBytes: 1024 });
  const environment = { ...process.env, FAKE_PROVIDER_MODE: "auth" };
  const host = new ProviderHost({ supervisor, extraAllowedEnvironment: ["FAKE_PROVIDER_MODE"], commandPolicy: new ProviderCommandPolicy({ commands: { "codex-subscription": codexPath } }), environment });
  const provider = new CodexAgentProvider({ host, executable: codexPath, environment });
  await assert.rejects(provider.execute(request(root)), (error) => error.code === "AUTH_REQUIRED");
  const malformed = new ProviderHost({ supervisor: new ProviderProcessSupervisor(), extraAllowedEnvironment: ["FAKE_PROVIDER_MODE"], commandPolicy: new ProviderCommandPolicy({ commands: { "codex-subscription": codexPath } }), environment: { ...process.env, FAKE_PROVIDER_MODE: "malformed" } });
  await assert.rejects(new CodexAgentProvider({ host: malformed, executable: codexPath, environment: { ...process.env, FAKE_PROVIDER_MODE: "malformed" } }).execute(request(root)), /invalid Codex JSONL/);
  const bomb = new ProviderHost({ supervisor: new ProviderProcessSupervisor({ maxOutputBytes: 1024 }), extraAllowedEnvironment: ["FAKE_PROVIDER_MODE"], commandPolicy: new ProviderCommandPolicy({ commands: { "codex-subscription": codexPath } }), environment: { ...process.env, FAKE_PROVIDER_MODE: "bomb" } });
  await assert.rejects(new CodexAgentProvider({ host: bomb, executable: codexPath, environment: { ...process.env, FAKE_PROVIDER_MODE: "bomb" } }).execute(request(root)), (error) => error.code === "PROVIDER_OUTPUT_LIMIT_EXCEEDED");
});
