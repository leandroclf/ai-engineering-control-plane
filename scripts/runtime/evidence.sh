#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
provider="${1:?provider is required}"
out="$root/.aicp/evidence/runtime/$provider"
mkdir -p "$out"
if [[ ! -f "$out/cli-version.txt" ]]; then printf '%s\n' 'UNVERIFIED: candidate image not supplied' > "$out/cli-version.txt"; fi
if [[ ! -f "$out/image-digest.txt" ]]; then printf '%s\n' 'UNVERIFIED: candidate image digest not supplied' > "$out/image-digest.txt"; fi
if [[ ! -f "$out/auth-test.log" ]]; then printf '%s\n' 'N/A: interactive provider authentication is not executed by unauthenticated CI' > "$out/auth-test.log"; fi
if [[ ! -f "$out/execution-test.log" ]]; then printf '%s\n' 'N/A: execution evidence requires a running candidate container' > "$out/execution-test.log"; fi
printf '%s\n' 'Evidence is PASS only when compliance, contract, adversarial and live provider checks are present.' > "$out/README.txt"
