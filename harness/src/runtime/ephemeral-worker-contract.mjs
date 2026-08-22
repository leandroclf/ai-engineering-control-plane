const FORBIDDEN_ENV = /^(OPENAI|ANTHROPIC|GEMINI|GOOGLE)_.*(?:KEY|TOKEN|SECRET)$/i;

export class WorkloadIdentity {
  constructor({ runId, litellmKeyRef, memoryTokenRef, expiresAt }) {
    if (!runId || !litellmKeyRef || !memoryTokenRef || !(expiresAt instanceof Date) || expiresAt <= new Date()) throw new TypeError("scoped, expiring workload identity is required");
    Object.assign(this, { runId, litellmKeyRef, memoryTokenRef, expiresAt }); Object.freeze(this);
  }
}

export class EphemeralWorkerSpec {
  constructor({ runId, projectDirectory, identity, capabilities = [], environment = {} }) {
    if (identity?.runId !== runId) throw new TypeError("worker identity must be scoped to run");
    if (Object.keys(environment).some((name) => FORBIDDEN_ENV.test(name))) throw new TypeError("physical provider credentials are forbidden in workers");
    this.runId = runId; this.projectDirectory = projectDirectory; this.identity = identity; this.capabilities = Object.freeze([...capabilities]); this.environment = Object.freeze({ ...environment });
    this.security = Object.freeze({ readOnlyRoot: true, noNewPrivileges: true, capabilitiesDropped: "ALL", dockerSocket: false, maxGraphHops: 2 });
    Object.freeze(this);
  }
}

export class WorkerManager {
  async create(_spec) { throw new Error("WorkerManager.create must be implemented by the deployment adapter"); }
  async destroy(_runId) { throw new Error("WorkerManager.destroy must be implemented by the deployment adapter"); }
}
