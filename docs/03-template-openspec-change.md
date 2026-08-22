# Template OpenSpec Change

Use este arquivo como referência para criar os artefatos de uma mudança em um repositório.

## Estrutura recomendada

```text
openspec/
  specs/
    <capability>/
      spec.md
  changes/
    <change-id>/
      proposal.md
      design.md
      tasks.md
      specs/
        <capability>/
          spec.md
```

---

## `openspec/changes/<change-id>/proposal.md`

```markdown
# Proposal: <título da mudança>

## Change ID
`<change-id>`

## Status
Draft

## Context
...

## Problem
...

## Goals
- ...

## Non-Goals
- ...

## Users / Actors Impacted
- ...

## Scope
### In scope
- ...

### Out of scope
- ...

## Product Requirements Summary
- ...

## Business Rules
- ...

## Affected Capabilities
- `<capability-1>`

## Expected Impact
### Code
- ...

### Data
- ...

### APIs / Contracts
- ...

### Integrations
- ...

### Operations
- ...

### Security / Privacy
- ...

## Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|

## Success Criteria
- ...

## Assumptions
- ...

## Open Questions
- ...
```

---

## `openspec/changes/<change-id>/specs/<capability>/spec.md`

```markdown
# Delta for <capability>

## ADDED Requirements

### Requirement: <nome do requisito>
The system SHALL <comportamento obrigatório, observável e verificável>.

#### Scenario: <caminho feliz>
- GIVEN ...
- WHEN ...
- THEN ...

#### Scenario: <entrada inválida>
- GIVEN ...
- WHEN ...
- THEN ...

#### Scenario: <permissão insuficiente>
- GIVEN ...
- WHEN ...
- THEN ...

## MODIFIED Requirements

### Requirement: <nome do requisito existente>
The system SHALL <novo comportamento obrigatório>.

Previously: <comportamento anterior, se conhecido>.

#### Scenario: <cenário alterado>
- GIVEN ...
- WHEN ...
- THEN ...

## REMOVED Requirements

### Requirement: <nome do requisito removido>
Reason: ...
Migration/Compatibility: ...
```

---

## `openspec/changes/<change-id>/design.md`

```markdown
# Design: <título da mudança>

## Context
...

## Goals and Constraints
### Goals
- ...

### Constraints
- ...

## Proposed Architecture
...

## Technical Decisions
### Decision 1: <nome>
Decision: ...
Rationale: ...
Trade-offs: ...
Consequences: ...

## Alternatives Considered
### Alternative 1: <nome>
Description: ...
Why not chosen: ...

## Affected Components
| Component | Change | Reason |
|---|---|---|

## Main Flows
### Flow 1: <nome>
1. ...
2. ...
3. ...

## Error Flows
### Error Flow 1: <nome>
1. ...
2. ...
3. ...

## API / Contract Design
...

## Data Model and Persistence
...

## Authentication and Authorization
...

## Security and Privacy
...

## Observability
### Logs
- ...

### Metrics
- ...

### Tracing
- ...

### Alerts
- ...

## Testing Strategy
- Unit tests:
- Integration tests:
- Contract tests:
- E2E tests:
- Performance tests:
- Security tests:
- Manual validation:

## Migration Strategy
...

## Rollback Plan
...

## Compatibility
...

## Operational Considerations
...

## Remaining Risks
| Risk | Impact | Mitigation | Owner/Decision |
|---|---|---|---|

## Open Questions
- ...
```

---

## `openspec/changes/<change-id>/tasks.md`

```markdown
# Tasks: <título da mudança>

## 1. Discovery and setup

- [ ] 1.1 <tarefa pequena>
  - Objective: ...
  - Likely files/components: ...
  - Depends on: ...
  - Validation: manual
  - Completion criteria: ...

## 2. Contract and specs

- [ ] 2.1 <tarefa pequena>
  - Objective: ...
  - Likely files/components: ...
  - Depends on: 1.1
  - Validation: contract
  - Completion criteria: ...

## 3. Implementation

- [ ] 3.1 <tarefa pequena>
  - Objective: ...
  - Likely files/components: ...
  - Depends on: 2.1
  - Validation: unit
  - Completion criteria: ...

## 4. Validation and observability

- [ ] 4.1 <tarefa pequena>
  - Objective: ...
  - Likely files/components: ...
  - Depends on: 3.1
  - Validation: integration | observability
  - Completion criteria: ...

## 5. Rollout and rollback

- [ ] 5.1 <tarefa pequena>
  - Objective: ...
  - Likely files/components: ...
  - Depends on: 4.1
  - Validation: manual
  - Completion criteria: ...
```
