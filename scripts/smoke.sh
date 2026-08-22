#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
if test -f .env.runtime; then
  set -a
  source .env.runtime
  set +a
fi
expected="${OPENCODE_VERSION:-1.18.21}"
actual="$(docker compose exec -T workspace opencode --version | tr -d '\r')"
test "$actual" = "$expected" || { printf 'unexpected OpenCode version: %s\n' "$actual" >&2; exit 1; }
docker compose exec -T workspace sh -ec 'test ! -S /var/run/docker.sock'
docker compose exec -T workspace sh -ec 'test -z "${OPENAI_API_KEY:-}${ANTHROPIC_API_KEY:-}${GEMINI_API_KEY:-}"'
curl -fsS http://127.0.0.1:4000/health/readiness >/dev/null

smoke_alias() {
  local alias="$1"
  local payload response
  payload="$(jq -n --arg model "$alias" '{
    model: $model,
    messages: [{role: "user", content: "Reply with OK only."}],
    max_completion_tokens: 16
  }')"
  if ! response="$(curl -fsS http://127.0.0.1:4000/v1/chat/completions \
    -H "Authorization: Bearer ${LITELLM_API_KEY:?LITELLM_API_KEY is required}" \
    -H 'Content-Type: application/json' \
    --data "$payload")"; then
    printf '[FAIL] model alias %s\n' "$alias" >&2
    return 1
  fi
  jq -e '.choices[0].message.content | strings | length > 0' <<<"$response" >/dev/null
  printf '[PASS] model alias %s\n' "$alias"
}

if test "${AICP_SKIP_MODEL_SMOKE:-0}" != "1"; then
  smoke_alias coding-fast
  smoke_alias coding-strong
fi
echo '[PASS] foundation smoke'
