export class ExecutionPlane {
  async createRun(_request) { throw new Error("ExecutionPlane.createRun must be implemented"); }
  async invokeAgent(_runId, _request) { throw new Error("ExecutionPlane.invokeAgent must be implemented"); }
  async executeCapability(_runId, _request) { throw new Error("ExecutionPlane.executeCapability must be implemented"); }
  async collectEvidence(_runId) { throw new Error("ExecutionPlane.collectEvidence must be implemented"); }
  async destroyRun(_runId) { throw new Error("ExecutionPlane.destroyRun must be implemented"); }
}
