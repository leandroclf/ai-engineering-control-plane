#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
command -v docker >/dev/null || { echo 'docker not found' >&2; exit 1; }
docker compose version >/dev/null
command -v openssl >/dev/null || { echo 'openssl not found' >&2; exit 1; }

mkdir -p secrets state/postgres state/neo4j/data state/neo4j/logs state/cache state/opencode projects .aicp/otel
chmod 700 secrets state
for name in postgres_password redis_password; do
  if test ! -s "secrets/$name"; then
    openssl rand -hex 32 > "secrets/$name"
    chmod 600 "secrets/$name"
  fi
done
if test ! -f .env.runtime; then
  cp .env.example .env.runtime
  chmod 600 .env.runtime
  echo 'configure .env.runtime before starting services' >&2
  exit 2
fi

./scripts/render-config.sh
set -a
source .env.runtime
source versions.env
set +a
docker compose config --quiet
docker compose build
docker compose up -d --wait postgres redis neo4j otel-collector
./scripts/migrate.sh
docker compose up -d --wait litellm memory-service
./scripts/provision-litellm-key.sh
set -a
source .env.runtime
set +a
docker compose up -d --no-deps --force-recreate workspace
./scripts/doctor.sh
./scripts/smoke.sh
./scripts/telemetry-smoke.sh
