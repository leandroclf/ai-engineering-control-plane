#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fixture="$root/tests/fixtures/vulnerable-project"
report="$(mktemp)"
trap 'rm -f "$report"' EXIT

if node "$root/harness/src/cli/audit-project.mjs" --project "$fixture" >"$report"; then
  echo "expected vulnerable fixture to fail mandatory gates" >&2
  exit 1
fi

node - "$report" <<'NODE'
const fs = require("node:fs");
const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const statuses = new Map(report.gates.map((gate) => [gate.gate, gate.status]));
const tools = new Set(report.findings.map((finding) => finding.tool));
const categories = new Set(report.findings.map((finding) => finding.category));

for (const gate of ["unit-tests", "gitleaks", "semgrep", "trivy"]) {
  if (statuses.get(gate) !== "fail") throw new Error(`${gate} did not block`);
}
for (const tool of ["gitleaks", "semgrep", "trivy"]) {
  if (!tools.has(tool)) throw new Error(`${tool} finding missing`);
}
for (const category of ["secret", "sast", "dependency", "container"]) {
  if (!categories.has(category)) throw new Error(`${category} finding missing`);
}
if (report.status !== "blocked") throw new Error("terminal status must be blocked");
if (JSON.stringify(report).includes("AICP_FAKE_SECRET_acceptance_only")) {
  throw new Error("secret material leaked into report");
}
NODE

echo "harness vulnerable-project acceptance: PASS"
