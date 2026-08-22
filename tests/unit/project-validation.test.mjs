import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ProjectAdapter } from "../../harness/src/gates/project-adapter.mjs";
import { ProjectGateRunner } from "../../harness/src/gates/project-gate-runner.mjs";
import { ProcessRunner } from "../../harness/src/adapters/process-runner.mjs";

test("project adapter detects static-site validation scripts without package.json", async () => {
  const project = await mkdtemp(join(tmpdir(), "aicp-static-site-"));
  await mkdir(join(project, "scripts"));
  for (const script of ["validate_site_structure.py", "quality_smoke.py", "budget_check.py", "validate_product_accountability_gate.py"]) {
    await writeFile(join(project, "scripts", script), "raise SystemExit(0)\n");
  }

  const profile = await new ProjectAdapter().detect(project);

  assert.equal(profile.kind, "static-site");
  assert.deepEqual(profile.gates.map((gate) => gate.name), [
    "structure", "quality-smoke", "performance-budget", "accountability",
  ]);
  assert.ok(profile.gates.every((gate) => gate.required));
});

test("project gate runner blocks when one detected command fails", async () => {
  const project = await mkdtemp(join(tmpdir(), "aicp-gates-"));
  const profile = {
    kind: "fixture",
    gates: [
      { name: "passing", required: true, command: [process.execPath, "-e", "process.exit(0)"] },
      { name: "blocking", required: true, command: [process.execPath, "-e", "process.exit(1)"] },
    ],
  };

  const report = await new ProjectGateRunner({ runner: new ProcessRunner() }).run({ project, profile });

  assert.equal(report.status, "blocked");
  assert.deepEqual(report.gates.map((gate) => gate.status), ["pass", "fail"]);
});
