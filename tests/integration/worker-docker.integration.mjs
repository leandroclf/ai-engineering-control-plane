import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { WorkloadIdentity, EphemeralWorkerSpec } from "../../harness/src/runtime/ephemeral-worker-contract.mjs";
import { WorkerProfileRegistry } from "../../harness/src/workers/worker-profile-registry.mjs";
import { WorkloadIdentityService } from "../../harness/src/workers/workload-identity-service.mjs";
import { ProcessDockerControl } from "../../harness/src/workers/process-docker-control.mjs";
import { DockerWorkerManager } from "../../harness/src/workers/docker-worker-manager.mjs";

test("Docker worker create exec collect destroy leaves no reusable identity", { skip: process.env.AICP_DOCKER_TEST !== "1" }, async () => {
  const runId = randomUUID();
  const project = resolve(`.aicp/worker-tests/${runId}`);
  await mkdir(project, { recursive: true });
  await writeFile(resolve(project, "package.json"), "{}\n");
  const config = JSON.parse(await readFile("harness/config/worker-profiles.json", "utf8"));
  const identities = new WorkloadIdentityService({ secret: "integration-worker-secret-material".repeat(2) });
  const token = identities.issue(runId);
  const identity = new WorkloadIdentity({ runId, litellmKeyRef: `llm/${runId}`, memoryTokenRef: `memory/${runId}`, expiresAt: new Date(Date.now() + 300_000) });
  const manager = new DockerWorkerManager({ docker: new ProcessDockerControl(), profiles: new WorkerProfileRegistry(config), identityService: identities, network: "none", secretResolver: async () => "scoped-test-token" });
  try {
    const handle = await manager.create(new EphemeralWorkerSpec({ runId, projectDirectory: project, profile: "node22", identity, identityToken: token }));
    assert.equal(handle.attestation.nonRoot, true);
    assert.equal(handle.attestation.readOnlyRoot, true);
    assert.equal(handle.attestation.dockerSocket, false);
    assert.equal((await manager.exec(runId, ["node", "--version"])).exitCode, 0);
    await assert.rejects(manager.exec(randomUUID(), ["node", "--version"]), /WORKER_NOT_FOUND/);
    assert.equal((await manager.collectEvidence(runId)).runId, runId);
  } finally {
    await manager.destroy(runId);
  }
  assert.throws(() => identities.verify(token, runId), /WORKLOAD_IDENTITY_INVALID/);
});

