#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
set -a
source .env.runtime
set +a
: "${LITELLM_MASTER_KEY:?LITELLM_MASTER_KEY is required}"

trace_file=".aicp/otel/traces.json"
test -f "$trace_file" || { echo 'telemetry trace file is unavailable' >&2; exit 1; }
before="$(stat -c '%s' "$trace_file")"
headers="$(mktemp)"
response="$(mktemp)"
trap 'rm -f "$headers" "$response"' EXIT

payload="$(jq -n '{
  model: "aicp-fallback-smoke",
  messages: [{role: "user", content: "Reply with FALLBACK_OK only."}],
  max_completion_tokens: 16,
  metadata: {aicp_task_id: "smoke:fallback"}
}')"
curl -fsS -D "$headers" -o "$response" http://127.0.0.1:4000/v1/chat/completions \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  -H 'Content-Type: application/json' \
  --data "$payload"
jq -e '.choices[0].message.content | strings | length > 0' "$response" >/dev/null

for _ in $(seq 1 40); do
  after="$(stat -c '%s' "$trace_file")"
  if test "$after" -gt "$before"; then
    tail -c "+$((before + 1))" "$trace_file" > .aicp/fallback-otel.json
    if grep -q 'chat aicp-fallback-smoke' .aicp/fallback-otel.json \
      && grep -q 'chat coding-fast' .aicp/fallback-otel.json; then
      break
    fi
  fi
  sleep 0.25
done
test -f .aicp/fallback-otel.json || { echo 'fallback trace was not exported' >&2; exit 1; }

node <<'NODE'
const { readFileSync } = require("node:fs");
const raw = readFileSync(".aicp/fallback-otel.json", "utf8");
if (/gen_ai\.prompt|FALLBACK_OK|OPENAI_API_KEY|sk-[A-Za-z0-9]/.test(raw)) {
  throw new Error("sensitive fallback telemetry detected");
}
const documents = raw.trim().split(/\n+/).map(JSON.parse);
const spans = documents.flatMap((document) => document.resourceSpans ?? [])
  .filter((resource) => resource.resource?.attributes?.some((attribute) =>
    attribute.key === "service.name" && attribute.value?.stringValue === "aicp-litellm"))
  .flatMap((resource) => resource.scopeSpans ?? [])
  .flatMap((scope) => scope.spans ?? []);
const primary = spans.find((span) => span.name === "chat aicp-fallback-smoke");
const fallback = spans.find((span) => span.name === "chat coding-fast" && span.traceId === primary?.traceId);
const cost = fallback?.attributes?.find((attribute) => attribute.key === "litellm.cost.total")?.value?.doubleValue;
const tokens = fallback?.attributes?.find((attribute) => attribute.key === "gen_ai.usage.total_tokens")?.value?.intValue;
if (!primary || primary.status?.code !== 2 || !fallback || !(cost > 0) || !(Number(tokens) > 0)) {
  throw new Error("fallback trace lacks correlated failure, success, tokens or cost");
}
NODE

tr -d '\r' < "$headers" | grep -Eiq '^x-litellm-attempted-fallbacks: 1$'
tr -d '\r' < "$headers" | grep -Eiq '^x-litellm-model-group: coding-fast$'
echo '[PASS] controlled gateway fallback and redacted trace'
