import test from "node:test";
import assert from "node:assert/strict";

import { HttpWorkerManager } from "../../harness/src/workers/http-worker-manager.mjs";

test("HTTP worker manager authenticates and maps only projects inside its client root", async () => {
  const requests = [];
  const manager = new HttpWorkerManager({ baseUrl: "http://worker-manager:8090", token: "manager-token", clientProjectRoot: "/workspace/project",
    transport: async (url, options) => { requests.push([url, options]); return { ok: true, json: async () => ({ runId: "run-1", workerId: "worker-1" }) }; } });
  await manager.create({ runId: "run-1", projectDirectory: "/workspace/project", profile: "node22", environment: {} });
  assert.equal(requests[0][0], "http://worker-manager:8090/v1/workers");
  assert.equal(requests[0][1].headers.Authorization, "Bearer manager-token");
  assert.equal(JSON.parse(requests[0][1].body).project, ".");
  await assert.rejects(manager.create({ runId: "run-2", projectDirectory: "/workspace/other", profile: "node22", environment: {} }), /OUTSIDE_CLIENT_ROOT/);
});
