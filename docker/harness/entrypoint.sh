#!/bin/sh
set -eu

postgres_password="$(cat /run/secrets/postgres_password)"
export DATABASE_URL="postgresql://aicp:${postgres_password}@postgres:5432/aicp_memory"
export HARNESS_SERVICE_TOKEN="$(cat /run/secrets/harness_service_token)"
export LITELLM_API_KEY="$(cat "${LITELLM_API_KEY_FILE:-/run/secrets/litellm_api_key}")"
export MEMORY_SERVICE_TOKEN="$(cat "${MEMORY_SERVICE_TOKEN_FILE:-/run/secrets/memory_service_token}")"
export WORKER_MANAGER_TOKEN="$(cat "${WORKER_MANAGER_TOKEN_FILE:-/run/secrets/worker_manager_token}")"
export BROWSER_WORKER_TOKEN="$(cat "${BROWSER_WORKER_TOKEN_FILE:-/run/secrets/browser_worker_token}")"
exec "$@"
