# ADR-005: Evidence-gated AICP v1 release

## Status

Accepted

## Decision

The v1 classification is produced by `npm run release:evaluate` from a
versioned control/evidence map. A control cannot be marked PASS without a
reviewable evidence path. GitHub governance evidence must match the active
ruleset, Context v3 must be non-regressive on tokens/precision/vector use, an
absent 180-run paired LLM/human ledger fails closed, and unresolved CRITICAL
image findings block a defensible release.

No agent may change BLOCKED to PASS, create a v1 tag, merge the release PR or
approve vulnerability risk. Those transitions require human review of the raw
CI/benchmark evidence. Structural Context measurements do not substitute for
human acceptance, defect, security, cost or provider observations.

## Consequences

Implementation can be complete while the release remains
`V1_NOT_YET_DEFENSIBLE`. This is deliberate: it separates delivered controls
from release claims and prevents fixtures, missing data or self-approval from
being interpreted as production evidence.
