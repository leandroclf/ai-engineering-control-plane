import test from "node:test";
import assert from "node:assert/strict";

import { parseRuntimeArguments, resolveProjectDirectory } from "../../harness/src/cli/runtime-arguments.mjs";
import { createHarnessServer } from "../../harness/src/runtime/http-server.mjs";

test("runtime CLI parses a governed start request", () => {
  const parsed = parseRuntimeArguments([
    "start", "--project", "site-lf-solucoes", "--query", "Improve navigation",
    "--idempotency-key", "issue-91", "--scope", "PROJECT:site", "--scope", "REPOSITORY:site-lf-solucoes",
  ]);

  assert.deepEqual(parsed, {
    command: "start",
    project: "site-lf-solucoes",
    query: "Improve navigation",
    idempotencyKey: "issue-91",
    repository: "site-lf-solucoes",
    scopes: ["PROJECT:site", "REPOSITORY:site-lf-solucoes"],
  });
});

test("runtime CLI parses resume without accepting unrelated fields", () => {
  assert.deepEqual(parseRuntimeArguments(["resume", "--run", "run-42"]), { command: "resume", runId: "run-42" });
  assert.throws(() => parseRuntimeArguments(["resume", "--run", "run-42", "--query", "no"]), /unknown option/);
});

test("runtime project resolver rejects traversal outside the projects root", () => {
  assert.equal(resolveProjectDirectory("/workspace/projects", "site"), "/workspace/projects/site");
  assert.throws(() => resolveProjectDirectory("/workspace/projects", "../secrets"), /outside projects root/);
  assert.throws(() => resolveProjectDirectory("/workspace/projects", "/etc"), /outside projects root/);
});

test("harness HTTP server authenticates and delegates a bounded start request", async (context) => {
  const calls = [];
  const server = createHarnessServer({
    token: "test-token",
    projectsRoot: "/workspace/projects",
    runtime: { start: async (request) => { calls.push(request); return { run: { id: "run-1", state: "ready" } }; } },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();

  const unauthorized = await fetch(`http://127.0.0.1:${port}/v1/runs`, { method: "POST" });
  assert.equal(unauthorized.status, 401);
  const response = await fetch(`http://127.0.0.1:${port}/v1/runs`, {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify({ project: "site", query: "Improve", idempotencyKey: "issue-1" }),
  });

  assert.equal(response.status, 201);
  assert.equal((await response.json()).run.id, "run-1");
  assert.deepEqual(calls[0], {
    idempotencyKey: "issue-1",
    constraints: {},
    metadata: {
      projectDirectory: "/workspace/projects/site",
      query: "Improve",
      repository: "site",
      scopes: ["REPOSITORY:site"],
    },
  });
});
