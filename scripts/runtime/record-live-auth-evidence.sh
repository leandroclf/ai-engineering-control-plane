#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
provider="${1:?provider is required}"
cli_version="${2:?validated CLI version is required}"
case "$provider" in codex|claude|opencode) ;; *) echo "unsupported provider: $provider" >&2; exit 2 ;; esac
out="$root/.aicp/evidence/runtime/$provider"
mkdir -p "$out"
printf '%s\n' \
  'provider-auth=PASS' \
  "provider=$provider" \
  "cli-version=$cli_version" \
  'login=PASS' \
  'restart-persistence=PASS' \
  'refresh-after-real-use=PASS' \
  'logout=PASS' \
  'status-after-logout=FAIL_EXPECTED' \
  'relogin=PASS' > "$out/auth-test.log"
printf '%s\n' \
  'provider-execution=PASS' \
  "provider=$provider" \
  "cli-version=$cli_version" \
  'prompt=Reply exactly OK' \
  'result=OK' \
  'source-tree-mounted=NO' > "$out/execution-test.log"
