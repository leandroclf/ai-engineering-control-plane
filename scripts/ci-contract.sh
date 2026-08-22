#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
mkdir -p .aicp/ci
npm run validate
npm run test:architecture > .aicp/ci/architecture-contracts.json
npm run validate:supply-chain > .aicp/ci/supply-chain.json
npm run evaluate:baseline > .aicp/ci/evaluation.stdout.json
npm run validate:benchmark > .aicp/ci/paired-benchmark.json

for schema in harness/schemas/*.json; do
  jq -e 'has("$schema") and .type == "object" and (.required | length > 0)' "$schema" >/dev/null
done
for contract in harness/workflows/feature.yaml harness/policies/quality-gates.yaml security/suppressions.yaml; do
  jq -e '.version == 1' "$contract" >/dev/null
done
docker compose --env-file versions.env config --quiet

fixture_report=".aicp/ci/vulnerable-project.json"
if node harness/src/cli/audit-project.mjs --project tests/fixtures/vulnerable-project > "$fixture_report"; then
  echo 'vulnerable fixture unexpectedly passed the CI gate' >&2
  exit 1
fi
jq -e '.status == "blocked"
  and ([.gates[] | select(.status == "fail")] | length) >= 4
  and ([.findings[].tool] | index("gitleaks") != null)
  and ([.findings[].tool] | index("semgrep") != null)
  and ([.findings[].tool] | index("trivy") != null)' "$fixture_report" >/dev/null

jq -n \
  --slurpfile evaluation .aicp/evaluations/baseline.report.json \
  --slurpfile abuse .aicp/security/abuse-report.json \
  --slurpfile fixture "$fixture_report" \
  '{schemaVersion: 1, status: "pass", evaluation: $evaluation[0].datasetId,
    abuse: $abuse[0].status, fixtureGate: $fixture[0].status,
    normalizedFindingCount: ($fixture[0].findings | length)}' > .aicp/ci/contracts-summary.json
echo '[PASS] clean-checkout CI contracts and negative fixture'
