#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
archive="${1:?usage: verify-backup.sh <encrypted-archive>}"
passphrase_file="${BACKUP_PASSPHRASE_FILE:-$root/secrets/backup_passphrase}"
test -s "$passphrase_file" || { echo 'backup passphrase file is missing' >&2; exit 1; }
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
source "$root/scripts/lib/backup-integrity.sh"
verify_backup_integrity "$archive" "$passphrase_file" "$staging"
echo '[PASS] external and encrypted internal backup checksums'
