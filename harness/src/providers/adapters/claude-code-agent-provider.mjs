import { AgentProvider } from "../provider-contract.mjs";
import { providerEnvironment } from "../host/clean-environment.mjs";
import { parseClaudeJson } from "../parsers/claude-json-parser.mjs";
import { healthStatus } from "../provider-health.mjs";

export class ClaudeCodeAgentProvider extends AgentProvider {
  constructor({ host, executable = "claude", environment = process.env } = {}) {
    super({ id: "claude-code-subscription", kind: "agent-runtime", transport: "claude-code", runtime: "claude-code", providerFamily: "anthropic", authMode: "vendor-browser-session", billingMode: "subscription-credit", executionZone: "provider-host", enabled: true, localOnly: true, featureFlag: "AICP_CLAUDE_CODE_PROVIDER_ENABLED", capabilities: ["architecture", "coding", "security-review", "code-review"], maxConcurrency: 1 });
    if (!host?.execute) throw new TypeError("provider host is required");
    this.host = host; this.executable = executable; this.environment = environment;
  }

  async health() {
    try {
      const version = await this.host.supervisor.execute({ executionId: `health-claude-${Date.now()}`, executable: this.executable, args: ["--version"], cwd: process.cwd(), env: providerEnvironment(this.environment), timeoutMs: 5000 });
      return healthStatus({ binary: { available: version.code === 0, version: version.stdout.trim().slice(0, 100) }, auth: { status: "unknown", mode: "vendor-browser-session" }, policy: { allowed: true }, quota: { status: "available", source: "aicp-shadow-ledger" }, liveInference: { status: "not_probed" } });
    } catch { return healthStatus({ binary: { available: false }, auth: { status: "unknown", mode: "vendor-browser-session" }, policy: { allowed: true }, quota: { status: "unknown", source: "aicp-shadow-ledger" }, liveInference: { status: "not_probed" } }); }
  }

  async estimate() { return { billingMode: this.descriptor.billingMode, monetaryCostKnown: false, providerReportedCostUsd: null }; }

  async execute(request) {
    const args = ["-p", request.prompt, "--output-format", "json", "--json-schema", "{{schemaPath}}"];
    const result = await this.host.execute({ providerId: this.id, executable: this.executable, args, request, parser: parseClaudeJson, environment: this.environment });
    return { structured: result.structured, provider: { providerId: this.id, providerFamily: this.descriptor.providerFamily, runtime: this.descriptor.runtime, authMode: this.descriptor.authMode, billingMode: this.descriptor.billingMode }, usage: { ...result.usage, wallTimeMs: result.durationMs }, mutation: { started: request.constraints.mutation === "workspace-write" }, terminationReason: result.terminationReason ?? "completed", providerAttempts: [{ attempt: 1, provider: this.id, model: this.descriptor.runtime, providerRequestId: result.requestId ?? result.executionId, pricingKnown: false, status: "succeeded", durationMs: result.durationMs }] };
  }

  cancel(executionId) { return this.host.cancel(executionId); }
}
