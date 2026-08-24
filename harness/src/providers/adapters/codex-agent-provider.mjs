import { AgentProvider } from "../provider-contract.mjs";
import { providerError, PROVIDER_ERROR_CODES } from "../provider-errors.mjs";
import { providerEnvironment } from "../host/clean-environment.mjs";
import { parseCodexJsonl } from "../parsers/codex-jsonl-parser.mjs";
import { healthStatus } from "../provider-health.mjs";

export class CodexAgentProvider extends AgentProvider {
  constructor({ host, executable = "codex", environment = process.env } = {}) {
    super({ id: "codex-subscription", kind: "agent-runtime", transport: "codex-cli", runtime: "codex", providerFamily: "openai", authMode: "vendor-browser-session", billingMode: "subscription", executionZone: "provider-host", enabled: true, localOnly: true, featureFlag: "AICP_CODEX_PROVIDER_ENABLED", capabilities: ["architecture", "coding", "security-review", "code-review"], maxConcurrency: 1 });
    if (!host?.execute) throw new TypeError("provider host is required");
    this.host = host; this.executable = executable; this.environment = environment;
  }

  async health() {
    try {
      const version = await this.host.supervisor.execute({ executionId: `health-codex-version-${Date.now()}`, executable: this.executable, args: ["--version"], cwd: process.cwd(), env: providerEnvironment(this.environment), timeoutMs: 5000 });
      let auth = { status: "unknown", mode: "vendor-browser-session" };
      try {
        const status = await this.host.supervisor.execute({ executionId: `health-codex-auth-${Date.now()}`, executable: this.executable, args: ["login", "status"], cwd: process.cwd(), env: providerEnvironment(this.environment), timeoutMs: 5000 });
        auth = { status: status.code === 0 ? "authenticated" : "unauthenticated", mode: "vendor-browser-session" };
      } catch { auth = { status: "unknown", mode: "vendor-browser-session" }; }
      return healthStatus({ binary: { available: version.code === 0, version: version.stdout.trim().slice(0, 100) }, auth, policy: { allowed: true }, quota: { status: "available", source: "aicp-shadow-ledger" }, liveInference: { status: "not_probed" } });
    } catch { return healthStatus({ binary: { available: false }, auth: { status: "unknown", mode: "vendor-browser-session" }, policy: { allowed: true }, quota: { status: "unknown", source: "aicp-shadow-ledger" }, liveInference: { status: "not_probed" } }); }
  }

  async estimate() { return { billingMode: this.descriptor.billingMode, monetaryCostKnown: false, providerReportedCostUsd: null }; }

  async execute(request) {
    const mutation = request.constraints.mutation === "workspace-write" ? "workspace-write" : "read-only";
    const args = ["exec", "--ephemeral", "--json", "--sandbox", mutation, "--ignore-user-config", "--ignore-rules", "--output-schema", "{{schemaPath}}", request.prompt];
    const result = await this.host.execute({ providerId: this.id, executable: this.executable, args, request, parser: parseCodexJsonl, environment: this.environment });
    return { structured: result.structured, provider: { providerId: this.id, providerFamily: this.descriptor.providerFamily, runtime: this.descriptor.runtime, authMode: this.descriptor.authMode, billingMode: this.descriptor.billingMode }, usage: { ...result.usage, wallTimeMs: result.durationMs }, mutation: { started: mutation === "workspace-write" }, terminationReason: result.terminationReason ?? "completed", providerAttempts: [{ attempt: 1, provider: this.id, model: this.descriptor.runtime, providerRequestId: result.requestId ?? result.executionId, pricingKnown: false, status: "succeeded", durationMs: result.durationMs }] };
  }

  cancel(executionId) { return this.host.cancel(executionId); }
}
