---
title: AICP Engineering
paginate: true
theme: aicp
---
# AICP Engineering
Governed execution, evidence and human authority.
---
## Problem
Uncontrolled agents can change workflow, exceed budget, leak credentials and produce unverifiable outcomes.
---
## Authority model
Harness owns workflow, budget, authorization, gates and termination. LLMs are untrusted executors.
---
## Architecture
Console → BFF → Harness → Worker / Knowledge / PostgreSQL. Workers reach providers through LiteLLM only.
---
## Run lifecycle
Authenticate → reserve → compile context → isolate worktree → execute → reconcile → gate → human review → cleanup.
---
## Execution isolation
One run, one worktree, one ephemeral worker, one revocable workload identity.
---
## Context and memory
Exact, changed, lexical, graph and authority-filtered memory evidence fit a model-aware envelope.
---
## Budget and routing
Logical calls and physical provider attempts reconcile in PostgreSQL. Unknown pricing fails closed.
---
## Security and evidence
Scanners are deterministic. Redacted evidence explains every PASS, BLOCKED and FAILED state.
---
## Observability and recovery
OTel correlates stages and provider attempts; Langfuse remains deep LLM observability.
---
## Current release readiness
35 PASS · 3 BLOCKED · 0 FAILED. The Console makes blockers easier to inspect, not easier to hide.
---
## Extension model
Add a worker, capability, gate, policy, retriever or release control through typed contracts and tests.
---
## Closing
AI can assist engineering. Authority stays explicit, bounded and reviewable.
