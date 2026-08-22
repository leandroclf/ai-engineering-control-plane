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
    if (!capability) return null;
    const required = definition.required ?? capability.required ?? false;
    if (capability.status && capability.status !== "AVAILABLE") {
      if (required) throw new GateResolutionError("REQUIRED_GATE_UNAVAILABLE", `${definition.capability}:${capability.status}`);
      return { ...capability, required: false, command: null, executions: [] };
    }
    if (!capability.command && !capability.executions?.length) return required ? null : { ...capability, required: false };
    return { ...capability, required };
  }
}

const SCANNERS = {
  semgrep: ({ mode }) => ["semgrep", "scan", "--config", "auto", ...(mode === "diff" ? ["--baseline-commit", "HEAD~1"] : []), "--json", "."],
  gitleaks: ({ mode }) => ["gitleaks", mode === "diff" ? "git" : "dir", "--no-banner", "--report-format", "json", "--report-path", "/dev/stdout", ...(mode === "diff" ? ["--log-opts=HEAD~1..HEAD"] : ["."])],
  trivy: () => ["trivy", "fs", "--format", "json", "--severity", "HIGH,CRITICAL", "."],
};
export class ScannerGateProvider {
  constructor(name, { runner = null, probeTimeoutMs = 5000 } = {}) { this.name = name; this.runner = runner; this.probeTimeoutMs = probeTimeoutMs; }
  async resolve({ definition }) {
    const command = SCANNERS[this.name]({ mode: definition.mode });
    if (this.runner) {
      const probe = await this.runner.run(command[0], ["--version"], { timeoutMs: this.probeTimeoutMs });
      if (probe.kind !== "completed" || probe.exitCode !== 0) throw new GateResolutionError("REQUIRED_GATE_UNAVAILABLE", `${this.name}:MISCONFIGURED`);
      return { command, required: true, scanner: this.name, mode: definition.mode, status: "AVAILABLE", evidence: { source: "scanner-version-probe", exitCode: probe.exitCode } };
    }
    return { command, required: true, scanner: this.name, mode: definition.mode, status: "DECLARED", evidence: { source: "scanner-registry" } };
  }
}
