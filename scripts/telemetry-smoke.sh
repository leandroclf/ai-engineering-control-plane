#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
trace_file=".aicp/otel/traces.json"
test -f "$trace_file" || { echo 'telemetry trace file is unavailable' >&2; exit 1; }
before="$(stat -c '%s' "$trace_file")"
./scripts/context-smoke.sh >/dev/null

for _ in $(seq 1 20); do
  after="$(stat -c '%s' "$trace_file")"
  test "$after" -gt "$before" && break
  sleep 0.25
done
test "${after:-0}" -gt "$before" || { echo 'collector did not export new traces' >&2; exit 1; }
for _ in $(seq 1 20); do
  first="$(stat -c '%s' "$trace_file")"
  sleep 0.1
  second="$(stat -c '%s' "$trace_file")"
  if test "$first" = "$second" && test "$(tail -c 1 "$trace_file" | wc -l)" -eq 1; then
    break
  fi
done
tail -c "+$((before + 1))" "$trace_file" > .aicp/otel-smoke.json

node <<'NODE'
const { readFileSync } = require("node:fs");
const raw = readFileSync(".aicp/otel-smoke.json", "utf8");
if (/gen_ai\.prompt|source\.code|http\.request\.body|db\.query\.text|stack_trace|sk-[A-Za-z0-9]|OPENAI_API_KEY/.test(raw)) {
  throw new Error("sensitive telemetry field detected");
}
const documents = raw.split(/\n+/).filter((line) => line.trim()).map(JSON.parse);
const spans = documents.flatMap((document) => document.resourceSpans ?? []).flatMap((resource) => {
  const service = resource.resource?.attributes?.find((item) => item.key === "service.name")?.value?.stringValue;
  return (resource.scopeSpans ?? []).flatMap((scope) => (scope.spans ?? []).map((span) => ({ service, span })));
});
const taskId = ({ span }) => span.attributes?.find((item) => item.key === "aicp.task_id")?.value?.stringValue;
const harness = spans.find((item) => item.service === "aicp-harness");
const memory = spans.find((item) => item.service === "aicp-memory");
if (!harness || !memory || taskId(memory) !== `${taskId(harness)}:compile`) {
  throw new Error("cross-service task correlation is incomplete");
}
process.stdout.write("[PASS] correlated redacted OTLP telemetry\n");
NODE
