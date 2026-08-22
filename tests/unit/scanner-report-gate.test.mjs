import test from "node:test";
import assert from "node:assert/strict";

import { evaluateScannerDocuments } from "../../harness/src/scanners/scanner-report-gate.mjs";

test("scanner report gate blocks findings and required missing evidence", () => {
  const result = evaluateScannerDocuments({
    reports: {
      semgrep: { exitCode: 0, document: { results: [{
        check_id: "sql", path: "app.js", start: { line: 2 },
        extra: { severity: "ERROR", message: "SQL injection" },
      }] } },
      gitleaks: { exitCode: 0, document: [] },
      trivy: { unavailable: true },
    },
    policies: {
      semgrep: { required: true, block: ["high", "critical"] },
      gitleaks: { required: true, block: ["high", "critical"] },
      trivy: { required: true, block: ["high", "critical"] },
    },
    suppressions: { version: 1, suppressions: [] },
    now: new Date("2026-08-21T00:00:00Z"),
  });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.gates.map((gate) => [gate.tool, gate.status]), [
    ["semgrep", "fail"], ["gitleaks", "pass"], ["trivy", "error"],
  ]);
  assert.equal(result.findings.length, 1);
});

test("scanner report gate passes complete reports without blocking findings", () => {
  const result = evaluateScannerDocuments({
    reports: {
      semgrep: { exitCode: 0, document: { results: [] } },
      gitleaks: { exitCode: 0, document: [] },
      trivy: { exitCode: 0, document: { Results: [] } },
    },
    policies: {
      semgrep: { required: true, block: ["high", "critical"] },
      gitleaks: { required: true, block: ["high", "critical"] },
      trivy: { required: true, block: ["high", "critical"] },
    },
    suppressions: { version: 1, suppressions: [] },
  });

  assert.equal(result.status, "pass");
  assert.deepEqual(result.gates.map((gate) => gate.status), ["pass", "pass", "pass"]);
});

test("scanner report gate fails closed for invalid scanner JSON", () => {
  const result = evaluateScannerDocuments({
    reports: {
      semgrep: { exitCode: 0, raw: "not-json" },
      gitleaks: { exitCode: 0, document: [] },
      trivy: { exitCode: 0, document: { Results: [] } },
    },
    policies: {
      semgrep: { required: true },
      gitleaks: { required: true },
      trivy: { required: true },
    },
    suppressions: { version: 1, suppressions: [] },
  });

  assert.equal(result.status, "blocked");
  assert.deepEqual(result.gates[0], {
    tool: "semgrep",
    status: "error",
    reason: "INVALID_SCANNER_OUTPUT",
    findingCount: 0,
  });
});
