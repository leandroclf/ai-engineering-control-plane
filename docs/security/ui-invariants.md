# UI Security Invariants
UI-01 Browser never receives provider credentials.
UI-02 Browser never receives internal worker-manager credentials.
UI-03 UI never mutates workflow state directly.
UI-04 UI never decides whether a gate passed.
UI-05 UI does not access PostgreSQL, Neo4j, Redis or Docker directly.
UI-06 Authorization is enforced server-side; disabled controls are not boundaries.
UI-07 Context views expose provenance by default, not arbitrary source contents.
UI-08 Demo/tutorial mode cannot mutate a production run.
UI-09 Secret-like fields never enter telemetry or client bundles.
UI-10 Destructive actions require explicit confirmation and audit evidence.
