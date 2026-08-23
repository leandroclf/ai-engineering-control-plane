#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache="$root/.aicp/ci/trivy-cache"
reports="$root/.aicp/ci/images"
trivy_image="aquasec/trivy:0.74.0@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969"
if (($#)); then images=("$@"); else images=(aicp-harness:latest aicp-memory-service:latest aicp-workspace:latest aicp-worker-manager:latest); fi
mkdir -p "$cache" "$reports"

docker run --rm -v "$cache:/root/.cache/trivy" "$trivy_image" image --download-db-only

for image in "${images[@]}"; do
  name="${image%%:*}"
  docker image inspect "$image" >/dev/null
  docker run --rm --network none \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$cache:/root/.cache/trivy" -v "$reports:/reports" \
    "$trivy_image" image --skip-db-update --skip-java-db-update --scanners vuln \
    --severity HIGH,CRITICAL --exit-code 0 --format json --output "/reports/${name}.vulnerabilities.json" "$image"
  docker run --rm --network none \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v "$cache:/root/.cache/trivy" -v "$reports:/reports" \
    "$trivy_image" image --skip-db-update --skip-java-db-update --scanners vuln \
    --format cyclonedx --output "/reports/${name}.cdx.json" "$image"
done

node "$root/scripts/evaluate-image-security.mjs" "${images[@]}"
