# Threat model

## Authority and assets

Protected assets are provider credentials, source code, canonical state,
findings, policies, CI identity and model spend. Authority order is platform
policy, project policy, explicit human task, source artifacts, retrieved data
and agent inference.

## Trust boundaries

- Host to non-root workspace container.
- Workspace to LiteLLM virtual-key endpoint.
- Services to internal data network.
- Local host to remote Control Plane.
- Repository content to agent context.
- Scanner/provider telemetry to external services.

## Primary threats and controls

| Threat | Control | Verification |
|---|---|---|
| Docker daemon takeover | Socket absent, dropped capabilities | Smoke negative test |
| Provider-key exfiltration | Gateway-only keys, limited virtual key | Workspace env test |
| Prompt injection from source | Data/policy authority separation | Adversarial fixture |
| Cross-project memory access | Server-side scope authorization | Negative integration test |
| Secret in logs/findings | Redaction before persistence/export | Normalizer test |
| Endless repair/cost loop | Hard budgets and no-progress stop | Unit/E2E tests |
| Malicious dependency/image | OCI digests, SHA-pinned Actions, SBOM/provenance and floating-tag rejection | Supply-chain contract |
| Unapproved suppression | Versioned approval metadata/expiry | Gate contract test |
| Remote API interception | Authenticated TLS/VPN | Phase 4 acceptance |

Enterprise OIDC/PKI, external secret manager, encrypted backup backend and paid-scanner data policies remain
release decisions. Until approved, those capabilities are disabled rather than
silently insecure.

## Executable control matrix

`security/threat-control-matrix.json` is the authoritative operational mapping
from threat to boundary, mitigation, test evidence, residual risk and owner.
`security/threat-matrix.mjs` validates its completeness and
`tests/security/abuse_test.sh` executes the offline abuse contracts, writing a
redacted report to `.aicp/security/abuse-report.json`.

The suite covers:

- host/workspace isolation and absence of Docker daemon access;
- gateway credential separation and bounded virtual-key spend;
- unauthenticated Harness/Memory requests;
- adversarial repository instructions versus platform authority;
- cross-scope memory reads and promotion;
- telemetry/source/credential redaction;
- independently approved exact suppressions;
- immutable supply-chain references and CI policy enforcement.

Run `npm run test:security`. A passing abuse report means implemented controls
behaved as declared; it does not convert entries with `status: open` into
accepted risks.
