#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
runtime_file=".env.runtime"
test -f "$runtime_file" || { echo '.env.runtime not found' >&2; exit 1; }

set -a
source "$runtime_file"
set +a
: "${LITELLM_MASTER_KEY:?LITELLM_MASTER_KEY is required}"

gateway="http://127.0.0.1:4000"
models='["coding-strong","coding-fast","architecture","security","review","embeddings"]'
if test -n "${LITELLM_API_KEY:-}"; then
  key_info="$(curl -fsS -G \
  --data-urlencode "key=${LITELLM_API_KEY}" \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  "$gateway/key/info" 2>/dev/null || true)"
  if test -n "$key_info"; then
    if jq -e --argjson required "$models" '(.info.models // .models) as $actual | ($required - $actual | length) == 0' <<<"$key_info" >/dev/null; then
      echo '[PASS] existing LiteLLM workspace key is valid'
      exit 0
    fi
    curl -fsS -X POST "$gateway/key/update" \
      -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
      -H 'Content-Type: application/json' \
      --data "$(jq -n --arg key "$LITELLM_API_KEY" --argjson models "$models" '{key: $key, models: $models}')" >/dev/null
    echo '[PASS] existing LiteLLM workspace key capabilities updated'
    exit 0
  fi
fi

payload="$(jq -n '{
  key_alias: "aicp-workspace",
  models: ["coding-strong", "coding-fast", "architecture", "security", "review", "embeddings"],
  max_budget: 10,
  budget_duration: "30d",
  rpm_limit: 60,
  tpm_limit: 200000,
  metadata: { owner: "aicp", purpose: "workspace" }
}')"
response="$(curl -fsS -X POST "$gateway/key/generate" \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  -H 'Content-Type: application/json' \
  --data "$payload")"
workspace_key="$(jq -er '.key' <<<"$response")"

temporary="$(mktemp "${runtime_file}.XXXXXX")"
awk -v value="$workspace_key" '
  BEGIN { found = 0 }
  index($0, "LITELLM_API_KEY=") == 1 { print "LITELLM_API_KEY=" value; found = 1; next }
  { print }
  END { if (!found) print "LITELLM_API_KEY=" value }
' "$runtime_file" > "$temporary"
chmod --reference="$runtime_file" "$temporary"
mv "$temporary" "$runtime_file"
chmod 600 "$runtime_file"
echo '[PASS] limited LiteLLM workspace key provisioned'
