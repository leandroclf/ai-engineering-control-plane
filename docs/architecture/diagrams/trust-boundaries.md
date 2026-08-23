# Security Trust Boundaries
Purpose: make secret and execution boundaries auditable.
```mermaid
flowchart LR
  Browser -. no secrets .-> BFF
  BFF --> Harness
  Harness --> Worker
  Worker -. no provider key .-> LiteLLM
  LiteLLM --> Provider
```
Textual equivalent: provider credentials live behind LiteLLM; the browser and worker receive only scoped, non-authoritative interfaces.
