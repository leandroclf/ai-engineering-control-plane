import { createHash, randomUUID } from "node:crypto";

export class CapabilityError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = "CapabilityError";
    this.code = code;
    this.details = details;
  }
}

export class CapabilityProvider {
  constructor({ name, version = "0.1.0", capabilities = [], permissions = {} }) {
    if (!name) throw new TypeError("provider name is required");
    this.name = name;
    this.version = version;
    this._capabilities = [...capabilities];
    this._permissions = structuredClone(permissions);
  }

  capabilities() { return [...this._capabilities]; }
  permissions() { return structuredClone(this._permissions); }
  async healthcheck() { return { status: "UNKNOWN", provider: this.name, version: this.version }; }
  async observe() { return { provider: this.name, observedAt: new Date().toISOString() }; }
  async execute() { throw new CapabilityError("CAPABILITY_NOT_IMPLEMENTED", `${this.name} has no execute implementation`); }
}

export class CapabilityRouter {
  #providers = new Map();

  register(provider) {
    if (!(provider instanceof CapabilityProvider)) throw new TypeError("provider must implement CapabilityProvider");
    if (this.#providers.has(provider.name)) throw new CapabilityError("PROVIDER_DUPLICATE", provider.name);
    this.#providers.set(provider.name, provider);
    return this;
  }

  providerFor(capability) {
    return [...this.#providers.values()].find((provider) => provider.capabilities().includes(capability));
  }

  list() {
    return [...this.#providers.values()].map((provider) => ({ name: provider.name, version: provider.version, capabilities: provider.capabilities(), permissions: provider.permissions() }));
  }

  async execute(request, context = {}) {
    const { capability, input = {}, actionId = randomUUID() } = request ?? {};
    const provider = request.provider ? this.#providers.get(request.provider) : this.providerFor(capability);
    if (!provider) throw new CapabilityError("CAPABILITY_UNAVAILABLE", `no provider for ${capability}`);
    if (!provider.capabilities().includes(capability)) throw new CapabilityError("CAPABILITY_UNAVAILABLE", `${provider.name} does not expose ${capability}`);
    const allowed = provider.permissions()[capability];
    if (allowed === false || (Array.isArray(context.allowedCapabilities) && !context.allowedCapabilities.includes(capability))) {
      throw new CapabilityError("CAPABILITY_DENIED", capability, { provider: provider.name });
    }
    const started = Date.now();
    const result = await provider.execute({ capability, input, actionId, context });
    return { actionId, capability, provider: provider.name, durationMs: Date.now() - started, result };
  }
}

export const fingerprint = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
