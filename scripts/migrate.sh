#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
set -a
source .env.runtime
set +a

for migration in memory-service/migrations/*.sql; do
  docker compose exec -T postgres psql \
    --username aicp \
    --dbname aicp_memory \
    --set ON_ERROR_STOP=1 \
    < "$migration"
done

if [[ "${AICP_GRAPH_ENABLED:-false}" =~ ^(1|true|yes|on)$ ]]; then
  for migration in graph/cypher/*.cypher; do
    docker compose --profile graph exec -T neo4j cypher-shell \
      -u "${NEO4J_AUTH%%/*}" \
      -p "${NEO4J_AUTH#*/}" \
      < "$migration"
  done
fi

echo '[PASS] canonical database and graph migrations'
