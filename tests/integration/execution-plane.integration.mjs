import test from "node:test";
import assert from "node:assert/strict";

import { WorkerExecutionPlane } from "../../harness/src/execution/worker-execution-plane.mjs";

test("production execution evidence binds agent and gates to one ephemeral worker", async () => {
  const calls = [];
  const workerManager = {
    create: async (spec) => { calls.push(["create", spec]); return { workerId: "worker-e2e", imageDigest: "sha256:" + "a".repeat(64) }; },
    invokeAgent: async (runId) => { calls.push(["agent", runId]); return { structured: { outcome: "changed", summary: "worker", artifacts: [] }, usage: {} }; },
    executeCapability: async (runId) => { calls.push(["capability", runId]); return { status: "pass", gates: [] }; },
    collectEvidence: async (runId) => ({ runId, workerId: "worker-e2e", executableStages: [{ workerId: "worker-e2e" }] }),
    destroy: async (runId) => { calls.push(["destroy", runId]); },
  };
  const plane = new WorkerExecutionPlane({ workerManager });
  await plane.createRun({ run: { id: "run-e2e" }, task: { id: "task-e2e", metadata: { projectDirectory: "/workspace/project", workerProfile: "node22" } } });
  await plane.invokeAgent("run-e2e", { agent: "implementer" });
  await plane.executeCapability("run-e2e", { capability: "custom" });
  const evidence = await plane.collectEvidence("run-e2e");
  assert.equal(evidence.executionMode, "ephemeral");
  assert.equal(evidence.controlPlaneProjectExecutionCount, 0);
  assert.deepEqual(calls.map(([operation]) => operation), ["create", "agent", "capability"]);
  await plane.destroyRun("run-e2e");
});
