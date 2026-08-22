#!/usr/bin/env node
import { resolve } from "node:path";
import process from "node:process";

import { ProcessRunner } from "../adapters/process-runner.mjs";
import { ProjectAdapter } from "../gates/project-adapter.mjs";
import { ProjectGateRunner } from "../gates/project-gate-runner.mjs";

const projectFlag = process.argv.indexOf("--project");
if (projectFlag === -1 || !process.argv[projectFlag + 1]) {
  process.stderr.write("usage: validate-project --project <directory>\n");
  process.exit(2);
}

try {
  const project = resolve(process.argv[projectFlag + 1]);
  const profile = await new ProjectAdapter().detect(project);
  const report = await new ProjectGateRunner({ runner: new ProcessRunner() }).run({ project, profile });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === "pass" ? 0 : 1;
} catch (error) {
  process.stderr.write(`project validation failed: ${error.message}\n`);
  process.exitCode = 2;
}
