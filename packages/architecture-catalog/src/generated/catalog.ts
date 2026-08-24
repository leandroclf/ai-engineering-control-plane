/* This file is generated from architecture/catalog.yaml. Do not edit manually. */
import type { ArchitectureComponent } from "../index";

export const architectureCatalog: ArchitectureComponent[] = [
  {
    "id": "console",
    "name": "AICP Console",
    "plane": "human",
    "purpose": "Human interface for governed engineering work.",
    "why": "Expose workflow, authority, budget and evidence without becoming authority.",
    "benefits": [
      "comprehension",
      "operation",
      "trust"
    ],
    "authority": "Harness",
    "owns": [
      "presentation",
      "navigation",
      "tutorial-state"
    ],
    "doesNotOwn": [
      "workflow",
      "budget",
      "gates",
      "credentials",
      "source-of-truth"
    ],
    "state": {
      "ephemeral": [
        "browser-session"
      ]
    },
    "dataSensitivity": "redacted-operational",
    "dependencies": [
      "harness",
      "memory-service"
    ],
    "interfaces": [
      "BFF",
      "OpenAPI"
    ],
    "failureMode": "degraded-read-only",
    "securityBoundary": "browser-to-server-only",
    "observability": [
      "request-correlation",
      "audit-links"
    ],
    "docs": "/docs/control-plane"
  },
  {
    "id": "harness",
    "name": "Harness",
    "plane": "control",
    "purpose": "Deterministic engineering authority.",
    "why": "Prevents an LLM from owning workflow, budget or termination.",
    "benefits": [
      "fail-closed-governance",
      "reconciliation",
      "evidence"
    ],
    "authority": "Harness",
    "owns": [
      "workflow",
      "budgets",
      "gates",
      "authorization",
      "termination"
    ],
    "doesNotOwn": [
      "provider-credentials",
      "project-source-of-truth"
    ],
    "state": {
      "canonical": "postgres"
    },
    "dataSensitivity": "restricted",
    "dependencies": [
      "postgres",
      "worker-manager",
      "memory-service",
      "litellm"
    ],
    "interfaces": [
      "HTTP-API",
      "execution-plane"
    ],
    "failureMode": "fail-closed",
    "securityBoundary": "trusted-control-plane",
    "observability": [
      "otel",
      "audit",
      "stage-evidence"
    ],
    "docs": "/docs/control-plane"
  },
  {
    "id": "worker-manager",
    "name": "Worker Manager",
    "plane": "execution",
    "purpose": "Create, attest and destroy one isolated worker per run.",
    "why": "Controls physical lifecycle and residual state.",
    "benefits": [
      "blast-radius-reduction",
      "cleanup",
      "worktree-isolation"
    ],
    "authority": "Harness",
    "owns": [
      "worker-lifecycle",
      "worktrees",
      "workload-identity"
    ],
    "doesNotOwn": [
      "workflow-transitions",
      "gate-approval"
    ],
    "state": {
      "ephemeral": [
        "containers",
        "run-worktrees",
        "credentials"
      ]
    },
    "dataSensitivity": "restricted",
    "dependencies": [
      "docker",
      "project-repository"
    ],
    "interfaces": [
      "worker-manager-http",
      "docker-control"
    ],
    "failureMode": "fail-closed",
    "securityBoundary": "deployment-side-execution-boundary",
    "observability": [
      "worker-attestation",
      "lifecycle-evidence"
    ],
    "docs": "/docs/execution-plane"
  },
  {
    "id": "worker",
    "name": "Ephemeral Worker",
    "plane": "execution",
    "purpose": "Execute OpenCode, builds, tests and scanners for one run.",
    "why": "Keeps untrusted project code outside the control plane.",
    "benefits": [
      "isolation",
      "disposable-runtime",
      "bounded-capabilities"
    ],
    "authority": "Harness",
    "owns": [
      "run-diff",
      "command-results"
    ],
    "doesNotOwn": [
      "authority",
      "credentials",
      "release-decision"
    ],
    "state": {
      "ephemeral": [
        "container-filesystem"
      ]
    },
    "dataSensitivity": "untrusted-project-data",
    "dependencies": [
      "opencode",
      "litellm",
      "worker-manager"
    ],
    "interfaces": [
      "structured-capabilities"
    ],
    "failureMode": "fail-closed",
    "securityBoundary": "container-and-network-boundary",
    "observability": [
      "otel",
      "redacted-evidence"
    ],
    "docs": "/docs/execution-plane"
  },
  {
    "id": "postgres",
    "name": "PostgreSQL",
    "plane": "data",
    "purpose": "Canonical transactional state.",
    "why": "Recovery and consistency cannot depend on ephemeral projections.",
    "benefits": [
      "durability",
      "transactions",
      "recovery"
    ],
    "authority": "canonical-state",
    "owns": [
      "workflow-state",
      "budget-ledger",
      "memory-ledger",
      "reconciliation"
    ],
    "doesNotOwn": [
      "interactive-cache",
      "graph-projection"
    ],
    "state": {
      "canonical": "postgres"
    },
    "dataSensitivity": "restricted",
    "dependencies": [],
    "interfaces": [
      "sql-from-trusted-services"
    ],
    "failureMode": "fail-closed",
    "securityBoundary": "data-plane",
    "observability": [
      "health",
      "metrics",
      "backup-integrity"
    ],
    "docs": "/docs/data"
  },
  {
    "id": "memory-service",
    "name": "Memory Service",
    "plane": "knowledge",
    "purpose": "Governed context, memory and graph retrieval.",
    "why": "Selects bounded evidence with scope, authority and provenance.",
    "benefits": [
      "context-efficiency",
      "continuity",
      "provenance"
    ],
    "authority": "Harness-policy",
    "owns": [
      "retrieval-policy",
      "provenance",
      "memory-scope"
    ],
    "doesNotOwn": [
      "workflow",
      "gate-approval"
    ],
    "state": {
      "canonical": "postgres",
      "derived": [
        "neo4j"
      ],
      "ephemeral": [
        "redis"
      ]
    },
    "dataSensitivity": "scope-filtered",
    "dependencies": [
      "postgres",
      "neo4j",
      "redis",
      "litellm"
    ],
    "interfaces": [
      "authenticated-context-api"
    ],
    "failureMode": "fail-closed",
    "securityBoundary": "knowledge-plane",
    "observability": [
      "retrieval-reasons",
      "token-usage",
      "otel"
    ],
    "docs": "/docs/knowledge-plane"
  },
  {
    "id": "litellm",
    "name": "LiteLLM Gateway",
    "plane": "external",
    "purpose": "Central provider routing and physical usage boundary.",
    "why": "Provider credentials must never reach workers.",
    "benefits": [
      "routing",
      "fallback",
      "cost-tracking"
    ],
    "authority": "provider-gateway",
    "owns": [
      "provider-credentials",
      "provider-calls"
    ],
    "doesNotOwn": [
      "workflow",
      "release-decision"
    ],
    "state": {
      "ephemeral": [
        "provider-session"
      ]
    },
    "dataSensitivity": "secret-boundary",
    "dependencies": [
      "provider-apis"
    ],
    "interfaces": [
      "openai-compatible-api",
      "otel"
    ],
    "failureMode": "fail-closed",
    "securityBoundary": "provider-egress",
    "observability": [
      "cost",
      "tokens",
      "fallback-spans"
    ],
    "docs": "/docs/model-routing"
  },
  {
    "id": "agent-provider-router",
    "name": "Agent Provider Router",
    "plane": "control",
    "purpose": "Select a governed agent runtime above model routing.",
    "why": "Keeps OpenCode, Codex and Claude Code at the correct abstraction level.",
    "benefits": [
      "runtime-interchangeability",
      "auditability",
      "provider-family-diversity"
    ],
    "authority": "Harness",
    "owns": [
      "agent-routing-decision",
      "provider-eligibility",
      "fallback-policy"
    ],
    "doesNotOwn": [
      "workflow-transition",
      "provider-credentials",
      "model-catalog"
    ],
    "state": {
      "canonical": "postgres"
    },
    "dataSensitivity": "restricted",
    "dependencies": [
      "harness",
      "postgres",
      "provider-quota-authority"
    ],
    "interfaces": [
      "agent-provider-contract",
      "http-api"
    ],
    "failureMode": "fail-closed",
    "securityBoundary": "trusted-control-plane",
    "observability": [
      "route-decision",
      "provider-family",
      "fallback"
    ],
    "docs": "/docs/architecture/providers/routing"
  },
  {
    "id": "agent-provider-host",
    "name": "Agent Provider Host",
    "plane": "execution",
    "purpose": "Run credential-bearing official vendor CLIs in a separate trust zone.",
    "why": "Subscription sessions cannot be placed in ordinary workers.",
    "benefits": [
      "credential-boundary",
      "process-supervision",
      "checkpointed-fallback"
    ],
    "authority": "Harness",
    "owns": [
      "provider-process",
      "argv-boundary",
      "output-boundary",
      "cancellation"
    ],
    "doesNotOwn": [
      "workflow",
      "budget",
      "quota-policy",
      "gate-approval",
      "credentials"
    ],
    "state": {
      "ephemeral": [
        "provider-process",
        "schema-temp-file"
      ]
    },
    "dataSensitivity": "vendor-session-sensitive",
    "dependencies": [
      "codex-cli",
      "claude-code-cli",
      "run-worktree"
    ],
    "interfaces": [
      "agent-execution-envelope"
    ],
    "failureMode": "fail-closed",
    "securityBoundary": "provider-host-trust-zone",
    "observability": [
      "bounded-status",
      "duration",
      "termination-reason"
    ],
    "docs": "/docs/architecture/providers/provider-host"
  },
  {
    "id": "provider-quota-authority",
    "name": "Provider Quota Authority",
    "plane": "control",
    "purpose": "Enforce AICP shadow quotas for subscription-backed runtimes.",
    "why": "Vendor subscription remaining quota is not treated as a stable API.",
    "benefits": [
      "bounded-concurrency",
      "retry-fuse",
      "principal-scope"
    ],
    "authority": "Harness",
    "owns": [
      "quota-reservations",
      "quota-settlement"
    ],
    "doesNotOwn": [
      "vendor-entitlement",
      "monetary-budget"
    ],
    "state": {
      "canonical": "postgres",
      "ephemeral": [
        "memory-tests"
      ]
    },
    "dataSensitivity": "restricted",
    "dependencies": [
      "postgres",
      "agent-provider-router"
    ],
    "interfaces": [
      "quota-ledger"
    ],
    "failureMode": "fail-closed",
    "securityBoundary": "trusted-control-plane",
    "observability": [
      "quota-reserve",
      "quota-commit",
      "exhaustion"
    ],
    "docs": "/docs/architecture/providers/routing"
  }
];

export const architectureEdges: Array<[string, string]> = [
  [
    "console",
    "harness"
  ],
  [
    "console",
    "memory-service"
  ],
  [
    "harness",
    "postgres"
  ],
  [
    "harness",
    "worker-manager"
  ],
  [
    "harness",
    "memory-service"
  ],
  [
    "harness",
    "litellm"
  ],
  [
    "worker",
    "litellm"
  ],
  [
    "worker",
    "worker-manager"
  ],
  [
    "memory-service",
    "postgres"
  ],
  [
    "memory-service",
    "litellm"
  ],
  [
    "agent-provider-router",
    "harness"
  ],
  [
    "agent-provider-router",
    "postgres"
  ],
  [
    "agent-provider-router",
    "provider-quota-authority"
  ],
  [
    "provider-quota-authority",
    "postgres"
  ],
  [
    "provider-quota-authority",
    "agent-provider-router"
  ]
];
