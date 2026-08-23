#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
set -a; source "$root/versions.env"; set +a
docker build --tag aicp-memory-service:latest --file "$root/docker/memory-service/Dockerfile" --build-arg "PYTHON_IMAGE=$PYTHON_IMAGE" "$root"
docker build --tag aicp-workspace:latest --file "$root/docker/workspace/Dockerfile" --build-arg "NODE_IMAGE=$NODE_IMAGE" --build-arg "OPENCODE_VERSION=$OPENCODE_VERSION" "$root"
docker build --tag aicp-harness:latest --file "$root/docker/harness/Dockerfile" --build-arg "NODE_IMAGE=$NODE_IMAGE" --build-arg "OPENCODE_VERSION=$OPENCODE_VERSION" "$root"
docker build --tag aicp-worker-manager:latest --file "$root/docker/worker-manager/Dockerfile" --build-arg "NODE_IMAGE=$NODE_IMAGE" "$root"
