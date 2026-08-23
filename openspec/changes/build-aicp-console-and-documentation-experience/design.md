# Design
The browser talks only to the Next.js server. The BFF owns request correlation, server-side Harness authentication and response redaction. The Harness remains the sole workflow/budget/gate authority.
The Console workspace uses Next.js App Router, TypeScript strict, React Aria-compatible primitives, TanStack data primitives, OpenAPI-generated types, deterministic fixtures, and semantic status tokens. Governance is read-only until a separately authorized mutation contract exists.
Architecture documentation is generated from `architecture/catalog.yaml`; the release page reads the same machine-readable contract exposed by `/v1/certifications/v1` in production and the same shape in Demo Mode.
