#!/bin/sh
set -eu

export RI_ACCEPT_TERMS_AND_CONDITIONS=true
export RI_STDOUT_LOGGER=true
export RI_APP_PORT="${RI_APP_PORT:-5540}"
export RI_REDIS_HOST0="${RI_REDIS_HOST0:-redis}"
export RI_REDIS_PORT0="${RI_REDIS_PORT0:-6379}"
export RI_REDIS_ALIAS0="${RI_REDIS_ALIAS0:-AICP Redis}"
export RI_REDIS_USERNAME0="${RI_REDIS_USERNAME0:-default}"
export RI_REDIS_PASSWORD0="$(cat /run/secrets/redis_password)"
exec /usr/src/app/docker-entry.sh "$@"
