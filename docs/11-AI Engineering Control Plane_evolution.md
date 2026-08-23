# Guia definitivo de evolução UI/UX, tutorial, documentação e apresentação do AI Engineering Control Plane

A nova revisão foi feita sobre o `main` no commit **`78cc6bca5dcefa2a047aa1971f7d46712474d106`**, merge da PR de certificação de produção. Esse estado já contém uma base de Control Plane bastante mais madura: execution plane com workers efémeros, budget transacional e físico, capabilities tipadas, Context Compiler, memória persistente, graph retrieval, OpenTelemetry/Langfuse, supply-chain checks, API operacional, testes adversariais e contrato de certificação v1. fileciteturn22file0L2-L2

A conclusão desta investigação é clara:

> **A próxima grande evolução não deve ser adicionar mais infraestrutura interna. Deve ser transformar a tecnologia já existente num produto compreensível, navegável, demonstrável e utilizável.**

O AICP tem hoje uma arquitetura de backend/control plane mais madura do que a experiência humana que a expõe. Não encontrei no `main` uma aplicação web dedicada equivalente a um console de produto; o root continua centrado em Harness, Context, Memory, Graph, Compose, OpenCode, observabilidade, documentação e testes, e o `package.json` ainda contém apenas as dependências centrais de backend Node (`@opencode-ai/sdk` e `pg`). fileciteturn28file0L2-L2 fileciteturn30file0L2-L2

Portanto, o caminho que recomendo agora é construir uma camada que chamarei de **AICP Console**, acompanhada pela **AICP Academy**, uma documentação pública de referência, um catálogo arquitetural machine-readable e material de apresentação derivado da mesma fonte de verdade.

## Diagnóstico do estado atual e direção de produto

Há quatro constatações particularmente importantes.

A primeira é que o projeto já tem informação suficiente para uma excelente interface. A API atual expõe runs, stages, audit, gates, findings, execution evidence, credenciais redigidas, attestations, certificação v1, budget ledger, capabilities, workflows, policies, model aliases e provenance de contextos. Isto significa que não precisamos inventar um dashboard artificial; podemos transformar evidência real do Harness em experiência visual. fileciteturn23file0L2-L2

A segunda é que a interface **não pode ser apenas um dashboard de observabilidade**. O projeto já possui Langfuse opcional e contratos de dashboards em `observability/dashboards/`, incluindo control plane, workflow quality e context/model routing. O próprio README expõe Langfuse separadamente. fileciteturn27file0L2-L2 fileciteturn24file0L2-L2

AICP Console deve responder a uma questão diferente:

> **“O que está a acontecer com este trabalho de engenharia, quem tem autoridade, qual o orçamento, que evidências existem e por que posso ou não confiar no resultado?”**

A terceira constatação é documental. O `README.md` principal já descreve corretamente muito da plataforma atual, mas `docs/README.md` continua apresentado como **“Spec-Driven Development com OpenSpec — Pacote de Prompts”** e essencialmente indexa o estado inicial da conceção. Isto já não representa a realidade do repositório. fileciteturn24file0L2-L2 fileciteturn26file0L2-L2

A quarta é talvez a mais importante para UX: **a UI deve mostrar honestamente o estado de maturidade**. O contrato v1 atual tem muitos controlos `PASS`, mas ainda mantém três controlos `BLOCKED`: execução dinâmica real de OpenCode + build/test/scanners dentro do worker; benchmark observado de 180 runs baseline/candidate com aceitação humana; e findings `CRITICAL` nas imagens próprias ainda sem remediação/aceitação. fileciteturn25file0L2-L2

Portanto, um dashboard cheio de cartões verdes seria uma má interface.

A primeira coisa que o utilizador deve compreender é:

```text
AICP Release Readiness

PASS       35
BLOCKED     3
FAILED      0

Overall:
NOT YET V1 CERTIFIED

Blocking:
• Dynamic worker + real provider E2E
• Paired human/LLM benchmark
• Critical container-image findings
```

Isso é **truth-first UX**.

### O produto que deve emergir

Eu posicionaria o sistema como:

> **AI Engineering Control Plane — Governed execution, evidence, context, memory and observability for AI-assisted software engineering.**

E a experiência visual em quatro verbos:

```text
RUN
  executar trabalho governado

UNDERSTAND
  perceber exactamente o que aconteceu

VERIFY
  inspecionar gates, segurança e evidência

LEARN
  compreender como e por que a plataforma funciona
```

O objetivo não é criar um “chat bonito”.

É criar o equivalente a:

```text
GitHub Actions
+
LangSmith / Langfuse
+
AI Gateway
+
Security Center
+
Architecture Explorer
+
Engineering Academy
```

sob o modelo de autoridade particular do AICP.

## Referências de mercado e stack recomendada

Analisei padrões atuais de produtos próximos, não para copiar aparência, mas para identificar interações que já demonstraram utilidade.

LangSmith usa dashboards pré-construídos e customizáveis para trace count, erros, tokens e métricas, e permite filtrar runs/traces e fazer drill-down. citeturn10search1turn10search6 Braintrust organiza observabilidade em logs pesquisáveis, traces/spans, custom columns, tags e análise em tempo real. citeturn10search2turn10search9 Portkey mostra o lifecycle cronológico de pedidos como spans de trace e torna retries/fallbacks explicitamente visíveis. citeturn10search0turn10search3 Langfuse complementa isso com custo, latência, volume, qualidade, dimensões por modelo/session/release e agrupamento de múltiplos traces em sessions. citeturn8search7turn8search9

A conclusão de UX é:

```text
Overview de alto nível
        ↓
listas densas e filtráveis
        ↓
drill-down do run
        ↓
timeline/trace
        ↓
evidência exacta
```

É esse padrão que AICP deve adotar, mas com **workflow, governance, budget, context, security e certification** como conceitos de primeira classe.

### Stack que recomendo

| Camada | Escolha |
|---|---|
| Web framework | **Next.js App Router + TypeScript** |
| Design system | **shadcn/ui com React Aria base** |
| Styling | **Tailwind CSS 4 + design tokens próprios** |
| Ícones | **Lucide** |
| Server state | **TanStack Query** |
| Data tables | **TanStack Table** |
| API client | **openapi-typescript + openapi-fetch** |
| Docs | **Fumadocs** |
| Docs/API | **Fumadocs OpenAPI** |
| Grafo visual | **React Flow** |
| Charts | **Recharts/shadcn Chart para métricas agregadas** |
| Component workbench | **Storybook** |
| E2E/visual | **Playwright** |
| Accessibility | **React Aria + Storybook axe + Playwright ARIA snapshots** |
| i18n | **next-intl** |
| Diagramas versionados | **Mermaid + C4** |
| Apresentações | **Marp CLI** |

A escolha de Next.js App Router não é apenas preferência: a arquitetura atual do framework usa Server Components por defeito, permite Client Components apenas onde há interatividade, e inclui prefetching, streaming e client-side transitions. citeturn5search2turn5search4turn5search7

Também é relevante para acessibilidade: Next.js inclui route announcement em navegação client-side e integração com regras `jsx-a11y`; títulos descritivos por página continuam necessários. citeturn5search0

Para este projeto, escolheria deliberadamente **shadcn/ui sobre React Aria**, mesmo que o Base UI seja atualmente o default do shadcn. Desde julho de 2026, React Aria é uma base de primeira classe no shadcn/ui, enquanto os componentes React Spectrum/Aria são desenhados com suporte de teclado e screen reader como preocupação central. citeturn6search0turn9search1

Fumadocs encaixa particularmente bem porque integra MDX com Next.js, oferece pesquisa `Ctrl/Cmd+K`, suporta múltiplos backends de pesquisa e consegue gerar documentação/API playground directamente de um OpenAPI existente. citeturn6search1turn6search2turn6search4turn6search6

A API TypeScript da Console deve ser **gerada a partir do contrato OpenAPI**, e não mantida manualmente. `openapi-typescript` + `openapi-fetch` permitem tipar path, parâmetros, requests e responses a partir do schema, reduzindo o risco de o frontend divergir do Control Plane. citeturn13search7

Não mudaria o repositório de npm para pnpm apenas por causa da nova interface. A melhor mudança é introduzir **npm workspaces**, preservando todos os scripts actuais.

Estrutura pretendida:

```text
ai-engineering-control-plane/

├── apps/
│   └── console/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── content/
│       │   └── learn/
│       ├── lib/
│       ├── public/
│       └── tests/
│
├── packages/
│   ├── ui/
│   ├── api-client/
│   ├── architecture-catalog/
│   ├── tutorial-engine/
│   └── test-fixtures/
│
├── architecture/
│   ├── catalog.yaml
│   └── schemas/
│
├── docs/
├── presentations/
│
├── harness/
├── context/
├── memory-service/
└── ...
```

## Arquitetura da experiência e interface definitiva

A Console deve ser tratada como um **novo Human Control Plane**, nunca como nova fonte de autoridade.

A arquitetura deve continuar a respeitar a invariável já documentada: Harness controla workflow, budget, autorização, gates e lifecycle; PostgreSQL é canónico; Neo4j é uma projeção reconstruível e Redis é efémero. fileciteturn29file0L2-L2

Portanto:

```text
                          Browser
                             │
                             ▼
                    ┌────────────────┐
                    │  AICP Console  │
                    │    Next.js     │
                    └───────┬────────┘
                            │
                         BFF layer
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
          Harness API   Knowledge APIs   Docs/Search
              │             │
              │             ├── Memory
              │             └── Graph
              │
              ▼
       Control Plane
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
   Budget   Worker    Evidence
            Manager
              │
              ▼
      Ephemeral Workers
              │
           OpenCode
              │
           LiteLLM

              OpenTelemetry
                    │
                    ▼
                Langfuse
```

**Nunca:**

```text
Browser → PostgreSQL
Browser → Neo4j
Browser → Docker socket
Browser → provider credential
Browser → worker directly
```

O browser não deve receber qualquer LiteLLM/provider credential. A Console deve trabalhar com sessão/autorização própria e BFF server-side, enquanto o backend continua a impor a autorização real.

### Navegação

Eu utilizaria esta Information Architecture:

```text
AICP
│
├── Overview
│
├── Runs
│
├── Projects
│
├── Governance
│   ├── Budgets
│   ├── Workflows
│   ├── Policies
│   └── Models
│
├── Knowledge
│   ├── Context
│   ├── Memory
│   └── Graph
│
├── Security & Release
│   ├── Findings
│   ├── Attestations
│   ├── Certification
│   └── Supply Chain
│
├── Learn
│
└── Docs
```

Observability fica disponível contextualmente:

```text
Run
  → View complete trace in Langfuse
```

em vez de duplicarmos todo Langfuse dentro da Console.

### Overview

A home deve responder em menos de dez segundos:

```text
Is the platform healthy?
Is the release certified?
What is running?
What is failing?
How much are we spending?
Where is human attention required?
```

Layout:

```text
┌────────────────────────────────────────────────────────────────┐
│ AICP                                     Ready ●   v1 BLOCKED   │
├────────────────────────────────────────────────────────────────┤
│ Release readiness                                              │
│ 35 PASS     3 BLOCKED     0 FAILED                             │
├────────────────┬────────────────┬──────────────────────────────┤
│ Active Runs    │ Budget today   │ Security                     │
│ 4              │ $12.42         │ 3 blockers                   │
├────────────────┴────────────────┴──────────────────────────────┤
│ Recent Runs                                                    │
│                                                                │
│ Status │ Project │ Stage │ Cost │ Tokens │ Duration │ Action   │
├────────────────────────────────────────────────────────────────┤
│ Workflow quality          │ Context efficiency                 │
│ first-pass / repairs      │ retrieved / used / vector-skipped  │
└────────────────────────────────────────────────────────────────┘
```

O **release status** deve aparecer antes de vanity metrics porque actualmente há três blockers reais. fileciteturn25file0L2-L2

### Runs

Este será provavelmente o ecrã mais utilizado.

```text
/runs
```

Filtros:

```text
project
status
workflow
stage
model
date
security finding
budget state
human review state
```

A tabela deve suportar URL-state, para que um filtro possa ser partilhado:

```text
/runs?project=foo&status=failed
```

TanStack Table é adequado para sorting/filtering/table state, e TanStack Virtual deve ser introduzido apenas quando o número real de linhas justificar virtualização; a própria documentação recomenda server-side operations para datasets demasiado grandes para o browser. citeturn13search1

### Run Detail

Este deve tornar-se o ecrã “hero” do projeto.

```text
RUN #8FD2A7

Feature: Add retry policy
Project: payments-api
Status: HUMAN REVIEW
Started: ...
Duration: ...
```

A primeira visualização:

```text
Discover
   ✓
Plan
   ✓
Implement
   ✓
Fast Verify
   ✓
Full Verify
   ✓
Security
   !
Targeted Repair
   ✓
Security
   ✓
Code Review
   ✓
Architecture
   ✓
Human Review
   ●
```

Depois:

```text
Overview
Evidence
Gates
Security
Budget
Context
Execution
Audit
```

**Budget** deve mostrar:

```text
Calls
████████████░░░░  7 / 10

Input tokens
██████████░░░░░░  42k / 64k

Output tokens
██████░░░░░░░░░░  8k / 20k

Cost
█████████░░░░░░░  $1.64 / $3.00

Physical attempts
primary → failed
fallback → succeeded
```

**Context**:

```text
Context ID
Retrieval policy
Token envelope

Sources

1 exact symbol        PaymentService.retry()
2 graph hop           PaymentService → NotificationClient
3 lexical             RetryPolicy
4 memory              ADR-014
5 vector              timeout semantics

Raw source persisted?
NO
```

Isso aproveita directamente o contrato actual que já expõe context provenance sem raw source. fileciteturn23file0L2-L2

**Evidence** deve tratar qualquer estado como verificável:

```text
PASS
   ↓
why?
   ↓
evidence
   ↓
source artifact
```

Esse padrão distingue AICP de um dashboard genérico.

### New Run

Criaria um wizard curto:

```text
Project
   ↓
Task
   ↓
Execution profile
   ↓
Budget
   ↓
Review
   ↓
Run
```

Com defaults inteligentes.

Não exponha vinte opções num único formulário.

A primeira experiência deve poder ser:

```text
Project:     payments
Task:        Implement idempotent retry
Workflow:    Recommended
Budget:      Recommended
Worker:      Auto
Model route: Auto

[ Start governed run ]
```

Opções avançadas ficam atrás de:

```text
Advanced settings
```

### Governance

Aqui entram:

```text
Workflows
Policies
Model aliases
Budget policies
Capabilities
```

Inicialmente eu faria a maior parte **read-only**.

Uma UI de governance que altera policies demasiado cedo aumenta muito a superfície de risco.

### Knowledge

Este é um grande diferenciador visual.

React Flow é apropriado para o explorer porque já fornece panning, zoom, minimap, controls e navegação em node-based UIs. citeturn7search6turn7search10

Mas não mostre:

```text
10.000 nós
```

só porque o Neo4j consegue.

O UX deve começar por:

```text
Search:
PaymentService

       RetryPolicy
           ↑
NotificationController
           │
           ▼
      PaymentService
        /         \
       ▼           ▼
 Repository   NotificationClient
```

e expandir sob pedido.

### Design language

Eu evitaria a estética habitual de “AI startup” com gradientes excessivos e animações decorativas.

AICP pede:

```text
neutral
technical
trustworthy
dense when necessary
calm
evidence-first
```

Características:

```text
light + dark
high contrast
semantic status colours
status never communicated by colour alone
monospace only for code/IDs
comfortable / compact density
strong typography hierarchy
consistent empty states
consistent loading skeletons
zero layout jumps
reduced-motion support
keyboard first
```

O standard de acessibilidade deverá ser **WCAG 2.2 AA**; WCAG 2.2 é actualmente uma W3C Recommendation e também foi aprovada como ISO/IEC 40500:2025. citeturn5search5turn5search12

## Tutorial interactivo e sistema de documentação

Aqui recomendo não criar simplesmente “um tour com dez tooltips”.

Criaria a **AICP Academy**.

Ela deve ter três níveis.

**Quick Tour — cinco minutos**

```text
What is AICP?
↓
Release status
↓
Run lifecycle
↓
Budget
↓
Evidence
↓
Context
↓
Security
```

**Guided Learning — cerca de uma hora**

```text
Foundations
Governance
Execution Plane
Context Engineering
Memory
Graph Retrieval
Model Routing
Security
Observability
Release Certification
```

**Deep Engineering**

```text
Extend a worker
Add a new stack
Add a capability
Add a scanner
Add a workflow
Add a policy
Add context retrieval
Extend memory
Add telemetry
Create a release control
```

### Demo Mode

Isto é obrigatório.

Um novo utilizador não deve precisar de:

```text
OpenAI key
Anthropic key
Gemini key
real repository
real spending
```

para perceber o produto.

Criaria:

```text
/demo
```

com dados realistas e determinísticos.

Por exemplo:

```text
Demo Project
     │
     ▼
Run created
     │
     ▼
Plan
     │
     ▼
Implementation
     │
     ▼
Unit test fails
     │
     ▼
Targeted repair
     │
     ▼
Security gate
     │
     ▼
Human review
```

Este run pode ser avançado passo a passo:

```text
[ Next event ]
```

permitindo que a pessoa “veja” o Control Plane a funcionar sem modelo real.

### Tutorial engine

Eu não tornaria uma biblioteca de product tours a autoridade do tutorial.

Criaria:

```text
packages/tutorial-engine/
```

com um manifesto declarativo:

```yaml
id: first-governed-run
version: 1

steps:
  - route: /
    target: release-readiness
    title: Release readiness

  - route: /runs/demo-run
    target: workflow-timeline
    title: Governed workflow

  - route: /runs/demo-run
    target: budget
    title: Bounded execution
```

O renderer usa os componentes React Aria/shadcn da própria aplicação.

Assim temos:

```text
Back
Next
Skip
Resume
Restart
```

com teclado e screen reader correctamente integrados.

### Interactive Architecture Explorer

Esta será provavelmente a peça mais interessante para apresentações.

```text
                    Human
                      │
                      ▼
                   Console
                      │
                      ▼
                   Harness
             ┌────────┼────────┐
             ▼        ▼        ▼
          Budget   Context   Worker
                      │        │
                      ▼        ▼
                   Memory   OpenCode
                      │        │
                   Neo4j    LiteLLM
                               │
                      ┌────────┼───────┐
                      ▼        ▼       ▼
                   OpenAI  Anthropic Gemini
```

Ao seleccionar `Harness`:

```text
HARNESS

Plane:
Control Plane

Why it exists:
Prevents the model from owning authority.

Owns:
workflow
budget
gates
termination

Does not own:
provider secrets
repository source-of-truth

Depends on:
PostgreSQL
Worker Manager
Context Service

Failure behaviour:
Fail closed

Security boundary:
Trusted
```

É aqui que o catálogo de componentes passa a ter enorme valor.

### Documentação

Fumadocs consegue integrar-se com Next.js/MDX e gerar páginas de API a partir do OpenAPI, incluindo endpoint information, request fields, response types, exemplos e playground interactivo. citeturn6search1turn6search6

A documentação pública deveria ficar organizada assim:

```text
docs/

├── README.md
│
├── getting-started/
│   ├── introduction.md
│   ├── quickstart.md
│   ├── first-run.md
│   └── demo-mode.md
│
├── concepts/
│   ├── authority.md
│   ├── governed-execution.md
│   ├── bounded-ai.md
│   ├── evidence.md
│   ├── context.md
│   └── memory.md
│
├── architecture/
│   ├── current.md
│   ├── system-context.md
│   ├── control-plane.md
│   ├── execution-plane.md
│   ├── knowledge-plane.md
│   ├── deployment.md
│   └── component-catalog.md
│
├── guides/
│   ├── new-project.md
│   ├── add-worker.md
│   ├── add-stack.md
│   ├── add-model.md
│   ├── add-policy.md
│   ├── add-gate.md
│   └── add-retriever.md
│
├── security/
│
├── operations/
│
├── observability/
│
├── evaluations/
│
├── reference/
│   ├── configuration.md
│   ├── environment.md
│   ├── components.md
│   ├── workflows.md
│   ├── events.md
│   └── glossary.md
│
├── api/
│
├── contributing/
│
└── archive/
    └── evolution/
```

Os actuais documentos históricos `06`, `07`, `08`, `09`, `10` devem ser preservados, mas classificados como **evolution history**, e não misturados com a documentação normativa.

`docs/README.md` precisa ser completamente substituído; o conteúdo actual não representa mais o sistema. fileciteturn26file0L2-L2

### Documentação para GitHub

O `README.md` de topo deve ficar muito mais visual.

Ordem:

```text
Hero
Status
Screenshot
Why AICP?
Core guarantees
60-second quickstart
Architecture
How a run works
UI screenshots
Security model
Context & memory
Observability
Tutorial
Documentation
Release status
Roadmap
Contributing
License
```

Não colocaria 200 linhas de comandos antes de o leitor compreender por que o projeto existe.

Para alcance global, manteria:

```text
README.md        → English
README.pt-PT.md  → Português
```

A aplicação deve já nascer internacionalizável. `next-intl` suporta App Router/Server Components, formatação locale-aware e routing internacionalizado. citeturn13search0

## Gráficos, catálogo dos componentes e material de apresentação

Para elevar o projeto à categoria de referência, a documentação arquitectural deve deixar de depender apenas de diagramas escritos manualmente.

Criaria:

```text
architecture/catalog.yaml
```

como fonte machine-readable.

Exemplo:

```yaml
components:
  - id: harness

    name: Harness

    plane: control

    purpose:
      Own deterministic engineering authority.

    owns:
      - workflow
      - budgets
      - gates
      - termination

    doesNotOwn:
      - provider-credentials
      - source-control-authority

    state:
      canonical: postgres

    dependencies:
      - postgres
      - worker-manager
      - context-service

    failureMode:
      fail-closed

    trust:
      trusted-control-plane

    docs:
      /docs/architecture/control-plane
```

A partir disso deve ser possível gerar:

```text
documentation tables
architecture explorer nodes
diagram metadata
component cards
tutorial explanations
presentation content references
```

Isso reduz drift documental.

### Motivo e benefício dos componentes actuais

A tabela abaixo representa a leitura arquitectural recomendada sobre os componentes que já fazem parte do sistema actual. A existência e as responsabilidades fundamentais de Harness, WorkerExecutionPlane, PostgreSQL, Neo4j, Redis, OpenCode, LiteLLM e Context Compiler estão documentadas no repositório. fileciteturn24file0L2-L2 fileciteturn29file0L2-L2

| Componente | Por que existe | Principal benefício |
|---|---|---|
| **AICP Console** | Criar interface humana unificada | Compreensão, operação e confiança |
| **Harness** | Separar inteligência de autoridade | LLM não controla workflow/gates/budget |
| **Worker Manager** | Controlar lifecycle físico | Isolamento e cleanup |
| **Ephemeral Worker** | Executar um run num ambiente descartável | Redução de blast radius |
| **Git Worktree** | Isolar alterações por execução | Reprodutibilidade e diff claro |
| **OpenCode** | Executar trabalho agentic | Interface entre agente e ferramentas |
| **LiteLLM** | Abstrair e governar providers | Routing, fallback, custos e isolamento |
| **PostgreSQL** | Estado transaccional canónico | Consistência e recovery |
| **Redis** | Estado/cache efémero | Baixa latência sem virar source of truth |
| **Memory Service** | Persistir conhecimento com scopes | Continuidade entre sessões/projetos |
| **Context Compiler** | Seleccionar contexto dentro de budget | Economia de tokens e precisão |
| **Neo4j** | Representar relações | Retrieval estrutural/impact analysis |
| **Parsers/Indexer** | Extrair estrutura sem LLM | Menor custo e maior determinismo |
| **Security Scanners** | Validar deterministamente | Segurança não depende de opinião do LLM |
| **OpenTelemetry** | Correlacionar execução distribuída | Portabilidade de telemetry |
| **Langfuse** | Analisar LLM traces/custo/qualidade | Observabilidade especializada |
| **Release Contract** | Expressar readiness em máquina | Evitar declarações subjetivas |
| **CI** | Autoridade determinística externa | Não confiar no ambiente do agente |
| **Human Review** | Decisão final | Accountability |
| **AICP Academy** | Ensinar o modelo mental | Adoção e onboarding |

### Diagramas obrigatórios

Adotaria o modelo C4 para arquitectura estática: System Context para toda a audiência, Container para a forma de alto nível do sistema, e Deployment para explicar Docker/workers/serviços. O próprio C4 recomenda Context e Container como os níveis suficientes para a maioria das equipas, enquanto Deployment representa a instalação física da solução. citeturn14search9turn14search10turn14search11

Criaria pelo menos:

```text
System Context
Container Architecture
Deployment - Local
Deployment - Shared Control Plane
Control / Execution / Knowledge Planes
Governed Run Sequence
Worker Lifecycle
Budget Reservation/Reconciliation
Context Retrieval Cascade
Memory Lifecycle
Graph Retrieval
Model Routing/Fallback
Security Trust Boundaries
Telemetry Trace Hierarchy
Backup/Restore
Release Certification
```

Manteria a fonte estática em Mermaid porque GitHub renderiza Mermaid directamente em ficheiros Markdown, issues, discussions e PRs. citeturn14search0turn14search1

Mas há um detalhe importante: a própria documentação GitHub alerta que nem todos os gráficos Mermaid são acessíveis para screen readers. Portanto **cada diagrama terá obrigatoriamente uma descrição textual equivalente**. citeturn14search19

### Apresentações

Criaria três decks diferentes, não um PowerPoint que tenta servir toda a gente.

```text
presentations/

├── engineering/
│   └── aicp-engineering.md
│
├── users/
│   └── aicp-user-guide.md
│
├── executive/
│   └── aicp-executive.md
│
└── theme/
    └── aicp.css
```

**Engineering deck**

Aproximadamente 25 slides:

```text
Problem
Principles
Authority model
Architecture
Run lifecycle
Execution isolation
Context
Memory
Graph
Routing
Budget
Security
Observability
Recovery
Release evidence
Extension model
Roadmap
```

**User deck**

Aproximadamente 12 slides:

```text
What AICP does
Start a run
Understand status
Read budget
Understand gates
Security findings
Human review
Where to find evidence
Tutorial
```

**Executive deck**

Aproximadamente 8–10 slides:

```text
Problem
Why uncontrolled agents are risky
AICP proposition
Governance model
Architecture at one glance
Evidence & security
Economics / evaluation strategy
Current v1 readiness
Roadmap
```

Marp é particularmente conveniente aqui porque a fonte continua Markdown e a CLI oficial consegue converter para HTML, PDF, PowerPoint e imagens. citeturn12search0turn12search1

## Qualidade, segurança e métricas para uma UI de referência

A interface deve herdar a filosofia do backend:

> **A UI também precisa de gates determinísticos.**

### Pirâmide de testes

```text
                     Manual UX
                    /         \
             Screen reader   usability

                 E2E Playwright

          Visual + ARIA snapshots

       Component behaviour / Storybook

        axe automated accessibility

             TypeScript

          OpenAPI contract

           unit tests
```

Playwright permite manter visual screenshot baselines e comparar futuras execuções, e também oferece ARIA snapshots da accessibility tree. citeturn9search0turn8search4

Storybook deve ser usado como laboratório do design system. O seu addon oficial de acessibilidade utiliza axe-core e pode transformar violações em falhas de CI; é importante não confundir isso com cobertura completa, já que a própria Storybook indica que a automação encontra até cerca de 57% dos problemas WCAG, deixando revisão manual indispensável. citeturn8search0

### Quality gates novos

O CI deve ganhar:

```text
ui-typecheck
ui-lint
ui-unit
ui-components
ui-a11y
ui-e2e
ui-visual
ui-openapi-drift
docs-links
docs-frontmatter
docs-diagrams
docs-search-index
presentation-build
architecture-catalog
```

E nenhum desses checks deve substituir os checks já existentes de:

```text
architecture-contracts
adversarial-certification
budget-adversarial
execution-plane-e2e
multistack-matrix
security
release
```

O commit actual já tornou vários destes checks parte da branch governance, incluindo adversarial certification, budget adversarial, execution-plane E2E e multistack matrix. fileciteturn22file0L2-L2

### Metas de UX iniciais

Estas são **metas propostas**, não medições actuais:

| Métrica | Meta inicial |
|---|---:|
| Core workflows acessíveis apenas por teclado | 100% |
| Axe critical/serious | 0 |
| Core pages com ARIA snapshots | 100% |
| Core pages com visual regression | 100% |
| UI API calls manualmente tipadas | 0 |
| Broken internal documentation links | 0 |
| Componentes sem Storybook quando reutilizáveis | 0 |
| Critical status dependent only on colour | 0 |
| Navegação até evidência de um run | ≤ 3 interações |
| Docs search zero-result para benchmark vocabulary | < 5% |
| First-run usability completion | ≥ 90% |
| Tutorial completion em teste de onboarding | ≥ 80% |

Para performance de produção, medir Core Web Vitals em vez de apenas tempo de build; a metodologia recomenda avaliar experiência real no percentil 75, e as métricas centrais cobrem loading, responsiveness e visual stability. citeturn7search5turn7search17

### Segurança da UI

Há algumas invariantes que eu colocaria explicitamente em `docs/security/ui-invariants.md`:

```text
UI-01
Browser never receives provider credentials.

UI-02
Browser never receives internal worker-manager token.

UI-03
UI never mutates workflow state directly.

UI-04
UI never decides whether a gate passed.

UI-05
UI does not access databases directly.

UI-06
Authorization is enforced server-side.

UI-07
Client-side disabled controls are not security boundaries.

UI-08
Context views expose provenance by default, not arbitrary source contents.

UI-09
Secret-like fields are never placed in telemetry.

UI-10
Demo/tutorial mode can never mutate a production run.

UI-11
External links to traces/evidence are permission-aware.

UI-12
Any destructive action requires explicit confirmation and audit evidence.
```

### Não substituir Langfuse

Langfuse já oferece dashboards, metrics API, sessões e análise por qualidade/custo/latência/model/release. citeturn8search7turn8search8turn8search9

Portanto:

```text
AICP Console
=
engineering governance UX

Langfuse
=
deep LLM observability
```

Um Run Detail deveria ter:

```text
[ Open correlated trace in Langfuse ↗ ]
```

e não recriar toda a ferramenta.

## Guia completo de execução para o agente

Este é o caminho que eu seguiria no repositório. A ordem é importante: **não comece pelo visual**. Comece pelos contratos que permitem construir a UI sem comprometer as invariantes actuais.

### Baseline e mudança OpenSpec

Antes de alterar código:

```text
1. Ler AGENTS.md.
2. Ler architecture/current.md.
3. Ler security/invariants.md.
4. Ler release/v1-contract.json.
5. Ler control-plane-v1.openapi.yaml.
6. Ler README.md e docs/README.md.
7. Ler os evolution guides apenas como histórico.
8. Criar um novo OpenSpec change:
   build-aicp-console-and-documentation-experience
```

O `proposal.md` deve declarar:

```text
Problem:
AICP possui uma forte implementação de Control Plane mas não possui
uma human interface equivalente à maturidade do backend.

Goal:
Create the canonical human interface, learning experience,
documentation system and presentation system for AICP.

Non-goals:
- change Harness authority
- expose provider credentials
- replace Langfuse
- bypass CI
- hide current release blockers
```

### Formalizar o contrato de produto

Criar:

```text
docs/product/
  product-vision.md
  personas.md
  information-architecture.md
  ux-principles.md
  terminology.md
```

Personas:

```text
Developer
Platform Engineer
Security Engineer
Engineering Manager
Executive / Technical Leader
Contributor
```

Princípios:

```text
truth-first
evidence-first
progressive disclosure
keyboard-first
fail-closed UX
no hidden authority
no status without evidence
no metric without definition
```

### Criar o monorepo web sem perturbar o runtime actual

Alterar root `package.json` para workspaces, mas preservar todos os scripts existentes.

Adicionar:

```text
apps/console
packages/ui
packages/api-client
packages/tutorial-engine
packages/architecture-catalog
packages/test-fixtures
```

Não migrar de npm.

Não mover Harness/context/memory durante esta fase.

### Construir o Design System

Em `packages/ui`:

```text
Button
IconButton
Link
Badge
StatusBadge
Card
MetricCard
Table
Tabs
Dialog
Popover
Tooltip
CommandPalette
Breadcrumb
Sidebar
TopNav
EmptyState
ErrorState
Skeleton
Progress
BudgetMeter
Timeline
EvidenceLink
FindingBadge
CodeBlock
CopyButton
Definition
```

Semantic statuses:

```text
neutral
running
success
warning
blocked
failed
cancelled
human-required
```

Um estado nunca poderá depender apenas da cor.

Criar Storybook desde o início.

Criar todos os componentes em:

```text
default
hover
focus
disabled
loading
error
dark
high contrast
small viewport
long text
```

### Fortalecer OpenAPI antes da Console consumir a API

Este é um P0 importante descoberto na revisão.

Embora a API actual tenha uma superfície operacional bastante boa, muitas responses do OpenAPI apenas possuem:

```yaml
'200':
  description: Runs
```

sem schema do response body. fileciteturn23file0L2-L2

Antes de gerar o frontend client, adicionar schemas explícitos para:

```text
RunSummary
RunDetail
RunPage

RunStage

GateResult
Finding

ExecutionEvidence
CredentialMetadata
Attestation

Certification
CertificationControl

Task
Budget
BudgetEvent

Capability
WorkflowDescriptor
PolicyDescriptor
ModelAlias

ContextProvenance

ApiError
Pagination
```

Depois:

```text
docs/api/control-plane-v1.openapi.yaml
        │
        ▼
openapi-typescript
        │
        ▼
packages/api-client/generated
```

E CI:

```text
npm run generate:api
git diff --exit-code
```

### Adicionar APIs específicas da experiência

Não transformar a Console numa aplicação que faz vinte pedidos para montar a Home.

Adicionar read models governados:

```text
GET /v1/overview
GET /v1/system/status
GET /v1/me
GET /v1/projects
GET /v1/projects/{projectId}
```

Adicionar event stream:

```text
GET /v1/runs/{runId}/events
Content-Type: text/event-stream
```

SSE é suficiente para o lifecycle; não há necessidade arquitectural de WebSocket bidireccional neste momento.

O stream pode transportar:

```text
run.created
stage.started
stage.completed
budget.updated
gate.completed
finding.created
repair.started
run.blocked
run.completed
run.cancelled
```

`/v1/me` deve retornar:

```json
{
  "actor": "...",
  "roles": [],
  "capabilities": []
}
```

A UI pode usar isso para apresentar a experiência, mas **o backend continua a autorizar todas as operações**.

### Criar o BFF da Console

No Next.js:

```text
browser
   ↓
Next.js BFF
   ↓
Harness
```

Utilizar:

```text
server-only modules
secure session cookie
CSRF protection on mutations
CSP
security headers
request correlation
```

Não introduzir:

```text
NEXT_PUBLIC_HARNESS_TOKEN
NEXT_PUBLIC_LITELLM_KEY
NEXT_PUBLIC_MEMORY_TOKEN
```

Nunca.

### Implementar a navegação e shell

Entregar primeiro:

```text
sidebar
topbar
breadcrumbs
command palette
locale switcher
theme switcher
global status
user menu
```

Adicionar `Cmd/Ctrl+K` para:

```text
Navigate to Runs
Navigate to Projects
Navigate to Security
Search documentation
Open run by ID
Start New Run
```

### Implementar Overview

Consumir `/v1/overview`.

Entregar:

```text
system readiness
release readiness
active runs
requires-attention
budget consumption
security blockers
workflow quality
context efficiency
recent runs
```

Todo cartão deve ter drill-down.

Não produzir métricas inventadas.

Quando não há dados:

```text
No observed data yet
```

e não:

```text
0% defects
```

### Implementar Runs

`/runs`:

```text
server pagination
filters
sorting
URL state
saved display columns
keyboard navigation
empty states
error recovery
```

`/runs/[runId]`:

```text
workflow timeline
overview
evidence
gates
security
budget
context
execution
attestations
audit
Langfuse link
```

Este deve ser o primeiro ecrã considerado **product-complete**.

### Implementar New Run

Wizard:

```text
Project
Task
Recommended defaults
Advanced configuration
Review
Start
```

Use o schema OpenAPI para validation.

Mostrar estimativa/default budget antes do submit, mas nunca prometer custo real.

Depois do submit:

```text
redirect → /runs/{runId}
```

### Implementar Security & Release

Criar:

```text
/security
/release
```

A página de Release deve ser directamente alimentada por:

```text
GET /v1/certifications/v1
```

e deve reflectir o contrato machine-readable real. O contrato actual possui os três blockers descritos anteriormente; a UI deve torná-los imediatamente visíveis. fileciteturn25file0L2-L2

Cada controlo:

```text
ID
Status
Explanation
Evidence
Last verified
```

### Implementar Governance

Criar:

```text
/governance/workflows
/governance/policies
/governance/models
/governance/capabilities
/governance/budgets
```

Manter read-only no primeiro ciclo, excepto operações já explicitamente permitidas pela API actual.

### Implementar Knowledge

Adicionar API governada/read-only para:

```text
memory metadata
graph neighbourhood
project index status
```

Não permita que a Console faça queries Cypher arbitrárias.

Não permita SQL.

Não permita raw source retrieval indiscriminado.

A UI de grafo recebe um DTO:

```json
{
  "nodes": [],
  "edges": [],
  "query": {},
  "truncated": true
}
```

com hard limits server-side.

### Criar Architecture Catalog

Adicionar:

```text
architecture/catalog.yaml
architecture/catalog.schema.json
```

Registar todos os componentes.

Criar validator:

```text
npm run validate:architecture-catalog
```

Criar generator:

```text
npm run generate:architecture-docs
```

Cada componente deve declarar:

```text
id
name
plane
purpose
why
benefits
authority
owns
doesNotOwn
state
dataSensitivity
dependencies
interfaces
failureMode
securityBoundary
observability
docs
```

### Criar o Interactive Architecture Explorer

Usar React Flow.

Permitir:

```text
filter by plane
filter by trust
filter by state ownership
search components
fit view
zoom
focus component
show dependencies
show data flow
show authority
```

Três presets:

```text
Executive
Engineering
Security
```

**Executive**

```text
Developer
Console
Control Plane
Execution
Providers
Data
```

**Engineering**

todos os principais componentes.

**Security**

```text
trust boundaries
credentials
network boundaries
canonical state
worker isolation
```

### Criar AICP Academy

Implementar:

```text
/learn
/learn/getting-started
/learn/architecture
/learn/governance
/learn/context
/learn/security
/learn/observability
```

Criar módulos:

```text
Foundations
First Governed Run
Authority Model
Execution Plane
Budgets
Context Compiler
Memory
Knowledge Graph
Model Routing
Security
Observability
Release Certification
Extending AICP
```

Cada módulo deve possuir:

```text
concept
interactive demo
diagram
checkpoint
links to deeper docs
```

### Criar Demo Mode

Adicionar fixtures versionadas:

```text
packages/test-fixtures/demo/
```

e:

```text
/demo
```

Nenhum provider real.

Nenhum gasto.

Nenhuma mutação real.

A demo deve simular:

```text
successful run
repair run
budget exhaustion
security blocked run
human review run
provider fallback
```

Esses cenários também servem para:

```text
Storybook
E2E
screenshots
README
presentations
tutorial
```

Isto é particularmente poderoso porque evita criar cinco fontes de fixture diferentes.

### Reconstruir documentação

Substituir `docs/README.md`.

Reorganizar documentação conforme a estrutura proposta.

Mover guias evolutivos anteriores para:

```text
docs/archive/evolution/
```

sem apagar histórico.

Criar:

```text
docs/reference/component-catalog.md
docs/reference/glossary.md
docs/reference/events.md
docs/reference/configuration.md
```

Criar uma página “Why every component exists”.

### Integrar Fumadocs

Publicar `/docs`.

Características mínimas:

```text
sidebar hierarchy
TOC
breadcrumbs
Ctrl/Cmd+K search
previous/next
edit on GitHub
copy page
copy code
deep links
API reference
dark/light
locale
```

Fumadocs já disponibiliza composição de docs, pesquisa e OpenAPI rendering, incluindo API playground e exemplos. citeturn6search4turn6search6turn6search7

### Criar diagramas oficiais

Adicionar Mermaid source para todos os fluxos listados anteriormente.

Criar uma convenção:

```text
docs/architecture/diagrams/
```

Cada diagrama terá:

```text
Purpose
Audience
Diagram
Textual equivalent
Key invariants
Related ADRs
```

### Criar materiais de apresentação

Adicionar Marp.

Scripts:

```text
npm run presentations:build
npm run presentations:pdf
npm run presentations:pptx
```

Produzir:

```text
engineering.pdf
engineering.pptx

user-guide.pdf
user-guide.pptx

executive.pdf
executive.pptx
```

O source continua versionado em Markdown. Marp CLI suporta essas formas de exportação. citeturn12search0

### Atualizar Compose

Adicionar:

```text
console
```

Inicialmente usar:

```text
localhost:3001
```

porque o README actual já reserva `localhost:3000` ao Langfuse opcional. fileciteturn24file0L2-L2

Exemplo conceptual:

```yaml
console:
  build:
    context: .
    dockerfile: docker/console/Dockerfile

  environment:
    HARNESS_URL: http://harness:8081

  ports:
    - "127.0.0.1:3001:3000"
```

O BFF fala internamente com Harness.

Não montar Docker socket.

Não montar `.env.runtime`.

Não montar provider secrets.

### Actualizar Quick Start

O resultado desejado deve ser:

```bash
cp .env.example .env.runtime
./scripts/configure-local.sh
./scripts/bootstrap.sh
```

e depois:

```text
AICP Console
http://localhost:3001

Langfuse
http://localhost:3000
```

O bootstrap deve imprimir uma tabela clara:

```text
AI Engineering Control Plane

Console       READY
Harness       READY
Memory        READY
PostgreSQL    READY
Neo4j         READY
Redis         READY
LiteLLM       READY

Langfuse      OPTIONAL

Release       BLOCKED (3 controls)

Open:
AICP Console → ...
```

### Adicionar testes

Storybook:

```text
all reusable components
all states
dark/light
long content
error states
```

Playwright:

```text
open dashboard
navigate with keyboard
filter runs
open run
inspect evidence
inspect budget
inspect security
cancel allowed run
view certification
use command palette
complete tutorial
switch locale
switch theme
```

Visual regression:

```text
overview
runs
run detail
architecture
release
docs
tutorial
```

ARIA snapshots:

```text
main navigation
run table
run detail
dialog
wizard
tutorial
```

### Adicionar UI adversarial tests

O AICP já trata abuse testing como componente sério da arquitectura; a UI deve seguir a mesma filosofia. O contrato v1 já referencia múltiplos testes adversariais e boundaries físicos. fileciteturn25file0L2-L2

Testar:

```text
HTML/script in repository name
HTML/script in task title
HTML/script in finding
HTML/script in model alias
oversized audit fields

forged role
expired token
missing token

direct BFF mutation
CSRF attempt
open redirect
malicious docs MDX
malicious Mermaid
path traversal

attempt to read server env
attempt to serialize service token
attempt to render provider credentials

SSE event injection
duplicate event
out-of-order event
reconnect
```

### Criar documentation quality CI

Validar:

```text
broken links
orphan pages
missing title
missing description
duplicate IDs
invalid Mermaid
invalid architecture catalog
invalid OpenAPI
stale generated API docs
missing text alternative for diagrams
```

### Criar GitHub presentation layer

Adicionar ao README screenshots **geradas a partir do Demo Mode**.

Script:

```text
npm run screenshots:docs
```

Playwright abre as rotas determinísticas:

```text
/demo
/demo/runs/example
/demo/architecture
/demo/release
```

e produz:

```text
docs/assets/screenshots/overview.png
docs/assets/screenshots/run-detail.png
docs/assets/screenshots/architecture.png
docs/assets/screenshots/release.png
```

Desta forma os screenshots podem ser reproduzidos.

### Preservar a certificação real

Não alterar:

```text
BLOCKED → PASS
```

porque a UI existe.

A situação actual permanece:

```text
dynamic_worker_agent_gate_e2e = BLOCKED
paired_llm_human_benchmark    = BLOCKED
no_critical_regression        = BLOCKED
```

até existirem as evidências exigidas pelo próprio release contract. fileciteturn25file0L2-L2

A nova Console deve tornar isto **mais difícil de esconder**, não mais fácil.

### Definition of Done desta evolução

A implementação só deverá ser considerada concluída quando:

| Área | Critério |
|---|---|
| Console | Executa integralmente via Docker |
| API | Client 100% derivado do OpenAPI |
| OpenAPI | Responses relevantes possuem schemas |
| Overview | Só mostra dados/evidências reais |
| Runs | List/detail completos |
| Workflow | Timeline live funcional |
| Budget | Ledger e consumo visualizados |
| Security | Findings e blockers apresentados |
| Certification | Derivada directamente do release contract/API |
| Governance | Workflows/policies/models/capabilities navegáveis |
| Knowledge | Context provenance, memory metadata e graph navegáveis |
| Docs | Nova arquitectura documental completa |
| API Docs | Geradas do OpenAPI |
| Tutorial | Tour + Academy + Demo Mode |
| Architecture | Explorer interactivo |
| Diagrams | C4/Mermaid + equivalentes textuais |
| Presentations | Engineering/user/executive geradas |
| Accessibility | WCAG 2.2 AA como requisito |
| Storybook | Design system documentado |
| E2E | Core journeys automatizados |
| Visual | Core screens protegidos por snapshots |
| Security | UI threat/adversarial tests |
| Docker | Console integrada no Compose |
| README | GitHub landing reconstruída |
| Historical docs | Arquivados, não eliminados |
| Existing CI | Continua verde |
| Release blockers | Permanecem honestamente representados |

### Ordem final de execução

Eu executaria exactamente nesta sequência:

```text
OpenSpec
   ↓
Product/UX contracts
   ↓
OpenAPI response schemas
   ↓
Console architecture + BFF
   ↓
Design system + Storybook
   ↓
Navigation shell
   ↓
Overview
   ↓
Runs + Run Detail
   ↓
New Run
   ↓
SSE live lifecycle
   ↓
Security + Certification
   ↓
Governance
   ↓
Knowledge
   ↓
Architecture Catalog
   ↓
Interactive Architecture Explorer
   ↓
Demo Mode
   ↓
AICP Academy
   ↓
Documentation restructuring
   ↓
Fumadocs + API docs
   ↓
Mermaid/C4 diagrams
   ↓
Presentations
   ↓
README/screenshots
   ↓
Accessibility
   ↓
E2E/visual/adversarial
   ↓
Performance
   ↓
Final architecture review
```

O agente **não deve saltar directamente para “criar dashboard bonito”**.

A ordem é deliberada:

```text
contracts
→ information architecture
→ data
→ components
→ flows
→ learning
→ documentation
→ polish
```

### Mandato que deve acompanhar o guia ao agente

```text
Implemente integralmente o guia de evolução UI/UX, AICP Console,
AICP Academy, documentação, arquitectura visual e materiais de
apresentação que lhe foi fornecido.

Trate o guia como especificação de produto e arquitectura, mas
confronte cada instrução com o estado real do repositório antes de
alterar código.

Antes da implementação:

1. Leia AGENTS.md e todas as instruções aplicáveis.
2. Leia docs/architecture/current.md.
3. Leia docs/security/invariants.md.
4. Leia release/v1-contract.json.
5. Leia docs/api/control-plane-v1.openapi.yaml.
6. Leia os testes e contratos existentes.
7. Crie/actualize os artefactos OpenSpec necessários.
8. Execute a baseline de testes antes de modificar código.

Princípios obrigatórios:

- Harness permanece autoridade de workflow, budget, gates,
  authorization e termination.
- A UI nunca se torna fonte de autoridade.
- PostgreSQL permanece estado canónico.
- Neo4j permanece projection/rebuildable state.
- Redis permanece efémero.
- Browser não recebe provider credentials.
- Browser não recebe worker-manager credentials.
- Browser não recebe service credentials.
- UI não comunica directamente com databases ou workers.
- Não montar Docker socket na Console.
- Não enfraquecer nenhuma security boundary existente.
- Não converter qualquer release control BLOCKED para PASS sem
  nova evidência verificável.
- Não inventar SLOs, benchmarks, resultados ou métricas.
- Não esconder limitações da implementação.
- Não substituir Langfuse; integrá-lo como deep observability.
- Não apagar documentação histórica; arquivá-la.
- Não introduzir framework/dependência sem necessidade demonstrável.
- Não trocar npm por outro package manager sem necessidade.
- Não executar push, merge ou release automaticamente.

A implementação deverá usar:

- Next.js App Router
- TypeScript strict
- shadcn/ui com React Aria
- Tailwind CSS
- TanStack Query
- TanStack Table
- openapi-typescript/openapi-fetch
- Fumadocs
- React Flow
- Storybook
- Playwright
- next-intl
- Mermaid/C4
- Marp

Implemente a Console como npm workspace e preserve os runtime
components existentes.

Primeiro fortaleça o OpenAPI, adicionando schemas completos às
responses necessárias. O frontend client deverá ser gerado desse
contrato; não duplique manualmente DTOs.

Implemente:

- Overview
- Runs
- Run Detail
- New Run
- workflow timeline
- live events/SSE
- budget visualization
- gates
- findings
- security
- execution evidence
- attestations
- audit
- context provenance
- release certification
- governance
- project navigation
- knowledge/memory
- graph explorer
- global navigation
- command palette
- light/dark mode
- internationalization

Crie também:

- architecture/catalog.yaml
- component catalog
- interactive architecture explorer
- deterministic Demo Mode
- AICP Academy
- advanced interactive tutorial
- complete Fumadocs documentation
- OpenAPI documentation
- C4/Mermaid architecture diagrams
- engineering presentation
- user presentation
- executive presentation
- reproducible README screenshots

Trate acessibilidade como requisito funcional:

- WCAG 2.2 AA
- complete keyboard flows
- proper focus management
- reduced motion
- screen reader semantics
- Storybook a11y
- Playwright ARIA snapshots
- manual accessibility checklist

Adicione testes:

- unit
- component
- contract
- integration
- E2E
- visual regression
- accessibility
- adversarial UI/security
- documentation validation

Crie quality gates correspondentes no CI.

Use o Demo Mode como fonte determinística para tutorial, E2E,
screenshots e apresentações sempre que possível.

Toda decisão importante deverá possuir:
- rationale
- implementation
- tests
- evidence
- documentation

Durante a implementação, corrija inconsistências ou gaps que
descobrir, desde que a correcção preserve as invariantes
arquitecturais do AICP.

Se uma parte do guia exigir mudanças no backend, implemente-as no
contrato correcto em vez de contornar a arquitectura pelo frontend.

Quando encontrar ambiguidade, adopte a solução:
1. mais segura,
2. mais determinística,
3. mais simples,
4. mais testável,
5. mais observável,
6. com menor acoplamento.

Não optimize apenas para completar a checklist.
Optimize para deixar o repositório tecnicamente defensável,
didáctico, visualmente excelente e sustentável a longo prazo.

No final:

1. Execute toda a suite existente.
2. Execute toda a nova suite.
3. Execute architecture/security contracts.
4. Execute build da Console.
5. Execute Storybook.
6. Execute Playwright.
7. Execute accessibility checks.
8. Execute docs build/link validation.
9. Execute presentation builds.
10. Execute Docker/Compose smoke.
11. Execute release evaluation.
12. Compare release/v1-contract.json antes/depois.
13. Revise git diff integralmente.
14. Confirme que nenhum secret foi versionado.
15. Confirme que nenhuma autoridade migrou para a UI.
16. Actualize README, docs, architecture/current.md e
    implementation-progress.md com apenas evidências reais.

Produza no final um relatório contendo:

- resumo executivo,
- arquitectura implementada,
- ficheiros criados/modificados,
- decisões tomadas,
- UX implementada,
- documentação criada,
- tutorial criado,
- diagramas criados,
- presentations criadas,
- API changes,
- security changes,
- testes executados,
- resultados,
- métricas,
- blockers ainda existentes,
- technical debt,
- release readiness.

Não faça push.
Deixe a implementação pronta para revisão humana.
```

A decisão estratégica mais importante desta etapa é **não transformar o AICP num dashboard genérico de IA**. LangSmith, Langfuse, Braintrust e Portkey já cobrem muito bem observabilidade de traces, logs, métricas e modelos. citeturn10search1turn10search2turn10search3turn8search9 O diferencial visual e conceptual do AICP deve ser mostrar algo que esses produtos não representam como centro do seu modelo: **autoridade determinística de engenharia, execution boundaries, budget físico/lógico, Context Engineering, memória governada, quality/security gates, evidence provenance e release certification**.

Se esta etapa for implementada desta forma, o repositório deixa de ser apenas uma implementação tecnicamente interessante que exige leitura profunda do código e passa a ser um sistema em que um novo developer consegue **ver, explorar, executar, compreender, aprender e explicar a arquitectura** sem perder as propriedades de segurança que fizeram o projecto amadurecer até aqui.