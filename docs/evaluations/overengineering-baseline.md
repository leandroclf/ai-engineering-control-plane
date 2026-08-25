# Baseline de overengineering — AICP

Data da medição: 25 de agosto de 2026
HEAD de `origin/main`: `c3126201893882a72796f45ae29d207896254617`
Branch de trabalho: `feat/uiux-assessment-providers`

Este arquivo registra o inventário verificável usado para a consolidação do
documento 15. O `origin/main` foi atualizado com `git fetch origin`; a branch
local não foi trocada porque continha os documentos 14 e 15 não rastreados.

## Inventário técnico

| Item | Estado observado |
|---|---|
| Implementação de providers | `harness/src/providers/` com 871 linhas em 24 módulos; a composição nova e os donos naturais foram consolidados sem fachadas de compatibilidade em produção |
| Serviços Compose padrão | 12 (`docker compose config --services`) |
| Serviços opcionais | Neo4j no profile `graph`; pgAdmin e RedisInsight no profile `admin` |
| Bancos persistentes | PostgreSQL é o estado canônico de controle, runs, budget e memória |
| Projeção derivada | Neo4j; agora desligada por padrão e reconstruível quando `AICP_GRAPH_ENABLED=true` |
| Estado efêmero/cache | Redis, usado pelo caminho atual do LiteLLM; não é autoridade de workflow ou budget |
| Filas dedicadas | Nenhum serviço de fila persistente foi encontrado no Compose; não há Kafka, SQS, RabbitMQ ou scheduler adicional |
| Dependências externas | LiteLLM/model APIs, OpenCode SDK/runtime, Docker/Compose, OpenTelemetry Collector, CLIs oficiais Codex/Claude somente local e opt-in |
| Configuração | Inventário lexical de nomes em `.env.example`, `harness/config/` e `compose.yaml`: 186 símbolos; esse número não substitui um catálogo semântico |
| Workers | `worker-manager` cria workers efêmeros e mantém a fronteira de execução; o worker não recebe credenciais físicas de provider |

## Autoridades e responsabilidades

| Conceito | Autoridade única | Evidência |
|---|---|---|
| Workflow e transições | Harness + `PostgresRunStore` | `harness/src/workflow/executor.mjs`, `harness/src/workflow/postgres-run-store.mjs` |
| Policy e autorização | Harness | `harness/src/policy/`, `harness/policies/`, gates e capabilities |
| Routing de modelos | Harness | `harness/src/routing/routing-policy.mjs` |
| Routing de runtimes | Harness | `harness/src/routing/agent-routing-policy.mjs` |
| Budget e quota física | `BudgetAuthority`, que compõe o ledger de quota | `harness/src/budget/budget-authority.mjs`, `provider-quota-ledger.mjs` |
| Execução de run | `PostgresRunStore` para estado; `ExecutionPlane` para isolamento | `harness/src/workflow/`, `harness/src/execution/` |
| Evidência de tentativa de provider | store de evidência anexado ao run | `harness/src/workflow/provider-execution-evidence-store.mjs` |
| Credenciais API | LiteLLM | secrets do serviço `litellm` no Compose |
| Sessão Codex/Claude | CLI oficial e usuário local | adapters não leem auth store, OAuth ou tokens |
| Projeção de grafo | Neo4j opcional | `AICP_GRAPH_ENABLED`, profile `graph` |
| Observabilidade | OTel/telemetria do Harness | payloads devem excluir prompt, source e segredo |

## Provider Layer antes/depois

Antes, a camada de provider mantinha dispatcher, routing policy, quota
authority, execution store, usage, health e uma façade própria, apesar de o
Harness já possuir `routing`, `budget`, `execution`, `workflow` e telemetria.

Depois, os pontos de entrada efetivos são:

```text
harness/src/providers/agent-runtime.mjs
  ├── provider-registry.mjs
  ├── agent-launcher.mjs
  └── adapters/
        ├── codex-agent-provider.mjs
        ├── claude-code-agent-provider.mjs
        └── opencode-agent-provider.mjs

harness/src/routing/agent-routing-policy.mjs
harness/src/budget/provider-quota-ledger.mjs
harness/src/telemetry/provider-usage.mjs
harness/src/workflow/provider-execution-evidence-store.mjs
```

As fachadas históricas foram removidas após a migração dos consumidores internos.
Os pontos de entrada efetivos são os módulos canônicos de runtime, routing,
budget, telemetria e evidência listados acima.

## Limites e riscos que permanecem

- A certificação de isolamento de credenciais de uma sessão vendor continua
  `BLOCKED`: os testes fake provam argv, ambiente, timeout e parsing, mas não
  provam o comportamento interno de uma CLI oficial autenticada.
- O benchmark de providers live continua opt-in; nenhum número de latência,
  custo ou sucesso real foi inventado.
- A decisão operacional do grafo foi registrada em
  `docs/adr/ADR-009-graph-default.md`: Neo4j permanece opcional e desligado
  por padrão; o ROI específico do grafo ainda não foi medido.
- `worker-manager` continua sendo um componente privilegiado de implantação e
  monta o socket Docker. Foi adicionado limite de workers ativos, mas a
  substituição do socket por proxy/rootless Docker exige uma mudança de
  deployment e não foi mascarada como resolvida.
- A matriz dos 20 cenários agora é executável em
  `security/adversarial-matrix.json`; 17 controles estão PASS e 3 permanecem
  LIMITED por ausência de prova OS/vendor ou drill de crash/repositório hostil.

## Comandos de coleta

```text
git fetch origin
git rev-parse origin/main
docker compose config --quiet
docker compose config --services
docker compose --profile graph config --services
docker compose --profile admin config --services
```
