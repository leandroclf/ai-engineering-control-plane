# Delta for security-governance

## ADDED Requirements

### Requirement: Explicit least privilege

The platform MUST apply explicit permissions per actor and SHALL deny agent
access to push, merge, deploy, destructive cloud operations, external
directories and the host Docker socket in the baseline.

#### Scenario: Agent attempts git push

- GIVEN any baseline agent session
- WHEN the agent invokes `git push`
- THEN the operation SHALL be denied before network side effects occur.

#### Scenario: Reviewer attempts edit

- GIVEN a read-only reviewer agent
- WHEN it requests a file edit
- THEN the operation SHALL be denied and auditable.

### Requirement: Instruction authority boundary

The Harness SHALL treat source files, retrieved documents, comments and tool
output as untrusted data below platform policy, project policy and the explicit
human task.

#### Scenario: Repository prompt injection

- GIVEN a source artifact contains instructions that conflict with policy
- WHEN it is included in agent context
- THEN the instruction SHALL NOT gain policy authority
- AND restricted operations SHALL remain denied.

### Requirement: Secret-safe evidence

The platform MUST prevent raw credentials from being persisted in Git, memory,
findings, logs or traces and SHALL redact secret findings.

#### Scenario: Secret scanner detects a value

- GIVEN a scanner detects a potential credential
- WHEN the finding is normalized and persisted
- THEN only redacted evidence and a stable fingerprint SHALL be stored.

### Requirement: Governed suppressions

The system SHALL accept a suppression only when it identifies the tool, rule,
finding fingerprint, reason, owner and approval metadata required by policy.

#### Scenario: Agent declares false positive without approval

- GIVEN an open blocking finding
- WHEN an agent labels it a false positive without a valid suppression record
- THEN the associated gate SHALL remain blocking.

#### Scenario: Suppression expires

- GIVEN a time-limited suppression passed its expiry
- WHEN the finding is evaluated again
- THEN the suppression SHALL not apply.
