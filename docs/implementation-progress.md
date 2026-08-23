# Implementation Progress

## Current baseline

- commit: `abba467`
- branch inicial: `main`
- branch de trabalho: `feat/govern-main-and-contracts`
- testes da baseline: 65 Node PASS; 25 Python PASS; architecture PASS; supply-chain PASS; acceptance PASS; security abuse PASS

## Ciclo AICP v1 production-certification

- branch: `feat/aicp-v1-production-certification`
- baseline HEAD: `417a4d2`
- baseline local: unit/acceptance/security/architecture/supply-chain PASS; integração PostgreSQL executada após migração dentro da rede Docker; release `V1_NOT_YET_DEFENSIBLE`
- entregue: `ExecutionPlane`, worker-backed handlers, worktree Git por run, command policy sem shell, credential broker per-run, fuse físico pessimista, OAuth access-token verifier, reconciliação de containers/worktrees, contrato de versões Context v3 e jobs CI dedicados
- evidência Docker executada: worker lifecycle direto e HTTP manager com worktree Git, criação, attestation, coleta e destruição PASS; imagem Node22 contém OpenCode 1.18.21
- bloqueios honestos: execução observada de OpenCode real + build/test/scanners no worker, ledger humano/LLM de 180 runs e findings `CRITICAL` das imagens

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
| `feat/otel-langfuse-trace-contract` | IMPLEMENTED | árvore run→stage→context/agent→gen_ai→provider attempt, redaction canary PASS | Conteúdo bruto permanece fora do contrato por padrão |
| `feat/ci-e2e-supply-chain` | IMPLEMENTED_WITH_FINDINGS | LiteLLM real + provider mock PASS; Trivy image offline + CycloneDX implementados | Findings das imagens são evidência de risco e não são suprimidos automaticamente |
| `feat/state-recovery-multihost` | IMPLEMENTED | checksum tamper fail-closed, restore clean-host e tabelas operacionais | Drill completo do ambiente ativo permanece uma operação deliberadamente não destrutiva em CI |
| `feat/ephemeral-worker-runtime-integration` | IMPLEMENTED | runtime create→evidence→destroy; cleanup em falha; manager deployment-side autenticado | Remote/team exige `AICP_EXECUTION_MODE=ephemeral`; Docker socket não entra no Harness |
| `feat/aicp-v1-benchmark` | IMPLEMENTED | protocolo 30×2×3 validado; Context v3 real: 90+90 observações | Ledger LLM/humano de 180 runs ainda não medido |
| `fix/context-packing-quality-regression` | IMPLEMENTED | tokens -2,07%; precisão +1,63 p.p.; vector use -16,67 p.p. | Resultado estrutural não substitui aceitação humana/LLM pareada |
| `chore/v1-release-contract` | IMPLEMENTED_BLOCKED | 28/30 controles com evidência; ruleset remoto ativo | Benchmark humano/LLM e findings CRITICAL impedem `V1_DEFENSIBLE` |

## Metrics

| Metric | Before | After |
|---|---:|---:|
| Node unit tests | 65 PASS | 83 PASS |
| Python unit tests | 25 PASS | 36 PASS |
| Behavioral OpenAPI create-run cases | 0 | 4 |
| Versioned required CI checks | 5 | 9 |
| Physical-attempt reconciliation tests | 0 | 3 |
| Fontes editáveis de model/routing/pricing | 2 | 1 |
| Fallback silencioso `strong → fast` | 1 | 0 |
| Scanners core usando configuração online automática | 2 | 0 |
| Perfis de toolchain com capability attestation | 0 | 5 |
| Implementações concretas de `WorkerManager` | 0 | 1 |
| Linguagens no Parser Registry | 1 | 5 |
| Graph distance constante/incorreta | 1 | 0 |
| Protected `main` no GitHub | ausente | ruleset ativo, sem bypass, 9 checks |

## Open risks

- O benchmark estrutural passou, mas o ledger LLM/humano pareado de 180 runs ainda não foi executado nem aprovado.
- Findings HIGH/CRITICAL das imagens próprias precisam de remediação ou aceitação humana independente; não foram suprimidos.
- O scan Trivy atual contabiliza 103 ocorrências `CRITICAL` em quatro imagens; a classificação por CVE/pacote/uso está em `docs/security/image-critical-classification.md`.
- Providers/gateways que não entregarem telemetria física completa falham fechados quando declararem attempts sem pricing.
- O `release/v1-contract.json` é a fonte final dos controles; nenhum agente pode transformar os bloqueios acima em PASS sem evidência externa revisável.
