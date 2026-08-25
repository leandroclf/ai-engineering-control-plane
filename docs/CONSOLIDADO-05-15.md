# AI Engineering Control Plane — consolidação coerente dos documentos 05–15

> Arquivo legado. A consolidação canônica atual dos documentos 06–15 está em
> [`CONSOLIDADO-06-15.md`](CONSOLIDADO-06-15.md). Este arquivo é preservado
> apenas para manter a proveniência da consolidação que também incluía o guia 05.

Data: 25 de agosto de 2026
Baseline de código: `origin/main` em `c3126201893882a72796f45ae29d207896254617`
Status desta consolidação: implementação parcial validada localmente; não é
declaração de certificação de produção.

Este é o documento único que organiza as decisões ainda coerentes dos arquivos
[05 — referências e metodologia](05-referencias-metodologia.md) até
[15 — des-overengineering](15-des-overengineering.md). Os arquivos numerados
continuam preservados como histórico e proveniência. Quando algum guia antigo
afirma um estado diferente do código atual, prevalecem o código, os contratos,
os testes e este documento, nessa ordem de evidência.

## 1. Síntese executiva

O AI Engineering Control Plane é uma plataforma de engenharia assistida por IA
governada por software determinístico. O Harness governa; o agente executa; o
adapter traduz. O browser, o OpenCode, Codex, Claude Code e qualquer LLM são
executores não confiáveis e não podem adquirir autoridade sobre workflow,
policy, aprovação, gates, budget, credenciais ou estado durável.

A evolução dos documentos 05–15 converge para uma decisão simples:

```text
Humano / UI / CLI
        ↓
Harness determinístico
  workflow · policy · budget · gates · context · evidence
        ↓
decisão única de routing
        ↓
launcher seguro de agente
  ├── OpenCode → LiteLLM → APIs de modelos
  ├── Codex CLI oficial (local, opt-in)
  └── Claude Code CLI oficial (local, opt-in)
        ↓
resultado estruturado e evidência redigida
```

O ciclo atual é de consolidação, segurança e validação. Não há justificativa
para adicionar outro framework, scheduler, plugin runtime, Kafka, Kubernetes,
Temporal ou uma nova plataforma de observabilidade.

## 2. Método e rastreabilidade

O documento 05 estabelece a disciplina usada aqui:

- requisitos devem ser claros, rastreáveis e verificáveis;
- comportamento observável fica separado de design técnico;
- tarefas são pequenas e verificáveis;
- ambiguidades ficam registradas como premissa, risco ou ponto aberto;
- documentos de mudança não substituem contratos canônicos sem uma decisão
  explícita.

Os documentos 06–10 formam a visão arquitetural e a evolução do Control Plane;
11–12 tratam da experiência humana, documentação, acessibilidade e console;
13 amplia o Harness com capability providers e Browser Harness; 14 separa
Agent Runtime de Model Gateway; 15 poda abstrações e define os gates desta
consolidação.

As referências externas e citações inseridas nos guias numerados são
proveniência de pesquisa, não configuração executável. Baselines de commits,
versões, quotas, termos de assinatura e status de serviços devem ser
revalidados no momento da execução.

## 3. Autoridades canônicas

| Responsabilidade | Dono | Regra |
|---|---|---|
| Workflow, lifecycle e transições | Harness / `PostgresRunStore` | agente nunca escolhe ou grava transição por conta própria |
| Policy, aprovação e autorização | Harness | conteúdo de repositório e memória LLM são dados não confiáveis |
| Quality gates | Harness + gates determinísticos/CI | falha de scanner ou gate não vira aprovação |
| Budget | `BudgetAuthority` | reserva antes da chamada, settlement/reconciliation depois |
| Quota de provider | ledger composto pelo `BudgetAuthority` | quota controla disponibilidade física; não é um orçamento paralelo |
| Routing de modelos | `harness/src/routing/routing-policy.mjs` | seleciona aliases/deployments do LiteLLM |
| Routing de runtimes | `harness/src/routing/agent-routing-policy.mjs` | seleciona adapters aprovados e registra decisão |
| Estado durável | PostgreSQL | fonte canônica para tasks, runs, stages, budget e memória |
| Projeção de relações | Neo4j opcional | reconstruível; não é autoridade |
| Cache/estado transitório | Redis | nunca decide workflow, policy ou budget |
| Execução isolada | `ExecutionPlane` / worker manager | workers são efêmeros e recebem apenas capacidade autorizada |
| Credenciais de API | LiteLLM | workers e agentes não recebem chaves físicas |
| Credenciais de CLI | CLI oficial + usuário | Harness não inspeciona auth store nem implementa OAuth vendor |
| Observabilidade/evidência | OTel + stores do Harness | prompt, source, segredo e bodies completos não são registrados por padrão |
| Console/BFF | camada de projeção humana | browser nunca acessa banco, Docker, worker manager ou provider |

Há uma distinção legítima entre routing de modelos e routing de runtimes: eles
decidem coisas diferentes e usam contratos diferentes. O que foi removido foi a
segunda autoridade dentro de `providers`, não a capacidade de tomar essas duas
decisões determinísticas em seus donos naturais.

## 4. Arquitetura implementada

### 4.1 Agent Adapter Layer

A composição efetiva está em
[`harness/src/providers/agent-runtime.mjs`](../harness/src/providers/agent-runtime.mjs).
Ela registra adapters, cria o `AgentLauncher` e conecta o routing do Harness.

O launcher responde somente por:

- executar um adapter aprovado;
- validar request, workspace e schema;
- usar argv estruturado com `shell: false`;
- aplicar ambiente allowlist;
- impor timeout, cancelamento e limite de saída;
- criar/atestar checkpoint de worktree;
- normalizar resultado, usage e erro;
- registrar evidência redigida de tentativas.

O launcher não escolhe workflow, aprova gate, define budget, possui credencial
vendor ou persiste estado de run.

Os adapters oficiais permanecem finos:

- Codex usa o executável oficial e a interface estruturada do CLI;
- Claude Code usa `claude -p` e as opções documentadas para saída estruturada;
- OpenCode preserva o caminho existente via controller e LiteLLM.

Codex e Claude Code não são modelos do LiteLLM. LiteLLM continua sendo Model
Gateway para chamadas HTTP e para o caminho OpenCode.

### 4.2 Compatibilidade sem segunda autoridade

Os consumidores internos foram migrados para os módulos canônicos e as
fachadas históricas foram removidas. Não há uma segunda autoridade para
runtime, routing, quota, telemetria ou evidência:

| Responsabilidade | Caminho efetivo |
|---|---|
| Composição e launcher | `providers/agent-runtime.mjs`, `providers/agent-launcher.mjs` |
| Routing | `routing/agent-routing-policy.mjs` |
| Quota | `budget/provider-quota-ledger.mjs` |
| Uso | `telemetry/provider-usage.mjs` |
| Evidência | `workflow/provider-execution-evidence-store.mjs` |

### 4.3 Fallback

Fallback é limitado a no máximo dois providers por decisão e somente para:

```text
PROVIDER_UNAVAILABLE
AUTH_REQUIRED
RATE_LIMITED
QUOTA_EXHAUSTED
TRANSIENT_PROVIDER_ERROR
```

Não há fallback automático para policy denial, budget exhausted, workspace
violation, invalid task, test failure, security gate failure ou cancelamento do
usuário. Cada tentativa libera ou liquida sua reserva, registra o motivo e
restaura o checkpoint antes de tentar outro provider.

### 4.4 Compose e dependências

O caminho padrão foi reduzido para 12 serviços. O profile `graph` habilita
Neo4j e o profile `admin` habilita pgAdmin e RedisInsight. Redis permanece no
default porque o LiteLLM atual declara dependência saudável dele. Não foi
adicionado nenhum serviço de fila, scheduler ou infraestrutura substituta.

Quando `AICP_GRAPH_ENABLED=false`, o Memory Service usa uma projeção nula
determinística. Quando o benchmark justificar o custo, o grafo pode ser
habilitado com `--profile graph`, sem mudar a autoridade canônica do PostgreSQL.

### 4.5 Contexto, memória e Browser Harness

Context Compiler, retrieval híbrido, provenance e limites de tokens continuam
válidos porque entregam contexto governado, determinístico e token-aware. A
seleção deve começar por símbolos exatos, arquivos alterados e lexical; vector
é condicional e precisa de evidência de ROI.

Memória é filtrada por escopo, relevância, autoridade, validade e proveniência.
Uma saída de LLM nunca se autopromove a `POLICY`. Browser Harness é um
capability provider isolado, não o núcleo da arquitetura: observa, executa,
produz evidência e passa por avaliação determinística.

### 4.6 Console e experiência humana

O Console deve expor cinco conceitos: Run, Understand, Verify, Learn e
Architecture. A experiência deve ser truth-first, evidence-first,
progressive-disclosure, keyboard-first, acessível e internacionalizável.

Estados importantes não podem depender apenas de cor; loading, vazio, erro,
conteúdo longo, foco visível e reduced motion precisam ser tratados. O Console
é projeção do Harness e não pode duplicar workflow, budget, aprovação ou
governance.

## 5. Segurança e fronteiras não negociáveis

- Nenhuma chamada LLM sem reserva válida e settlement/reconciliation posterior.
- Nenhum token OAuth, session store ou credencial vendor é lido pelo Harness.
- Não há OAuth próprio, endpoint undocumented ou transformação de assinatura em
  API HTTP compartilhada.
- CLI adapters não usam `shell:true`, executáveis arbitrários, flags de bypass
  de permissão, ambiente completo do host ou interpolação de shell.
- Conteúdo do repositório, `README`, `AGENTS.md`, código e memória não alteram
  policy, workflow, budget ou gates.
- Workspace é canonicalizado e traversal/symlink escape são negados.
- Output, runtime e número de tentativas são bounded.
- Falha de restore, scanner, policy ou security gate falha fechado.
- Push para branches protegidas, merge, force push, tags de release e
  reescrita de histórico continuam proibidos para automação.

O isolamento físico de uma CLI vendor autenticada continua uma lacuna
explicitamente `BLOCKED` até haver evidência específica de OS/vendor. Testes
fake não são promovidos a prova de segurança física.

## 6. Validação executada nesta implementação

Passaram:

```text
npm run test:providers
npm run test:architecture
bash tests/acceptance/config_test.sh
docker compose config --quiet
docker compose config --services
```

Resultado relevante:

- 27 testes de providers passaram, incluindo fallback com checkpoint,
  bloqueio de fallback por policy, parsing estruturado, limite de output,
  ambiente allowlist e quotas;
- contratos arquiteturais passaram;
- contrato de configuração passou;
- Compose padrão renderiza 12 serviços;
- `graph` e `admin` são profiles opt-in.

Ainda não foram declarados como concluídos neste turno: `npm run validate`
completo, worker E2E Docker, benchmark pareado live, certificação real de
Codex/Claude e a matriz completa de 20 ataques. Eles exigem tempo/ambiente e
alguns dependem de serviços externos ou credenciais que devem permanecer
opt-in.

## 7. Matriz de decisões

| Área | Decisão atual | Próximo gate |
|---|---|---|
| Harness authority | KEEP | manter contracts e abuse tests |
| Agent launcher/adapters | KEEP, fino | ampliar caracterização por contrato |
| Provider façade/dispatcher | REMOVED | consumidores internos usam launcher canônico |
| Agent routing | MERGE no domínio routing | adicionar cobertura de eligibility |
| Quota | MERGE sob BudgetAuthority | testar concorrência PostgreSQL e crash reconciliation |
| Provider execution evidence | KEEP como evidência, não estado | ligar consulta à API sem duplicar run state |
| LiteLLM | KEEP para model gateway | validar custo/latência em benchmark real |
| Neo4j | OPTIONAL | `ADR-009`; benchmark de grafo populado antes de alterar o default |
| Redis | KEEP no default atual | remover apenas se LiteLLM/runtime deixar de exigir |
| Memory sofisticada | KEEP + MEASURE | poisoning, autoridade e ROI |
| Browser capability | KEEP isolado | production readiness e recovery drill |
| ML routing/plugin runtime | DEFER/REJECT | só após evidência de necessidade concreta |
| Console/tutorial | KEEP como projeção | fechar i18n, a11y, UX telemetry e performance budgets |

## 8. Critério de saída

Esta consolidação só deve ser promovida a `MERGE_ELIGIBLE` quando os gates
protegidos aplicáveis terminarem com sucesso e as lacunas acima estiverem
registradas com evidência. O próximo ciclo deve priorizar:

1. executar os drills LIMITED da matriz adversarial, sem promovê-los a PASS;
2. manter `npm run validate`, os testes de worker e o benchmark estrutural como gates locais;
3. executar benchmark pareado com grafo populado antes de qualquer mudança do default;
4. obter evidência OS/vendor para credential isolation;
5. substituir o bind direto do Docker socket por proxy ou Docker rootless em deployment dedicado;
6. atualizar esta consolidação somente com resultados reproduzíveis.

Nenhuma nova componente deve entrar sem demonstrar problema concreto,
alternativa mais simples, autoridade única, benefício mensurável e estratégia
de remoção.
