# Events
Lifecycle events are append-only evidence, not client commands.
`run.created`, `stage.started`, `stage.completed`, `budget.updated`, `gate.completed`, `finding.created`, `repair.started`, `run.blocked`, `run.completed`, `run.cancelled`.
Consumers must tolerate duplicate, out-of-order and reconnect delivery.
