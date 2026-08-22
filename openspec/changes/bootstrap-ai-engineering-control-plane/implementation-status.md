# Implementation status

Updated: 2026-08-21

## Current verdict

`HARNESS_READY`

The repository now contains an executable and tested Foundation plus the
deterministic Engineering Harness core. It has transactional workflow storage,
bounded execution, normalized scanner adapters, configurable command gates and
a blocking vulnerable-project acceptance suite. It MUST NOT yet be classified
as `READY_FOR_HUMAN_REVIEW` for the full OpenSpec change. Durable Memory API,
GraphRAG, telemetry backend, restore drill and multi-host acceptance remain
open.

## Verified evidence

| Capability | Evidence | Result |
|---|---|---|
| Local contracts | `npm run validate` | PASS: 24 Node tests, 2 Python tests, configuration and Harness acceptance |
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
| Control persistence schema | `scripts/migrate.sh` and PostgreSQL catalog query | PASS: `control.tasks`, `control.runs`, `control.stages` |
| Workflow lifecycle | in-memory and PostgreSQL store contract tests | PASS: idempotency, optimistic concurrency, resume and atomic stage evidence |
| Process gates | command adapter tests | PASS: success, failure, timeout, unavailable and missing configuration |
| Scanner adapters | normalized JSON contract tests | PASS: Semgrep, Gitleaks, Trivy; optional Snyk and Sonar modes |
| Targeted repair | bounded repair unit tests | PASS: originating gate, regression, read-only review and no-progress stop |
| Vulnerable project | `tests/acceptance/harness_test.sh` | PASS: test, secret, SQL injection, vulnerable dependency and Docker defects block |
| Real project gates | `site-lf-solucoes` at `3389682` | BLOCKED as designed: 3 native gates pass, HTML performance budget fails |

## Implemented artifacts

- Version and compatibility evidence.
- Compose core networks, secrets, health checks and non-root workspace.
- Bootstrap, config renderer, migration, doctor, smoke, backup, restore and
  index entrypoints.
- OpenCode provider configuration, agents, permissions and secure-review skill.
- OpenCode SDK controller contract with JSON Schema output.
- Workflow executor, budgets, no-progress detector and targeted repair.
- Transactional PostgreSQL and in-memory task/run/stage stores.
- Command gate framework and Node.js project command detection.
- Semgrep, Gitleaks, Trivy, Snyk and Sonar report adapters.
- Redacted vulnerable-project auditor and acceptance fixture.
- Generic Node.js/static-site project detection and governed gate runner.
- PostgreSQL Memory Ledger and Control Plane migrations.
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

- Expose authenticated REST v1 memory/context/run APIs.
- Wire the runtime entrypoint to PostgreSQL, OpenCode and installed scanner CLIs.
- Implement parser/symbol extraction, persistent incremental index and Neo4j
  graph deltas.
- Add embeddings and semantic fallback after model selection.
- Instrument services and validate a real telemetry backend.
- Execute encrypted backup/restore drill.
- Run clean-host, provider, CI and multi-host acceptance.

## Resume command

The Foundation and Harness can be revalidated at any time with:

```bash
./scripts/doctor.sh
./scripts/smoke.sh
npm run validate
```

The next required evidence is the durable Context and Memory phase: authenticated
REST APIs, persistent incremental indexing, graph deltas and semantic retrieval.
