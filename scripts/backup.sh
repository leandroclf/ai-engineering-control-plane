#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
set -a
source .env.runtime
set +a
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="${1:-./backups}"
passphrase_file="${BACKUP_PASSPHRASE_FILE:-secrets/backup_passphrase}"
test -s "$passphrase_file" || { echo 'backup passphrase file is missing' >&2; exit 1; }
mkdir -p "$destination"
chmod 700 "$destination"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

for database in aicp_memory litellm; do
  docker compose exec -T postgres pg_dump --username aicp --format=custom "$database" > "$staging/$database.dump"
done
tar -C opencode -czf "$staging/opencode-config.tar.gz" .
awk -F= '$1 ~ /^(LITELLM_MASTER_KEY|LITELLM_SALT_KEY)$/ { print }' .env.runtime > "$staging/runtime-recovery.env"
chmod 600 "$staging/runtime-recovery.env"
printf 'schema_version=1\ncreated_at=%s\n' "$stamp" > "$staging/MANIFEST"
(cd "$staging" && sha256sum aicp_memory.dump litellm.dump opencode-config.tar.gz runtime-recovery.env MANIFEST > SHA256SUMS)

archive="$destination/aicp-backup-$stamp.tar.zst.gpg"
tar -C "$staging" -I zstd -cf - . | gpg --batch --yes --pinentry-mode loopback --passphrase-file "$passphrase_file" --cipher-algo AES256 --symmetric --output "$archive"
chmod 600 "$archive"
(cd "$destination" && sha256sum "$(basename "$archive")" > "$(basename "$archive").sha256")
printf '%s\n' "$archive"
