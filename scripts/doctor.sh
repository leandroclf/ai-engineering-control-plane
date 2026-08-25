#!/usr/bin/env bash
set -uo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
fail=0
check() { local name="$1"; shift; if "$@" >/dev/null 2>&1; then printf '[PASS] %s\n' "$name"; else printf '[FAIL] %s\n' "$name"; fail=1; fi; }

check docker docker version
check compose docker compose version
check config docker compose config --quiet
check otel-collector sh -ec 'docker compose ps --status running --services | grep -qx otel-collector'
check postgres docker compose exec -T postgres pg_isready -U aicp -d postgres
check redis docker compose exec -T redis sh -ec 'redis-cli -a "$(cat /run/secrets/redis_password)" ping | grep -q PONG'
if [[ "${AICP_GRAPH_ENABLED:-false}" =~ ^(1|true|yes|on)$ ]]; then
  check neo4j docker compose --profile graph exec -T neo4j wget -q --spider http://localhost:7474
fi
check litellm curl -fsS http://127.0.0.1:4000/health/readiness
check memory docker compose exec -T memory-service python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"
check opencode docker compose exec -T workspace opencode --version
check harness curl -fsS http://127.0.0.1:${HARNESS_PORT:-18081}/health
check non-root docker compose exec -T workspace sh -ec 'test "$(id -u)" -ne 0'
check no-docker-socket docker compose exec -T workspace sh -ec 'test ! -S /var/run/docker.sock'
check no-provider-secrets docker compose exec -T workspace sh -ec 'test -z "${OPENAI_API_KEY:-}" && test -z "${ANTHROPIC_API_KEY:-}" && test -z "${GOOGLE_API_KEY:-}"'
check root-read-only docker compose exec -T workspace sh -ec 'touch /etc/aicp-write-test >/dev/null 2>&1 && exit 1 || exit 0'
exit "$fail"
