#!/bin/sh
set -eu

export WORKER_MANAGER_TOKEN="$(cat "${WORKER_MANAGER_TOKEN_FILE}")"
export WORKER_IDENTITY_SIGNING_SECRET="$(cat "${WORKER_IDENTITY_SIGNING_SECRET_FILE}")"
export LITELLM_API_KEY="$(cat /run/secrets/litellm_api_key)"
export WORKER_LITELLM_TOKEN="${WORKER_LITELLM_TOKEN:-$LITELLM_API_KEY}"
export WORKER_MEMORY_TOKEN="$(cat "${WORKER_MEMORY_TOKEN_FILE:-/run/secrets/memory_service_token}")"
exec "$@"
