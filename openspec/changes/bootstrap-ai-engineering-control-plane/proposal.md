# Proposal: Bootstrap do AI Engineering Control Plane

## Change ID

`bootstrap-ai-engineering-control-plane`

## Status

Draft

## Context

O repositório contém uma visão arquitetural abrangente, mas ainda precisa de um
contrato versionável que organize a construção por capabilities e evidências de
aceite. A primeira entrega deve provar um ambiente reproduzível e seguro antes
de adicionar memória sofisticada, GraphRAG e operação multi-host.

## Problem

Não existe ainda uma aplicação inicializável que governe agentes, contexto,
modelos, qualidade e estado de forma reproduzível. Sem esse plano, a visão pode
ser implementada como um conjunto acoplado de contêineres, com autoridade
delegada a prompts e sem critérios objetivos de conclusão.

## Goals

- Entregar um perfil `core` inicializável e verificável em host limpo.
- Controlar workflows de agentes por máquina de estados determinística.
- Aplicar segurança, budgets e quality gates desde a Foundation.
- Acrescentar contexto, memória, observabilidade e multi-host em fases
  dependentes e testáveis.
- Documentar bootstrap, uso, diagnóstico, backup, restore e evolução.

## Non-Goals

- Autorizar agentes a fazer merge, push, deploy ou administrar o host.
- Entregar alta disponibilidade ou escala corporativa no primeiro marco.
- Tornar Neo4j, Redis, Langfuse ou respostas LLM fonte de verdade.
- Instalar toda stack de linguagem e scanner no workspace base.
- Fixar permanentemente providers, modelos ou ferramentas substituíveis.

## Users / Actors Impacted

- Desenvolvedores e revisores humanos.
- Mantenedores de plataforma, segurança e arquitetura.
- Harness, CI e agentes especializados.
- Gateways, stores e serviços de observabilidade.

## Scope

### In scope

- Compose core, workspace e configuração reproduzível.
- Scripts de bootstrap, renderização, diagnóstico, smoke, backup e restore.
- LiteLLM com aliases por capacidade e isolamento de credenciais.
- Harness com workflow, schemas, gates, budgets e loops limitados.
- Adapters de build/test, Semgrep, Trivy, Gitleaks, Snyk e Sonar por perfil.
- Memory Ledger, escopos, proveniência e invalidação.
- Indexação incremental, grafo reconstruível e Context Compiler limitado.
- OpenTelemetry/Langfuse, dashboards, backups e operação multi-host por fase.
- Documentação, threat model, runbook, ADRs e testes de aceitação.

### Out of scope

- Operações autônomas irreversíveis.
- Orquestração de produção sem fronteira humana/CI.
- Compartilhamento direto de volumes de bancos entre hosts.
- Semantic response cache em fluxos agentic por padrão.
- Suporte universal a linguagens na primeira release.

## Product Requirements Summary

- Uma pessoa operadora deve subir o perfil suportado seguindo o README e obter
  diagnóstico e smoke test conclusivos.
- Uma pessoa desenvolvedora deve abrir um projeto no workspace sem acesso às
  credenciais reais dos providers ou ao Docker socket do host.
- O Harness deve avançar somente com outputs estruturados e gates aprovados.
- O contexto deve caber no budget e explicar a proveniência dos artefatos.
- A memória deve respeitar escopo, autoridade, validade e histórico.
- A plataforma deve expor evidência suficiente para calcular custo, qualidade,
  loops e estado de cada tarefa.

## Business Rules

- `READY_FOR_HUMAN_REVIEW` é o único terminal de sucesso do Harness local.
- CI em checkout limpo continua sendo autoridade de validação final.
- Políticas assinadas/projeto e tarefa humana precedem conteúdo recuperado e
  inferência do agente.
- Exceções de scanner são explícitas, versionadas, justificadas e auditáveis.
- Projeções e caches podem ser reconstruídos sem perda do estado canônico.

## Affected Capabilities

- `platform-bootstrap`
- `governed-workflows`
- `model-gateway`
- `context-memory`
- `security-governance`
- `observability-operations`

## Expected Impact

### Code

- Novos módulos de workspace, Harness, contexto, memória e adapters.

### Data

- PostgreSQL para estado canônico e ledger; Neo4j e Redis como derivados.

### APIs / Contracts

- REST v1 inicial, schemas JSON de agentes/findings/gates/contexto e workflow
  YAML versionado.

### Integrations

- OpenCode, LiteLLM, providers, scanners, OpenTelemetry, Langfuse e CI.

### Operations

- Perfis core/observability, health/readiness, backup/restore e runbooks.

### Security / Privacy

- Segregação de secrets, menor privilégio, redaction e proteção contra prompt
  injection proveniente do repositório.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Escopo amplo impedir primeira entrega | Alto | Gate de Foundation e fases dependentes |
| Dependência de versões não validadas | Alto | Spikes, lockfile e imagens por digest |
| Vazamento de secrets | Crítico | Chaves virtuais, secrets e testes negativos |
| Loops/custo sem limite | Alto | Budgets, fingerprint e parada por progresso |
| Memória/grafo incorretos | Alto | Proveniência, invalidação e reconstrução |
| Divergência local/CI | Alto | Adapters e políticas compartilhados |

## Success Criteria

- Host suportado e limpo conclui `bootstrap`, `doctor` e `smoke` do core.
- Todos os serviços obrigatórios apresentam health/readiness e versões
  registradas.
- Testes comprovam que provider secrets, `.env`, Docker socket, push e deploy
  permanecem indisponíveis a agentes.
- Fixtures defeituosas bloqueiam os gates esperados e loops sem progresso
  terminam dentro do budget.
- Reindexação sem mudanças processa zero arquivos; alteração isolada processa
  apenas o delta relevante.
- Context package nunca excede o budget configurado e preserva proveniência.
- Backup/restore recupera estado canônico e reconstrói projeções.
- Trace correlaciona task, contexto, agente, modelo, scanners, loops e gates.
- Novo host autorizado reutiliza estado remoto sem compartilhar volumes.

## Assumptions

- Linux/Docker Compose v2 será a baseline inicial.
- Observabilidade completa poderá ser remota ou opcional localmente.
- Thresholds e budgets do guia são configurações iniciais calibráveis.

## Open Questions

- Quais providers/model IDs compõem cada alias no primeiro ambiente?
- Qual CI, registry e secret manager serão suportados primeiro?
- Quais linguagens entram no primeiro indexador e workspace especializado?
- Qual identidade e autorização protegem APIs no perfil multi-host?
- Quais scanners pagos estarão habilitados por padrão?
