import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ProjectAdapter } from "../../harness/src/gates/project-adapter.mjs";

const ok = async () => ({ kind: "completed", exitCode: 0, stdout: "assemble check test integrationTest jacocoTestReport mvn", stderr: "" });
const fakeAdapters = {
  node: { detect: async () => ({ path: ".", kind: "node", languages: ["javascript"], capabilities: { build: { status: "AVAILABLE", command: ["npm", "run", "build"] }, "unit-tests": { status: "AVAILABLE", command: ["npm", "test"] } } }) },
  gradle: { detect: async () => ({ path: ".", kind: "gradle", languages: ["java"], capabilities: { build: { status: "AVAILABLE", command: ["./gradlew", "assemble"] }, "unit-tests": { status: "AVAILABLE", command: ["./gradlew", "test"] } } }) },
  maven: { detect: async () => ({ path: ".", kind: "maven", languages: ["java"], capabilities: { build: { status: "AVAILABLE", command: ["mvn", "package"] }, "unit-tests": { status: "AVAILABLE", command: ["mvn", "test"] } } }) },
  python: { detect: async () => ({ path: ".", kind: "python", languages: ["python"], capabilities: { build: { status: "AVAILABLE", command: ["python3", "-m", "compileall"] }, "unit-tests": { status: "AVAILABLE", command: ["python3", "-m", "pytest"] } } }) },
  go: { detect: async () => ({ path: ".", kind: "go", languages: ["go"], capabilities: { build: { status: "AVAILABLE", command: ["go", "build"] }, "unit-tests": { status: "AVAILABLE", command: ["go", "test"] } } }) },
};

test("multi-stack profiles expose build and unit-test capabilities", async () => {
  const root = await mkdtemp(join(tmpdir(), "aicp-multistack-"));
  const manifests = [["node", "package.json", "{}"], ["gradle", "build.gradle", ""], ["maven", "pom.xml", "<project/>"], ["python", "pyproject.toml", "[project]\nname='fixture'\n"], ["go", "go.mod", "module fixture\n"]];
  for (const [kind, manifest, contents] of manifests) { const directory = join(root, kind); await mkdir(directory); await writeFile(join(directory, manifest), contents); }
  const adapter = new ProjectAdapter({ adapters: fakeAdapters });
  const profile = await adapter.detect(root);
  assert.equal(profile.kind, "composite");
  for (const kind of ["node", "gradle", "maven", "python", "go"]) assert.equal(profile.modules.find((module) => module.kind === kind).capabilities.build.status, "AVAILABLE");
});
