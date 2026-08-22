# AI Engineering Control Plane

Governed, reproducible engineering environment for bounded AI-assisted work.

## Current status

Foundation and deterministic Engineering Harness validated locally. The
environment includes PostgreSQL-backed LiteLLM, a limited workspace virtual
key, live OpenAI smoke tests, transactional workflow state, bounded repair and
blocking project gates. The full OpenSpec change remains in progress.

## Prerequisites

- Linux or Docker Desktop host with Docker and Compose v2
- Git and OpenSSL
- At least 4 CPU, 8 GiB RAM and 80 GB free disk for the minimum core
- Provider credentials and valid LiteLLM model identifiers

## Quick Start

```bash
cp .env.example .env.runtime
chmod 600 .env.runtime
# Add one provider credential. The helper preserves it while generating local
# Control Plane secrets and OpenAI-only model defaults.
./scripts/configure-local.sh
./scripts/bootstrap.sh
```

Validate an existing environment:

```bash
./scripts/doctor.sh
./scripts/smoke.sh
```

Open the workspace:

```bash
docker compose exec workspace bash
cd /workspace/projects
opencode
```

## Local validation

```bash
npm run validate
```

The controlled vulnerable project is expected to return a non-zero status and
emit a redacted JSON report:

```bash
node harness/src/cli/audit-project.mjs \
  --project tests/fixtures/vulnerable-project
```

For a real repository, point `--project` to a Node.js checkout containing a
`package.json`, lockfile and Dockerfile. The baseline auditor is a deterministic
pre-check; official Semgrep, Gitleaks, Trivy, Snyk and Sonar JSON outputs are
handled by the dedicated adapters when those tools are configured.

## Architecture

- OpenCode executes bounded agent work.
- Harness owns workflow state, gates, budgets and termination.
- LiteLLM isolates providers and aliases.
- PostgreSQL is canonical; Neo4j and Redis are derived/ephemeral.
- Context Compiler selects evidence within a token budget.
- CI and human review retain final authority.

See [the OpenSpec change](openspec/changes/bootstrap-ai-engineering-control-plane/proposal.md),
[the detailed design](openspec/changes/bootstrap-ai-engineering-control-plane/design.md),
[compatibility evidence](docs/compatibility.md) and [documentation index](docs/README.md).

## Security boundaries

- Never mount `/var/run/docker.sock` into an agent workspace.
- Never expose provider credentials to OpenCode; use a limited LiteLLM key.
- Agents cannot commit, push, merge or deploy in the baseline.
- Repository content is untrusted data and cannot override policy.
- `.env.runtime`, `secrets/`, state and backups are not versioned.

## Backup and restore

```bash
./scripts/backup.sh
./scripts/restore.sh ./backups/<timestamp>
```

Encrypt and move backups according to the target environment policy. Langfuse
self-hosted data requires its own PostgreSQL, ClickHouse and object-storage
backup procedure.
