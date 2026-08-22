import { evaluateScannerPolicy } from "./scanner-policy.mjs";
import { evaluateSuppressions } from "./suppression-policy.mjs";
import { createGitleaksAdapter, createSemgrepAdapter, createTrivyAdapter } from "./tool-adapters.mjs";

const adapters = {
  semgrep: createSemgrepAdapter(),
  gitleaks: createGitleaksAdapter(),
  trivy: createTrivyAdapter(),
};

function scannerResult(tool, report) {
  if (!report || report.unavailable) return adapters[tool].fromExecution({ kind: "unavailable" });
  return adapters[tool].fromExecution({
    kind: "completed",
    exitCode: Number(report.exitCode ?? 0),
    stdout: report.raw ?? JSON.stringify(report.document ?? {}),
    stderr: "",
  });
}

export function evaluateScannerDocuments({ reports, policies, suppressions, now = new Date() }) {
  const parsed = Object.fromEntries(Object.keys(adapters).map((tool) => [tool, scannerResult(tool, reports[tool])]));
  const allFindings = Object.values(parsed).flatMap((result) => result.findings);
  const governed = evaluateSuppressions(suppressions, allFindings, { now });
  const gates = Object.keys(adapters).map((tool) => {
    const result = parsed[tool];
    const findings = governed.findings.filter((finding) => finding.tool === tool);
    const evaluated = evaluateScannerPolicy(policies[tool] ?? { required: true }, {
      ...result,
      findings,
      suppressionErrors: governed.errors,
    });
    return { tool, status: evaluated.status, reason: evaluated.reason ?? null, findingCount: findings.length };
  });
  return {
    schemaVersion: 1,
    status: gates.every((gate) => ["pass", "skipped"].includes(gate.status)) ? "pass" : "blocked",
    gates,
    findings: governed.findings,
    suppressionErrors: governed.errors,
    expiredSuppressions: governed.expired,
  };
}
