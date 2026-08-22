# Operations runbook

## Bootstrap fails before startup

Run `docker version`, `docker compose version`, inspect `.env.runtime` for
placeholder values and rerun `./scripts/render-config.sh`. Never paste the file
or secret values into an issue.

## Service is unhealthy

Run `./scripts/doctor.sh`, then `docker compose ps` and service-specific logs.
Classify configuration, dependency, migration, resource or application failure
before restarting. A required unavailable gate remains blocking.

## No-progress workflow

Preserve task/run IDs, finding fingerprint, diff fingerprint and gate artifacts.
Do not increase budgets automatically. Route to human review.

## Suspected secret exposure

Stop affected workflow, revoke/rotate the credential at its authority, preserve
redacted evidence, scan Git history and determine whether provider logs or
telemetry received the value.

## Backup and restore

Run `./scripts/backup.sh`, encrypt and move the resulting directory. Restore in
a compatible isolated environment with `./scripts/restore.sh <directory>` and
require doctor, scope-isolation and context checks. Neo4j is rebuilt; Redis is
discarded.

## Safe shutdown

`docker compose stop` preserves state. `docker compose down` removes containers
and networks but not bind-mounted canonical state. Do not use volume/data
deletion commands without a separately approved destructive procedure.

## Repository index and graph rebuild

Index a configured checkout and verify that a second run is a no-op:

```bash
./scripts/index.sh projects/<repository> <repository-id>
./scripts/index.sh projects/<repository> <repository-id>
```

Use `--rebuild` after graph loss or a projection schema change:

```bash
./scripts/index.sh projects/<repository> <repository-id> --rebuild
```

PostgreSQL is canonical, Neo4j is reconstructible and Redis is not required for
the rebuild. A failed graph projection returns `503` and does not advance the
incremental index state, so retrying the same operation remains safe.

Run `./scripts/context-smoke.sh [repository-id] [query] [exact-symbol] [budget]`
to verify gateway token counting, authorized compilation and sanitized Harness
stage evidence. Use `/v1/context:impact` to inspect local import dependents of a
path before planning a change.

## Telemetry degradation

Run `./scripts/telemetry-smoke.sh` and inspect `docker compose logs
otel-collector`. Workflow execution remains functional if export fails, but the
stage evidence records `telemetryExported=false`; this is degradation, not a
successful telemetry result. Local OTLP evidence is written under ignored
`.aicp/otel/` and excludes full prompts/source by default.
