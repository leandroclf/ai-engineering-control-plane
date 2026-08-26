# Runtime Contract v1

### Requirement: runtime isolation

Agent execution MUST use a validated immutable image and MUST NOT inherit host
HOME, host SSH state, Docker socket, unauthorized native extensions or
interactive login.

### Requirement: compliance enforcement

The Harness MUST block execution when behavioral runtime compliance fails.
Evidence MUST include checks and observed image digest.

### Requirement: authentication separation

AUTH MODE MUST run without a project worktree. EXECUTION MODE MUST NOT initiate
interactive authentication. Provider credential persistence MUST remain
provider-specific and documented.
