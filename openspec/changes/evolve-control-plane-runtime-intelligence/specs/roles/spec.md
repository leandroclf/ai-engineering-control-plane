# Agent Roles v1

### Requirement: planner authority

Planner MUST emit TaskPlan and MUST NOT alter workflow, budget, policy or tools.

### Requirement: conditional architecture

Architect SHOULD run only for structural architecture impact or elevated risk.

### Requirement: bounded implementation

Implementer MUST consume an ImplementationContract with scope, non-goals,
constraints, tests, acceptance criteria and evidence requirements.

### Requirement: adversarial review

Reviewer MUST compare requirements, diff, tests and evidence. Findings MUST
reference all four dimensions.
