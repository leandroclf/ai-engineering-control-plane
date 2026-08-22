# Remote profile validation

Validated locally on 2026-08-21 with `nginx:1.31.4-alpine3.24` and the running
Control Plane state restored from canonical PostgreSQL/Git sources.

## Evidence

- gateway ran as non-root with read-only filesystem, all capabilities dropped
  and only the isolated `agent-internal` network;
- connection without a client certificate was rejected during mTLS handling;
- an accepted Host B certificate with an invalid bearer token returned `401`;
- an accepted identity requesting `PROJECT:host-b-denied` returned `403`;
- `REPOSITORY:site-lf-solucoes` context compilation succeeded within its token
  budget through the remote API;
- the Host B `task_id` appeared in `.aicp/otel/traces.json`;
- the gateway mount contained only server key/certificate and CA certificate;
- no PostgreSQL, Redis or Neo4j port or volume was exposed to Host B.

Reproduce with `./scripts/configure-remote.sh`, the remote Compose command in
the runbook and `./scripts/remote-smoke.sh`. Generated keys and certificates are
ignored and must never be committed.
