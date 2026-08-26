#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
provider="${1:?provider is required}"
mkdir -p "$root/.aicp/evidence/runtime/$provider"
node --test "$root/tests/runtime/runtime-adversarial.test.mjs" | tee "$root/.aicp/evidence/runtime/$provider/adversarial-test.log"
