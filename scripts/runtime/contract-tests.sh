#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
provider="${1:?provider is required}"
container="${2:?running candidate container is required}"
mkdir -p "$root/.aicp/evidence/runtime/$provider"
node --test "$root/tests/runtime/runtime-contract.test.mjs" | tee "$root/.aicp/evidence/runtime/$provider/host-contract-test.log"
case "$provider" in codex|claude|opencode) ;; *) exit 2 ;; esac
docker exec "$container" "$provider" --version > "$root/.aicp/evidence/runtime/$provider/contract-test.log"
docker exec "$container" test -w /workspace/project
