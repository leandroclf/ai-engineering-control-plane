#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
expected="${OPENCODE_VERSION:-1.18.21}"
actual="$(docker compose exec -T workspace opencode --version | tr -d '\r')"
test "$actual" = "$expected" || { printf 'unexpected OpenCode version: %s\n' "$actual" >&2; exit 1; }
docker compose exec -T workspace sh -ec 'test ! -S /var/run/docker.sock'
docker compose exec -T workspace sh -ec 'test -z "${OPENAI_API_KEY:-}${ANTHROPIC_API_KEY:-}${GEMINI_API_KEY:-}"'
curl -fsS http://127.0.0.1:4000/health/readiness >/dev/null
echo '[PASS] foundation smoke'
