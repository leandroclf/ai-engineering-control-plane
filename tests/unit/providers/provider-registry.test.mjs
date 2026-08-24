import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { AgentProviderRegistry } from "../../../harness/src/providers/provider-registry.mjs";
import { AgentProvider } from "../../../harness/src/providers/provider-contract.mjs";

const configuration = JSON.parse(await readFile("harness/config/agent-providers.json", "utf8"));

test("agent provider registry validates the separated catalog and rejects duplicate IDs", () => {
  assert.equal(AgentProviderRegistry.validateConfiguration(configuration), true);
  const registry = new AgentProviderRegistry({ configuration });
  const provider = new class extends AgentProvider {
    constructor() { super({ id: "test", transport: "codex-cli", runtime: "test", providerFamily: "test", authMode: "api-key", billingMode: "local", executionZone: "provider-host", capabilities: ["coding"] }); }
    execute() { return Promise.resolve({}); }
  }();
  registry.register(provider);
  assert.throws(() => registry.register(provider), /duplicate provider id/);
});

test("registry rejects unknown transports and credential-shaped configuration fields", () => {
  assert.throws(() => AgentProviderRegistry.validateConfiguration({ ...configuration, providers: { x: { ...configuration.providers["opencode-litellm"], transport: "shell" } } }), /unknown provider transport/);
  assert.throws(() => AgentProviderRegistry.validateConfiguration({ ...configuration, providers: { x: { ...configuration.providers["opencode-litellm"], authFile: "~\/.codex\/auth.json" } } }), /forbidden credential field/);
});
