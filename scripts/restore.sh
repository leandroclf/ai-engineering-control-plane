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
gpg --batch --yes --pinentry-mode loopback --passphrase-file "$passphrase_file" --decrypt "$archive" | tar -I zstd -xf - -C "$staging"
(cd "$staging" && sha256sum --check SHA256SUMS)

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
docker compose up -d --wait redis neo4j otel-collector litellm memory-service workspace harness control-gateway
if test -n "$repository_path"; then
  ./scripts/index.sh "$repository_path" "$repository_id" --rebuild
fi
./scripts/doctor.sh
./scripts/memory-smoke.sh
if test -n "$repository_id"; then
  ./scripts/context-smoke.sh "$repository_id"
fi
