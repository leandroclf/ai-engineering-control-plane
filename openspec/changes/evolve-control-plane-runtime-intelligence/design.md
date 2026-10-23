# Design

## Boundaries

`role-contract.mjs` produz objetos bounded e não possui chamadas de ferramenta,
transições ou budget. `GovernedContextProvider` continua sendo o ponto de
entrada do Context API e aplica progressive disclosure localmente quando o
workflow o solicita. `DockerWorkerManager` permanece o único ponto que cria o
container e bloqueia compliance.

## Authority

1. Harness policy e workflow.
2. TaskPlan/ImplementationContract de tarefa.
3. Instruções canônicas/ADRs do repositório.
4. Contexto selecionado e Skills resumidas.
5. Retrieval suplementar.

Cada item material mantém `ContextEvidence` com source, hash, prioridade e
estimativa de tokens. Duplicatas são fundidas sem remover provenance.

## Runtime

O default é `STRICT`, rootfs read-only, usuário não-root, HOME efêmero em
`/run/aicp-home`, workspace único RW, sem host HOME/SSH/socket Docker e sem
native skills/plugins/MCP auto-discovery. `network=none` é default-deny. Uma
allowlist provider-only só pode ser marcada PASS com enforcement externo e
prova comportamental.

## Authentication

O AICP chama apenas comandos oficiais por provider em AUTH MODE. O contrato não
conhece nem serializa o segredo. A matriz e as limitações ficam em
`docs/operations/provider-auth-investigation-2026-08.md`.

## Promotion

Manifests começam `UNVALIDATED`. `promote.sh` exige compliance, testes de
contrato e adversariais, obtém digest de registry e preserva o digest anterior
como rollback. Sem auth live, a promoção mantém a limitação explícita.
