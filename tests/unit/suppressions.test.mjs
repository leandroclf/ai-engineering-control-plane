import test from "node:test";
import assert from "node:assert/strict";

import { evaluateSuppressions } from "../../harness/src/scanners/suppression-policy.mjs";
import { evaluateScannerPolicy } from "../../harness/src/scanners/scanner-policy.mjs";

const finding = {
  tool: "semgrep",
  ruleId: "javascript.security.sql-injection",
  fingerprint: `sha256:${"a".repeat(64)}`,
  severity: "high",
  status: "open",
};

function validSuppression(overrides = {}) {
  return {
    id: "sup-001",
    tool: finding.tool,
    ruleId: finding.ruleId,
    fingerprint: finding.fingerprint,
    reason: "Reviewed fixture is not reachable from production input.",
    owner: "security-owner@example.com",
    ticket: "SEC-1234",
    expiresAt: "2026-09-01T00:00:00Z",
    approval: { approver: "security-reviewer@example.com", approvedAt: "2026-08-20T00:00:00Z" },
    ...overrides,
  };
}

test("valid suppression is exact independently approved and auditable", () => {
  const result = evaluateSuppressions(
    { version: 1, suppressions: [validSuppression()] },
    [finding],
    { now: new Date("2026-08-21T00:00:00Z") },
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.findings[0].status, "suppressed");
  assert.deepEqual(result.findings[0].suppression, {
    id: "sup-001", owner: "security-owner@example.com", approver: "security-reviewer@example.com",
    ticket: "SEC-1234", expiresAt: "2026-09-01T00:00:00Z",
  });
});

test("expired or non-matching suppression never unblocks a finding", () => {
  const expired = evaluateSuppressions(
    { version: 1, suppressions: [validSuppression({ expiresAt: "2026-08-01T00:00:00Z" })] },
    [finding],
    { now: new Date("2026-08-21T00:00:00Z") },
  );
  const broad = evaluateSuppressions(
    { version: 1, suppressions: [validSuppression({ fingerprint: "*" })] },
    [finding],
    { now: new Date("2026-08-21T00:00:00Z") },
  );

  assert.equal(expired.findings[0].status, "open");
  assert.equal(expired.findings[0].suppression, undefined);
  assert.deepEqual(expired.expired, [{ id: "sup-001", expiresAt: "2026-08-01T00:00:00Z" }]);
  assert.equal(broad.findings[0].status, "open");
  assert.ok(broad.errors.some((error) => error.code === "INVALID_FINGERPRINT"));
});

test("invalid approval fails a required scanner gate closed", () => {
  const suppressionResult = evaluateSuppressions(
    { version: 1, suppressions: [validSuppression({
      approval: { approver: "security-owner@example.com", approvedAt: "2026-08-20T00:00:00Z" },
    })] },
    [finding],
    { now: new Date("2026-08-21T00:00:00Z") },
  );
  const gate = evaluateScannerPolicy(
    { required: true, block: ["high"] },
    { status: "findings", findings: suppressionResult.findings, suppressionErrors: suppressionResult.errors },
  );

  assert.equal(gate.status, "error");
  assert.equal(gate.reason, "INVALID_SUPPRESSION_POLICY");
});
