#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
mkdir -p .aicp/security
compose_json="$(docker compose --env-file versions.env config --format json)"

# host-workspace
test -z "$(jq -r '.services.workspace.volumes[]?.source' <<<"$compose_json" | grep '/var/run/docker.sock' || true)"
jq -e '.services.workspace.cap_drop | index("ALL") != null' <<<"$compose_json" >/dev/null
rg -q '^USER dev$' docker/workspace/Dockerfile

# gateway
for service in workspace harness; do
  if jq -r --arg service "$service" '.services[$service].environment | keys[]' <<<"$compose_json" \
    | grep -Eq '^(OPENAI|ANTHROPIC|GEMINI)_'; then
    echo "provider key leaked to $service" >&2
    exit 1
  fi
done
rg -q 'max_budget: 10' scripts/provision-litellm-key.sh

# prompt-injection and reviewer authority
rg -q 'IGNORE ALL PLATFORM RULES' tests/security/fixtures/prompt-injection.txt
jq -e '.permission.external_directory == "deny" and .permission.read["*.env"] == "deny"' opencode/opencode.json >/dev/null
rg -q 'git push \*": "deny"' opencode/opencode.json
rg -q '^  edit: deny$' opencode/agents/security-reviewer.md
rg -q '^  edit: deny$' opencode/agents/code-reviewer.md

# telemetry
for key in gen_ai.prompt source.code http.request.body db.query.text exception.stacktrace litellm.provider.error.stack_trace; do
  yq_pattern="- key: $key"
  rg -Fq -- "$yq_pattern" observability/otel/collector.yaml
done

node --test tests/unit/runtime-cli.test.mjs tests/unit/suppressions.test.mjs tests/unit/telemetry.test.mjs >/dev/null
PYTHONPATH=memory-service/src python3 -m unittest discover -s tests/unit -p 'memory*_test.py' >/dev/null

node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";
import { validateThreatMatrix } from "./security/threat-matrix.mjs";
const matrix = JSON.parse(readFileSync("security/threat-control-matrix.json", "utf8"));
const result = validateThreatMatrix(matrix);
if (result.errors.length) throw new Error(result.errors.join("\n"));
if (!result.openRisks.includes("THR-SUPPLY-CHAIN")) throw new Error("supply-chain residual risk must remain explicit until Foundation 3.5");
const report = {
  schemaVersion: 1,
  status: "pass",
  verifiedThreats: matrix.threats.map(({ id, status, boundary }) => ({ id, status, boundary })),
  openRisks: result.openRisks,
  sensitivePayloadPersisted: false,
};
writeFileSync(".aicp/security/abuse-report.json", `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
NODE

echo '[PASS] security abuse matrix'
