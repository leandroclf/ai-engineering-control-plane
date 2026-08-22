#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
set -a
source .env.runtime
set +a
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
backup_id="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"
destination="${1:-./backups}"
passphrase_file="${BACKUP_PASSPHRASE_FILE:-secrets/backup_passphrase}"
test -s "$passphrase_file" || { echo 'backup passphrase file is missing' >&2; exit 1; }
mkdir -p "$destination"
chmod 700 "$destination"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

docker compose exec -T postgres psql --username aicp --dbname aicp_memory -v ON_ERROR_STOP=1 \
  -v backup_id="$backup_id" -v started_at="$started_at" \
  -v destination_class="${BACKUP_DESTINATION_CLASS:-local}" >/dev/null <<'SQL'
INSERT INTO operations.backup_runs
  (backup_id,started_at,status,destination_class,encrypted)
VALUES (:'backup_id', :'started_at', 'RUNNING', :'destination_class', true);
SQL

for database in aicp_memory litellm; do
  docker compose exec -T postgres pg_dump --username aicp --format=custom "$database" > "$staging/$database.dump"
done
tar -C opencode -czf "$staging/opencode-config.tar.gz" .
awk -F= '$1 ~ /^(LITELLM_MASTER_KEY|LITELLM_SALT_KEY)$/ { print }' .env.runtime > "$staging/runtime-recovery.env"
chmod 600 "$staging/runtime-recovery.env"
printf 'schema_version=2\nbackup_id=%s\ncreated_at=%s\n' "$backup_id" "$stamp" > "$staging/MANIFEST"
(cd "$staging" && sha256sum aicp_memory.dump litellm.dump opencode-config.tar.gz runtime-recovery.env MANIFEST > SHA256SUMS)

archive="$destination/aicp-backup-$stamp.tar.zst.gpg"
tar -C "$staging" -I zstd -cf - . | gpg --batch --yes --pinentry-mode loopback --passphrase-file "$passphrase_file" --cipher-algo AES256 --symmetric --output "$archive"
chmod 600 "$archive"
(cd "$destination" && sha256sum "$(basename "$archive")" > "$(basename "$archive").sha256")
manifest_hash="$(sha256sum "$staging/MANIFEST" | cut -d' ' -f1)"
size_bytes="$(wc -c < "$archive" | tr -d ' ')"
docker compose exec -T postgres psql --username aicp --dbname aicp_memory -v ON_ERROR_STOP=1 \
  -v backup_id="$backup_id" -v started_at="$started_at" -v manifest_hash="$manifest_hash" \
  -v destination_class="${BACKUP_DESTINATION_CLASS:-local}" -v size_bytes="$size_bytes" >/dev/null <<'SQL'
UPDATE operations.backup_runs SET finished_at=now(), status='SUCCESS', manifest_hash=:'manifest_hash',
  destination_class=:'destination_class', encrypted=true, size_bytes=:'size_bytes'
WHERE backup_id=:'backup_id';
SQL
printf '%s\n' "$archive"
