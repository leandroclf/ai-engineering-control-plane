import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_REQUEST_BODY_BYTES,
  readJsonBody,
  statusForWorkerManagerError,
  validateCreateWorkerPayload,
  validateExecPayload,
} from "../../harness/src/workers/worker-manager-http.mjs";

function requestFromString(body) {
  const chunks = [Buffer.from(body)];
  return {
    destroyed: false,
    destroy() { this.destroyed = true; },
    async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk; },
  };
}

test("worker manager request helpers enforce request shape and size", async () => {
  const parsed = await readJsonBody(requestFromString('{"runId":"run-1","project":"project","profile":"node22"}'));
  assert.deepEqual(validateCreateWorkerPayload(parsed), {
    runId: "run-1",
    project: "project",
    profile: "node22",
    environment: {},
  });
  assert.deepEqual(validateExecPayload({ command: ["node", "--version"] }), { command: ["node", "--version"] });
  assert.throws(() => validateCreateWorkerPayload({ runId: "", project: "x", profile: "node22" }), /runId is required/);
  assert.throws(() => validateExecPayload({ command: [""] }), /command must contain non-empty strings/);
  await assert.rejects(readJsonBody(requestFromString(`{"x":"${"a".repeat(MAX_REQUEST_BODY_BYTES)}"}`), 16), /request body exceeds limit/);
});

test("worker manager errors map client and server failures distinctly", () => {
  assert.equal(statusForWorkerManagerError(new RangeError("request body exceeds limit")), 413);
  assert.equal(statusForWorkerManagerError(new TypeError("bad request")), 400);
  assert.equal(statusForWorkerManagerError(new SyntaxError("unexpected token")), 400);
  assert.equal(statusForWorkerManagerError(new Error("WORKER_ALREADY_EXISTS:run-1")), 409);
  assert.equal(statusForWorkerManagerError(new Error("WORKER_PROJECT_OUTSIDE_SERVER_ROOT")), 400);
  assert.equal(statusForWorkerManagerError(new Error("WORKER_SCOPED_CREDENTIAL_UNAVAILABLE")), 500);
});
