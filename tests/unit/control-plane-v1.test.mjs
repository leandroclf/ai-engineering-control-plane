import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

import { GateRegistry, ProjectGateProvider, ScannerGateProvider } from "../../harness/src/gates/gate-registry.mjs";
import { ProjectAdapter } from "../../harness/src/gates/project-adapter.mjs";
import { ScannerCommandGate } from "../../harness/src/gates/scanner-command-gate.mjs";

test("gate registry rejects duplicates and unknown workflow gates during preflight", async () => {
  const registry = new GateRegistry({ definitions: { build: { provider: "project", capability: "build" } } });
  registry.register("project", new ProjectGateProvider());
  assert.throws(() => registry.register("project", new ProjectGateProvider()), /DUPLICATE_PROVIDER/);
  await assert.rejects(registry.preflight({ names: ["unknown"], project: ".", profile: { capabilities: {} } }), /UNKNOWN_GATE/);
});

test("gate registry composes project and scanner capabilities", async () => {
  const registry = new GateRegistry({ definitions: {
    build: { provider: "project", capability: "build" }, semgrep: { provider: "semgrep", mode: "full" },
  } }).register("project", new ProjectGateProvider()).register("semgrep", new ScannerGateProvider("semgrep"));
  const definitions = await registry.preflight({ names: ["build", "semgrep"], project: ".", profile: { capabilities: { build: { command: ["go", "build", "./..."], required: true } } } });
  assert.deepEqual(definitions[0].command, ["go", "build", "./..."]);
  assert.equal(definitions[1].scanner, "semgrep");
});

test("project adapter supports Gradle Maven Python and Go manifests", async () => {
  const fixtures = [["build.gradle.kts", "gradle"], ["pom.xml", "maven"], ["pyproject.toml", "python"], ["go.mod", "go"]];
  for (const [manifest, kind] of fixtures) {
    const project = await mkdtemp(join(tmpdir(), `aicp-${kind}-`));
    await writeFile(join(project, manifest), "\n");
    const profile = await new ProjectAdapter().detect(project);
    assert.equal(profile.kind, kind);
    assert.ok(profile.capabilities.build);
    assert.ok(profile.capabilities["unit-tests"]);
    assert.ok(["AVAILABLE", "MISCONFIGURED", "UNSUPPORTED"].includes(profile.capabilities["unit-tests"].status));
  }
});

test("stable symbol identity survives line shifts", async () => {
  const { planGraphDelta } = await import("../../context/indexer/graph-projection.mjs");
  const symbol = { qualifiedName: "Service.run", kind: "function", lineStart: 2, lineEnd: 4, signatureHash: "run()" };
  const first = planGraphDelta({ repositoryId: "repo", changed: [{ path: "service.js", symbols: [symbol] }], deleted: [] });
  const shifted = planGraphDelta({ repositoryId: "repo", changed: [{ path: "service.js", symbols: [{ ...symbol, lineStart: 20, lineEnd: 22 }] }], deleted: [] });
  assert.equal(first.upsertSymbols[0].id, shifted.upsertSymbols[0].id);
});

test("scanner findings fail while scanner crashes are errors", async () => {
  const findingGate = new ScannerCommandGate({ runner: { run: async () => ({ kind: "completed", exitCode: 1, stdout: JSON.stringify({ results: [{ check_id: "rule", path: "app.js", start: { line: 1 }, extra: { severity: "ERROR", message: "finding" } }] }), stderr: "" }) } });
  const crashGate = new ScannerCommandGate({ runner: { run: async () => ({ kind: "completed", exitCode: 2, stdout: "", stderr: "crash" }) } });
  assert.equal((await findingGate.evaluate({ name: "semgrep", scanner: "semgrep", required: true, command: ["semgrep"], cwd: "." })).status, "fail");
  assert.equal((await crashGate.evaluate({ name: "semgrep", scanner: "semgrep", required: true, command: ["semgrep"], cwd: "." })).status, "error");
});

test("every feature workflow gate resolves for a supported Node project", async () => {
  const project = await mkdtemp(join(tmpdir(), "aicp-node-preflight-"));
  await writeFile(join(project, "package.json"), JSON.stringify({ scripts: {
    build: "node -e 0", lint: "node -e 0", test: "node -e 0", "test:integration": "node -e 0", coverage: "node -e 0",
  } }));
  const profile = await new ProjectAdapter().detect(project);
  const workflow = JSON.parse(await readFile("harness/workflows/feature.yaml", "utf8"));
  const config = JSON.parse(await readFile("harness/config/gates.yaml", "utf8"));
  const names = [...new Set(Object.values(workflow.states).flatMap((state) => state.gates ?? []))];
  const registry = new GateRegistry({ definitions: config.gates })
    .register("project", new ProjectGateProvider())
    .register("semgrep", new ScannerGateProvider("semgrep"))
    .register("gitleaks", new ScannerGateProvider("gitleaks"))
    .register("trivy", new ScannerGateProvider("trivy"));
  assert.equal((await registry.preflight({ names, project, profile })).length, names.length);
});
