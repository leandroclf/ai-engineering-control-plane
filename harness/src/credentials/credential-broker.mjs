import { randomBytes, randomUUID } from "node:crypto";

export class CredentialBroker {
  constructor({ ttlSeconds = 900, now = () => new Date(), random = () => `sk-${randomBytes(32).toString("base64url")}`, randomLitellm = random, randomMemory = random } = {}) {
    this.ttlSeconds = ttlSeconds;
    this.now = now;
    this.randomLitellm = randomLitellm;
    this.randomMemory = randomMemory;
    this.credentials = new Map();
  }

  async issue({ taskId, runId, scopes = [], models = [], budget = null } = {}) {
    if (!taskId || !runId) throw new TypeError("taskId and runId are required");
    if (this.credentials.has(runId)) throw new Error(`CREDENTIAL_ALREADY_ISSUED:${runId}`);
    const expiresAt = new Date(this.now().getTime() + this.ttlSeconds * 1000);
    const record = {
      credentialId: `cred_${randomUUID()}`,
      subject: `run:${runId}`,
      taskId,
      runId,
      expiresAt,
      scopes: [...scopes],
      allowedModels: [...models],
      remainingBudgetUsd: budget,
      revoked: false,
      refs: { litellm: `llm/${randomUUID()}`, memory: `memory/${randomUUID()}` },
      material: { litellm: this.randomLitellm(), memory: this.randomMemory() },
    };
    this.credentials.set(runId, record);
    return Object.freeze({ credentialId: record.credentialId, subject: record.subject, taskId, runId, expiresAt, scopes: [...record.scopes], allowedModels: [...record.allowedModels], remainingBudgetUsd: record.remainingBudgetUsd, refs: { ...record.refs } });
  }

  #record(runId) {
    const record = this.credentials.get(runId);
    if (!record || record.revoked || record.expiresAt <= this.now()) throw new Error("CREDENTIAL_INVALID");
    return record;
  }

  async resolve(reference) {
    const record = [...this.credentials.values()].find((candidate) => candidate.refs.litellm === reference || candidate.refs.memory === reference);
    if (!record) throw new Error("CREDENTIAL_INVALID");
    const active = this.#record(record.runId);
    return reference === active.refs.litellm ? active.material.litellm : active.material.memory;
  }

  async revoke(runId) {
    const record = this.credentials.get(runId);
    if (record) record.revoked = true;
    return Boolean(record);
  }

  async reconcile() {
    const now = this.now();
    let expired = 0;
    for (const record of this.credentials.values()) {
      if (!record.revoked && record.expiresAt <= now) { record.revoked = true; expired += 1; }
    }
    return { expired };
  }

  describe(runId) {
    const record = this.credentials.get(runId);
    if (!record) throw new Error("CREDENTIAL_NOT_FOUND");
    const { material, refs, ...description } = record;
    return Object.freeze({ ...description, expiresAt: description.expiresAt.toISOString() });
  }
}
