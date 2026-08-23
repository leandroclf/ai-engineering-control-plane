# Context Retrieval Cascade
Purpose: show deterministic evidence selection.
```mermaid
flowchart LR
  Query --> Exact --> Changed --> Lexical --> Graph --> Memory --> Vector
  Vector --> Envelope[Token envelope]
```
Textual equivalent: exact symbols and changed files are preferred; vector retrieval is conditional and all provenance is retained.
