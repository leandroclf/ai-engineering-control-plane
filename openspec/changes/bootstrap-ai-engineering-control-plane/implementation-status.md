# Implementation status

Updated: 2026-08-21

## Current verdict

`CONTEXT_RUNTIME_PARTIAL`

The repository now contains an executable Foundation, deterministic Engineering
Harness, persistent scoped Memory API and an authenticated Context runtime.
Git deltas, JavaScript symbols/chunks and versioned embeddings persist in
PostgreSQL; Neo4j is rebuilt as a derived projection; retrieval is exact-first,
lexical/vector fallback and budgeted. It MUST NOT yet be classified as
`READY_FOR_HUMAN_REVIEW` for the full OpenSpec change. Reference/impact graph
traversal, exact model token counting, executor integration, telemetry backend,
restore drill and multi-host acceptance remain open.

## Verified evidence

| Capability | Evidence | Result |
|---|---|---|
| Local contracts | `npm run validate` | PASS: 32 Node tests, 16 Python tests, configuration and Harness acceptance |
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
| Reference project repair | `site-lf-solucoes` at `2199053` | PASS: all four detected native gates |
| Memory REST lifecycle | `scripts/memory-smoke.sh` | PASS: idempotency, promotion, scoped search and cross-scope denial |
| Memory persistence | container restart followed by authorized GET | PASS: active version 2 retained |
| Append-only ledger | attempted SQL event mutation | PASS: database trigger blocked mutation |
| Embedding route | live LiteLLM `embeddings` alias | PASS: 1,536 dimensions through limited virtual key |
| Persistent real index | `site-lf-solucoes` at `2199053` | PASS: 7 files, 128 symbols/chunks |
| Incremental no-op | second `scripts/index.sh` run | PASS: zero parsed, changed or embedded artifacts |
| Context compile | exact `bootDashboard`, budget 1,000 | PASS: exact-first, 526 calculated tokens, provenance retained |
| Projection recovery | graph deletion, Redis stopped, `--rebuild` | PASS: repository/file/symbol/chunk counts restored |
| Dependency consistency | graph failure regression tests | PASS: index state does not advance; sanitized `503` returned |

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
- Authenticated Memory REST API and transactional Psycopg repository.
- Authenticated index/context REST API and host client/CLI.
- Persistent Git index state, JavaScript parser, chunk embeddings and hybrid retrieval.
- Neo4j constraints, graph delta projection and reconstructible rebuild.
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

- Expose authenticated REST v1 run APIs.
- Wire the runtime entrypoint to PostgreSQL, OpenCode and installed scanner CLIs.
- Project references and implement deterministic impact traversal in Neo4j.
- Replace calculated chunk token estimates with exact model token counting.
- Wire the Context API package and provenance into the Harness executor.
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

The next required evidence completes Context and Memory: reference/impact graph
traversal, exact token counting and runtime delivery of the authorized context
package to each Harness stage.
