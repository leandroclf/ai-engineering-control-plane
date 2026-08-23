# Build AICP Console and Documentation Experience
## Problem
AICP has a mature governed Control Plane but no human interface, learning path, documentation navigation or presentation system that exposes its evidence and current maturity honestly.
## Goal
Create the canonical human interface, deterministic Demo Mode, Academy, machine-readable architecture catalog, documentation system and presentation system without changing Harness authority.
## Non-goals
- change Harness authority or release controls;
- expose provider, worker-manager or service credentials;
- replace Langfuse;
- bypass CI, human review or production gates;
- hide current release blockers;
- turn the browser into a database or worker client.
## Acceptance
The Console builds with strict TypeScript, uses a server-side BFF, renders evidence-backed Overview/Runs/Release views, supports deterministic demo fixtures, and keeps the three current v1 blockers visible.
