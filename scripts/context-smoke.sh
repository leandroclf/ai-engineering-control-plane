#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
repository="${1:-ai-engineering-control-plane}"
query="${2:-GitIndexer incremental index}"
exact_symbol="${3:-GitIndexer}"
budget="${4:-100}"

set -a
source .env.runtime
set +a
export MEMORY_SERVICE_URL="${MEMORY_SERVICE_URL:-http://127.0.0.1:${MEMORY_SERVICE_PORT:-18080}}"
export OTEL_EXPORTER_OTLP_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://127.0.0.1:4318}"
export AICP_CONTEXT_REPOSITORY="$repository"
export AICP_CONTEXT_QUERY="$query"
export AICP_CONTEXT_SYMBOL="$exact_symbol"
export AICP_CONTEXT_BUDGET="$budget"

node --input-type=module <<'NODE'
import { ContextApiClient } from "./context/client/context-api-client.mjs";
import { GovernedContextProvider } from "./harness/src/agents/governed-context-provider.mjs";
import { WorkflowExecutor } from "./harness/src/workflow/executor.mjs";
import { InMemoryRunStore } from "./harness/src/workflow/run-store.mjs";
import { OtlpHttpTelemetry } from "./harness/src/telemetry/otlp-http-telemetry.mjs";

const repository = process.env.AICP_CONTEXT_REPOSITORY;
const budget = Number(process.env.AICP_CONTEXT_BUDGET);
const client = new ContextApiClient({ baseUrl: process.env.MEMORY_SERVICE_URL, token: process.env.MEMORY_SERVICE_TOKEN });
const provider = new GovernedContextProvider({ contextClient: client });
const telemetry = new OtlpHttpTelemetry({ endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT });
const store = new InMemoryRunStore();
const task = await store.createTask({
  idempotencyKey: `context-smoke:${repository}`,
  workflowVersion: 1,
  metadata: {
    repository,
    query: process.env.AICP_CONTEXT_QUERY,
    exactSymbols: [process.env.AICP_CONTEXT_SYMBOL],
    scopes: [`REPOSITORY:${repository}`],
  },
});
const run = await store.createRun({ taskId: task.id, initialState: "compile", policyVersion: 1 });
const definition = {
  initial: "compile",
  terminal: ["ready"],
  states: {
    compile: { agent: "smoke", context: { budget, scopeTypes: ["REPOSITORY"] }, next: { pass: "ready" } },
    ready: {},
  },
};
const executor = new WorkflowExecutor({
  definition,
  store,
  contextProvider: provider,
  telemetry,
  handlers: { compile: async ({ context }) => context.contextId && context.tokenCount <= budget ? "pass" : "fail" },
});
await executor.execute(run.id);
const [stage] = await store.listStages(run.id);
if (!stage.evidence.contextId || JSON.stringify(stage.evidence).includes('"content"')) {
  throw new Error("context evidence is missing or contains raw content");
}
if (!stage.evidence.telemetryExported) throw new Error("stage telemetry was not exported");
process.stdout.write(`${JSON.stringify({
  status: "pass",
  contextId: stage.evidence.contextId,
  tokenCount: stage.evidence.contextTokenCount,
  budget: stage.evidence.contextBudget,
  artifacts: stage.evidence.contextArtifacts.length,
}, null, 2)}\n`);
NODE
