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

## Budget reservation drift

Query `GET /v1/tasks/<task-id>/budget/events` and locate
`BUDGET_RESERVATION_DRIFT`. Preserve reserved/actual ratios and model alias,
stop remaining task work, and correct pricing/routing/token overhead before
resume. Never increase or reset the persisted budget to hide an overshoot.

## Capability preflight failure

Use `GET /v1/capabilities?project=<name>` and inspect each module's status and
probe evidence. `MISCONFIGURED` required capabilities block before any model
call. Install/configure the declared project tool or deliberately update the
project policy; do not replace a required gate with a guessed conventional command.

## Ephemeral execution for remote/team mode

Run the deployment-side manager on the trusted Docker host, never inside the
Harness or an agent container. Set `AICP_WORKER_PROJECTS_ROOT` to the exact host
checkout boundary and provide only the manager API token and workload-signing
secret through secret files. The manager issues material credentials per run;
provider keys never cross the LiteLLM boundary. Start it with
`npm run worker-manager`. Configure the Harness with
`AICP_EXECUTION_MODE=ephemeral`, `WORKER_MANAGER_URL`, `WORKER_MANAGER_TOKEN`
and `WORKER_CLIENT_PROJECT_ROOT`. Readiness fails closed when the manager or an
attested toolchain profile is unavailable. Local personal mode remains
long-lived unless explicitly switched; remote/team deployments must use the
ephemeral mode.

Production also requires `AICP_RELEASE_MODE=production` and
`AICP_AUTH_MODE=oauth` with issuer, audience and JWKS configuration. Static
admin tokens are reserved for local mode.

## Suspected secret exposure

Stop affected workflow, revoke/rotate the credential at its authority, preserve
redacted evidence, scan Git history and determine whether provider logs or
telemetry received the value.

## Backup and restore

Run `./scripts/backup.sh [destination-directory]`. The result is one AES256
archive plus an external checksum; plaintext dumps exist only in trap-cleaned
staging. Restore with `./scripts/restore.sh <archive> [repository-path
repository-id]`. Restore rejects checksum or `LITELLM_SALT_KEY` mismatch
before database mutation, rebuilds Neo4j from Git and runs acceptance. Redis is
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
Graph context traversal is capped at two hops. Source changes reconcile matching
memory refs and append `memory.reconciliation_events`; stale entries must not be
reactivated without new evidence.

## Telemetry degradation

Run `./scripts/telemetry-smoke.sh` and inspect `docker compose logs
otel-collector`. Workflow execution remains functional if export fails, but the
stage evidence records `telemetryExported=false`; this is degradation, not a
successful telemetry result. Local OTLP evidence is written under ignored
`.aicp/otel/` and excludes full prompts/source by default.

## Remote profile and certificate rotation

The remote profile exposes only the mTLS gateway. Keep the default loopback bind
for local validation. In a remote environment, set `REMOTE_BIND_ADDRESS` to a
private VPN interface and `REMOTE_SERVER_SAN` to the PKI-approved DNS/IP SAN;
never bind the profile directly to a public interface.

```bash
export REMOTE_GATEWAY_UID="$(id -u)" REMOTE_GATEWAY_GID="$(id -g)"
export REMOTE_BIND_ADDRESS=127.0.0.1
./scripts/configure-remote.sh
docker compose --env-file .env.runtime -f compose.yaml -f compose/remote.yaml \
  up -d --no-deps remote-gateway
./scripts/remote-smoke.sh
```

The local CA is a validation fixture. Production certificates MUST come from
the approved PKI, with one client certificate per workload or user identity.
Rotate certificates with `./scripts/configure-remote.sh --rotate`, distribute
the new client bundle out of band, recreate `remote-gateway`, validate the new
client, and revoke the old certificate. Rotate bearer tokens independently;
mTLS authenticates the host while bearer grants authorize actions and exact
scopes. PostgreSQL, Redis and Neo4j remain on the internal data network and no
database volume may be copied or mounted by a client host.
