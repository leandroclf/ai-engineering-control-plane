# ADR-006: Execution Plane efêmero como fronteira de produção

## Status

Accepted for implementation; production certification remains blocked until dynamic end-to-end evidence exists.

## Decision

Production runs use `WorkerExecutionPlane` through the deployment-side
`worker-manager`. The Harness may orchestrate workflow, budget, policy and
evidence, but it must not mount the project read-write or expose a Docker
socket. Project changes are isolated in a Git worktree owned by the run.

Agent, build, test and scanner operations cross the boundary only as typed
capabilities. The worker command policy validates profile, capability, tool,
argv and working directory before execution. A local execution plane remains
available only for development mode.

## Evidence and limits

Lifecycle, worktree, identity, command-policy and HTTP-manager evidence is
covered by the unit/adversarial/Docker tests listed in the v1 contract. The
contract deliberately keeps dynamic OpenCode + build/test/scanner execution
blocked until a provider-backed certification run records the corresponding
stage evidence.

## Consequences

The system has a real runtime boundary rather than only a declared worker
abstraction. Production also depends on worker image attestation, manager
reconciliation and per-run credential revocation. The additional deployment
service owns Docker access and must be independently hardened and monitored.
