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

test("node project adapter detects declared commands without inventing missing gates", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aicp-project-"));
  await writeFile(join(directory, "package.json"), JSON.stringify({ scripts: { build: "node build.mjs", test: "node test.mjs" } }));
  const commands = await new NodeProjectAdapter().detect(directory);

  assert.deepEqual(commands.build, ["npm", "run", "build"]);
  assert.deepEqual(commands["unit-tests"], ["npm", "test"]);
  assert.equal(commands.lint, null);
  assert.equal(commands.coverage, null);
});
