# ADR-002: Separate canonical and derived state

## Status
Accepted

## Decision
Git/CI and approved policy govern code; PostgreSQL stores canonical Control
Plane state; Neo4j is reconstructible; Redis is disposable.

## Consequences
Recovery requires PostgreSQL and Git backups while graph/cache can be rebuilt.
