#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

docker compose exec -T postgres psql \
  --username aicp \
  --dbname aicp_memory \
  --set ON_ERROR_STOP=1 \
  < memory-service/migrations/001_initial.sql

echo '[PASS] canonical database migrations'
