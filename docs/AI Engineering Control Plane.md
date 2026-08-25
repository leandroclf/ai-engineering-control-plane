# AI Engineering Control Plane — consolidação canônica dos documentos 06–15

Data: 25 de agosto de 2026
Status: documento canônico de arquitetura, produto, segurança, operação e roadmap.

Este arquivo unifica as decisões coerentes dos documentos numerados 06 a 15.
Os arquivos originais permanecem no repositório como histórico e proveniência;
não devem ser usados como requisitos concorrentes. Quando houver divergência,
a ordem de autoridade é: código executável, contratos, testes, este documento,
e por último os guias históricos.

## 1. Fontes consolidadas

| Documento | Contribuição incorporada |
|---|---|
| 06 — AI Engineering Control Plane | requisitos, OpenSpec, engenharia de requisitos e metodologia |
| 07 — evolução | arquitetura, trust zones, workflow, budget, workers e gates |
| 08 — evolução | estado implementado, recuperação, observabilidade e memória |
| 09 — evolução | fronteiras do control plane, execução efêmera e reconciliação |
| 10 — evolução | estado atual, threat model, testes adversariais e runbooks |
| 11 — evolução UX | experiência, navegação, segurança e arquitetura de informação |
| 12 — evolução UX | Console, acessibilidade, documentação, onboarding e métricas |
| 13 — Browser Harness | capability providers, browser isolado e evidência |
| 14 — CLI Adapters | Agent Runtime, Model Gateway, Codex, Claude e OpenCode |
| 15 — des-overengineering | poda arquitetural, autoridades únicas, benchmarks e gates |

## 2. Síntese executiva

O AI Engineering Control Plane é uma plataforma de engenharia assistida por IA
governada por software determinístico. O Harness governa; os agentes executam;
os adapters traduzem; os workers isolam; os gates produzem evidência.

```text
Humano / Console / CLI
          ↓
Harness determinístico
  workflow · policy · budget · gates · context · evidence
          ↓
Routing de runtime e quota
          ↓
Launcher de agente
  ├── OpenCode → LiteLLM → APIs de modelos
  ├── Codex CLI oficial → Provider Host local/opt-in
  └── Claude Code CLI oficial → Provider Host local/opt-in
          ↓
Resultado estruturado + usage + evidência redigida
```

A fase atual é de consolidação e comprovação. Não há justificativa para
introduzir outro scheduler, plugin runtime, fila, framework de agentes,
Kubernetes ou nova autoridade de estado sem problema mensurável, ADR aprovado,
gate verificável e estratégia de remoção.

## 3. Autoridades e trust zones

| Responsabilidade | Autoridade canônica | Regra |
|---|---|---|
| Workflow, lifecycle e transições | Harness + `PostgresRunStore` | agente nunca escolhe nem grava transições |
| Policy, aprovação e autorização | Harness | repo e memória LLM são dados não confiáveis |
| Gates de qualidade e segurança | Harness + CI protegido | falha não vira aprovação |
| Budget | `BudgetAuthority` | reserva antes da chamada e settlement depois |
| Quota física | `budget/provider-quota-ledger.mjs` | não é orçamento paralelo |
| Routing de modelos | `routing/routing-policy.mjs` | escolhe aliases do LiteLLM |
| Routing de runtimes | `routing/agent-routing-policy.mjs` | escolhe adapters aprovados |
| Estado durável | PostgreSQL | fonte canônica para runs, budget e memória |
| Relações derivadas | Neo4j opcional | projeção reconstruível |
| Cache | Redis | efêmero; não decide workflow ou budget |
| Execução isolada | `WorkerExecutionPlane` | um worker efêmero por run |
| Credenciais de API | LiteLLM | chaves físicas não chegam aos workers |
| Credenciais de CLI | CLI oficial + usuário | Harness não lê auth store vendor |
| Observabilidade | OTel + stores do Harness | payloads sensíveis são excluídos |
| Console/BFF | projeção server-side | browser não acessa infraestrutura |

Trust zones:

- Control Plane: workflow, policy, budget, routing, API e estado canônico;
  não executa código de projeto.
- Ordinary Execution Worker: executa OpenCode, build, testes e scanners; não
  possui provider API keys físicos nem Docker socket.
- Model Gateway: LiteLLM guarda credenciais de API e controla modelos.
- Agent Provider Host: zona para CLIs oficiais, com argv estruturado, ambiente
  allowlist, timeout, output bounded, checkpoint e cancelamento.
- Console/BFF: apresentação e operação humana, sem autoridade própria.

## 4. Arquitetura implementada

### 4.1 Workflow, budget e gates

Toda chamada de agente exige reservation válida. O resultado gera settlement ou
release e reconciliação posterior. Retries e fallbacks físicos são registrados
sem transformar múltiplas tentativas em chamadas lógicas adicionais.

O Harness controla transições declaradas, outcomes válidos, gates obrigatórios,
aprovação humana e limites de iteração. Scanner ausente, pricing desconhecido,
output inválido, restore inválido ou policy denial geram falha fechada.

### 4.2 Agent Runtime e adapters

A composição está em
[`harness/src/providers/agent-runtime.mjs`](../harness/src/providers/agent-runtime.mjs)
e o limite de execução em
[`harness/src/providers/agent-launcher.mjs`](../harness/src/providers/agent-launcher.mjs).

O launcher valida request, workspace e schema; chama apenas adapters
registrados; usa argv estruturado e `shell: false`; filtra o ambiente; impõe
timeout, cancelamento e output bounded; cria e restaura checkpoint; normaliza
usage e erro; liquida quota e registra evidência.

Ele não governa workflow, gate, budget, credencial vendor ou estado durável.
Codex e Claude Code permanecem finos e opt-in; OpenCode continua no caminho
LiteLLM existente.

### 4.3 Fallback

Fallback é limitado a dois providers por decisão e só é elegível para:

```text
PROVIDER_UNAVAILABLE
AUTH_REQUIRED
RATE_LIMITED
QUOTA_EXHAUSTED
TRANSIENT_PROVIDER_ERROR
```

Não existe fallback automático para policy denial, budget exhausted, workspace
violation, output inválido, falha de segurança, cancelamento ou falha de
restore. Cada tentativa possui evidência, quota e checkpoint próprios.

### 4.4 Execução efêmera e Browser Harness

O worker-manager cria worktree e container por run, verifica identidade, imagem,
usuário não-root, rootfs read-only, capabilities removidas,
`no-new-privileges`, ausência de secrets físicos e ausência de Docker socket no
worker.

O Browser Harness é um capability provider isolado. Ele cria sessões escopadas,
não entrega credenciais ao browser, produz observações bounded e não decide
workflow ou aprovação. Browser, OpenCode e CLIs vendor são executores não
confiáveis.

### 4.5 Contexto, memória e grafo

Retrieval começa por símbolos exatos, arquivos alterados e lexical; vector é
condicional. Context Compiler é determinístico, token-aware e preserva
provenance sem persistir source bruto.

Memória é filtrada por escopo, relevância, autoridade, validade e proveniência.
Inferência de LLM nunca se autopromove a `POLICY`; promoção exige autoridade e
evidência explícitas.

Neo4j é opcional no profile Compose `graph` e
`AICP_GRAPH_ENABLED=false` é o default. O Memory Service usa
`NullGraphProjection` quando o grafo está desligado. PostgreSQL continua
canônico. A decisão está em
[`ADR-009-graph-default.md`](adr/ADR-009-graph-default.md).

### 4.6 Console e experiência

O Console expõe cinco conceitos: Run, Understand, Verify, Learn e Architecture.
A UX deve ser evidence-first, progressive disclosure, keyboard-first,
acessível e internacionalizável.

Loading, vazio, erro, foco, conteúdo longo e reduced motion precisam ser
explícitos. A interface é uma projeção do Harness e não pode duplicar workflow,
budget, aprovação ou governance.

## 5. Segurança e invariantes

- Nenhuma chamada LLM sem reservation e settlement/reconciliation.
- Nenhum token OAuth, session store ou credencial vendor é lido pelo Harness.
- Nenhuma CLI usa `shell:true`, executável arbitrário ou flag de bypass.
- Conteúdo de `README`, `AGENTS.md`, código e memória não altera autoridade.
- Traversal, symlink escape e workspace fora da raiz são negados.
- Output, duração, tentativas, PIDs e workers são bounded.
- Credential material é escopado por run, expirável e revogável.
- Run terminal não mantém worker, worktree ou credential ativo.
- Push protegido, merge, force push, tags de release e reescrita de histórico
  não são automatizados.
- Prompt, source, secrets e bodies completos não entram na telemetria padrão.

O isolamento físico de uma CLI vendor autenticada ainda exige evidência
específica de OS/vendor. Testes fake comprovam argv, ambiente, timeout e
parsing, mas não comprovam o comportamento interno da CLI oficial.

## 6. Compose e operação local

O caminho padrão possui 12 serviços. Neo4j só inicia no profile `graph`; pgAdmin
e RedisInsight só iniciam no profile `admin`. Redis permanece no default porque
o LiteLLM atual depende dele.

```bash
docker compose config --quiet
docker compose config --services
docker compose --profile graph --profile admin config --services
```

O worker-manager continua sendo deployment-side e possui acesso privilegiado ao
Docker para criar workers. O limite padrão é de 16 workers ativos por processo,
configurável por `AICP_MAX_ACTIVE_WORKERS`. Isso reduz abuso de capacidade, mas
não remove o risco estrutural do bind direto do Docker socket; proxy ou Docker
rootless é uma decisão de deployment posterior.

## 7. Validação e evidência

Gates locais:

```bash
npm run validate
npm run test:adversarial
npm run test:architecture
npm run validate:benchmark
npm run validate:docs
npm run validate:architecture-catalog
npm run validate:api-drift
npm run test:worker-e2e
```

A matriz de 20 ataques está em
[`security/adversarial-matrix.json`](../security/adversarial-matrix.json) e é
validada por `npm run test:adversarial`.

Estado da matriz em 25 de agosto de 2026:

- 17 controles `PASS`;
- 3 controles `LIMITED`: isolamento OS/vendor, drill de crash do manager e
  repositório hostil integrado;
- nenhum cenário é promovido a certificação de produção apenas por fixture.

O benchmark estrutural Context v3 executou 30 tarefas, 3 repetições e 90 pares.
O resultado em
[`context-v3-2026-08-25.md`](evaluations/context-v3-2026-08-25.md) mostrou
precisão `0,133651` → `0,245065` e redução de tokens de `2,44%`. Não há claim
de custo real, qualidade de código, defeito ou aceitação humana.

## 8. Decisões de simplificação

| Área | Decisão |
|---|---|
| Harness authority | KEEP |
| Agent launcher/adapters | KEEP, fino |
| Provider façades históricas | REMOVED |
| Routing de runtimes | MERGED no domínio `routing` |
| Quota | MERGED sob `BudgetAuthority` |
| Execution evidence | KEEP como evidência, não estado de run |
| LiteLLM | KEEP como Model Gateway |
| Neo4j | OPTIONAL, desligado por padrão |
| Redis | KEEP enquanto LiteLLM depender dele |
| Memory | KEEP + MEASURE |
| Browser capability | KEEP isolado |
| ML routing/plugin runtime | DEFER até necessidade mensurável |
| Console/tutorial | KEEP como projeção, com gates de UX |

## 9. Roadmap e critério de saída

Não adicionar componentes sem problema concreto, alternativa mais simples,
autoridade única, benefício mensurável e estratégia de remoção.

Próximos gates honestos:

1. executar os três cenários `LIMITED` em ambiente autorizado;
2. executar benchmark live com providers reais, se credenciais forem
   disponibilizadas;
3. executar benchmark pareado com grafo populado antes de alterar o default;
4. avaliar proxy/rootless Docker para substituir o bind direto do socket;
5. atualizar este documento somente com evidência reproduzível.

O projeto pode ser considerado localmente validado quando os gates locais
passam. Certificação de produção, merge e release continuam dependentes dos
gates protegidos e da evidência externa acima.
