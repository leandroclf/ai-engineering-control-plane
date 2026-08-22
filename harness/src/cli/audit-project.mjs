#!/usr/bin/env node
import { resolve } from "node:path";
import process from "node:process";

import { BaselineProjectAuditor } from "../scanners/baseline-project-auditor.mjs";

const projectFlag = process.argv.indexOf("--project");
if (projectFlag === -1 || !process.argv[projectFlag + 1]) {
  process.stderr.write("usage: audit-project --project <directory>\n");
  process.exit(2);
}

try {
  const report = await new BaselineProjectAuditor().audit(resolve(process.argv[projectFlag + 1]));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === "pass" ? 0 : 1;
} catch (error) {
  process.stderr.write(`audit failed: ${error.message}\n`);
  process.exitCode = 2;
}
