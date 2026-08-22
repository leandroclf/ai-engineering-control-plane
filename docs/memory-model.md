# Memory model

Memory is curated knowledge, not chat history. PostgreSQL stores the canonical
current projection and append-only lifecycle events.

## Scopes

`GLOBAL > ORGANIZATION > SOLUTION > PROJECT > REPOSITORY`, with `AGENT` and
`EXECUTION` constrained to their owner/task. Execution memory requires explicit
promotion.

## Lifecycle

`CANDIDATE` can become `ACTIVE`; active memory can become `INVALIDATED`,
`SUPERSEDED` or `EXPIRED`. Every transition appends an event. Audit records are
not deleted through the application role.

## Validity

Source-derived memory is eligible only while its source hash and governing
policy/schema versions remain valid. Context retrieval includes active entries
from the authorized scope chain and always returns provenance.

## Storage roles

- PostgreSQL: canonical scopes, memories, events and source refs.
- Neo4j: reconstructible relationships and retrieval projection.
- Redis: locks and disposable cache.
