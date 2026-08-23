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
    body: JSON.stringify({ project: "site", query: "Improve", idempotencyKey: "issue-001" }),
  });

  assert.equal(response.status, 201);
  assert.equal((await response.json()).run.id, "run-1");
  assert.deepEqual(calls[0], {
    idempotencyKey: "issue-001",
    constraints: {},
    metadata: {
      projectDirectory: "/workspace/projects/site",
      query: "Improve",
      repository: "site",
      scopes: ["REPOSITORY:site"],
    },
  });
});

test("OpenAPI create-run examples are accepted behaviorally and invalid schema fields fail closed", async (context) => {
  const calls = [];
  const server = createHarnessServer({
    token: "test-token",
    projectsRoot: "/workspace/projects",
    runtime: { start: async (request) => { calls.push(request); return { run: { id: "run-contract" } }; } },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const endpoint = `http://127.0.0.1:${server.address().port}/v1/runs`;
  const headers = { Authorization: "Bearer test-token", "Content-Type": "application/json", "Idempotency-Key": "contract-123" };
  const valid = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({
    project: "site", repository: "org/site", query: "Improve", exactSymbols: ["App.render"], scopes: ["REPOSITORY:site"],
    constraints: { maxCostUsd: 1.5, maxCalls: 2, maxInputTokens: 1000, maxOutputTokens: 200, maxIterations: 0 },
  }) });
  assert.equal(valid.status, 201);
  assert.deepEqual(calls[0].constraints, { maxCostUsd: 1.5, maxCalls: 2, maxInputTokens: 1000, maxOutputTokens: 200, maxIterations: 0 });

  for (const body of [
    { project: "site", query: "Improve", unknown: true },
    { project: "site", query: "Improve", constraints: { maxCalls: 0 } },
    { project: "site", query: "Improve", constraints: { maxCostUsd: 0 } },
  ]) {
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, "INVALID_REQUEST");
  }
});

test("harness HTTP server rejects oversized request bodies with 413", async (context) => {
  const server = createHarnessServer({
    token: "test-token",
    projectsRoot: "/workspace/projects",
    runtime: { start: async () => ({ run: { id: "run-too-large" } }) },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const endpoint = `http://127.0.0.1:${server.address().port}/v1/runs`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify({
      project: "site",
      query: "x".repeat(1_048_576),
      idempotencyKey: "issue-oversized",
    }),
  });

  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, "PAYLOAD_TOO_LARGE");
});

test("harness exposes execution evidence, safe credential metadata and certification findings", async (context) => {
  const runtime = {
    getExecution: () => ({ runId: "run-1", executionMode: "ephemeral", workerId: "worker-1", imageDigest: "sha256:abc", credentials: { credentialId: "cred-1" } }),
    getCredentials: () => ({ credentialId: "cred-1", subject: "run:run-1", revoked: true }),
    getAttestations: () => ({ runId: "run-1", imageDigest: "sha256:abc", attestation: { nonRoot: true } }),
  };
  const server = createHarnessServer({ token: "test-token", runtime });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const headers = { Authorization: "Bearer test-token" };
  for (const path of ["/v1/runs/run-1/execution", "/v1/runs/run-1/credentials", "/v1/runs/run-1/attestations", "/v1/certifications/v1", "/v1/certifications/v1/findings"]) {
    const response = await fetch(`${endpoint}${path}`, { headers });
    assert.equal(response.status, 200, path);
  }
  const credentials = await (await fetch(`${endpoint}/v1/runs/run-1/credentials`, { headers })).json();
  assert.equal(credentials.revoked, true);
  assert.equal(credentials.material, undefined);
});
