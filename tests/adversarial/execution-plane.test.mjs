import test from "node:test";
import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { CredentialBroker } from "../../harness/src/credentials/credential-broker.mjs";
import { WorkerExecutionPlane } from "../../harness/src/execution/worker-execution-plane.mjs";
import { createWorkflowHandlers } from "../../harness/src/runtime/workflow-handlers.mjs";
import { WorkerCommandPolicy } from "../../harness/src/workers/worker-command-policy.mjs";
import { RunWorktreeManager } from "../../harness/src/workers/run-worktree-manager.mjs";
import { DockerWorkerManager } from "../../harness/src/workers/docker-worker-manager.mjs";
import { WorkloadIdentity } from "../../harness/src/runtime/ephemeral-worker-contract.mjs";
import { WorkloadIdentityService } from "../../harness/src/workers/workload-identity-service.mjs";
import { WorkerProfileRegistry } from "../../harness/src/workers/worker-profile-registry.mjs";

const execFile = promisify(execFileCallback);

test("worker command policy rejects shell and arbitrary argv before docker exec", async () => {
  const policy = new WorkerCommandPolicy(JSON.parse(await readFile("harness/config/worker-command-policy.json", "utf8")));
  assert.deepEqual(policy.validate({ profile: "node22", capability: "test:unit", tool: "npm", args: ["test"] }), { capability: "test:unit", tool: "npm", args: ["test"] });
  for (const request of [
    { capability: "test:unit", tool: "sh", args: ["-c", "cat /etc/passwd"] },
    { capability: "test:unit", tool: "npm", args: ["run", "build; curl evil"] },
    { capability: "unknown", tool: "node", args: ["-e", "process.exit(0)"] },
  ]) assert.throws(() => policy.validate({ profile: "node22", ...request }), /COMMAND_NOT_ALLOWED/);
});

test("production workflow handlers use only the worker execution plane", async () => {
  const calls = [];
  const plane = {
    remote: true,
    hasRun: () => true,
    profile: () => ({ kind: "node", capabilities: { build: { status: "AVAILABLE", command: ["npm", "run", "build"], required: true } } }),
    invokeAgent: async (runId, request) => { calls.push(["agent", runId, request]); return { structured: { outcome: "success", summary: "worker", artifacts: [] }, usage: null }; },
    executeCapability: async (runId, request) => { calls.push(["gates", runId, request]); return { projectKind: "node", status: "pass", gates: [] }; },
    createRun: async () => undefined,
  };
  const definition = { version: 1, initial: "discover", terminal: ["ready"], states: {
    discover: { agent: "architect", next: { success: "verify" } },
    verify: { gates: ["build"], next: { pass: "ready" } }, ready: {},
  } };
  const handlers = createWorkflowHandlers({
    definition, executionPlane: plane,
    controller: { run: async () => { throw new Error("CONTROL_PLANE_AGENT_EXECUTION"); } },
    gateRunner: { run: async () => { throw new Error("CONTROL_PLANE_GATE_EXECUTION"); } },
    projectAdapter: { detect: async () => { throw new Error("CONTROL_PLANE_PROJECT_READ"); } },
    gateRegistry: { preflight: async ({ names, profile }) => [{ name: names[0], required: true, command: profile.capabilities.build.command }] },
  });
  const task = { id: "task-1", metadata: { projectDirectory: "/worker/project", query: "inspect", projectProfile: { kind: "node", capabilities: { build: { status: "AVAILABLE", command: ["npm", "run", "build"], required: true } } } } };
  const run = { id: "run-1", version: 1 };
  assert.equal((await handlers.discover({ run, task, context: { artifacts: [] } })).outcome, "success");
  assert.equal((await handlers.verify({ run, task })).outcome, "pass");
  assert.deepEqual(calls.map(([kind]) => kind), ["agent", "gates"]);
});

test("two run worktrees have independent roots and changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "aicp-worktree-source-"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src/value.txt"), "base\n");
  await execFile("git", ["init", "-q"], { cwd: root });
  await execFile("git", ["config", "user.email", "aicp@test.invalid"], { cwd: root });
  await execFile("git", ["config", "user.name", "AICP Test"], { cwd: root });
  await execFile("git", ["add", "."], { cwd: root });
  await execFile("git", ["commit", "-qm", "base"], { cwd: root });
  const manager = new RunWorktreeManager({ root: join(root, ".runs") });
  const first = await manager.create({ runId: "run-a", sourceDirectory: root });
  const second = await manager.create({ runId: "run-b", sourceDirectory: root });
  assert.notEqual(first.path, second.path);
  await writeFile(join(first.path, "src/value.txt"), "run-a\n");
  assert.equal(await readFile(join(second.path, "src/value.txt"), "utf8"), "base\n");
  await manager.destroy("run-a"); await manager.destroy("run-b");
});

test("worker credentials are unique, scoped and revoked", async () => {
  const broker = new CredentialBroker({ random: (() => { let index = 0; return () => `material-${index++}`; })() });
  const first = await broker.issue({ taskId: "task-a", runId: "run-a", models: ["coding-strong"] });
  const second = await broker.issue({ taskId: "task-b", runId: "run-b", models: ["review"] });
  assert.notEqual(first.refs.litellm, second.refs.litellm);
  assert.notEqual(await broker.resolve(first.refs.litellm), await broker.resolve(second.refs.litellm));
  await broker.revoke("run-a");
  await assert.rejects(broker.resolve(first.refs.litellm), /CREDENTIAL_INVALID/);
  assert.equal((await broker.describe("run-b")).revoked, false);
});

test("docker worker evidence uses structured git argv and no shell", async () => {
  const calls = [];
  const identityService = new WorkloadIdentityService({ secret: "a".repeat(32) });
  const token = identityService.issue("run-structured");
  const profile = new WorkerProfileRegistry({ schemaVersion: 1, profiles: { node22: { projectKinds: ["node"], image: "node@sha256:test", dockerfile: "Dockerfile", probes: [["node", "--version"]] } } });
  const docker = {
    create: async () => "container-1",
    inspect: async () => ({ Image: "sha256:test", Config: { User: "worker", Env: [], Labels: { "aicp.run_id": "run-structured" } }, HostConfig: { ReadonlyRootfs: true, CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"] }, Mounts: [] }),
    exec: async (_id, command) => { calls.push(command); return { exitCode: 0, stdout: command.includes("status") ? "" : "diff" }; },
    remove: async () => undefined,
  };
  const manager = new DockerWorkerManager({ docker, profiles: profile, identityService, secretResolver: async () => "scoped" });
  await manager.create({ runId: "run-structured", projectDirectory: "/workspace/project", profile: "node22", identity: new WorkloadIdentity({ runId: "run-structured", litellmKeyRef: "llm/a", memoryTokenRef: "memory/a", expiresAt: new Date(Date.now() + 60_000) }), identityToken: token, environment: {} });
  await manager.collectEvidence("run-structured");
  assert.equal(calls.some((command) => command[0] === "sh" || command[0] === "bash"), false);
  await manager.destroy("run-structured");
});
