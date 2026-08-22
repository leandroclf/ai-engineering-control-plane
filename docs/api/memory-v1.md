# Memory API v1

The Memory API stores curated knowledge in PostgreSQL. Every `/v1` request
requires `Authorization: Bearer <MEMORY_SERVICE_TOKEN>`. The token resolves to
an actor, allowed actions and an exact set of scopes configured by
`MEMORY_AUTHORIZED_SCOPES`.

## Endpoints

| Method | Path | Action |
|---|---|---|
| `GET` | `/health` | Process health; unauthenticated |
| `GET` | `/ready` | PostgreSQL readiness; unauthenticated |
| `POST` | `/v1/memories` | Create an idempotent candidate |
| `GET` | `/v1/memories/{id}` | Read an authorized memory |
| `GET` | `/v1/memories/search?scope=TYPE:key` | Search active, non-expired memory |
| `POST` | `/v1/memories/{id}:promote` | Promote a candidate to an authorized scope |
| `POST` | `/v1/memories/{id}:invalidate` | Invalidate current knowledge with a reason |
| `POST` | `/v1/memories/{id}:supersede` | Create a new active version and supersede old knowledge |

## Create

```json
{
  "scope": "EXECUTION:local",
  "canonical_key": "architecture.database.primary",
  "kind": "DECISION",
  "summary": "PostgreSQL is canonical",
  "authority": "HUMAN",
  "source_hash": "sha256:...",
  "idempotency_key": "task-42:database-decision",
  "policy_version": "1",
  "schema_version": "1"
}
```

Candidates remain invisible to active search until promotion. Credential-like
material is rejected before persistence. Search never expands a caller-provided
scope: every requested scope must be present in the token's server-side
authorization record.

## Lifecycle

Lifecycle state is never hard-deleted. Promotion, invalidation, supersession and
TTL expiration append events to `memory.memory_events`. A database trigger
rejects update or delete attempts against that ledger.
