#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
provider="${1:?provider is required}"
container="${2:?running candidate container is required}"
mkdir -p "$root/.aicp/evidence/runtime/$provider"
node --test "$root/tests/runtime/runtime-adversarial.test.mjs" | tee "$root/.aicp/evidence/runtime/$provider/host-adversarial-test.log"
if docker exec "$container" touch /aicp-adversarial-write >/dev/null 2>&1; then exit 1; fi
docker exec "$container" test ! -S /var/run/docker.sock
docker exec "$container" test ! -e /root/.ssh
printf '%s\n' 'candidate-boundary-probes=PASS' > "$root/.aicp/evidence/runtime/$provider/adversarial-test.log"
