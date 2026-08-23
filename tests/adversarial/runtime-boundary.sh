#!/usr/bin/env bash
set -euo pipefail

rg -q 'new WorkerExecutionPlane' harness/src/runtime/production-runtime.mjs
rg -q 'executionPlane' harness/src/runtime/workflow-handlers.mjs
if rg -n '"sh", "-lc"|"bash", "-lc"' harness/src/workers harness/src/execution; then
  echo 'shell execution found in worker boundary' >&2
  exit 1
fi
rg -q 'controlPlaneProjectExecutionCount: 0' harness/src/execution/worker-execution-plane.mjs
echo '{"status":"pass","boundary":"execution-plane"}'
