import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InMemoryRunStore } from "../../harness/src/workflow/run-store.mjs";
import { PostgresRunStore } from "../../harness/src/workflow/postgres-run-store.mjs";
import { WorkflowExecutor } from "../../harness/src/workflow/executor.mjs";
import { ProcessRunner } from "../../harness/src/adapters/process-runner.mjs";
import { CommandGate } from "../../harness/src/gates/command-gate.mjs";
import { NodeProjectAdapter } from "../../harness/src/gates/node-project-adapter.mjs";
import { GovernedRuntime } from "../../harness/src/runtime/governed-runtime.mjs";
import { createWorkflowHandlers } from "../../harness/src/runtime/workflow-handlers.mjs";

const definition = {
  version: 1,
  initial: "verify",
  terminal: ["ready", "human-review"],
  states: {
    verify: { next: { pass: "ready", fail: "human-review" } },
    ready: {},
    "human-review": {},
  },
};

test("run store creates tasks idempotently and rejects stale transitions", async () => {
  const store = new InMemoryRunStore();
  const first = await store.createTask({ idempotencyKey: "issue-42", workflowVersion: 1 });
  const replay = await store.createTask({ idempotencyKey: "issue-42", workflowVersion: 1 });

  assert.equal(replay.id, first.id);
  const run = await store.createRun({ taskId: first.id, initialState: "verify", policyVersion: 3 });
  const advanced = await store.transition(run.id, { expectedVersion: 1, outcome: "pass", to: "ready" });
  assert.equal(advanced.version, 2);
  await assert.rejects(
    store.transition(run.id, { expectedVersion: 1, outcome: "pass", to: "ready" }),
    /stale run version/,
  );
});

test("postgres run store commits transition and stage evidence atomically", async () => {
  const queries = [];
  const client = {
    query: async (sql, params = []) => {
      queries.push([sql.trim(), params]);
      if (sql.includes("FOR UPDATE")) return { rows: [{ state: "verify", version: 1 }] };
      if (sql.includes("UPDATE control.runs")) return { rows: [{ id: "run-1", task_id: "task-1", state: "ready", status: "completed", policy_version: 1, version: 2 }] };
      if (sql.includes("INSERT INTO control.stages")) return { rows: [{ id: "stage-1" }] };
      return { rows: [] };
    },
    release: () => { queries.push(["RELEASE", []]); },
  };
  const store = new PostgresRunStore({ connect: async () => client });

  const run = await store.transition("run-1", {
    expectedVersion: 1,
    outcome: "pass",
    to: "ready",
    terminal: true,
    evidence: { gate: "unit-tests" },
  });

  assert.equal(run.version, 2);
  assert.equal(queries[0][0], "BEGIN");
  assert.equal(queries.at(-2)[0], "COMMIT");
  assert.equal(queries.at(-1)[0], "RELEASE");
  assert.ok(queries.some(([sql]) => sql.includes("INSERT INTO control.stages")));
  assert.equal(queries.find(([sql]) => sql.includes("INSERT INTO control.stages"))[1][1], "verify");
});

test("workflow executor resumes a run and persists declared transitions", async () => {
  const store = new InMemoryRunStore();
  const task = await store.createTask({ idempotencyKey: "resume-1", workflowVersion: 1 });
  const run = await store.createRun({ taskId: task.id, initialState: "verify", policyVersion: 1 });
  const executor = new WorkflowExecutor({ definition, store, handlers: { verify: async () => "pass" } });

  const result = await executor.execute(run.id);

  assert.equal(result.state, "ready");
  assert.equal(result.status, "completed");
  assert.deepEqual((await store.listStages(run.id)).map((stage) => stage.outcome), ["pass"]);
});

test("workflow executor delivers governed context and persists redacted provenance", async () => {
  const governedDefinition = {
    ...definition,
    states: { ...definition.states, verify: {
      agent: "reviewer", context: { budget: 100, scopeTypes: ["PROJECT"] },
      next: { pass: "ready", fail: "human-review" },
    } },
  };
  const store = new InMemoryRunStore();
  const task = await store.createTask({
    idempotencyKey: "context-1", workflowVersion: 1,
    metadata: { repository: "repo", query: "review change", scopes: ["PROJECT:A"] },
  });
  const run = await store.createRun({ taskId: task.id, initialState: "verify", policyVersion: 1 });
  const contextProvider = { load: async ({ task: loadedTask, state, policy }) => {
    assert.equal(loadedTask.id, task.id);
    assert.equal(state, "verify");
    assert.equal(policy.budget, 100);
    return { contextId: "ctx_1", tokenCount: 8, budget: 100, artifacts: [
      { id: "chunk-1", content: "must not persist", reason: "exact-symbol", provenance: { path: "app.js" } },
    ] };
  } };
  const telemetryCalls = [];
  const executor = new WorkflowExecutor({
    definition: governedDefinition, store, contextProvider,
    telemetry: { stage: async (metadata) => { telemetryCalls.push(metadata); return true; } },
    handlers: { verify: async ({ context }) => context.contextId === "ctx_1" ? "pass" : "fail" },
  });

  await executor.execute(run.id);

  const [stage] = await store.listStages(run.id);
  assert.equal(stage.evidence.contextId, "ctx_1");
  assert.deepEqual(stage.evidence.contextArtifacts, [
    { id: "chunk-1", reason: "exact-symbol", provenance: { path: "app.js" } },
  ]);
  assert.equal(JSON.stringify(stage.evidence).includes("must not persist"), false);
  assert.equal(stage.evidence.telemetryExported, true);
  assert.deepEqual(telemetryCalls[0], {
    taskId: task.id, runId: run.id, stage: "verify", outcome: "pass", contextId: "ctx_1",
  });
});

test("workflow executor persists bounded handler evidence", async () => {
  const store = new InMemoryRunStore();
  const task = await store.createTask({ idempotencyKey: "evidence-1", workflowVersion: 1 });
  const run = await store.createRun({ taskId: task.id, initialState: "verify", policyVersion: 1 });
  const executor = new WorkflowExecutor({
    definition,
    store,
    handlers: { verify: async () => ({ outcome: "pass", evidence: { summary: "verified", artifacts: ["report.json"] } }) },
  });

  await executor.execute(run.id);

  const [stage] = await store.listStages(run.id);
  assert.deepEqual(stage.evidence.handler, { summary: "verified", artifacts: ["report.json"] });
});

test("governed runtime creates an idempotent task and executes a new run", async () => {
  const store = new InMemoryRunStore();
  const runtime = new GovernedRuntime({ definition, store, handlers: { verify: async () => "pass" } });

  const first = await runtime.start({ idempotencyKey: "issue-77", metadata: { query: "verify" } });
  const second = await runtime.start({ idempotencyKey: "issue-77", metadata: { query: "verify" } });

  assert.equal(first.task.id, second.task.id);
  assert.notEqual(first.run.id, second.run.id);
  assert.equal(first.run.state, "ready");
});

test("workflow handlers constrain agent output to declared outcomes and governed context", async () => {
  const calls = [];
  const agentDefinition = {
    version: 1,
    initial: "discover",
    terminal: ["ready", "failed"],
    states: {
      discover: { agent: "architect", next: { success: "ready", failed: "failed" } },
      ready: {},
      failed: {},
    },
  };
  const handlers = createWorkflowHandlers({
    definition: agentDefinition,
    controller: { run: async (request) => { calls.push(request); return { outcome: "success", summary: "mapped", artifacts: [] }; } },
    projectAdapter: { detect: async () => ({ kind: "fixture", gates: [] }) },
    gateRunner: { run: async () => ({ status: "pass", gates: [] }) },
  });

  const result = await handlers.discover({
    run: { id: "run-1" },
    task: { metadata: { projectDirectory: "/workspace/projects/example", query: "Inspect architecture" } },
    context: { contextId: "ctx-1", artifacts: [{ id: "a", content: "approved context", provenance: { path: "src/a.js" } }] },
  });

  assert.equal(result.outcome, "success");
  assert.deepEqual(result.evidence, { summary: "mapped", artifacts: [] });
  assert.deepEqual(calls[0].schema.properties.outcome.enum, ["success", "failed"]);
  assert.match(calls[0].prompt, /approved context/);
  assert.match(calls[0].prompt, /Inspect architecture/);
});

test("workflow gate handler executes only gates declared by the state", async () => {
  const calls = [];
  const gateDefinition = {
    version: 1,
    initial: "verify",
    terminal: ["ready", "repair", "review"],
    states: {
      verify: { gates: ["build", "lint"], next: { pass: "ready", fail: "repair", error: "review" } },
      ready: {}, repair: {}, review: {},
    },
  };
  const handlers = createWorkflowHandlers({
    definition: gateDefinition,
    controller: { run: async () => ({}) },
    projectAdapter: { detect: async () => ({ kind: "node", gates: [
      { name: "build", command: ["npm", "run", "build"], required: true },
      { name: "lint", command: ["npm", "run", "lint"], required: true },
      { name: "unit-tests", command: ["npm", "test"], required: true },
    ] }) },
    gateRunner: { run: async (request) => { calls.push(request); return { status: "blocked", gates: [{ gate: "lint", status: "fail" }] }; } },
  });

  const result = await handlers.verify({ task: { metadata: { projectDirectory: "/workspace/projects/example" } } });

  assert.equal(result.outcome, "fail");
  assert.deepEqual(calls[0].gateNames, ["build", "lint"]);
  assert.deepEqual(result.evidence.gates, [{ gate: "lint", status: "fail" }]);
});

test("targeted repair handler uses prior gate evidence and enforces persisted iteration limit", async () => {
  const calls = [];
  const repairDefinition = {
    version: 1,
    initial: "targeted-repair",
    terminal: ["verify", "review"],
    states: {
      "targeted-repair": { maxIterations: 1, next: { progress: "verify", exhausted: "review" } },
      verify: {}, review: {},
    },
  };
  const store = {
    listStages: async () => [{ state_from: "full-verify", evidence: { handler: { gates: [{ gate: "lint", status: "fail" }] } } }],
  };
  const handlers = createWorkflowHandlers({
    definition: repairDefinition,
    store,
    controller: { run: async (request) => { calls.push(request); return { outcome: "progress", summary: "fixed lint", artifacts: ["src/a.js"] }; } },
    projectAdapter: { detect: async () => ({ kind: "fixture", gates: [] }) },
    gateRunner: { run: async () => ({ status: "pass", gates: [] }) },
  });

  const first = await handlers["targeted-repair"]({
    run: { id: "run-1" },
    task: { metadata: { projectDirectory: "/workspace/projects/example", query: "repair" } },
  });
  assert.equal(first.outcome, "progress");
  assert.match(calls[0].prompt, /lint/);

  store.listStages = async () => [{ state_from: "targeted-repair", evidence: {} }];
  const exhausted = await handlers["targeted-repair"]({
    run: { id: "run-1" },
    task: { metadata: { projectDirectory: "/workspace/projects/example", query: "repair" } },
  });
  assert.deepEqual(exhausted, { outcome: "exhausted", evidence: { reason: "ITERATION_BUDGET_EXHAUSTED", iterations: 1 } });
});

test("process runner distinguishes command findings, timeout and unavailable tool", async () => {
  const runner = new ProcessRunner();
  const failure = await runner.run(process.execPath, ["-e", "console.error('finding'); process.exit(1)"]);
  const timeout = await runner.run(process.execPath, ["-e", "setTimeout(() => {}, 1000)"], { timeoutMs: 20 });
  const unavailable = await runner.run("aicp-command-that-does-not-exist", []);

  assert.equal(failure.kind, "completed");
  assert.equal(failure.exitCode, 1);
  assert.equal(timeout.kind, "timeout");
  assert.equal(unavailable.kind, "unavailable");
});

test("required command gate never passes when command is missing", async () => {
  const gate = new CommandGate({ runner: new ProcessRunner() });
  const result = await gate.evaluate({ name: "build", required: true, command: null, cwd: process.cwd() });

  assert.equal(result.status, "error");
  assert.equal(result.reason, "COMMAND_NOT_CONFIGURED");
});

test("command gate records a bounded artifact instead of raw unbounded output", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aicp-gate-"));
  await writeFile(join(directory, "package.json"), "{}\n");
  const gate = new CommandGate({ runner: new ProcessRunner(), maxOutputBytes: 32 });
  const result = await gate.evaluate({
    name: "unit-tests",
    required: true,
    command: [process.execPath, "-e", "process.stdout.write('x'.repeat(100))"],
    cwd: directory,
  });

  assert.equal(result.status, "pass");
  assert.equal(result.evidence.stdout.length, 32);
  assert.equal(result.evidence.truncated, true);
});

test("command gate redacts credential-like output before persistence", async () => {
  const gate = new CommandGate({ runner: new ProcessRunner() });
  const result = await gate.evaluate({
    name: "secret-diff",
    required: true,
    command: [process.execPath, "-e", "console.log('OPENAI_API_KEY=sk-example-secret-123456')"],
    cwd: process.cwd(),
  });

  assert.equal(result.status, "pass");
  assert.equal(result.evidence.stdout.includes("sk-example-secret"), false);
  assert.match(result.evidence.stdout, /\[REDACTED\]/);
});

test("node project adapter detects declared commands without inventing missing gates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aicp-project-"));
  await writeFile(join(directory, "package.json"), JSON.stringify({ scripts: { build: "node build.mjs", test: "node test.mjs" } }));
  const commands = await new NodeProjectAdapter().detect(directory);

  assert.deepEqual(commands.build, ["npm", "run", "build"]);
  assert.deepEqual(commands["unit-tests"], ["npm", "test"]);
  assert.equal(commands.lint, null);
  assert.equal(commands.coverage, null);
});
