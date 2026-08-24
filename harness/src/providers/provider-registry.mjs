import { readFile } from "node:fs/promises";
import { assertSanitizedProviderConfig, createProviderDescriptor, sanitizeProvider } from "./provider-contract.mjs";

const transports = new Set(["worker-opencode", "codex-sdk", "codex-cli", "claude-code", "claude-agent-sdk"]);

export class AgentProviderRegistry {
  constructor({ configuration = null, environment = process.env } = {}) {
    this.environment = environment;
    this.configuration = configuration ?? { providers: {} };
    assertSanitizedProviderConfig(this.configuration);
    this.providers = new Map();
  }

  register(provider) {
    if (!provider?.id || typeof provider.execute !== "function") throw new TypeError("agent provider with execute() is required");
    if (this.providers.has(provider.id)) throw new TypeError(`duplicate provider id: ${provider.id}`);
    this.providers.set(provider.id, provider);
    return this;
  }

  get(id) { return this.providers.get(id) ?? null; }
  require(id) { const provider = this.get(id); if (!provider) throw new Error(`PROVIDER_UNKNOWN:${id}`); return provider; }
  list() { return [...this.providers.values()].sort((a, b) => a.id.localeCompare(b.id)); }
  sanitized() { return this.list().map(sanitizeProvider); }
  async health(id) { return this.require(id).health({ environment: this.environment }); }

  static validateConfiguration(configuration) {
    assertSanitizedProviderConfig(configuration);
    if (!configuration || configuration.schemaVersion !== 1 || !configuration.providers || typeof configuration.providers !== "object") throw new TypeError("invalid agent provider configuration");
    for (const [id, raw] of Object.entries(configuration.providers)) {
      const descriptor = createProviderDescriptor({ id, ...raw });
      if (!transports.has(descriptor.transport)) throw new TypeError(`unknown provider transport: ${descriptor.transport}`);
      if (descriptor.executionZone === "worker" && descriptor.authMode === "vendor-browser-session") throw new TypeError("vendor sessions cannot run in ordinary workers");
    }
    return true;
  }

  static async fromFile(path, environment = process.env) {
    const configuration = JSON.parse(await readFile(path, "utf8"));
    AgentProviderRegistry.validateConfiguration(configuration);
    return new AgentProviderRegistry({ configuration, environment });
  }
}
