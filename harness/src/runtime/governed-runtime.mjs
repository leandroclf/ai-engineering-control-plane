import { WorkflowExecutor } from "../workflow/executor.mjs";
import { readFile } from "node:fs/promises";
import { redactText } from "../security/redact.mjs";

export class GovernedRuntime {
  constructor({ definition, store, handlers, contextProvider = null, telemetry = null, budgetAuthority = null, preflight = null, readiness = null, capabilities = null, workerManager = null, workerProfile = null, executionPlane = null, metadata = {}, providerLayer = null }) {
    this.definition = definition;
    this.store = store;
    this.budgetAuthority = budgetAuthority;
    this.preflight = preflight;
    this.readiness = readiness;
    this.capabilityProvider = capabilities;
    this.workerManager = workerManager;
    this.workerProfile = workerProfile;
    this.executionPlane = executionPlane;
    this.metadata = metadata;
    this.providerLayer = providerLayer;
    this.executionEvidence = new Map();
    this.executor = new WorkflowExecutor({ definition, store, handlers, contextProvider, telemetry });
  }

  async start({ idempotencyKey, metadata = {}, constraints = {} }) {
    if (!idempotencyKey) throw new TypeError("idempotencyKey is required");
    if (this.preflight) await this.preflight({ id: null, metadata: structuredClone(metadata) });
    const task = await this.store.createTask({
      idempotencyKey,
      workflowVersion: this.definition.version,
      metadata,
    });
    if (this.budgetAuthority) {
      await this.budgetAuthority.reconcile();
      await this.budgetAuthority.ensure(task.id, constraints);
    }
    if (task.idempotentReplay && this.store.getLatestRunForTask) {
      const existing = await this.store.getLatestRunForTask(task.id);
      if (existing) return { task, run: existing, stages: await this.store.listStages(existing.id), links: this.#links(existing.id), idempotentReplay: true };
    }
    const created = await this.store.createRun({
      taskId: task.id,
      initialState: this.definition.initial,
      policyVersion: this.definition.version,
    });
    return this.#executeWithWorker(created, task);
  }

  async resume(runId) {
    if (this.budgetAuthority) await this.budgetAuthority.reconcile();
    const pending = await this.store.getRun(runId);
    const task = await this.store.getTask(pending.taskId);
    return this.#executeWithWorker(pending, task, false);
  }

  async getRun(runId) { const run = await this.store.getRun(runId); return { run, stages: await this.store.listStages(runId) }; }
  getExecution(runId) { const evidence = this.executionEvidence.get(runId); if (!evidence) throw new Error(`unknown execution ${runId}`); return evidence; }
  getCredentials(runId) { const evidence = this.getExecution(runId); if (!evidence.credentials) throw new Error(`credentials unavailable ${runId}`); const { material: _material, ...safe } = evidence.credentials; return { ...safe, revoked: true }; }
  getAttestations(runId) { const evidence = this.getExecution(runId); return { runId, workerId: evidence.workerId, image: evidence.image, imageDigest: evidence.imageDigest, attestation: evidence.attestation ?? null }; }
  listRuns(filters) { return this.store.listRuns(filters); }
  async overview() {
    const [runs, certification] = await Promise.all([this.store.listRuns({ limit: 50, offset: 0 }), readFile("release/v1-contract.json", "utf8").then(JSON.parse)]);
    const controls = certification.controls ?? [];
    const count = (status) => controls.filter((control) => control.status === status).length;
    return { release: { overall: count("BLOCKED") ? "NOT_YET_V1_CERTIFIED" : "CERTIFIED", pass: count("PASS"), blocked: count("BLOCKED"), failed: count("FAILED") }, activeRuns: runs.items.filter((run) => ["running", "blocked"].includes(run.status)).length, recentRuns: runs.items, attention: controls.filter((control) => control.status !== "PASS").map(({ id, status, reason, evidence }) => ({ id, status, reason: reason ?? null, evidence: evidence ?? [] })) };
  }
  systemStatus() { return { components: [{ id: "harness", name: "Harness", status: "READY" }, { id: "postgres", name: "PostgreSQL", status: "READY" }, { id: "execution-plane", name: "Execution Plane", status: this.executionPlane ? "READY" : "LOCAL_ONLY" }] }; }
  currentActor() { return { actor: "authenticated-principal", roles: ["operator"], capabilities: ["runs:read", "runs:write", "tasks:read", "platform:read"] }; }
  async projects() { const runs = await this.store.listRuns({ limit: 200, offset: 0 }); const byProject = new Map(); for (const run of runs.items) { const project = run.project ?? run.metadata?.project ?? "unknown"; if (!byProject.has(project)) byProject.set(project, { id: project, name: project, status: run.status, repository: project }); } return { items: [...byProject.values()], pagination: { limit: 200, offset: 0, total: byProject.size } }; }
  async project(projectId) { const projects = await this.projects(); const project = projects.items.find((item) => item.id === projectId); if (!project) throw new Error(`unknown project: ${projectId}`); return project; }
  async events(runId) { const audit = await this.getAudit(runId); return audit.items.map((item) => ({ id: `${item.type}-${item.occurredAt}`, type: item.type.toLowerCase(), occurredAt: item.occurredAt, data: item.data })); }
  getTask(taskId) { return this.store.getTask(taskId); }
  async getAudit(runId) {
    const run = await this.store.getRun(runId);
    const stages = await this.store.listStages(runId);
    const budget = this.budgetAuthority ? await this.budgetAuthority.events(run.taskId) : [];
    return { runId, taskId: run.taskId, items: [
      ...stages.map((stage) => ({ type: "STAGE", occurredAt: stage.finished_at ?? stage.finishedAt, data: stage })),
      ...budget.filter((event) => !event.runId || event.runId === runId).map((event) => ({ type: `BUDGET_${event.eventType}`, occurredAt: event.createdAt, data: event })),
    ].sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt))) };
  }
  async getGates(runId) { const stages = await this.store.listStages(runId); return { items: stages.flatMap((stage) => stage.evidence?.handler?.gates ?? stage.evidence?.gates ?? []) }; }
  async getFindings(runId) { const gates = await this.getGates(runId); return { items: gates.items.flatMap((gate) => gate.findings ?? gate.evidence?.findings ?? []) }; }
  async ready() { return this.readiness ? this.readiness() : { status: "ready", checks: { runtime: "ok" }, versions: this.metadata.versions ?? {} }; }
  capabilities(request) { return this.capabilityProvider ? this.capabilityProvider(request) : { status: "unavailable", items: [] }; }
  workflows() { return { items: [{ name: this.definition.name, version: this.definition.version, initial: this.definition.initial, terminal: this.definition.terminal }] }; }
  policies() { return { items: this.metadata.policies ?? [] }; }
  models() { return { items: this.metadata.models ?? [] }; }
  providers() { return { items: this.metadata.providers ?? this.providerLayer?.registry?.sanitized?.() ?? [] }; }
  async provider(id) { const item = this.providers().items.find((provider) => provider.id === id); if (!item) throw new Error(`unknown provider: ${id}`); return { ...item, policyVersion: this.providerLayer?.configuration?.policyVersion ?? "agent-providers-v1" }; }
  async providerHealth(id) { const provider = this.providerLayer?.registry?.get(id); if (!provider) return { id, status: "not_configured", readiness: "unknown" }; return { id, ...(await provider.health({ environment: this.providerLayer.environment, live: false })) }; }
  async providerQuota(id, filters = {}) { return this.providerLayer?.quotaAuthority?.snapshot({ providerId: id, ...filters }) ?? { source: "aicp-shadow-ledger", providerId: id, items: [], reservations: [] }; }
  providerPolicies() { return { schemaVersion: 1, policyVersion: this.providerLayer?.routingConfiguration?.policyVersion ?? "agent-routing-v1", roles: this.providerLayer?.routingConfiguration?.roles ?? {}, default: this.providerLayer?.routingConfiguration?.default ?? "opencode-litellm" }; }
  async providerProbe(id, { live = false } = {}) { if (live && this.providerLayer?.environment?.AICP_LIVE_PROVIDER_TESTS !== "true") throw new Error("LIVE_PROVIDER_TESTS_DISABLED"); return this.providerHealth(id); }
  async providerAttempts(runId) { if (this.providerLayer?.executionStore?.listByRun) return { runId, items: await this.providerLayer.executionStore.listByRun(runId) }; const stages = await this.store.listStages(runId); return { runId, items: stages.flatMap((stage) => stage.evidence?.handler?.providerAttempts ?? []).map((attempt) => ({ ...attempt, stage: stage.state_from ?? stage.from ?? null })) }; }
  async providerTaskQuota(taskId) { return { taskId, source: "aicp-shadow-ledger", items: await Promise.all(this.providers().items.map((provider) => this.providerQuota(provider.id, { taskId })))}; }
  getContext(contextId) { return this.store.getContext(contextId); }
  async cancelRun(runId) { const run = await this.store.cancelRun(runId); if (this.executionPlane) await this.executionPlane.destroyRun(runId); else if (this.workerManager) await this.workerManager.destroy(runId); if (this.budgetAuthority) await this.budgetAuthority.cancel(run.taskId); return { run, stages: await this.store.listStages(runId) }; }
  getBudget(taskId) { if (!this.budgetAuthority) throw new Error("budget authority unavailable"); return this.budgetAuthority.get(taskId); }
  getBudgetEvents(taskId) { if (!this.budgetAuthority) throw new Error("budget authority unavailable"); return this.budgetAuthority.events(taskId); }
  cancelBudget(taskId) { if (!this.budgetAuthority) throw new Error("budget authority unavailable"); return this.budgetAuthority.cancel(taskId); }
  async #executeWithWorker(pending, task, includeTask = true) {
    if (this.executionPlane) {
      let execution = null;
      try {
        execution = await this.executionPlane.createRun({ run: pending, task });
        const run = await this.executor.execute(pending.id);
        const stages = await this.store.listStages(run.id);
        const evidence = await this.executionPlane.collectEvidence(run.id);
        const executionEvidence = Object.freeze({ ...evidence, executableStages: stages.map((stage) => ({ stage: stage.state_from ?? stage.from ?? stage.stateFrom ?? null, workerId: evidence.workerId })) });
        this.executionEvidence.set(run.id, executionEvidence);
        return { ...(includeTask ? { task } : {}), run, stages, ...(includeTask ? { links: this.#links(run.id) } : {}), execution: executionEvidence };
      } catch (error) {
        if (!execution) await this.#recordFailure(pending, error);
        throw error;
      } finally {
        if (execution) await this.executionPlane.destroyRun(pending.id);
      }
    }
    let worker = null; let workerEvidence = null;
    try {
      if (this.workerManager) {
        const profile = await this.workerProfile(task.metadata.projectDirectory);
        worker = await this.workerManager.create({ runId: pending.id, projectDirectory: task.metadata.projectDirectory, profile, environment: {} });
      }
      const run = await this.executor.execute(pending.id);
      if (worker) workerEvidence = await this.workerManager.collectEvidence(run.id);
      return { ...(includeTask ? { task } : {}), run, stages: await this.store.listStages(run.id), ...(includeTask ? { links: this.#links(run.id) } : {}), ...(worker ? { worker: { ...worker, evidence: workerEvidence } } : {}) };
    } catch (error) {
      if (!worker) await this.#recordFailure(pending, error);
      throw error;
    } finally {
      if (worker) await this.workerManager.destroy(pending.id);
    }
  }
  async #recordFailure(run, error) {
    const state = this.definition.states[run.state];
    const outcome = Object.keys(state?.next ?? {}).find((value) => ["failed", "error", "blocked"].includes(value));
    const target = outcome ? state.next[outcome] : null;
    if (!outcome || !this.definition.terminal.includes(target)) return;
    try {
      await this.store.transition(run.id, {
        expectedVersion: run.version,
        outcome,
        to: target,
        terminal: true,
        evidence: { error: { name: error.name ?? "Error", code: error.code ?? null, message: redactText(error.message).slice(0, 240) } },
      });
    } catch {
      // Preserve the original infrastructure error; failure persistence is best effort.
    }
  }
  #links(runId) { return { self: `/v1/runs/${runId}`, stages: `/v1/runs/${runId}/stages`, audit: `/v1/runs/${runId}/audit`, gates: `/v1/runs/${runId}/gates`, findings: `/v1/runs/${runId}/findings` }; }
}
