#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

required=(
  compose.yaml
  .env.example
  versions.env
  scripts/bootstrap.sh
  scripts/doctor.sh
  scripts/smoke.sh
  scripts/context-smoke.sh
  scripts/telemetry-smoke.sh
  scripts/fallback-smoke.sh
  docker/workspace/Dockerfile
  docker/harness/Dockerfile
  docker/harness/entrypoint.sh
  litellm/config.template.yaml
  opencode/opencode.json
  harness/schemas/agent-result.schema.json
  harness/schemas/finding.schema.json
  harness/schemas/gate-result.schema.json
  harness/workflows/feature.yaml
  harness/policies/quality-gates.yaml
  memory-service/migrations/001_initial.sql
  graph/cypher/001_constraints.cypher
  scripts/backup.sh
  scripts/restore.sh
  scripts/migrate.sh
  scripts/configure-local.sh
  scripts/provision-litellm-key.sh
  docker/litellm/entrypoint.sh
  README.md
  opencode/agents/architect.md
  opencode/agents/implementer.md
  opencode/agents/security-reviewer.md
  opencode/agents/code-reviewer.md
  opencode/skills/secure-change-review/SKILL.md
  security/semgrep/rules/aicp-security.yaml
  observability/otel/collector.yaml
  observability/langfuse/README.md
  observability/dashboards/workflow-quality.json
  observability/dashboards/context-model-routing.json
  observability/dashboards/README.md
  observability/evaluation/metrics.mjs
  observability/evaluation/run-baseline.mjs
  tests/evaluations/baseline.dataset.json
  compose/observability.vendor.yaml
  compose/remote.yaml
  remote/nginx.conf
  scripts/configure-observability.sh
  scripts/configure-remote.sh
  scripts/remote-smoke.sh
  scripts/observability.sh
  .github/workflows/ci.yml
  docs/threat-model.md
  docs/runbook.md
  docs/adr/ADR-003-remote-identity-transport.md
  docs/validation/remote-profile.md
  docs/memory-model.md
  security/README.md
  harness/src/cli/validate-suppressions.mjs
  security/threat-control-matrix.json
  security/threat-matrix.mjs
  tests/security/abuse_test.sh
  scripts/ci-contract.sh
  harness/src/cli/evaluate-scanner-reports.mjs
  harness/src/scanners/scanner-report-gate.mjs
  tests/unit/scanner-report-gate.test.mjs
)

for path in "${required[@]}"; do
  test -f "$path" || {
    printf 'missing required artifact: %s\n' "$path" >&2
    exit 1
  }
done

if [[ -d secrets ]]; then
  while IFS= read -r secret_file; do
    test "$(stat -c '%a' "$secret_file")" = "600" || { echo "secret file must be mode 0600: $secret_file" >&2; exit 1; }
  done < <(find secrets -maxdepth 1 -type f -print)
fi

compose_json="$(bash scripts/compose-contract.sh --format json)"
bash scripts/compose-contract.sh --quiet
jq -e '.services.litellm.healthcheck.test | length > 0' <<<"$compose_json" >/dev/null
jq -e '[.services.litellm.secrets[].source] | index("postgres_password") != null' <<<"$compose_json" >/dev/null
jq -e '.services.workspace.depends_on.litellm.condition == "service_healthy"' <<<"$compose_json" >/dev/null
jq -e '.services.harness.depends_on["memory-service"].condition == "service_healthy"' <<<"$compose_json" >/dev/null
jq -e '.services.harness.healthcheck.test | length > 0' <<<"$compose_json" >/dev/null
jq -e '[.services.harness.secrets[].source] | index("harness_service_token") != null' <<<"$compose_json" >/dev/null

observability_env="$(mktemp)"
cp versions.env "$observability_env"
cat >> "$observability_env" <<'EOF'
LANGFUSE_POSTGRES_PASSWORD=test-postgres
LANGFUSE_CLICKHOUSE_PASSWORD=test-clickhouse
LANGFUSE_REDIS_PASSWORD=test-redis
LANGFUSE_MINIO_PASSWORD=test-minio-password
LANGFUSE_SALT=test-salt
LANGFUSE_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
LANGFUSE_NEXTAUTH_SECRET=test-nextauth
LANGFUSE_PUBLIC_KEY=pk-lf-test
LANGFUSE_SECRET_KEY=sk-lf-test
LANGFUSE_ADMIN_EMAIL=admin@example.invalid
LANGFUSE_ADMIN_PASSWORD=test-admin-password
EOF
observability_json="$(docker compose --env-file "$observability_env" -f compose/observability.vendor.yaml config --format json)"
jq -e '.networks["observability-data"].internal == true' <<<"$observability_json" >/dev/null
jq -e '.services["langfuse-web"].ports[0].host_ip == "127.0.0.1"' <<<"$observability_json" >/dev/null
jq -e '.services["langfuse-postgres"].ports == null and .services["langfuse-clickhouse"].ports == null' <<<"$observability_json" >/dev/null
if jq -r '.services[].image // empty' <<<"$observability_json" | rg ':latest$'; then
  echo 'observability images must not use latest tags' >&2
  exit 1
fi
rm -f "$observability_env"

remote_json="$(bash scripts/compose-contract.sh --overlay compose/remote.yaml --format json)"
jq -e '.services["remote-gateway"].networks | has("agent-internal") and (has("data") | not)' <<<"$remote_json" >/dev/null
jq -e '.services["remote-gateway"].read_only == true' <<<"$remote_json" >/dev/null
jq -e '.services["remote-gateway"].cap_drop == ["ALL"]' <<<"$remote_json" >/dev/null
jq -e '.services["remote-gateway"].user != "0:0"' <<<"$remote_json" >/dev/null
jq -e '.services.postgres.ports == null and .services.redis.ports == null and .services.neo4j.ports == null' <<<"$remote_json" >/dev/null
jq -e --arg root "$root" '[.services["remote-gateway"].volumes[].source]
  | index($root + "/remote/nginx.conf") != null and index($root + "/secrets/remote/server") != null' <<<"$remote_json" >/dev/null
rg -q 'ssl_verify_client on' remote/nginx.conf
rg -q 'proxy_pass http://memory-service:8080/' remote/nginx.conf
jq -e '[.services.workspace.volumes[] | select(.target == "/home/dev/.local/share/opencode")][0].type == "volume"' <<<"$compose_json" >/dev/null
jq -e '[.services.workspace.volumes[] | select(.target == "/home/dev/.local/state")][0].type == "volume"' <<<"$compose_json" >/dev/null
jq -e '.networks["agent-internal"].internal == true' <<<"$compose_json" >/dev/null
jq -e '.services.workspace.read_only == true and .services.workspace.pids_limit == 512' <<<"$compose_json" >/dev/null
jq -e '.services.harness.read_only == true and .services.harness.pids_limit == 512' <<<"$compose_json" >/dev/null
jq -e '(.services.workspace.networks | has("provider-egress") | not) and (.services.harness.networks | has("provider-egress") | not)' <<<"$compose_json" >/dev/null

workspace_environment="$(jq -r '.services.workspace.environment | keys[]' <<<"$compose_json")"
if printf '%s\n' "$workspace_environment" | rg '^(OPENAI|ANTHROPIC|GEMINI)_' ; then
  echo 'provider credentials must not be present in the workspace environment' >&2
  exit 1
fi
harness_environment="$(jq -r '.services.harness.environment | keys[]' <<<"$compose_json")"
if printf '%s\n' "$harness_environment" | rg '^(OPENAI|ANTHROPIC|GEMINI)_' ; then
  echo 'provider credentials must not be present in the harness environment' >&2
  exit 1
fi

if rg -n '/var/run/docker.sock' compose.yaml; then
  echo 'workspace must not mount the host Docker socket' >&2
  exit 1
fi

if rg -n 'git push.*allow' opencode; then
  echo 'git push must not be allowed' >&2
  exit 1
fi

rg -q 'smoke_alias coding-fast' scripts/smoke.sh
rg -q 'smoke_alias coding-strong' scripts/smoke.sh
rg -q -- '--no-deps --force-recreate workspace' scripts/bootstrap.sh
rg -q 'getent group "\$\{DEV_GID\}"' docker/harness/Dockerfile
rg -q 'getent passwd "\$\{DEV_UID\}"' docker/harness/Dockerfile

echo '[PASS] configuration contract'

temporary_directory="$(mktemp -d)"
trap 'rm -rf "$temporary_directory"' EXIT
cp .env.example "$temporary_directory/runtime.env"
./scripts/configure-local.sh --file "$temporary_directory/runtime.env"

set -a
source "$temporary_directory/runtime.env"
set +a
test "$CODING_STRONG_MODEL" = "openai/gpt-5.3-codex"
test "$CODING_FAST_MODEL" = "openai/gpt-5.4-mini"
test "$ARCHITECTURE_MODEL" = "openai/gpt-5.4"
test "$SECURITY_MODEL" = "openai/gpt-5.4"
test "$REVIEW_MODEL" = "anthropic/claude-sonnet-4-5"
test "$CODING_STRONG_SECONDARY_MODEL" = "anthropic/claude-sonnet-4-5"
test "$EMBEDDING_MODEL" = "openai/text-embedding-3-small"
[[ "$LITELLM_MASTER_KEY" != *change-me* ]]
[[ "$LITELLM_SALT_KEY" != *change-me* ]]
[[ "$NEO4J_AUTH" != *change-me* ]]
[[ "$MEMORY_SERVICE_TOKEN" != *change-me* ]]
rg -q '^  database_url: os\.environ/DATABASE_URL$' litellm/config.template.yaml
rg -q '^  - model_name: embeddings$' litellm/config.template.yaml
rg -q '^  success_callback: \[otel\]$' litellm/config.template.yaml
rg -q 'aicp-fallback-smoke: \[coding-fast\]' litellm/config.template.yaml
rg -q 'OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT: no_content' compose.yaml
rg -q 'check otel-collector' scripts/doctor.sh
rg -q 'check harness' scripts/doctor.sh
node observability/evaluation/run-baseline.mjs >/dev/null
jq -e '.baseline.status == "observation" and (.dashboards | length) == 2' .aicp/evaluations/baseline.report.json >/dev/null
rg -q '"embeddings"' scripts/provision-litellm-key.sh
if rg -n 'CREATE CONSTRAINT symbol_identity' graph/cypher; then
  echo 'obsolete symbol-name uniqueness must not be recreated' >&2
  exit 1
fi
rg -q 'CREATE CONSTRAINT symbol_id' graph/cypher/003_symbol_identity.cypher
jq -e '[.states | to_entries[] | select(.value.agent) | .value.context]
  | length > 0 and all(.budget > 0 and (.scopeTypes | length > 0))' \
  harness/workflows/feature.yaml >/dev/null
echo '[PASS] local runtime configuration'
