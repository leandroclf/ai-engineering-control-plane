import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { InvocationEstimator, RoutingPricingCatalog } from "../../harness/src/budget/invocation-estimator.mjs";
import { GateRegistry, ProjectGateProvider } from "../../harness/src/gates/gate-registry.mjs";
import { ProjectAdapter } from "../../harness/src/gates/project-adapter.mjs";
import { ControlPlaneAuthorizer } from "../../harness/src/security/identity-authority.mjs";
import { EphemeralWorkerSpec, WorkloadIdentity } from "../../harness/src/runtime/ephemeral-worker-contract.mjs";
import { reconcilePhysicalUsage } from "../../harness/src/budget/physical-usage.mjs";
import { RoutingPolicy } from "../../harness/src/routing/routing-policy.mjs";
import { ScannerBundleAttestor } from "../../harness/src/scanners/scanner-bundle-attestor.mjs";
import { createHash } from "node:crypto";
import { WorkerProfileRegistry } from "../../harness/src/workers/worker-profile-registry.mjs";
import { WorkloadIdentityService } from "../../harness/src/workers/workload-identity-service.mjs";
import { DockerWorkerManager } from "../../harness/src/workers/docker-worker-manager.mjs";

test("invocation estimator reserves prompt schema output margin and worst eligible deployment", async () => {
  const estimator = new InvocationEstimator({ tokenizer: { count: async (value) => String(value).length }, fixedOverheadTokens: 10, safetyMargin: 1.2,
    pricingCatalog: new RoutingPricingCatalog({ strong: { deployments: [
      { model: "cheap", inputPerMillion: 1, outputPerMillion: 2 }, { model: "expensive", inputPerMillion: 10, outputPerMillion: 20 },
    ] } }) });
  const result = await estimator.estimate({ alias: "strong", prompt: "12345", contextTokenCount: 8, schema: { x: 1 }, maxOutputTokens: 100 });
  assert.equal(result.inputTokens, Math.ceil((8 + JSON.stringify({ response: { x: 1 }, tools: [] }).length + 10) * 1.2));
  assert.equal(result.costUsd, result.inputTokens * 10 / 1e6 + 100 * 20 / 1e6);
  await assert.rejects(estimator.estimate({ alias: "unknown", prompt: "x" }), /PRICING_UNKNOWN/);
});

test("polyglot repository produces composite modules and per-module executions", async () => {
  const root = await mkdtemp(join(tmpdir(), "aicp-polyglot-"));
  await mkdir(join(root, "frontend")); await mkdir(join(root, "service"));
  await writeFile(join(root, "frontend/package.json"), JSON.stringify({ scripts: { build: "x", test: "x" } }));
  await writeFile(join(root, "service/go.mod"), "module example/service\n");
  const profile = await new ProjectAdapter().detect(root);
  assert.equal(profile.kind, "composite");
  assert.deepEqual(profile.modules.map((item) => item.path), ["frontend", "service"]);
  assert.equal(profile.capabilities.build.status, "AVAILABLE");
  assert.equal(profile.capabilities.build.executions.length, 2);
});

test("required undeclared capability fails preflight before execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "aicp-missing-cap-"));
  await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { build: "x" } }));
  const profile = await new ProjectAdapter().detect(root);
  const registry = new GateRegistry({ definitions: { tests: { provider: "project", capability: "unit-tests" } } }).register("project", new ProjectGateProvider());
  await assert.rejects(registry.preflight({ names: ["tests"], project: root, profile }), /REQUIRED_GATE_UNAVAILABLE/);
});

test("static token RBAC remains compatible and worker contract rejects provider secrets", async () => {
  const principal = await new ControlPlaneAuthorizer({ staticToken: "token" }).authenticate({ headers: { authorization: "Bearer token" }, socket: {} });
  assert.doesNotThrow(() => principal.require("runs:write"));
  const identity = new WorkloadIdentity({ runId: "run-1", litellmKeyRef: "secret:llm/run-1", memoryTokenRef: "secret:memory/run-1", expiresAt: new Date(Date.now() + 60_000) });
  assert.throws(() => new EphemeralWorkerSpec({ runId: "run-1", projectDirectory: "/workspace/project", identity, environment: { OPENAI_API_KEY: "forbidden" } }), /forbidden/);
});

test("physical provider attempts reconcile retry cost while logical calls remain one", () => {
  const result = reconcilePhysicalUsage({}, [
    { attempt: 1, provider: "openai", model: "strong-a", providerRequestId: "req-1", pricingKnown: true, status: "failed", inputTokens: 100, costUsd: 0.1, durationMs: 50 },
    { attempt: 2, provider: "anthropic", model: "strong-b", providerRequestId: "req-2", pricingKnown: true, status: "succeeded", inputTokens: 120, outputTokens: 20, costUsd: 0.3, durationMs: 80 },
  ]);
  assert.deepEqual(result.actualUsage, { calls: 1, inputTokens: 220, outputTokens: 20, costUsd: 0.4, iterations: 0 });
  assert.equal(result.physicalAttempts.length, 2);
  assert.equal(result.fallbackCostDelta, 0.3);
});

test("physical reconciliation fails closed when a provider attempt has unknown pricing", () => {
  assert.throws(() => reconcilePhysicalUsage({}, [
    { provider: "unknown", model: "m", providerRequestId: "req", pricingKnown: false },
  ]), (error) => error.name === "PricingUnknownError");
});

test("routing keeps capability class and enforces producer reviewer diversity", () => {
  const catalog = { schemaVersion: 1, policyVersion: "test", aliases: { review: { class: "strong", requireProviderDiversity: true, deployments: [
    { id: "a", provider: "openai", modelEnv: "A_MODEL", apiKeyEnv: "A_KEY", inputPerMillionEnv: "A_IN", outputPerMillionEnv: "A_OUT" },
    { id: "b", provider: "anthropic", modelEnv: "B_MODEL", apiKeyEnv: "B_KEY", inputPerMillionEnv: "B_IN", outputPerMillionEnv: "B_OUT" },
  ] } } };
  const environment = { A_MODEL: "a", A_KEY: "key", A_IN: "1", A_OUT: "2", B_MODEL: "b", B_KEY: "key", B_IN: "3", B_OUT: "4" };
  const decision = new RoutingPolicy(catalog, environment).decide({ alias: "review", role: "reviewer", producerProvider: "openai" });
  assert.equal(decision.capabilityClass, "strong");
  assert.deepEqual(decision.deployments.map((item) => item.provider), ["anthropic"]);
  assert.equal(decision.selected.gatewayAlias, "review-anthropic");
  assert.match(decision.decisionId, /^[a-f0-9]{64}$/);
});

test("routing fails closed for unknown pricing and unavailable diverse reviewer", () => {
  const route = { schemaVersion: 1, policyVersion: "test", aliases: { strong: { class: "strong", requireProviderDiversity: true, deployments: [
    { id: "a", provider: "openai", modelEnv: "MODEL", apiKeyEnv: "KEY", inputPerMillionEnv: "IN", outputPerMillionEnv: "OUT" },
  ] } } };
  assert.throws(() => new RoutingPolicy(route, { MODEL: "m", KEY: "k" }).decide({ alias: "strong" }), (error) => error.name === "PricingUnknownError");
  assert.throws(() => new RoutingPolicy(route, { MODEL: "m", KEY: "k", IN: "1", OUT: "2" }).decide({ alias: "strong", role: "reviewer", producerProvider: "openai" }), /ROUTE_UNAVAILABLE/);
});

test("scanner bundle validates vendored rules and rejects stale Trivy data", async () => {
  const root = await mkdtemp(join(tmpdir(), "aicp-scanners-"));
  await mkdir(join(root, "rules"), { recursive: true });
  await mkdir(join(root, "cache/db"), { recursive: true });
  await writeFile(join(root, "rules/rules.yaml"), "rules: []\n");
  await writeFile(join(root, "cache/db/trivy.db"), "db");
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  await writeFile(join(root, "cache/runtime.json"), JSON.stringify({ schemaVersion: 1, downloadedAt: "2026-08-20T00:00:00.000Z", dbSha256: hash("db") }));
  const attestor = new ScannerBundleAttestor({ root, now: () => new Date("2026-08-22T00:00:00.000Z"), manifest: {
    schemaVersion: 1, bundleVersion: "test", semgrep: { rulesPath: "rules/rules.yaml", sha256: hash("rules: []\n") },
    gitleaks: { configPath: "rules/rules.yaml", sha256: hash("rules: []\n") },
    trivy: { cachePath: "cache", runtimeManifestPath: "cache/runtime.json", maxAgeHours: 24 },
  } });
  assert.equal((await attestor.attest("semgrep")).offline, true);
  await assert.rejects(attestor.attest("trivy"), /SCANNER_BUNDLE_STALE/);
});

test("worker profile selection supports polyglot projects and availability requires runtime probes", async () => {
  const registry = new WorkerProfileRegistry({ schemaVersion: 1, profiles: {
    node: { projectKinds: ["node"], image: "node@sha256:test", dockerfile: "node/Dockerfile", probes: [["node", "--version"]] },
    go: { projectKinds: ["go"], image: "go@sha256:test", dockerfile: "go/Dockerfile", probes: [["go", "version"]] },
  } });
  assert.deepEqual(registry.select({ kind: "composite", modules: [{ kind: "go" }, { kind: "node" }] }), ["go", "node"]);
  const attestation = await registry.attest("node", { exec: async () => ({ exitCode: 0, stdout: "v22" }) });
  assert.equal(attestation.status, "AVAILABLE");
  assert.match(attestation.attestationId, /^[a-f0-9]{64}$/);
  await assert.rejects(registry.attest("go", { exec: async () => ({ exitCode: 127 }) }), /WORKER_CAPABILITY_UNAVAILABLE/);
});

test("ephemeral worker is scoped to one run and destroy revokes its identity", async () => {
  const now = () => new Date("2026-08-22T12:00:00.000Z");
  const identities = new WorkloadIdentityService({ secret: "x".repeat(32), now });
  const token = identities.issue("run-a");
  const inspect = { Config: { User: "worker", Env: ["AICP_RUN_ID=run-a"], Labels: { "aicp.run_id": "run-a" } }, HostConfig: { ReadonlyRootfs: true, NetworkMode: "none", CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"] }, Mounts: [] };
  const calls = [];
  const docker = { create: async () => "worker-a", inspect: async () => inspect, exec: async (id, command) => { calls.push([id, command]); return { exitCode: 0, stdout: "v1" }; }, diff: async () => ({ exitCode: 0, stdout: "C /workspace/project/a" }), remove: async (id) => calls.push(["remove", id]) };
  const profiles = new WorkerProfileRegistry({ schemaVersion: 1, profiles: { node: { projectKinds: ["node"], image: "node", dockerfile: "Dockerfile", probes: [["node", "--version"]] } } });
  const manager = new DockerWorkerManager({ docker, profiles, identityService: identities, secretResolver: async () => "scoped" });
  const identity = new WorkloadIdentity({ runId: "run-a", litellmKeyRef: "llm/a", memoryTokenRef: "memory/a", expiresAt: new Date(Date.now() + 60_000) });
  const spec = new EphemeralWorkerSpec({ runId: "run-a", projectDirectory: "/workspace/project", profile: "node", identity, identityToken: token });
  const handle = await manager.create(spec);
  assert.equal(handle.attestation.nonRoot, true);
  await assert.rejects(manager.exec("run-b", ["node", "--version"]), /WORKER_NOT_FOUND/);
  assert.equal((await manager.collectEvidence("run-a")).changedEntries, 1);
  assert.equal(await manager.destroy("run-a"), true);
  assert.throws(() => identities.verify(token, "run-a"), /WORKLOAD_IDENTITY_INVALID/);
  assert.deepEqual(calls.at(-1), ["remove", "worker-a"]);
});

test("worker manager refuses capacity exhaustion before creating another container", async () => {
  const identities = new WorkloadIdentityService({ secret: "x".repeat(32) });
  const token = identities.issue("run-a");
  const inspect = { Config: { User: "worker", Labels: { "aicp.run_id": "run-a" } }, HostConfig: { ReadonlyRootfs: true, CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"] }, Mounts: [] };
  let creates = 0;
  const docker = { create: async () => { creates += 1; return "worker-a"; }, inspect: async () => inspect, exec: async () => ({ exitCode: 0, stdout: "v1" }), remove: async () => undefined };
  const profiles = new WorkerProfileRegistry({ schemaVersion: 1, profiles: { node: { projectKinds: ["node"], image: "node", dockerfile: "Dockerfile", probes: [["node", "--version"]] } } });
  const manager = new DockerWorkerManager({ docker, profiles, identityService: identities, maxActiveWorkers: 1, secretResolver: async () => "scoped" });
  const spec = (runId, identityToken) => new EphemeralWorkerSpec({ runId, projectDirectory: "/workspace/project", profile: "node", identity: new WorkloadIdentity({ runId, litellmKeyRef: `llm/${runId}`, memoryTokenRef: `memory/${runId}`, expiresAt: new Date(Date.now() + 60_000) }), identityToken });
  await manager.create(spec("run-a", token));
  const secondToken = identities.issue("run-b");
  await assert.rejects(manager.create(spec("run-b", secondToken)), /WORKER_CAPACITY_EXHAUSTED/);
  assert.equal(creates, 1);
  await manager.destroy("run-a");
});
