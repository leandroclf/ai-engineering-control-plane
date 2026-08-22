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
| `feat/budget-physical-reconciliation` | IMPLEMENTED | 2 novos unit tests PASS; integração adicionada | E2E real depende de o gateway fornecer attempts com pricing conhecido |
| `feat/model-catalog-routing-policy` | IMPLEMENTED | catálogo gerado + routing policy tests | Deployments secundários exigem configuração explícita de modelo, key e preço |
| `feat/scanner-bundle-offline-readiness` | IMPLEMENTED | hash/freshness unit test; Compose validado | Atualização da DB requer egress apenas no updater confiável |
| `feat/worker-profile-registry` | IMPLEMENTED | seleção polyglot e probes positivos/negativos PASS | Builds das cinco imagens serão executados com o manager efêmero |
| `feat/ephemeral-worker-manager` | IMPLEMENTED | lifecycle/cross-run/revocation unit + Docker smoke | Deployment do manager deve permanecer fora da trust boundary do agente |
| `feat/polyglot-context-parsers` | IMPLEMENTED | JS/TS/Java/Python/Go symbol/import tests | Parsers sem dependências externas priorizam fatos sintáticos deliberadamente conservadores |
| `feat/graph-retrieval-v2` | IMPLEMENTED | hop real, multi-seed e relation allowlist PASS | Relações semânticas continuam limitadas às que possuem fonte determinística |
| `feat/context-compiler-v3` | IMPLEMENTED | BM25, confiança determinística, vector condicional, memória relevante e packing token-aware | Threshold deve ser calibrado pelo benchmark pareado |
| `feat/memory-relevance-and-retention` | IMPLEMENTED | relevance + scope distance + authority, TTL de inferência e source invalidation | Promoção derivada exige confiança e continua sujeita a ator autorizado |

## Metrics

| Metric | Before | After |
|---|---:|---:|
| Node unit tests | 65 PASS | 66 PASS |
| Python unit tests | 25 PASS | NOT_EXECUTED nesta etapa |
| Behavioral OpenAPI create-run cases | 0 | 4 |
| Versioned required CI checks | 5 | 7 |
| Physical-attempt reconciliation tests | 0 | 3 |
| Fontes editáveis de model/routing/pricing | 2 | 1 |
| Fallback silencioso `strong → fast` | 1 | 0 |
| Scanners core usando configuração online automática | 2 | 0 |
| Perfis de toolchain com capability attestation | 0 | 5 |
| Implementações concretas de `WorkerManager` | 0 | 1 |
| Linguagens no Parser Registry | 1 | 5 |
| Graph distance constante/incorreta | 1 | 0 |
| Protected `main` no GitHub | NOT_MEASURED | NOT_MEASURED |

## Open risks

- O ruleset está versionado, mas o estado remoto do GitHub deve ser verificado e aplicado sem bypass.
- Scanning efetivo das imagens será fechado no workstream de CI/supply chain.
- Providers/gateways que não entregarem telemetria física completa falham fechados quando declararem attempts sem pricing.
