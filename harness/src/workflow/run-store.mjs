import { randomUUID } from "node:crypto";

export class InMemoryRunStore {
  #tasks = new Map();
  #tasksByKey = new Map();
  #runs = new Map();
  #stages = new Map();

  async createTask({ idempotencyKey, workflowVersion, metadata = {} }) {
    if (!idempotencyKey) throw new TypeError("idempotencyKey is required");
    const existing = this.#tasksByKey.get(idempotencyKey);
    if (existing) return structuredClone(this.#tasks.get(existing));
    const task = {
      id: randomUUID(),
      idempotencyKey,
      workflowVersion,
      metadata: structuredClone(metadata),
      createdAt: new Date().toISOString(),
    };
    this.#tasks.set(task.id, task);
    this.#tasksByKey.set(idempotencyKey, task.id);
    return structuredClone(task);
  }

  async createRun({ taskId, initialState, policyVersion }) {
    if (!this.#tasks.has(taskId)) throw new Error(`unknown task: ${taskId}`);
    const run = {
      id: randomUUID(),
      taskId,
      state: initialState,
      status: "running",
      policyVersion,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.#runs.set(run.id, run);
    this.#stages.set(run.id, []);
    return structuredClone(run);
  }

  async getTask(taskId) {
    const task = this.#tasks.get(taskId);
    if (!task) throw new Error(`unknown task: ${taskId}`);
    return structuredClone(task);
  }

  async getRun(runId) {
    const run = this.#runs.get(runId);
    if (!run) throw new Error(`unknown run: ${runId}`);
    return structuredClone(run);
  }

  async transition(runId, { expectedVersion, outcome, to, terminal = false, evidence = {}, startedAt, finishedAt }) {
    const run = this.#runs.get(runId);
    if (!run) throw new Error(`unknown run: ${runId}`);
    if (run.version !== expectedVersion) throw new Error(`stale run version: expected ${expectedVersion}, actual ${run.version}`);
    const now = new Date().toISOString();
    this.#stages.get(runId).push({
      sequence: this.#stages.get(runId).length + 1,
      from: run.state,
      to,
      outcome,
      evidence: structuredClone(evidence),
      startedAt: startedAt?.toISOString?.() ?? startedAt ?? run.updatedAt,
      finishedAt: finishedAt?.toISOString?.() ?? finishedAt ?? now,
    });
    run.state = to;
    run.status = !terminal ? "running" : to === "failed" ? "failed" : to === "human-review" ? "blocked" : "completed";
    run.version += 1;
    run.updatedAt = now;
    return structuredClone(run);
  }

  async listStages(runId) {
    if (!this.#stages.has(runId)) throw new Error(`unknown run: ${runId}`);
    return structuredClone(this.#stages.get(runId));
  }

  async cancelRun(runId) {
    const run = this.#runs.get(runId);
    if (!run) throw new Error(`unknown run: ${runId}`);
    if (run.status !== "running" && run.status !== "cancelled") throw new Error(`run cannot be cancelled from status: ${run.status}`);
    run.status = "cancelled";
    run.version += 1;
    run.updatedAt = new Date().toISOString();
    return structuredClone(run);
  }
}
