#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
repository_path="${1:?usage: scripts/index.sh <repository-path> [repository-id] [--rebuild]}"
readonly repository_id="${2:-$(basename "$repository_path")}"
readonly mode="${3:-}"

set -a
source .env.runtime
set +a
export MEMORY_SERVICE_URL="${MEMORY_SERVICE_URL:-http://127.0.0.1:${MEMORY_SERVICE_PORT:-18080}}"
node context/cli/index-repository.mjs "$repository_path" "$repository_id" "$mode"
