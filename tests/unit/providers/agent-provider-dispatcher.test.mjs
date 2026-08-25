import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AgentProvider } from "../../../harness/src/providers/provider-contract.mjs";
import { AgentProviderRegistry } from "../../../harness/src/providers/provider-registry.mjs";
import { AgentProviderDispatcher } from "../../../harness/src/providers/agent-provider-dispatcher.mjs";
import { ProviderError } from "../../../harness/src/providers/provider-errors.mjs";

const run = promisify(execFile);
function request(root) { return { agent: "implementer", prompt: "test", schema: { type: "object" }, worktree: { root, checkpoint: root }, constraints: { timeoutMs: 5000, mutation: "workspace-write", network: "provider-only" }, invocation: { taskId: "task", runId: "run", stage: "implement", reservationId: "reservation", logicalInvocationId: "logical" } }; }

test("fallback restores a mutation before alternate provider execution", async () => {
  const root = await mkdtemp(`${tmpdir()}/aicp-dispatcher-`);
  try {
    await run("git", ["init", "-q", root]); await run("git", ["-C", root, "config", "user.email", "aicp@example.test"]); await run("git", ["-C", root, "config", "user.name", "AICP"]);
    await writeFile(join(root, "file.txt"), "before\n"); await run("git", ["-C", root, "add", "."]); await run("git", ["-C", root, "commit", "-qm", "initial"]);
    class FailingProvider extends AgentProvider { constructor() { super({ id: "first", transport: "codex-cli", runtime: "fake", providerFamily: "openai", authMode: "api-key", billingMode: "subscription", executionZone: "provider-host", capabilities: ["coding"] }); } async execute() { await writeFile(join(root, "file.txt"), "dirty\n"); throw new ProviderError("PROVIDER_UNAVAILABLE", "crash", { retryable: true }); } }
    class SuccessProvider extends AgentProvider { constructor() { super({ id: "second", transport: "codex-cli", runtime: "fake", providerFamily: "anthropic", authMode: "api-key", billingMode: "subscription", executionZone: "provider-host", capabilities: ["coding"] }); } async execute(request) { assert.equal(await readFile(join(request.worktree.root, "file.txt"), "utf8"), "before\n"); return { structured: { outcome: "pass", summary: "ok", artifacts: [] }, usage: { calls: 1, inputTokens: 1, outputTokens: 1, monetaryCostKnown: false }, provider: { providerId: this.id, providerFamily: "anthropic", runtime: "fake", authMode: "api-key", billingMode: "subscription" }, mutation: { started: false }, terminationReason: "completed" }; } }
    const registry = new AgentProviderRegistry({ configuration: { providers: {} } }).register(new FailingProvider()).register(new SuccessProvider());
    const dispatcher = new AgentProviderDispatcher({ registry, environment: { AICP_PROVIDER_FALLBACK_ENABLED: "true" } });
    const result = await dispatcher.execute(request(root), { fallback: ["first", "second"] });
    assert.equal(result.structured.outcome, "pass");
    assert.equal(result.provider.providerId, "second");
    assert.equal(result.providerAttempts[0].mutationStarted, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("read-only provider mutation is rejected and restored", async () => {
  const root = await mkdtemp(`${tmpdir()}/aicp-dispatcher-`);
  try {
    await run("git", ["init", "-q", root]); await run("git", ["-C", root, "config", "user.email", "aicp@example.test"]); await run("git", ["-C", root, "config", "user.name", "AICP"]);
    await writeFile(join(root, "file.txt"), "before\n"); await run("git", ["-C", root, "add", "."]); await run("git", ["-C", root, "commit", "-qm", "initial"]);
    const provider = new class extends AgentProvider { constructor() { super({ id: "read-only", transport: "codex-cli", runtime: "fake", providerFamily: "openai", authMode: "api-key", billingMode: "subscription", executionZone: "provider-host", capabilities: ["coding"] }); } async execute() { await writeFile(join(root, "file.txt"), "forbidden\n"); return { structured: { outcome: "pass" }, usage: {}, mutation: { started: false }, provider: { providerId: this.id, providerFamily: "openai", runtime: "fake", authMode: "api-key", billingMode: "subscription" }, terminationReason: "completed" }; } }();
    const registry = new AgentProviderRegistry({ configuration: { providers: {} } }).register(provider);
    const dispatcher = new AgentProviderDispatcher({ registry });
    await assert.rejects(dispatcher.execute({ ...request(root), constraints: { ...request(root).constraints, mutation: "read-only" } }, { fallback: ["read-only"] }), (error) => error.code === "POLICY_DENIED");
    assert.equal(await readFile(join(root, "file.txt"), "utf8"), "before\n");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("fallback is blocked when checkpoint restoration fails", async () => {
  const root = await mkdtemp(`${tmpdir()}/aicp-dispatcher-`);
  try {
    const provider = new class extends AgentProvider { constructor() { super({ id: "first", transport: "codex-cli", runtime: "fake", providerFamily: "openai", authMode: "api-key", billingMode: "subscription", executionZone: "provider-host", capabilities: ["coding"] }); } async execute() { throw new Error("failed"); } }();
    const registry = new AgentProviderRegistry({ configuration: { providers: {} } }).register(provider);
    const checkpoint = { create: async () => ({ root, clean: true, head: "x", beforeTree: "x" }), attest: async () => ({ clean: false }), restore: async () => { throw new Error("restore failed"); } };
    const dispatcher = new AgentProviderDispatcher({ registry, checkpoint, environment: { AICP_PROVIDER_FALLBACK_ENABLED: "true" } });
    await assert.rejects(dispatcher.execute(request(root), { fallback: ["first"] }), (error) => error.code === "PROVIDER_FALLBACK_CHECKPOINT_FAILED");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("fallback does not hide policy or validation failures", async () => {
  const root = await mkdtemp(`${tmpdir()}/aicp-dispatcher-`);
  try {
    await run("git", ["init", "-q", root]); await run("git", ["-C", root, "config", "user.email", "aicp@example.test"]); await run("git", ["-C", root, "config", "user.name", "AICP"]);
    await writeFile(join(root, "file.txt"), "before\n"); await run("git", ["-C", root, "add", "."]); await run("git", ["-C", root, "commit", "-qm", "initial"]);
    let alternateCalls = 0;
    const first = new class extends AgentProvider {
      constructor() { super({ id: "policy", transport: "codex-cli", runtime: "fake", providerFamily: "openai", authMode: "api-key", billingMode: "subscription", executionZone: "provider-host", capabilities: ["coding"] }); }
      async execute() { throw new ProviderError("POLICY_DENIED", "policy blocked"); }
    }();
    const second = new class extends AgentProvider {
      constructor() { super({ id: "alternate", transport: "codex-cli", runtime: "fake", providerFamily: "anthropic", authMode: "api-key", billingMode: "subscription", executionZone: "provider-host", capabilities: ["coding"] }); }
      async execute() { alternateCalls += 1; return { structured: { outcome: "pass" }, usage: {}, provider: { providerId: this.id }, mutation: { started: false } }; }
    }();
    const registry = new AgentProviderRegistry({ configuration: { providers: {} } }).register(first).register(second);
    const dispatcher = new AgentProviderDispatcher({ registry, environment: { AICP_PROVIDER_FALLBACK_ENABLED: "true" } });
    await assert.rejects(dispatcher.execute(request(root), { fallback: ["policy", "alternate"] }), (error) => error.code === "POLICY_DENIED");
    assert.equal(alternateCalls, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
