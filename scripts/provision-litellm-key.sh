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
if test -n "${LITELLM_API_KEY:-}" && curl -fsS -G \
  --data-urlencode "key=${LITELLM_API_KEY}" \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  "$gateway/key/info" >/dev/null 2>&1; then
  echo '[PASS] existing LiteLLM workspace key is valid'
  exit 0
fi

payload="$(jq -n '{
  key_alias: "aicp-workspace",
  models: ["coding-strong", "coding-fast", "architecture", "security", "review"],
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
