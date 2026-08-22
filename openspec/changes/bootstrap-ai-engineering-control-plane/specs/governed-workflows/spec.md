# Delta for governed-workflows

## ADDED Requirements

### Requirement: Deterministic workflow ownership

The Harness SHALL own workflow state, transitions, budgets, retries and terminal
status independently from agent prose.

#### Scenario: Valid structured result

- GIVEN a workflow stage invokes an authorized agent
- WHEN the agent returns output valid against the required schema
- THEN the Harness SHALL select only a transition declared by the workflow.

#### Scenario: Invalid or unstructured result

- GIVEN a stage requires a versioned output schema
- WHEN the agent response does not validate
- THEN the Harness SHALL mark the stage as failed or blocked
- AND SHALL NOT infer a success transition from free-form text.

### Requirement: Governed success state

The Harness SHALL emit `READY_FOR_HUMAN_REVIEW` only after every mandatory gate
for the selected workflow has passed within budget.

#### Scenario: All mandatory gates pass

- GIVEN implementation and every required deterministic and independent review
  gate report `PASS`
- AND no budget is exceeded
- WHEN the workflow evaluates completion
- THEN its terminal state SHALL be `READY_FOR_HUMAN_REVIEW`.

#### Scenario: One mandatory gate fails

- GIVEN at least one mandatory gate is failing or unavailable
- WHEN completion is evaluated
- THEN the Harness SHALL NOT report `READY_FOR_HUMAN_REVIEW`.

### Requirement: Bounded targeted repair

The Harness SHALL limit repair by configured iterations, calls, tokens, cost,
repeated findings and evidence of diff progress.

#### Scenario: Actionable new finding

- GIVEN a gate reports a normalized actionable finding
- WHEN repair budget remains
- THEN the Harness SHALL provide the affected evidence to the repair stage
- AND rerun the originating gate before the regression gate.

#### Scenario: No progress

- GIVEN the same finding fingerprint and diff fingerprint repeat up to the
  configured threshold
- WHEN the Harness evaluates progress
- THEN it SHALL stop further automated repair
- AND route the task to human review with reason `NO_PROGRESS`.

### Requirement: Reproducible CI validation

The CI SHALL reproduce mandatory deterministic gates from a clean checkout and
SHALL NOT accept local gate results as final evidence.

#### Scenario: Local preflight passed

- GIVEN the local Harness reports `READY_FOR_HUMAN_REVIEW`
- WHEN CI evaluates the change
- THEN CI SHALL rebuild and rerun its required gates from a clean checkout.
