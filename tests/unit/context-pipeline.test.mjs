import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { GitIndexer, InMemoryIndexStore } from "../../context/indexer/git-indexer.mjs";
import { JavaScriptParser } from "../../context/parsers/javascript-parser.mjs";
import { planGraphDelta } from "../../context/indexer/graph-projection.mjs";
import { EmbeddingCache, hybridRetrieve } from "../../context/retrieval/hybrid-retrieval.mjs";
import { compileContextPackage } from "../../context/compiler/context-package.mjs";
import { GovernedContextProvider } from "../../harness/src/agents/governed-context-provider.mjs";
import { ContextApiClient } from "../../context/client/context-api-client.mjs";

function git(directory, ...args) {
  return execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
}

test("git indexer reparses zero unchanged blobs and reuses blobs across branches", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aicp-git-index-"));
  git(directory, "init", "-q");
  git(directory, "config", "user.email", "test@aicp.local");
  git(directory, "config", "user.name", "AICP Test");
  await writeFile(join(directory, "app.js"), "export function hello() { return 'hello'; }\n");
  git(directory, "add", ".");
  git(directory, "commit", "-qm", "initial");
  const parsed = [];
  const store = new InMemoryIndexStore();
  const indexer = new GitIndexer({ store, parser: { parse: async (file) => { parsed.push(file.path); return []; } } });

  const first = await indexer.sync({ repositoryId: "repo", directory, parserVersion: "js-1", schemaVersion: "1" });
  const second = await indexer.sync({ repositoryId: "repo", directory, parserVersion: "js-1", schemaVersion: "1" });
  git(directory, "checkout", "-qb", "same-blob-branch");
  const branch = await indexer.sync({ repositoryId: "repo", directory, parserVersion: "js-1", schemaVersion: "1" });

  assert.deepEqual(first.changed, ["app.js"]);
  assert.deepEqual(second.changed, []);
  assert.deepEqual(branch.changed, []);
  assert.deepEqual(parsed, ["app.js"]);
});

test("javascript parser extracts symbols and rejects syntax errors", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aicp-js-parser-"));
  const valid = join(directory, "service.js");
  const invalid = join(directory, "broken.js");
  await writeFile(valid, "import { db } from './db.js';\nexport class Service {}\nexport function run() { return db; }\n");
  await writeFile(invalid, "export function broken( {\n");
  const parser = new JavaScriptParser();

  const result = await parser.parse({ path: "service.js", absolutePath: valid, oid: "blob-1" });

  assert.deepEqual(result.symbols.map((symbol) => symbol.qualifiedName), ["Service", "run"]);
  assert.deepEqual(result.references.map((reference) => reference.target), ["./db.js"]);
  assert.ok(result.chunks.every((chunk) => chunk.provenance.oid === "blob-1"));
  await assert.rejects(parser.parse({ path: "broken.js", absolutePath: invalid, oid: "blob-2" }), /syntax error/);
});

test("graph delta handles rename delete and ambiguous symbols deterministically", () => {
  const delta = planGraphDelta({
    repositoryId: "repo",
    changed: [{ path: "new.js", previousPath: "old.js", symbols: [
      { qualifiedName: "Service.run", kind: "function", lineStart: 2, lineEnd: 4 },
      { qualifiedName: "Service.run", kind: "function", lineStart: 8, lineEnd: 9 },
    ] }],
    deleted: ["removed.js"],
  });

  assert.deepEqual(delta.deletePaths, ["old.js", "removed.js"]);
  assert.equal(delta.upsertFiles[0].path, "new.js");
  assert.notEqual(delta.upsertSymbols[0].id, delta.upsertSymbols[1].id);
});

test("embedding cache reuses unchanged content and invalidates model changes", async () => {
  const calls = [];
  const cache = new EmbeddingCache(async ({ model, content }) => { calls.push([model, content]); return [content.length, 1]; });

  const first = await cache.embed({ model: "embed-v1", dimensions: 2, contentHash: "hash", content: "hello" });
  const reused = await cache.embed({ model: "embed-v1", dimensions: 2, contentHash: "hash", content: "hello" });
  const changedModel = await cache.embed({ model: "embed-v2", dimensions: 2, contentHash: "hash", content: "hello" });

  assert.deepEqual(first, reused);
  assert.deepEqual(changedModel, [5, 1]);
  assert.equal(calls.length, 2);
});

test("hybrid retrieval ranks exact and lexical evidence before vector fallback", () => {
  const results = hybridRetrieve({
    query: "PaymentService process",
    queryVector: [1, 0],
    exactSymbols: ["PaymentService.process"],
    candidates: [
      { id: "vector", symbol: "Other.run", content: "unrelated", embedding: [1, 0] },
      { id: "lexical", symbol: "PaymentService.process", content: "process payment safely", embedding: [0, 1] },
    ],
  });

  assert.deepEqual(results.map((item) => item.id), ["lexical", "vector"]);
  assert.equal(results[0].reason, "exact-symbol+lexical");
});

test("context package is deterministic budgeted and retains provenance", () => {
  const request = {
    taskId: "task-1", budget: 10,
    candidates: [
      { id: "semantic", priority: 3, tokens: 8, contentHash: "s", reason: "vector", provenance: { path: "b.js" } },
      { id: "exact", priority: 1, tokens: 6, contentHash: "e", reason: "exact-symbol", provenance: { path: "a.js" } },
      { id: "memory", priority: 2, tokens: 4, contentHash: "m", reason: "scoped-memory", provenance: { memoryId: "m1" } },
    ],
  };
  const first = compileContextPackage(request);
  const second = compileContextPackage(request);

  assert.equal(first.contextId, second.contextId);
  assert.equal(first.tokenCount, 10);
  assert.deepEqual(first.artifacts.map((item) => item.id), ["exact", "memory"]);
  assert.ok(first.artifacts.every((item) => item.reason && item.provenance));
});

test("harness context provider compiles only task scopes allowed by stage policy", async () => {
  const calls = [];
  const provider = new GovernedContextProvider({
    contextClient: { compile: async (payload) => {
      calls.push(payload);
      return { context_id: "ctx_1", schema_version: 2, token_count: 6, budget: payload.budget, requested_budget: payload.budget,
        retrieval_policy_version: payload.retrieval_policy_version, packing_policy_version: payload.packing_policy_version,
        embedding_model: "text-embedding-3-small", token_count_model: "gpt-5", tokenizer_version: payload.tokenizer_version,
        index_snapshot: "commit-1", graph_snapshot: "graph-1", envelope: { model_window: payload.model_window }, metrics: { selected_tokens: 6 }, artifacts: [
        { id: "exact", content: "allowed", reason: "exact-symbol", provenance: { path: "app.js" } },
      ] };
    } },
  });

  const result = await provider.load({
    task: { id: "task-1", metadata: {
      repository: "repo", query: "Service.run", exactSymbols: ["Service.run"],
      scopes: ["PROJECT:A", "ORGANIZATION:org"],
    } },
    state: "implement",
    policy: { budget: 20, scopeTypes: ["PROJECT"] },
  });

  assert.equal(result.contextId, "ctx_1");
  assert.deepEqual(calls[0].scopes, ["PROJECT:A"]);
  assert.equal(calls[0].budget, 20);
  assert.equal(calls[0].task_id, "task-1:implement");
  assert.deepEqual(result.metadata, {
    schemaVersion: 2, requestedBudget: 20, retrievalPolicyVersion: "hybrid-rrf-v1", packingPolicyVersion: "context-v2",
    embeddingModel: "text-embedding-3-small", tokenCountModel: "gpt-5", tokenizerVersion: "1",
    indexSnapshot: "commit-1", graphSnapshot: "graph-1",
  });
  assert.deepEqual(result.envelope, { model_window: 128000 });
  assert.deepEqual(result.metrics, { selected_tokens: 6 });
});

test("context API client loads persistent Git state and sends sync delta", async () => {
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push([path, options]);
    if (!options.method) return { repository: "repo", files: [{ path: "app.js", oid: "1", parser_version: "js-1", schema_version: "1" }] };
    if (path === "/v1/context:impact") return { repository: "repo", path: "lib.js", dependents: ["app.js"] };
    return { parsed: 1, embedded: 1 };
  };
  const client = new ContextApiClient({ baseUrl: "http://memory", token: "internal", request });

  const state = await client.indexState("repo");
  const result = await client.sync("repo", { files: [{ path: "app.js" }] });
  const impact = await client.impact({ repository: "repo", path: "lib.js" });

  assert.equal(state.get("app.js").oid, "1");
  assert.deepEqual(result, { parsed: 1, embedded: 1 });
  assert.equal(calls[1][1].headers.Authorization, "Bearer internal");
  assert.equal(calls[1][1].method, "POST");
  assert.deepEqual(impact.dependents, ["app.js"]);
});
