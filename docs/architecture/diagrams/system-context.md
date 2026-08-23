# System Context
Purpose: explain AICP to every audience.
```mermaid
flowchart LR
  Human[Human] --> Console[AICP Console]
  Console --> Harness[Harness]
  Harness --> Worker[Ephemeral Worker]
  Harness --> Knowledge[Memory and Graph]
  Harness --> State[(PostgreSQL)]
  Worker --> Gateway[LiteLLM]
  Gateway --> Providers[Providers]
```
Textual equivalent: a human uses the Console; the Console calls the Harness; the Harness governs workers, knowledge and canonical state; workers call providers only through LiteLLM.
