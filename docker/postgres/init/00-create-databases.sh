#!/usr/bin/env bash
set -euo pipefail

for database in aicp_memory litellm; do
  if ! psql --username "$POSTGRES_USER" --dbname postgres --tuples-only --no-align \
    --command "SELECT 1 FROM pg_database WHERE datname='${database}'" | grep -qx 1; then
    psql --username "$POSTGRES_USER" --dbname postgres \
      --command "CREATE DATABASE \"${database}\" OWNER \"${POSTGRES_USER}\""
  fi
done
