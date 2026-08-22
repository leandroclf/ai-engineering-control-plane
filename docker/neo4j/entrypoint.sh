#!/bin/sh
set -eu
export NEO4J_AUTH="$(cat /run/secrets/neo4j_auth)"
unset NEO4J_AUTH_FILE
exec /startup/docker-entrypoint.sh "$@"
