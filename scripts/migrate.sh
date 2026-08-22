#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

for migration in memory-service/migrations/*.sql; do
  docker compose exec -T postgres psql \
    --username aicp \
    --dbname aicp_memory \
    --set ON_ERROR_STOP=1 \
    < "$migration"
done

echo '[PASS] canonical database migrations'
