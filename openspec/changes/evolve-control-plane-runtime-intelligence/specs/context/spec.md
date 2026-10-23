# Context Intelligence v1

### Requirement: progressive disclosure

The Context Compiler MUST select metadata and summaries before on-demand
fragments and MUST defer overflow rather than truncate silently.

### Requirement: budget and provenance

Context selection MUST respect a declared budget and MUST retain source, hash,
kind, priority and estimated tokens for every material item.

### Requirement: deduplication

Equivalent constraints SHOULD be emitted once while preserving every material
source in provenance.
