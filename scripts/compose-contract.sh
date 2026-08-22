#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$root/.aicp"
portable_compose="$(mktemp "$root/.aicp/compose-contract.XXXXXX.yaml")"
trap 'rm -f "$portable_compose"' EXIT

# Older Compose releases reject BuildKit attestation keys before they can
# validate the remaining runtime contract. Their presence is asserted by the
# supply-chain validator; this compatibility view is only used for config
# rendering in tests.
sed -E '/^[[:space:]]+(sbom: true|provenance: mode=max)$/d' "$root/compose.yaml" > "$portable_compose"
docker compose --project-directory "$root" --env-file "$root/versions.env" -f "$portable_compose" config "$@"
