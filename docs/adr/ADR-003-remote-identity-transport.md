# ADR-003: Remote identity and transport

## Status

Accepted

## Context

Disposable workspaces need canonical state from the Control Plane without
exposing databases, trusting source-controlled instructions or sharing host
volumes. Transport identity and application authorization must remain
independent so compromise or rotation of one credential does not silently grant
the other capability.

## Decision

- Remote access uses TLS 1.2 or 1.3 with mandatory client certificates over a
  private network or approved VPN. Direct public exposure is prohibited.
- The gateway is the only remotely bound service and joins only the `frontend`
  network. PostgreSQL, Redis and Neo4j remain unpublished on `data`.
- A unique client certificate identifies each workload or user. Shared client
  certificates are allowed only in the local Host B acceptance fixture.
- Bearer service tokens independently authorize operations and exact scopes at
  the Memory and Harness APIs. Wildcard scope grants are prohibited.
- The local CA is test-only. Production uses the organizational PKI, approved
  DNS/IP SANs, revocation and auditable issuance.
- Server and client leaf certificates have a 90-day maximum in the bootstrap
  fixture and rotate when less than seven days remain. The CA rotates before its
  final 30 days. Bearer tokens rotate independently after personnel, host or
  scope changes and after suspected exposure.
- Client hosts consume APIs only. They never mount or copy canonical database
  volumes. Git plus authenticated APIs are the portability boundary.

## Consequences

Remote bootstrap requires PKI/VPN ownership and certificate distribution.
Compromising a client certificate without its bearer token, or a token without
an accepted certificate, is insufficient for access. Revocation and production
secret distribution remain responsibilities of the selected infrastructure
provider; no provider-specific secret manager is embedded in the Foundation.
