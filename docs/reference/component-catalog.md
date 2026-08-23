# Component Catalog

Generated from `architecture/catalog.yaml`. Do not edit this table manually.

| Component | Plane | Authority | Failure mode | Purpose |
|---|---|---|---|---|
| [AICP Console](/docs/control-plane) | human | Harness | degraded-read-only | Human interface for governed engineering work. |
| [Harness](/docs/control-plane) | control | Harness | fail-closed | Deterministic engineering authority. |
| [Worker Manager](/docs/execution-plane) | execution | Harness | fail-closed | Create, attest and destroy one isolated worker per run. |
| [Ephemeral Worker](/docs/execution-plane) | execution | Harness | fail-closed | Execute OpenCode, builds, tests and scanners for one run. |
| [PostgreSQL](/docs/data) | data | canonical-state | fail-closed | Canonical transactional state. |
| [Memory Service](/docs/knowledge-plane) | knowledge | Harness-policy | fail-closed | Governed context, memory and graph retrieval. |
| [LiteLLM Gateway](/docs/model-routing) | external | provider-gateway | fail-closed | Central provider routing and physical usage boundary. |
