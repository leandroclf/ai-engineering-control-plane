#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$root/.aicp"
temporary="$(mktemp -d "$root/.aicp/clean-host-restore.XXXXXX")"
source_container="aicp-restore-source-${$}"
target_container="aicp-restore-target-${$}"
trap 'docker rm -f "$source_container" "$target_container" >/dev/null 2>&1 || true; rm -rf "$temporary"' EXIT
set -a; source "$root/versions.env"; set +a

for container in "$source_container" "$target_container"; do
  docker run -d --name "$container" -e POSTGRES_PASSWORD=test-only -e POSTGRES_USER=aicp -e POSTGRES_DB=postgres "$POSTGRES_IMAGE" >/dev/null
done
for container in "$source_container" "$target_container"; do
  ready=false
  for _ in $(seq 1 60); do
    if docker exec "$container" psql -v ON_ERROR_STOP=1 -U aicp -d postgres -c 'SELECT 1' >/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 1
  done
  test "$ready" = true
  docker exec "$container" createdb -U aicp aicp_memory
  docker exec "$container" createdb -U aicp litellm
done
for migration in "$root"/memory-service/migrations/*.sql; do docker exec -i "$source_container" psql -v ON_ERROR_STOP=1 -U aicp -d aicp_memory < "$migration" >/dev/null; done
docker exec "$source_container" psql -v ON_ERROR_STOP=1 -U aicp -d aicp_memory -c "INSERT INTO control.tasks(id,idempotency_key,workflow_version,metadata) VALUES('00000000-0000-0000-0000-000000000001','restore-sentinel',1,'{}');" >/dev/null
docker exec "$source_container" psql -v ON_ERROR_STOP=1 -U aicp -d litellm -c "CREATE TABLE recovery_sentinel(value text primary key); INSERT INTO recovery_sentinel VALUES('litellm-canonical');" >/dev/null
for database in aicp_memory litellm; do docker exec "$source_container" pg_dump -U aicp --format=custom "$database" > "$temporary/$database.dump"; done
for database in aicp_memory litellm; do docker exec -i "$target_container" pg_restore -U aicp -d "$database" --no-owner < "$temporary/$database.dump"; done
test "$(docker exec "$target_container" psql -At -U aicp -d aicp_memory -c "SELECT idempotency_key FROM control.tasks WHERE idempotency_key='restore-sentinel'")" = restore-sentinel
test "$(docker exec "$target_container" psql -At -U aicp -d litellm -c 'SELECT value FROM recovery_sentinel')" = litellm-canonical
test "$(docker exec "$target_container" psql -At -U aicp -d aicp_memory -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='operations'")" -ge 2
echo '[PASS] clean-host restore reproduces PostgreSQL and LiteLLM canonical state'
