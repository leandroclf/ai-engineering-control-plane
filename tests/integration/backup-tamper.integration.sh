#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$root/.aicp"
temporary="$(mktemp -d "$root/.aicp/backup-tamper.XXXXXX")"
trap 'rm -rf "$temporary"' EXIT
printf 'test-only-passphrase\n' > "$temporary/passphrase"
printf 'schema_version=2\nbackup_id=00000000-0000-0000-0000-000000000001\n' > "$temporary/MANIFEST"
(cd "$temporary" && sha256sum MANIFEST > SHA256SUMS)
tar -C "$temporary" -I zstd -cf - MANIFEST SHA256SUMS | gpg --batch --yes --pinentry-mode loopback \
  --passphrase-file "$temporary/passphrase" --cipher-algo AES256 --symmetric --output "$temporary/backup.tar.zst.gpg"
(cd "$temporary" && sha256sum backup.tar.zst.gpg > backup.tar.zst.gpg.sha256)
printf 'tamper' >> "$temporary/backup.tar.zst.gpg"
set +e
BACKUP_PASSPHRASE_FILE="$temporary/passphrase" "$root/scripts/verify-backup.sh" "$temporary/backup.tar.zst.gpg" >/dev/null 2>&1
status=$?
set -e
test "$status" -ne 0
echo '[PASS] tampered encrypted backup fails closed before restore'
