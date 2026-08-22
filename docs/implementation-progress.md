# Implementation Progress

## Current baseline

- commit: `abba467`
- branch inicial: `main`
- branch de trabalho: `feat/govern-main-and-contracts`
- testes da baseline: 65 Node PASS; 25 Python PASS; architecture PASS; supply-chain PASS; acceptance PASS; security abuse PASS

## PRs

| PR/branch | Status | Tests | Risks |
|---|---|---|---|
| `feat/govern-main-and-contracts` | IMPLEMENTED | Node unit + architecture PASS | Aplicação do ruleset no GitHub depende de acesso/autorização externa |

## Metrics

| Metric | Before | After |
|---|---:|---:|
| Node unit tests | 65 PASS | 66 PASS |
| Python unit tests | 25 PASS | NOT_EXECUTED nesta etapa |
| Behavioral OpenAPI create-run cases | 0 | 4 |
| Versioned required CI checks | 5 | 7 |
| Protected `main` no GitHub | NOT_MEASURED | NOT_MEASURED |

## Open risks

- O ruleset está versionado, mas o estado remoto do GitHub deve ser verificado e aplicado sem bypass.
- Scanning efetivo das imagens será fechado no workstream de CI/supply chain.

