# Agent Provider Certification

| Provider/control | Status | Evidence |
|---|---|---|
| OpenCode compatibility | PASS | `npm test`, `test:architecture` |
| Registry/router/quota | PASS | `npm run test:providers` |
| Codex fake CLI/parser | PASS | `npm run test:providers:integration` |
| Claude fake CLI/parser | PASS | `npm run test:providers:integration` |
| Shell/path/schema/output controls | PASS | `npm run test:providers:adversarial` |
| Shared production denial | PASS | routing adversarial test |
| Real vendor credential isolation | BLOCKED | OS/vendor sandbox evidence not available |
| Live vendor smoke | NOT_APPLICABLE | opt-in only; no credentials used |

`BLOCKED` não é promovido a `PASS`. Subscription adapters são experimentais,
local-only e não production-certified.
