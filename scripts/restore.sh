#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
archive="${1:?usage: restore.sh <encrypted-archive> [repository-path repository-id]}"
repository_path="${2:-}"
repository_id="${3:-}"
if { test -n "$repository_path" && test -z "$repository_id"; } || \
   { test -z "$repository_path" && test -n "$repository_id"; }; then
  echo 'repository path and id must be provided together' >&2
  exit 2
fi
passphrase_file="${BACKUP_PASSPHRASE_FILE:-secrets/backup_passphrase}"
test -s "$passphrase_file" || { echo 'backup passphrase file is missing' >&2; exit 1; }
test -f "$archive.sha256" || { echo 'external archive checksum is missing' >&2; exit 1; }
(cd "$(dirname "$archive")" && sha256sum --check "$(basename "$archive").sha256")
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
source "$root/scripts/lib/backup-integrity.sh"
verify_backup_integrity "$archive" "$passphrase_file" "$staging"
backup_id="$(awk -F= '$1=="backup_id" {print $2}' "$staging/MANIFEST")"
test -n "$backup_id" || { echo 'backup manifest lacks backup_id' >&2; exit 1; }

set -a
source .env.runtime
current_salt="$LITELLM_SALT_KEY"
source "$staging/runtime-recovery.env"
set +a
test "$current_salt" = "$LITELLM_SALT_KEY" || {
  echo 'LITELLM_SALT_KEY differs from backup; restore matching runtime recovery secrets first' >&2
  exit 1
}

docker compose stop control-gateway workspace harness memory-service litellm >/dev/null
docker compose up -d --wait postgres
for database in aicp_memory litellm; do
  docker compose exec -T postgres pg_restore --username aicp --dbname "$database" \
    --clean --if-exists --no-owner < "$staging/$database.dump"
done
opencode_restore="$staging/opencode.restore"
mkdir -p "$opencode_restore"
tar -xzf "$staging/opencode-config.tar.gz" -C "$opencode_restore"
test -f "$opencode_restore/opencode.json" || { echo 'invalid OpenCode configuration backup' >&2; exit 1; }
opencode_previous=".aicp/opencode-before-restore-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p .aicp
mv opencode "$opencode_previous"
mkdir opencode
cp -a "$opencode_restore/." opencode/
printf 'previous OpenCode configuration preserved at %s\n' "$opencode_previous"
if [[ "${AICP_GRAPH_ENABLED:-false}" =~ ^(1|true|yes|on)$ ]]; then
  docker compose --profile graph up -d --wait neo4j
fi
docker compose up -d --wait redis otel-collector litellm memory-service workspace harness control-gateway
if test -n "$repository_path"; then
  ./scripts/index.sh "$repository_path" "$repository_id" --rebuild
fi
./scripts/doctor.sh
./scripts/memory-smoke.sh
if test -n "$repository_id"; then
  ./scripts/context-smoke.sh "$repository_id"
fi
drill_id="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"
manifest_hash="$(sha256sum "$staging/MANIFEST" | cut -d' ' -f1)"
size_bytes="$(wc -c < "$archive" | tr -d ' ')"
docker compose exec -T postgres psql --username aicp --dbname aicp_memory -v ON_ERROR_STOP=1 \
  -v drill_id="$drill_id" -v backup_id="$backup_id" -v graph_rebuilt="$([[ -n "$repository_id" ]] && echo true || echo false)" \
  -v context_verified="$([[ -n "$repository_id" ]] && echo true || echo false)" -v manifest_hash="$manifest_hash" -v size_bytes="$size_bytes" >/dev/null <<'SQL'
UPDATE operations.backup_runs SET status='SUCCESS', finished_at=coalesce(finished_at,now()),
  manifest_hash=:'manifest_hash', encrypted=true, size_bytes=:'size_bytes'
WHERE backup_id=:'backup_id';
INSERT INTO operations.restore_drills
  (drill_id,backup_id,started_at,finished_at,status,postgres_verified,graph_rebuilt,context_verified,smoke_run_verified)
VALUES (:'drill_id', :'backup_id', now(), now(), 'SUCCESS', true, :'graph_rebuilt', :'context_verified', true);
SQL
echo "[PASS] recovery drill recorded: $drill_id"
