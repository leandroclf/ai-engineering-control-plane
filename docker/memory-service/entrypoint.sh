#!/bin/sh
set -eu

postgres_password="$(cat /run/secrets/postgres_password)"
export DATABASE_URL="postgresql://aicp:${postgres_password}@postgres:5432/aicp_memory"
exec python -m aicp_memory.server
