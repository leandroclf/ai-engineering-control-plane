# Delta for model-gateway

## ADDED Requirements

### Requirement: Provider isolation

The system MUST route workspace model requests through the configured gateway
without making provider credentials available to the workspace or agents.

#### Scenario: Model request

- GIVEN the workspace has a limited Control Plane credential
- WHEN an authorized agent requests a configured model alias
- THEN the request SHALL be processed through the gateway
- AND the resolved provider credential SHALL remain confined to the gateway.

#### Scenario: Workspace credential inspection

- GIVEN an agent can inspect its allowed environment and filesystem
- WHEN it searches for provider credentials
- THEN no provider credential value SHALL be readable.

### Requirement: Capability aliases

The gateway SHALL expose versioned capability aliases independently from exact
provider and model identifiers.

#### Scenario: Provider replacement

- GIVEN an alias is changed to a validated provider/model deployment
- WHEN workspace configuration remains unchanged
- THEN subsequent requests to that alias SHALL use the new mapping.

### Requirement: Controlled fallback and budgets

The gateway SHALL enforce configured authentication, routing, retry, fallback
and spend controls and SHALL expose their outcomes to telemetry.

#### Scenario: Primary model unavailable

- GIVEN a validated fallback is configured and request budget remains
- WHEN the primary deployment fails with a fallback-eligible error
- THEN the gateway MAY route to the fallback
- AND SHALL record both attempted and resolved deployments.

#### Scenario: Budget exhausted

- GIVEN the applicable spend or request budget is exhausted
- WHEN a new request arrives
- THEN the gateway SHALL reject it with a classified error
- AND SHALL NOT silently bypass the budget.
