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

docker compose --env-file versions.env config --quiet

workspace_environment="$(docker compose --env-file versions.env config --format json | jq -r '.services.workspace.environment | keys[]')"
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

echo '[PASS] configuration contract'
