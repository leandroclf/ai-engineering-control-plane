# Delta for platform-bootstrap

## ADDED Requirements

### Requirement: Reproducible core bootstrap

The system SHALL initialize the supported `core` profile from a clean host by
using versioned configuration and a documented bootstrap command.

#### Scenario: Clean supported host

- GIVEN Docker Engine or Desktop, Compose v2 and Git are available
- AND required model aliases and secrets are configured
- WHEN the operator executes the bootstrap command
- THEN all mandatory core services SHALL be created in dependency order
- AND the command SHALL finish with doctor and smoke evidence.

#### Scenario: Missing prerequisite

- GIVEN a mandatory host dependency or configuration is absent
- WHEN bootstrap starts
- THEN it SHALL stop before claiming success
- AND identify the missing prerequisite without exposing secret values.

### Requirement: Idempotent initialization

The system SHALL preserve valid existing secrets and durable state when
bootstrap is executed repeatedly.

#### Scenario: Bootstrap executed twice

- GIVEN the core profile is healthy and contains durable state
- WHEN the operator executes bootstrap again
- THEN existing generated secrets SHALL not be replaced
- AND durable state SHALL remain available
- AND the resulting profile SHALL remain healthy.

### Requirement: Operational diagnosis

The system SHALL provide doctor and smoke commands that report a non-zero exit
status when any mandatory verification fails.

#### Scenario: Healthy environment

- GIVEN all mandatory services are running with expected versions
- WHEN doctor and smoke are executed
- THEN each required check SHALL report `PASS`
- AND both commands SHALL exit successfully.

#### Scenario: Unhealthy service

- GIVEN one mandatory service is unavailable or has an unexpected version
- WHEN doctor is executed
- THEN the affected check SHALL report `FAIL`
- AND the command SHALL exit unsuccessfully.

### Requirement: Profile separation

The system SHALL allow the core profile to run without requiring the complete
self-hosted observability stack.

#### Scenario: Resource-constrained workstation

- GIVEN the operator selects only the core profile
- WHEN the environment starts
- THEN workspace, gateway and mandatory state services SHALL be usable
- AND Langfuse, ClickHouse and object storage SHALL not be required locally.
