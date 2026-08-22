# Langfuse observability profile

This optional low-scale profile is derived from the official Langfuse
`v4.16.0` Docker Compose deployment. The source revision is
`https://github.com/langfuse/langfuse/blob/v4.16.0/docker-compose.yml`.
Web and worker images are pinned to the verified multi-platform manifest
digests in `versions.env`. The core AICP stack does not depend on this profile.

## Lifecycle

```bash
./scripts/configure-observability.sh
./scripts/observability.sh up
./scripts/observability.sh status
docker compose --env-file versions.env --env-file .env.observability \
  -f compose.yaml -f compose/observability-export.yaml \
  up -d --force-recreate otel-collector
./scripts/observability.sh down
```

The UI is available only at `http://127.0.0.1:3000`. MinIO's S3 API is bound
to `127.0.0.1:9090` for media links and backup; its console, PostgreSQL,
ClickHouse and Redis are not published. Credentials live only in the ignored,
mode-0600 `.env.observability`. Prompt/input/output capture remains disabled in
the core collector until a data owner explicitly approves it.

The optional collector overlay exports redacted traces through Langfuse's native
OTLP endpoint (`/api/public/otel`) with ingestion version 4. It keeps metrics in
the local collector and never exports prompts, completions, source, request
bodies, database statements or stack traces. Without the overlay, the core
runtime continues to use only its local file exporters.

## Update procedure

1. Review the upstream release notes, migration guide and official Compose diff.
2. Update the exact release tag and verify web/worker manifest digests for both
   amd64 and arm64.
3. Reconcile new required environment variables and datastore versions in the
   vendored Compose file; never copy upstream placeholder credentials.
4. Run `docker compose --env-file .env.observability -f
   compose/observability.vendor.yaml config --quiet`, then start the profile and
   verify all health checks plus UI login.
5. Run a backup before migration and a restore drill after it. Roll back only
   with a data-compatible release or the pre-upgrade backup.

## Backup boundary

Langfuse is non-canonical observability data, but a recoverable deployment must
capture a consistent set of:

- PostgreSQL logical dump for application configuration and identities;
- ClickHouse backup for traces, observations and scores;
- MinIO `langfuse` bucket for events and media;
- `.env.observability` through the approved encrypted secret backup channel.

Redis is queue/cache state and is rebuilt, not restored. Stop web and worker or
use datastore-native consistent snapshots before backup. Encrypt artifacts
before moving them off-host, validate checksums, and test restoration in an
isolated Compose project. Retention, owner, destination and deletion approval
remain governed by the organization-wide backup policy decision in task 6.6.

The official documentation describes Docker Compose as suitable for local and
low-scale deployments, not high availability. Production deployments require
the approved Kubernetes or cloud architecture instead of this profile.
