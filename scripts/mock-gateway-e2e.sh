#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
provider_port="${AICP_MOCK_PROVIDER_PORT:-4011}"
gateway_port="${AICP_MOCK_GATEWAY_PORT:-4012}"
gateway_token="test-only"
container="aicp-mock-gateway-${$}"
mkdir -p "$root/.aicp"
temporary="$(mktemp -d "$root/.aicp/mock-gateway.XXXXXX")"
provider_pid=""

cleanup() {
  if [[ -n "$provider_pid" ]]; then kill "$provider_pid" >/dev/null 2>&1 || true; fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$temporary"
}
trap cleanup EXIT

set -a
source "$root/versions.env"
set +a

printf '%s\n' \
  'model_list:' \
  '  - model_name: coding-strong' \
  '    litellm_params:' \
  '      model: openai/mock-model' \
  "      api_base: http://host.docker.internal:${provider_port}/v1" \
  '      api_key: test-only' \
  'general_settings:' \
  '  master_key: test-only' > "$temporary/litellm.yaml"

AICP_MOCK_PROVIDER_PORT="$provider_port" node "$root/tests/e2e/mock-openai-provider.mjs" > "$temporary/provider.log" 2>&1 &
provider_pid=$!

docker run -d --name "$container" --add-host host.docker.internal:host-gateway -p "127.0.0.1:${gateway_port}:${gateway_port}" \
  -v "$temporary/litellm.yaml:/app/config.yaml:ro" \
  "$LITELLM_IMAGE" --config /app/config.yaml --port "$gateway_port" > "$temporary/container.id"

ready=false
for _ in $(seq 1 75); do
  if curl --fail --silent -H "Authorization: Bearer ${gateway_token}" "http://127.0.0.1:${gateway_port}/health/readiness" >/dev/null 2>&1; then ready=true; break; fi
  if ! docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null | grep -q true; then break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs "$container" >&2
  exit 1
fi

AICP_MOCK_GATEWAY_URL="http://127.0.0.1:${gateway_port}" node "$root/tests/e2e/mock-gateway-client.mjs"
