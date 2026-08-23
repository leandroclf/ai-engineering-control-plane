export const demoCertification = {
  schemaVersion: 1,
  release: "AICP v1",
  counts: { PASS: 35, BLOCKED: 3, FAILED: 0 },
  overall: "NOT_YET_V1_CERTIFIED",
  blockers: [
    { id: "dynamic_worker_agent_gate_e2e", title: "Dynamic worker + real provider E2E", status: "BLOCKED" },
    { id: "paired_llm_human_benchmark", title: "Paired human/LLM benchmark", status: "BLOCKED" },
    { id: "no_critical_regression", title: "Critical container-image findings", status: "BLOCKED" },
  ],
};

export const demoRuns = [
  { id: "demo-run", project: "payments-api", task: "Implement idempotent retry", stage: "human-review", status: "HUMAN_REVIEW", costUsd: 1.64, tokens: 50000, duration: "08m 42s", scenario: "repair" },
  { id: "demo-success", project: "catalog-service", task: "Add cache invalidation gate", stage: "completed", status: "COMPLETED", costUsd: 0.82, tokens: 31000, duration: "04m 18s", scenario: "success" },
  { id: "demo-budget", project: "search-api", task: "Refactor query planner", stage: "budget", status: "BLOCKED", costUsd: 3.0, tokens: 64000, duration: "11m 03s", scenario: "budget" },
  { id: "demo-security", project: "checkout-web", task: "Update payment form", stage: "security", status: "BLOCKED", costUsd: 0.47, tokens: 19000, duration: "03m 11s", scenario: "security" },
];

export const demoRunDetail = {
  ...demoRuns[0],
  workflow: ["discover", "plan", "implement", "fast-verify", "full-verify", "security-review", "targeted-repair", "security-review", "code-review", "architecture-conformance", "human-review"],
  completed: ["discover", "plan", "implement", "fast-verify", "full-verify", "targeted-repair", "security-review", "code-review", "architecture-conformance"],
  budget: { calls: [7, 10], inputTokens: [42000, 64000], outputTokens: [8000, 20000], cost: [1.64, 3], attempts: [{ provider: "primary", status: "failed" }, { provider: "fallback", status: "succeeded" }] },
  evidence: [{ gate: "unit-tests", status: "PASS", source: "worker://demo-run/evidence/unit-tests.json" }, { gate: "security-review", status: "PASS", source: "worker://demo-run/evidence/security-review.json" }, { gate: "human-review", status: "HUMAN_REQUIRED", source: "harness://demo-run/audit" }],
  context: { id: "ctx_demo_8fd2a7", policy: "stage-bounded-v3", tokenEnvelope: 64000, sources: [{ kind: "exact-symbol", value: "PaymentService.retry()" }, { kind: "graph-hop", value: "PaymentService → NotificationClient" }, { kind: "lexical", value: "RetryPolicy" }, { kind: "memory", value: "ADR-014" }], rawSourcePersisted: false },
};

export const demoArchitecture = { nodes: [{ id: "console", label: "AICP Console", plane: "human" }, { id: "harness", label: "Harness", plane: "control" }, { id: "worker", label: "Ephemeral Worker", plane: "execution" }, { id: "memory", label: "Memory + Graph", plane: "knowledge" }, { id: "postgres", label: "PostgreSQL", plane: "data" }, { id: "litellm", label: "LiteLLM", plane: "external" }], edges: [["console", "harness"], ["harness", "worker"], ["harness", "memory"], ["harness", "postgres"], ["worker", "litellm"]] };
