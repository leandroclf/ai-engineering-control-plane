import test from "node:test";
import assert from "node:assert/strict";
import { AgentRoutingPolicy } from "../../../harness/src/providers/agent-routing-policy.mjs";
import { AgentProviderRegistry } from "../../../harness/src/providers/provider-registry.mjs";
import { AgentProvider } from "../../../harness/src/providers/provider-contract.mjs";

class FakeProvider extends AgentProvider {
  constructor(id, family) { super({ id, transport: "codex-cli", runtime: id, providerFamily: family, authMode: "api-key", billingMode: "local", executionZone: "provider-host", localOnly: id !== "opencode-litellm", capabilities: ["coding", "code-review"] }); }
  async health() { return { readiness: "ready", liveness: "ok", auth: { status: "authenticated" }, policy: { allowed: true }, quota: { status: "available" } }; }
  execute() { return Promise.resolve({}); }
}

function policy(environment = {}) {
  const registry = new AgentProviderRegistry({ configuration: { providers: {} }, environment });
  registry.register(new FakeProvider("opencode-litellm", "openai"));
  registry.register(new FakeProvider("codex-subscription", "openai"));
  registry.register(new FakeProvider("claude-code-subscription", "anthropic"));
  return new AgentRoutingPolicy({ configuration: { schemaVersion: 1, policyVersion: "test", roles: { implementer: ["codex-subscription", "claude-code-subscription", "opencode-litellm"] } }, registry, environment });
}

test("agent routing is deterministic and keeps OpenCode as default while layer is disabled", async () => {
  const decision = await policy({ AICP_AGENT_PROVIDER_LAYER_ENABLED: "false" }).decide({ role: "implementer" });
  assert.equal(decision.selected, "opencode-litellm");
  assert.equal(decision.candidates.find((item) => item.providerId === "codex-subscription").reason, "LAYER_DISABLED");
  assert.ok(decision.decisionId.startsWith("apr_"));
});

test("reviewer diversity rejects an adapter with the same underlying provider family", async () => {
  const decision = await policy({ AICP_AGENT_PROVIDER_LAYER_ENABLED: "true", AICP_CODEX_PROVIDER_ENABLED: "true" }).decide({ role: "implementer", producerProviderFamily: "openai" });
  assert.equal(decision.selected, "claude-code-subscription");
  assert.equal(decision.candidates.find((item) => item.providerId === "codex-subscription").reason, "SAME_PROVIDER_FAMILY");
});

test("shared production never selects a local subscription provider", async () => {
  const decision = await policy({ AICP_AGENT_PROVIDER_LAYER_ENABLED: "true", AICP_CODEX_PROVIDER_ENABLED: "true", AICP_ENVIRONMENT_CLASS: "SHARED_PRODUCTION" }).decide({ role: "implementer" });
  assert.equal(decision.selected, "opencode-litellm");
  assert.equal(decision.candidates.find((item) => item.providerId === "codex-subscription").reason, "LOCAL_ONLY");
});
