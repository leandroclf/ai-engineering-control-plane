# ADR-001: Harness owns workflow authority

## Status
Accepted

## Context
Agent prose cannot provide deterministic transitions, budgets or completion.

## Decision
The Harness owns state, gates, retries and terminal status. Agents return
schema-validated results and never claim production readiness.

## Consequences
Workflows and schemas become versioned contracts; conversational orchestration
remains a user interface only.
