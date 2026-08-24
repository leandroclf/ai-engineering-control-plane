import { AgentProvider } from "../provider-contract.mjs";
import { normalizeProviderUsage } from "../provider-usage.mjs";
import { healthStatus } from "../provider-health.mjs";

export class OpenCodeAgentProvider extends AgentProvider {
  constructor({ controller } = {}) {
    super({ id: "opencode-litellm", kind: "agent-runtime", transport: "worker-opencode", runtime: "opencode", providerFamily: "dynamic", authMode: "gateway", billingMode: "api-metered", executionZone: "worker", enabled: true, capabilities: ["architecture", "coding", "security-review", "code-review"], maxConcurrency: 10 });
    if (!controller?.runDetailed && !controller?.run) throw new TypeError("OpenCode controller is required");
    this.controller = controller;
  }

  async health() { return healthStatus({ binary: { available: true, version: "managed" }, auth: { status: "authenticated", mode: "gateway" }, policy: { allowed: true }, quota: { status: "available", source: "budget-authority" }, liveInference: { status: "not_probed" } }); }
  async estimate() { return { billingMode: "api-metered", monetaryCostKnown: true }; }

  async execute(request) {
    const result = this.controller.runDetailed
      ? await this.controller.runDetailed({ directory: request.worktree.root, agent: request.agent, prompt: request.prompt, schema: request.schema, maxOutputTokens: request.constraints.maxOutputTokens, invocation: request.invocation, modelAlias: request.invocation.modelAlias })
      : { structured: await this.controller.run({ directory: request.worktree.root, agent: request.agent, prompt: request.prompt, schema: request.schema }), usage: {} };
    return {
      structured: result.structured,
      provider: { providerId: this.id, providerFamily: this.descriptor.providerFamily, runtime: this.descriptor.runtime, authMode: this.descriptor.authMode, billingMode: this.descriptor.billingMode },
      usage: normalizeProviderUsage({ ...result.usage, billingMode: this.descriptor.billingMode, monetaryCostKnown: true }, this.descriptor),
      mutation: { started: request.constraints.mutation === "workspace-write" },
      terminationReason: "completed",
    };
  }
}
