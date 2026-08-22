# Delta for context-memory

## ADDED Requirements

### Requirement: Scoped and authoritative memory

The Memory Service SHALL store knowledge with scope, kind, status, version,
authority, provenance and validity metadata.

#### Scenario: Candidate memory creation

- GIVEN an execution produces a candidate fact or decision
- WHEN it is submitted to memory
- THEN it SHALL remain a candidate in its execution scope until an authorized
  promotion occurs.

#### Scenario: Cross-project retrieval

- GIVEN a request belongs to project A
- WHEN scoped memory is searched
- THEN memories exclusive to project B SHALL NOT be returned.

### Requirement: Auditable lifecycle

The system SHALL preserve append-only lifecycle events when memory is promoted,
updated, invalidated, superseded, expired or restored.

#### Scenario: Source changed

- GIVEN an active memory depends on a source hash
- WHEN the authoritative source hash changes
- THEN the memory SHALL no longer be returned as active
- AND the lifecycle reason SHALL be auditable.

#### Scenario: Superseded decision

- GIVEN a newer approved version supersedes an active decision
- WHEN current memory is queried
- THEN only the newer active decision SHALL be eligible for context.

### Requirement: Incremental index

The indexer SHALL reuse parse and embedding artifacts whose content and relevant
schema/model versions have not changed.

#### Scenario: No-op reindex

- GIVEN a repository was indexed and no tracked content changed
- WHEN synchronization runs again with unchanged parser/index versions
- THEN zero source files SHALL be reparsed.

#### Scenario: File changed

- GIVEN one tracked file changes
- WHEN synchronization runs
- THEN only the changed file and demonstrably affected derived relationships
  SHALL be updated.

### Requirement: Reconstructible graph

The graph SHALL be reconstructible from Git and canonical PostgreSQL state.

#### Scenario: Graph data loss

- GIVEN canonical state and repository commits are available
- WHEN graph rebuild is requested
- THEN the logical nodes and relationships required by the current schema SHALL
  be recreated without Redis or previous graph storage.

### Requirement: Budgeted context package

The Context Compiler SHALL prioritize explicit artifacts and deterministic
retrieval before semantic fallback and SHALL never exceed the computed
retrieval budget.

#### Scenario: Exact symbol is available

- GIVEN the task identifies an exact symbol
- WHEN context is compiled
- THEN that exact symbol SHALL rank ahead of semantically similar unrelated
  artifacts.

#### Scenario: Package exceeds initial budget

- GIVEN candidate artifacts contain more tokens than allowed
- WHEN the package is assembled
- THEN lower-priority candidates SHALL be omitted
- AND every selected item SHALL retain its retrieval reason and provenance.
