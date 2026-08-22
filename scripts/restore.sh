#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"; cd "$root"
source_dir="${1:?usage: restore.sh <backup-directory>}"
(cd "$source_dir" && sha256sum --check SHA256SUMS)
docker compose up -d postgres
for database in aicp_memory litellm; do
  docker compose exec -T postgres pg_restore --username aicp --dbname "$database" --clean --if-exists < "$source_dir/$database.dump"
done
docker compose up -d neo4j memory-service
if test -x scripts/index.sh; then ./scripts/index.sh --all --rebuild-graph; fi
./scripts/doctor.sh
