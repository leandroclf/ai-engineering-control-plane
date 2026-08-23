#!/usr/bin/env bash
set -euo pipefail

search() {
  if command -v rg >/dev/null 2>&1; then
    rg "$@"
  else
    grep -R -E "$@"
  fi
}

search -q 'new WorkerExecutionPlane' harness/src/runtime/production-runtime.mjs
search -q 'executionPlane' harness/src/runtime/workflow-handlers.mjs
if search -n '"sh", "-lc"|"bash", "-lc"' harness/src/workers harness/src/execution; then
  echo 'shell execution found in worker boundary' >&2
  exit 1
fi
search -q 'controlPlaneProjectExecutionCount: 0' harness/src/execution/worker-execution-plane.mjs
echo '{"status":"pass","boundary":"execution-plane"}'
