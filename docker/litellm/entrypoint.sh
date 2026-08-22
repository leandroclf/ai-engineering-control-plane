#!/bin/sh
set -eu

postgres_password="$(cat /run/secrets/postgres_password)"
export DATABASE_URL="postgresql://aicp:${postgres_password}@postgres:5432/litellm"
export LITELLM_MASTER_KEY="$(cat /run/secrets/litellm_master_key)"
export LITELLM_SALT_KEY="$(cat /run/secrets/litellm_salt_key)"
export OPENAI_API_KEY="$(cat /run/secrets/openai_api_key)"
export ANTHROPIC_API_KEY="$(cat /run/secrets/anthropic_api_key)"
export GEMINI_API_KEY="$(cat /run/secrets/gemini_api_key)"
exec /app/docker/prod_entrypoint.sh "$@"
