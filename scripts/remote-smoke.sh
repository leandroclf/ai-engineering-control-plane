#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
set -a
source .env.runtime
source versions.env
set +a

base="https://localhost:${REMOTE_PORT:-18443}"
cert=(--cacert secrets/remote/host-b/ca.crt --cert secrets/remote/host-b/client.crt --key secrets/remote/host-b/client.key)

without_certificate="$(curl --silent --output /dev/null --write-out '%{http_code}' --cacert secrets/remote/host-b/ca.crt "$base/health" || true)"
test "$without_certificate" = 400

invalid_token="$(curl --silent --output /dev/null --write-out '%{http_code}' "${cert[@]}" \
  --header 'Authorization: Bearer invalid' "$base/memory/v1/memories/search?scope=REPOSITORY:site-lf-solucoes")"
test "$invalid_token" = 401

denied_scope="$(curl --silent --output /dev/null --write-out '%{http_code}' "${cert[@]}" \
  --header "Authorization: Bearer ${MEMORY_SERVICE_TOKEN}" "$base/memory/v1/memories/search?scope=PROJECT:host-b-denied")"
test "$denied_scope" = 403

task_id="remote-host-b-$(date +%s)"
allowed="$(curl --silent --fail-with-body "${cert[@]}" \
  --header "Authorization: Bearer ${MEMORY_SERVICE_TOKEN}" \
  --header 'Content-Type: application/json' \
  --data "{\"repository\":\"site-lf-solucoes\",\"scopes\":[\"REPOSITORY:site-lf-solucoes\"],\"query\":\"GitIndexer\",\"exact_symbols\":[\"GitIndexer\"],\"budget\":100,\"task_id\":\"$task_id\"}" \
  "$base/memory/v1/context:compile")"
jq -e '.token_count <= 100 and (.artifacts | length > 0)' <<<"$allowed" >/dev/null

sleep 1
rg -q "$task_id" .aicp/otel/traces.json
echo "[PASS] host B mTLS, bearer authorization, scope isolation and task correlation: $task_id"
