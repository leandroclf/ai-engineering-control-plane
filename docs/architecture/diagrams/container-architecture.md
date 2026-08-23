# Container Architecture
Purpose: show the main runtime containers and trust boundaries.
```mermaid
flowchart TB
  Browser --> BFF[Next.js BFF]
  BFF --> API[Harness HTTP API]
  API --> PG[(PostgreSQL)]
  API --> WM[Worker Manager]
  WM --> W[One worker per run]
  API --> MS[Memory Service]
  MS --> Neo[(Neo4j projection)]
```
Textual equivalent: browser access terminates at server-side BFF; only trusted services reach data and worker boundaries.
