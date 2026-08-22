export class GateResolutionError extends Error {
  constructor(code, gate) { super(`${code}:${gate}`); this.name = "GateResolutionError"; this.code = code; this.gate = gate; }
}

export class GateRegistry {
  constructor({ definitions = {} } = {}) { this.definitions = definitions; this.providers = new Map(); }
  register(name, provider) { if (this.providers.has(name)) throw new GateResolutionError("DUPLICATE_PROVIDER", name); this.providers.set(name, provider); return this; }
  async resolve({ name, project, profile, changeSet }) {
    const configured = this.definitions[name];
    if (!configured) throw new GateResolutionError("UNKNOWN_GATE", name);
    const provider = this.providers.get(configured.provider);
    if (!provider) throw new GateResolutionError("UNKNOWN_PROVIDER", configured.provider);
    const result = await provider.resolve({ name, definition: configured, project, profile, changeSet });
    if (!result) throw new GateResolutionError("UNSUPPORTED_GATE", name);
    return { name, required: result.required ?? true, timeoutMs: result.timeoutMs, ...result };
  }
  async preflight({ names, ...context }) { return Promise.all(names.map((name) => this.resolve({ name, ...context }))); }
}

export class ProjectGateProvider {
  async resolve({ definition, profile }) {
    const capability = profile.capabilities?.[definition.capability];
    if (!capability?.command) return null;
    return capability;
  }
}

const SCANNERS = {
  semgrep: ({ mode }) => ["semgrep", "scan", "--config", "auto", ...(mode === "diff" ? ["--baseline-commit", "HEAD~1"] : []), "--json", "."],
  gitleaks: ({ mode }) => ["gitleaks", mode === "diff" ? "git" : "dir", "--no-banner", "--report-format", "json", "--report-path", "/dev/stdout", ...(mode === "diff" ? ["--log-opts=HEAD~1..HEAD"] : ["."])],
  trivy: () => ["trivy", "fs", "--format", "json", "--severity", "HIGH,CRITICAL", "."],
};
export class ScannerGateProvider {
  constructor(name) { this.name = name; }
  async resolve({ definition }) { return { command: SCANNERS[this.name]({ mode: definition.mode }), required: true, scanner: this.name, mode: definition.mode }; }
}
