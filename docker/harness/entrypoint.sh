#!/bin/sh
set -eu

postgres_password="$(cat /run/secrets/postgres_password)"
export DATABASE_URL="postgresql://aicp:${postgres_password}@postgres:5432/aicp_memory"
export HARNESS_SERVICE_TOKEN="$(cat /run/secrets/harness_service_token)"
exec "$@"
