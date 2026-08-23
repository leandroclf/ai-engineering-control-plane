# Delta for documentation-governance

## ADDED Requirements

### Requirement: Canonical documentation index

The system SHALL provide one primary documentation index that points readers to
the current source of truth for product, architecture, reference, security,
validation, operations and OpenSpec planning.

#### Scenario: Reader opens the docs index

- GIVEN a person or agent opens `docs/README.md`
- WHEN they need the current state of the system
- THEN the index SHALL point them to the canonical current documents first
- AND SHALL separate historical material from current contracts.

### Requirement: Historical documentation must be labeled

The system SHALL keep legacy prompts and evolution guides accessible for
provenance while clearly marking them as historical.

#### Scenario: Reader navigates legacy material

- GIVEN a numbered prompt or evolution guide exists
- WHEN the reader opens the archive index
- THEN the document SHALL be labeled historical
- AND SHALL not be presented as the current source of truth.

### Requirement: Single implementation-progress mirror

The system SHALL maintain a short implementation-progress mirror that points to
the canonical OpenSpec implementation status instead of duplicating the full
ledger.

#### Scenario: Implementation status is requested

- GIVEN someone needs to know what is implemented and what remains open
- WHEN they read the short progress document
- THEN they SHALL be redirected to the canonical OpenSpec status
- AND the mirror SHALL summarize only the current high-level state.

### Requirement: OpenSpec planning authority

The system SHALL record new planning work in OpenSpec change folders before it
spawns additional free-form planning documents.

#### Scenario: New documentation work is proposed

- GIVEN a new documentation cleanup or product roadmap item is identified
- WHEN the work is planned
- THEN the proposal, design and tasks SHALL be captured in OpenSpec
- AND the documentation index SHALL link to that change.

