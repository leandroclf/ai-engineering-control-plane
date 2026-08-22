import test from "node:test";
import assert from "node:assert/strict";
import { spawn, execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { HttpWorkerManager } from "../../harness/src/workers/http-worker-manager.mjs";

const execFile = promisify(execFileCallback);
test("deployment-side HTTP manager performs an authenticated real Docker lifecycle", { skip: process.env.AICP_DOCKER_TEST !== "1", timeout: 60_000 }, async () => {
  const runId = randomUUID(); const port = 18090; const project = resolve(`.aicp/worker-http-tests/${runId}`);
  await mkdir(project, { recursive: true }); await writeFile(resolve(project, "package.json"), "{}\n");
  const server = spawn(process.execPath, ["harness/src/workers/worker-manager-server.mjs"], { stdio: "ignore", env: {
    ...process.env, WORKER_MANAGER_PORT: String(port), WORKER_MANAGER_TOKEN: "manager-test-token",
    WORKER_IDENTITY_SIGNING_SECRET: "integration-worker-secret-material-integration", AICP_WORKER_PROJECTS_ROOT: project,
    WORKER_LITELLM_TOKEN: "scoped-llm-test", WORKER_MEMORY_TOKEN: "scoped-memory-test",
  } });
  const manager = new HttpWorkerManager({ baseUrl: `http://127.0.0.1:${port}`, token: "manager-test-token", clientProjectRoot: project });
  try {
    for (let attempt = 0; attempt < 30; attempt += 1) { try { await manager.ready(); break; } catch { await new Promise((done) => setTimeout(done, 100)); } }
    const handle = await manager.create({ runId, projectDirectory: project, profile: "node22", environment: {} });
    assert.match(handle.imageDigest, /^sha256:[a-f0-9]{64}$/);
    assert.equal((await manager.exec(runId, ["node", "--version"])).exitCode, 0);
    assert.equal((await manager.collectEvidence(runId)).runId, runId);
  } finally {
    await manager.destroy(runId).catch(() => undefined); server.kill("SIGTERM");
    await new Promise((done) => server.once("exit", done));
  }
  const residual = await execFile("docker", ["ps", "-a", "--filter", `label=aicp.run_id=${runId}`, "--format", "{{.ID}}"]).then(({ stdout }) => stdout.trim());
  assert.equal(residual, "");
});
