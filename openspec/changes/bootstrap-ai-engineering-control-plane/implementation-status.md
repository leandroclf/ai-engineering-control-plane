# Implementation status

Updated: 2026-08-21

## Current verdict

`FOUNDATION_READY`

The repository now contains an executable and tested Foundation with a
PostgreSQL-backed LiteLLM gateway, limited workspace virtual key and live model
smoke. It MUST NOT yet be classified as `READY_FOR_HUMAN_REVIEW` for the full
OpenSpec change. Durable Memory API, complete Harness gates, GraphRAG, telemetry
backend, restore drill and multi-host acceptance remain open.

## Verified evidence

| Capability | Evidence | Result |
|---|---|---|
| Local contracts | `npm run validate` | PASS: 9 Node tests, 2 Python tests, configuration acceptance |
| Workspace image | `docker compose build workspace` | PASS |
| Memory image | `docker compose build memory-service` | PASS |
| OpenCode baseline | `docker run --rm aicp-workspace opencode --version` | PASS: `1.18.21` |
| Non-root workspace | `docker run --rm aicp-workspace id -u` | PASS: `10001` |
| Data services | Compose health for PostgreSQL, Redis and Neo4j | PASS |
| Logical databases | PostgreSQL query | PASS: `aicp_memory`, `litellm` |
| Memory readiness | `GET /ready` inside service | PASS |
| Migration rerun | two sequential `scripts/migrate.sh` runs | PASS |
| Provider isolation contract | resolved Compose workspace env check | PASS |
| Gateway persistence | LiteLLM readiness response | PASS: PostgreSQL connected |
| Workspace virtual key | provision followed by idempotent validation | PASS: limited key preserved |
| Live model routing | `scripts/smoke.sh` | PASS: `coding-fast`, `coding-strong` |
| SDK structured output | injected OpenCode SDK client contract | PASS |
| Budget/no-progress | unit tests | PASS |
| Context budget/dedup | unit tests | PASS |
| Incremental index planning | no-op/change/delete tests | PASS |
| Secret finding redaction | normalized finding test | PASS |

## Implemented artifacts

- Version and compatibility evidence.
- Compose core networks, secrets, health checks and non-root workspace.
- Bootstrap, config renderer, migration, doctor, smoke, backup, restore and
  index entrypoints.
- OpenCode provider configuration, agents, permissions and secure-review skill.
- OpenCode SDK controller contract with JSON Schema output.
- Workflow, budget, progress detector and finding/context primitives.
- PostgreSQL Memory Ledger migration and in-memory lifecycle domain.
- Neo4j constraints and full-text index definitions.
- OTel collector redaction baseline.
- GitHub clean-checkout contract pipeline.
- Threat model, runbook, memory model, compatibility and ADR documentation.

## Resolved local configuration

- OpenAI credential is configured locally and remains ignored by Git.
- OpenAI-only model defaults are configured for all required aliases.
- Internal LiteLLM and Neo4j secrets were generated locally.
- The existing Neo4j password was rotated to match persistent state.

## Blocking external configuration for later phases

The following values cannot be invented or committed:

- production LiteLLM immutable release pin replacing `latest`;
- CI/registry credentials for publishing and full scanner execution;
- remote identity/TLS/VPN and secret-manager selection;
- Langfuse endpoint/keys or approved alternative;
- Snyk/Sonar licensing and data-transfer approval.

## Remaining engineering work

- Persist task/run/stage and Memory Service operations in PostgreSQL.
- Expose authenticated REST v1 memory/context/run APIs.
- Implement real workflow executor and gate/scanner process adapters.
- Add vulnerable-project acceptance fixture and targeted repair E2E.
- Implement parser/symbol extraction, persistent incremental index and Neo4j
  graph deltas.
- Add embeddings and semantic fallback after model selection.
- Instrument services and validate a real telemetry backend.
- Execute encrypted backup/restore drill.
- Run clean-host, provider, CI and multi-host acceptance.

## Resume command

The Foundation can be revalidated at any time with:

```bash
./scripts/doctor.sh
./scripts/smoke.sh
```

The next required evidence is the Engineering Harness vulnerable-project suite
with deterministic gates and bounded targeted repair.
