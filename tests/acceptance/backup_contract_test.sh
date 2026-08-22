#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

rg -q 'gpg .*--symmetric' scripts/backup.sh
rg -q -- '--passphrase-file' scripts/backup.sh
rg -q 'LITELLM_SALT_KEY' scripts/backup.sh
rg -q 'trap .*rm -rf' scripts/backup.sh
rg -q 'verify_backup_integrity' scripts/restore.sh
rg -q 'gpg .*--decrypt' scripts/lib/backup-integrity.sh
rg -q 'LITELLM_SALT_KEY' scripts/restore.sh
rg -q 'scripts/index.sh .*--rebuild' scripts/restore.sh
if rg -q -- '--all --rebuild-graph' scripts/restore.sh; then
  echo 'restore uses an unsupported index command' >&2
  exit 1
fi
set +e
scripts/restore.sh /missing/archive repo-only >/dev/null 2>&1
status=$?
set -e
test "$status" -eq 2
bash tests/integration/backup-tamper.integration.sh
echo '[PASS] encrypted backup and restore contract'
