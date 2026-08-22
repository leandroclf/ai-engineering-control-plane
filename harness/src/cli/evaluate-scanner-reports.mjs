#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { evaluateScannerDocuments } from "../scanners/scanner-report-gate.mjs";

const reportDirectory = process.argv[2] ?? ".aicp/ci/raw";
const outputPath = process.argv[3] ?? ".aicp/ci/scanner-gate.json";
const tools = ["semgrep", "gitleaks", "trivy"];
const reports = {};
for (const tool of tools) {
  try {
    const [raw, exitCode] = await Promise.all([
      readFile(join(reportDirectory, `${tool}.json`), "utf8"),
      readFile(join(reportDirectory, `${tool}.exit`), "utf8"),
    ]);
    reports[tool] = { raw, exitCode: Number(exitCode.trim()) };
  } catch {
    reports[tool] = { unavailable: true };
  }
}
const [policy, suppressions] = await Promise.all([
  readFile("harness/policies/quality-gates.yaml", "utf8").then(JSON.parse),
  readFile("security/suppressions.yaml", "utf8").then(JSON.parse),
]);
const result = evaluateScannerDocuments({ reports, policies: policy.gates, suppressions });
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = result.status === "pass" ? 0 : 1;
