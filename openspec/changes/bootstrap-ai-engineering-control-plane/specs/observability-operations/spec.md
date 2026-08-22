# Delta for observability-operations

## ADDED Requirements

### Requirement: End-to-end task correlation

The system SHALL propagate a task identifier across context compilation, agent
requests, model routing, tools, scanners, repair loops and gates.

#### Scenario: Completed workflow trace

- GIVEN telemetry is enabled for a workflow execution
- WHEN the task reaches a terminal state
- THEN an operator SHALL be able to correlate every mandatory stage by task ID.

### Requirement: Measurable cost and quality

The system SHALL expose enough metadata to calculate tokens, cost, latency,
fallbacks, context composition, gate outcomes and repair loops per task without
recording source code or full prompts by default.

#### Scenario: Sensitive repository telemetry

- GIVEN default sensitive-data controls are enabled
- WHEN traces are exported
- THEN operational metadata SHALL be available
- AND raw source content and full prompts SHALL be omitted unless explicitly
  authorized by policy.

### Requirement: Canonical backup and restore

The platform SHALL back up canonical state and required cryptographic gateway
state and SHALL document reconstruction of derived projections.

#### Scenario: Restore drill

- GIVEN a valid backup and repository history
- WHEN restore is executed in a supported environment
- THEN canonical PostgreSQL state SHALL be recovered
- AND Neo4j state SHALL be rebuildable
- AND health and logical acceptance checks SHALL pass.

### Requirement: Multi-host state reuse

The platform SHALL support authorized workspaces on different hosts through
service protocols and SHALL NOT require direct sharing of database volumes.

#### Scenario: New authorized host

- GIVEN remote services, network security and credentials are configured
- WHEN a workspace starts on a new host
- THEN it SHALL access authorized canonical memory and gateway services
- AND local workspace state SHALL remain disposable.

### Requirement: Observable degradation

The platform SHALL classify failures of gateway, storage, telemetry and
scanners and SHALL not report a required gate as passed when its evidence is
unavailable.

#### Scenario: Required scanner unavailable

- GIVEN policy marks a scanner gate as required
- WHEN the scanner cannot produce valid evidence
- THEN the gate SHALL report an error or block
- AND SHALL NOT be converted to `PASS`.
