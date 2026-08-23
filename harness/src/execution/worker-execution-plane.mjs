import { ExecutionPlane } from "./execution-plane.mjs";
import { runWorkerGates } from "./worker-gate-runner.mjs";

export class WorkerExecutionPlane extends ExecutionPlane {
  constructor({ workerManager, profileRegistry = null, credentialBroker = null }) {
    super();
    if (!workerManager?.create || !workerManager?.destroy) throw new TypeError("worker manager is required");
    this.workerManager = workerManager;
    this.remote = true;
    this.profileRegistry = profileRegistry;
    this.credentialBroker = credentialBroker;
    this.runs = new Map();
  }

  #profile(task) {
    if (task?.metadata?.workerProfile) return task.metadata.workerProfile;
    if (task?.metadata?.projectKind && this.profileRegistry) {
      const modules = (task.metadata.projectModules ?? []).map((module) => typeof module === "string" ? { kind: module } : module);
      const selected = this.profileRegistry.select({ kind: task.metadata.projectKind, modules });
      if (selected.length !== 1) throw new Error(`EPHEMERAL_PROFILE_AMBIGUOUS:${selected.join(",")}`);
      return selected[0];
    }
    throw new Error("EPHEMERAL_WORKER_PROFILE_REQUIRED");
  }

  async createRun({ run, task }) {
    if (!task?.metadata?.projectDirectory) throw new TypeError("task metadata.projectDirectory is required");
    const profile = this.#profile(task);
    const credentials = this.credentialBroker ? await this.credentialBroker.issue({ taskId: task.id, runId: run.id, scopes: task.metadata.scopes ?? [], models: task.metadata.allowedModels ?? [] }) : null;
    try {
      const worker = await this.workerManager.create({
        runId: run.id,
        taskId: task.id,
        projectDirectory: task.metadata.projectDirectory,
        baseCommit: task.metadata.baseCommit,
        profile,
        environment: {},
        ...(credentials ? { credentials } : {}),
      });
      const handle = Object.freeze({ ...worker, runId: run.id, profile, executionMode: "ephemeral", projectProfile: task.metadata.projectProfile ?? null });
      this.runs.set(run.id, handle);
      return handle;
    } catch (error) {
      if (this.credentialBroker) await this.credentialBroker.revoke(run.id).catch(() => undefined);
      throw error;
    }
  }

  #run(runId) {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`EXECUTION_RUN_NOT_FOUND:${runId}`);
    return run;
  }

  async invokeAgent(runId, request) {
    this.#run(runId);
    if (!this.workerManager.invokeAgent) throw new Error("WORKER_AGENT_EXECUTION_UNAVAILABLE");
    return this.workerManager.invokeAgent(runId, request);
  }

  async executeCapability(runId, request) {
    this.#run(runId);
    if (request?.capability === "gates") return runWorkerGates({ workerManager: this.workerManager, runId, profile: request.profile, gateNames: request.gateNames, definitions: request.definitions });
    if (!this.workerManager.executeCapability) throw new Error("WORKER_CAPABILITY_EXECUTION_UNAVAILABLE");
    return this.workerManager.executeCapability(runId, request);
  }

  async collectEvidence(runId) {
    const handle = this.#run(runId);
    const evidence = await this.workerManager.collectEvidence(runId);
    return Object.freeze({ ...evidence, runId, workerId: handle.workerId, profile: handle.profile, image: handle.image, imageDigest: handle.imageDigest, attestation: handle.attestation, projectProfile: handle.projectProfile, executionMode: "ephemeral", controlPlaneProjectExecutionCount: 0 });
  }

  async destroyRun(runId) {
    let error;
    try { await this.workerManager.destroy(runId); } catch (cause) { error = cause; }
    try { if (this.credentialBroker) await this.credentialBroker.revoke(runId); } catch (cause) { error ??= cause; }
    this.runs.delete(runId);
    if (error) throw error;
    return true;
  }

  profile(runId) { return this.#run(runId).projectProfile; }
  hasRun(runId) { return this.runs.has(runId); }
}
