#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache="$root/.aicp/ci/trivy-cache"
reports="$root/.aicp/ci/images"
trivy_image="aquasec/trivy:0.74.0@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969"
if (($#)); then images=("$@"); else images=(aicp-harness:latest aicp-memory-service:latest aicp-workspace:latest aicp-worker-manager:latest); fi
mkdir -p "$cache" "$reports"

# Avoid the implicit mirror, which can return a stale OCI artifact (HTTP 404).
# Retry two verified upstream repositories; never continue without a valid DB.
db_ready=false
for repository in ghcr.io/aquasecurity/trivy-db:2 public.ecr.aws/aquasecurity/trivy-db:2; do
  for attempt in 1 2; do
    if docker run --rm -v "$cache:/root/.cache/trivy" "$trivy_image" \
      image --download-db-only --db-repository "$repository"; then
      db_ready=true
      break 2
    fi
    echo "Trivy DB download failed (repository=$repository, attempt=$attempt)" >&2
    if (( attempt < 2 )); then sleep 3; fi
  done
done
if [[ "$db_ready" != true ]]; then
  echo "Trivy vulnerability DB unavailable from both upstream repositories; refusing to scan without evidence" >&2
  exit 1
fi

# Offline scans must not consume a stale or missing vulnerability database.
python3 - "$cache/db/metadata.json" <<'PY'
import datetime as dt
import json
import pathlib
import sys

metadata_path = pathlib.Path(sys.argv[1])
try:
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    next_update = dt.datetime.fromisoformat(metadata["NextUpdate"].replace("Z", "+00:00"))
    if next_update.tzinfo is None:
        raise ValueError("NextUpdate has no timezone")
    if next_update <= dt.datetime.now(dt.timezone.utc):
        raise ValueError("vulnerability DB is expired")
except (OSError, KeyError, ValueError, json.JSONDecodeError) as exc:
    raise SystemExit(f"Trivy vulnerability DB freshness check failed: {exc}")
PY

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
