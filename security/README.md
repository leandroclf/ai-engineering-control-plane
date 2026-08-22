# Security suppression governance

`suppressions.yaml` is JSON-compatible YAML and is validated in CI. Empty is
the safe default. Each suppression must contain:

- unique `id`;
- exact `tool`, `ruleId` and `sha256:<64 lowercase hex>` finding fingerprint;
- reviewable `reason` with at least 20 characters;
- accountable `owner` and independent `approval.approver`;
- `approval.approvedAt` not in the future;
- issue key such as `SEC-1234` or an HTTPS `ticket` URL;
- ISO-8601 `expiresAt` in the future.

Wildcards are rejected. Matching uses all three finding identity fields.
Expired records never suppress findings and make the policy validation fail
until removed or replaced by a newly reviewed record. Suppressed findings stay
in evidence with suppression ID, owner, approver, ticket and expiry.

```json
{
  "id": "sup-001",
  "tool": "semgrep",
  "ruleId": "javascript.security.example",
  "fingerprint": "sha256:<exact-finding-fingerprint>",
  "reason": "Reviewed false positive with documented compensating control.",
  "owner": "service-owner@example.com",
  "ticket": "SEC-1234",
  "expiresAt": "2026-12-01T00:00:00Z",
  "approval": {
    "approver": "security-reviewer@example.com",
    "approvedAt": "2026-08-21T00:00:00Z"
  }
}
```

Validate with `npm run validate:suppressions`.
