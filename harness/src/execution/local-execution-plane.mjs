import { ExecutionPlane } from "./execution-plane.mjs";

export class LocalExecutionPlane extends ExecutionPlane {
  constructor({ controller, gateRunner }) {
    super();
    if (!controller?.run && !controller?.runDetailed) throw new TypeError("local execution controller is required");
    if (!gateRunner?.run) throw new TypeError("local execution gate runner is required");
    this.controller = controller;
    this.gateRunner = gateRunner;
    this.runs = new Map();
  }

  async createRun({ run, task }) {
    const projectDirectory = task?.metadata?.projectDirectory;
    if (!projectDirectory) throw new TypeError("task metadata.projectDirectory is required");
    const handle = Object.freeze({ runId: run.id, executionMode: "local", projectDirectory });
    this.runs.set(run.id, handle);
    return handle;
  }

  #run(runId) {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`EXECUTION_RUN_NOT_FOUND:${runId}`);
    return run;
  }

  async invokeAgent(runId, request) {
    const run = this.#run(runId);
    return this.controller.runDetailed
      ? this.controller.runDetailed({ ...request, directory: run.projectDirectory })
      : { structured: await this.controller.run({ ...request, directory: run.projectDirectory }), usage: null };
  }

  async executeCapability(runId, request) {
    const run = this.#run(runId);
    if (request?.capability !== "gates") throw new Error(`LOCAL_CAPABILITY_NOT_SUPPORTED:${request?.capability}`);
    return this.gateRunner.run({ ...request, project: run.projectDirectory });
  }

  async collectEvidence(runId) {
    const run = this.#run(runId);
    return { runId, executionMode: "local", controlPlaneProjectExecutionCount: 1, projectDirectory: run.projectDirectory };
  }

  async destroyRun(runId) {
    this.runs.delete(runId);
    return true;
  }

  hasRun(runId) { return this.runs.has(runId); }
}
