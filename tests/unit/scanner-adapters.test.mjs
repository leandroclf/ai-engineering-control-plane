import test from "node:test";
import assert from "node:assert/strict";

import { JsonScannerAdapter } from "../../harness/src/scanners/json-scanner-adapter.mjs";
import { evaluateScannerPolicy } from "../../harness/src/scanners/scanner-policy.mjs";
import {
  createGitleaksAdapter,
  createSemgrepAdapter,
  createTrivyAdapter,
} from "../../harness/src/scanners/tool-adapters.mjs";

test("scanner adapter distinguishes findings from tool execution errors", async () => {
  const adapter = new JsonScannerAdapter({
    name: "semgrep",
    parse: (document) => document.results,
    map: (finding) => ({
      ruleId: finding.check_id,
      severity: finding.extra.severity,
      category: "sast",
      message: finding.extra.message,
      path: finding.path,
      line: finding.start.line,
    }),
  });
  const findingResult = adapter.fromExecution({
    kind: "completed",
    exitCode: 1,
    stdout: JSON.stringify({ results: [{ check_id: "sql", path: "app.js", start: { line: 2 }, extra: { severity: "HIGH", message: "SQL injection" } }] }),
    stderr: "",
  });
  const errorResult = adapter.fromExecution({ kind: "completed", exitCode: 2, stdout: "not-json", stderr: "crash" });

  assert.equal(findingResult.status, "findings");
  assert.equal(findingResult.findings[0].tool, "semgrep");
  assert.equal(errorResult.status, "error");
});

test("scanner policy handles disabled optional and required tools differently", () => {
  const unavailable = { status: "unavailable", findings: [] };

  assert.equal(evaluateScannerPolicy({ mode: "disabled" }, unavailable).status, "skipped");
  assert.equal(evaluateScannerPolicy({ mode: "optional" }, unavailable).status, "skipped");
  assert.equal(evaluateScannerPolicy({ mode: "required" }, unavailable).status, "error");
});

test("official scanner adapters normalize Semgrep Gitleaks and Trivy reports", () => {
  const semgrep = createSemgrepAdapter().fromExecution({
    kind: "completed", exitCode: 1, stderr: "",
    stdout: JSON.stringify({ results: [{ check_id: "sql", path: "app.js", start: { line: 2 }, extra: { severity: "ERROR", message: "SQL" } }] }),
  });
  const gitleaks = createGitleaksAdapter().fromExecution({
    kind: "completed", exitCode: 1, stderr: "",
    stdout: JSON.stringify([{ RuleID: "generic", Description: "secret value", File: "app.js", StartLine: 1, Secret: "value" }]),
  });
  const trivy = createTrivyAdapter().fromExecution({
    kind: "completed", exitCode: 1, stderr: "",
    stdout: JSON.stringify({ Results: [{ Target: "package-lock.json", Vulnerabilities: [{ VulnerabilityID: "CVE-1", Severity: "CRITICAL", Title: "dependency issue" }] }] }),
  });

  assert.deepEqual([semgrep.status, gitleaks.status, trivy.status], ["findings", "findings", "findings"]);
  assert.equal(gitleaks.findings[0].message.includes("value"), false);
  assert.deepEqual([semgrep.findings[0].category, gitleaks.findings[0].category, trivy.findings[0].category], ["sast", "secret", "dependency"]);
});
