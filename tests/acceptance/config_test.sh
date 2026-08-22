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
  docker/workspace/Dockerfile
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
  .github/workflows/ci.yml
  docs/threat-model.md
  docs/runbook.md
  docs/memory-model.md
)

for path in "${required[@]}"; do
  test -f "$path" || {
    printf 'missing required artifact: %s\n' "$path" >&2
    exit 1
  }
done

compose_json="$(docker compose --env-file versions.env config --format json)"
docker compose --env-file versions.env config --quiet
jq -e '.services.litellm.healthcheck.test | length > 0' <<<"$compose_json" >/dev/null
jq -e '[.services.litellm.secrets[].source] | index("postgres_password") != null' <<<"$compose_json" >/dev/null
jq -e '.services.workspace.depends_on.litellm.condition == "service_healthy"' <<<"$compose_json" >/dev/null
jq -e '[.services.workspace.volumes[] | select(.target == "/home/dev/.local/share/opencode")][0].type == "volume"' <<<"$compose_json" >/dev/null
jq -e '[.services.workspace.volumes[] | select(.target == "/home/dev/.local/state")][0].type == "volume"' <<<"$compose_json" >/dev/null

workspace_environment="$(jq -r '.services.workspace.environment | keys[]' <<<"$compose_json")"
if printf '%s\n' "$workspace_environment" | rg '^(OPENAI|ANTHROPIC|GEMINI)_' ; then
  echo 'provider credentials must not be present in the workspace environment' >&2
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
test "$REVIEW_MODEL" = "openai/gpt-5.4"
test "$EMBEDDING_MODEL" = "openai/text-embedding-3-small"
[[ "$LITELLM_MASTER_KEY" != *change-me* ]]
[[ "$LITELLM_SALT_KEY" != *change-me* ]]
[[ "$NEO4J_AUTH" != *change-me* ]]
[[ "$MEMORY_SERVICE_TOKEN" != *change-me* ]]
rg -q '^  database_url: os\.environ/DATABASE_URL$' litellm/config.template.yaml
rg -q '^  - model_name: embeddings$' litellm/config.template.yaml
rg -q '"embeddings"' scripts/provision-litellm-key.sh
if rg -n 'CREATE CONSTRAINT symbol_identity' graph/cypher; then
  echo 'obsolete symbol-name uniqueness must not be recreated' >&2
  exit 1
fi
rg -q 'CREATE CONSTRAINT symbol_id' graph/cypher/003_symbol_identity.cypher
echo '[PASS] local runtime configuration'
