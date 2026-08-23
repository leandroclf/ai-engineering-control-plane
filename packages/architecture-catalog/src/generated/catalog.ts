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
  ]
];
