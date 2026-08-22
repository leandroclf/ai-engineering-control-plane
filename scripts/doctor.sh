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
check neo4j docker compose exec -T neo4j wget -q --spider http://localhost:7474
check litellm curl -fsS http://127.0.0.1:4000/health/readiness
check memory docker compose exec -T memory-service python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"
check opencode docker compose exec -T workspace opencode --version
exit "$fail"
