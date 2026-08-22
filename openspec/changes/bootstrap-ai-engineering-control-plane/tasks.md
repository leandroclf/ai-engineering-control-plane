# Tasks: Bootstrap do AI Engineering Control Plane

Cada item deve ser concluído com evidência anexável ao change/PR. Valores de
versão, budgets e thresholds só se tornam baseline depois dos spikes e testes
indicados.

## 1. Discovery e contratos

- [ ] 1.1 Validar a matriz de versões e licenças da Foundation
  - Objective: comprovar compatibilidade entre Docker/Compose, OpenCode SDK,
    LiteLLM, PostgreSQL, Redis e Neo4j.
  - Likely files/components: `versions.env`, `docs/compatibility.md`, ADR.
  - Depends on: none.
  - Validation: integration | manual.
  - Completion criteria: matriz com versão/digest, licença, fonte, teste mínimo,
    restrição conhecida e política de atualização aprovada.

- [ ] 1.2 Prototipar OpenCode SDK e structured output
  - Objective: provar criação de sessão, invocação de agente, JSON Schema e
    permission request sem depender de parsing de prosa.
  - Likely files/components: `spikes/opencode-sdk/`, `harness/schemas/`.
  - Depends on: 1.1.
  - Validation: contract | integration.
  - Completion criteria: spike automatizado passa e registra limitações/API
    escolhida no ADR.

- [ ] 1.3 Definir schemas v1 e catálogo de erros
  - Objective: versionar contratos de agent result, finding, gate, context,
    run, workflow, policy e suppression.
  - Likely files/components: `harness/schemas/`, `context/schemas/`, `docs/api/`.
  - Depends on: 1.2.
  - Validation: contract.
  - Completion criteria: exemplos válidos/inválidos testam todos os schemas e
    erros possuem código, retryability e exposição segura.

- [ ] 1.4 Registrar ADRs arquiteturais iniciais
  - Objective: aprovar autoridade do Harness, stores, REST-first, aliases,
    perfis e deny baseline.
  - Likely files/components: `docs/adr/`.
  - Depends on: 1.1, 1.2.
  - Validation: manual.
  - Completion criteria: ADRs aceitos referenciam specs, alternativas e riscos.

## 2. Foundation: estrutura e configuração

- [ ] 2.1 Criar a estrutura mínima do repositório
  - Objective: materializar módulos, ownership e arquivos de entrada sem
    implementar capabilities futuras vazias como se estivessem prontas.
  - Likely files/components: root, `docker/`, `harness/`, `memory-service/`,
    `context/`, `scripts/`, `tests/`, `docs/`.
  - Depends on: 1.4.
  - Validation: manual | lint.
  - Completion criteria: layout documentado, arquivos gerados ignorados e
    ownership/fronteiras explícitos.

- [ ] 2.2 Criar configuração de ambiente segura
  - Objective: separar exemplos versionáveis, runtime local, secrets e config
    gerada.
  - Likely files/components: `.env.example`, `.gitignore`, `versions.env`,
    `secrets/`, `litellm/generated/`.
  - Depends on: 2.1.
  - Validation: security | manual.
  - Completion criteria: nenhum segredo real é rastreável; permissões e campos
    obrigatórios têm validação automatizada.

- [ ] 2.3 Implementar Compose core com isolamento
  - Objective: definir stores, gateway, Memory Service e workspace com networks,
    secrets, health checks e dependências.
  - Likely files/components: `compose.yaml`, `compose/*.yaml`.
  - Depends on: 2.2.
  - Validation: integration | security.
  - Completion criteria: `docker compose config` passa; rede de dados é interna;
    portas são mínimas; Docker socket não é montado.

- [ ] 2.4 Implementar inicialização/migração de bancos
  - Objective: criar databases/roles e aplicar migrations de forma repetível.
  - Likely files/components: `docker/postgres/init/`, `memory-service/migrations/`.
  - Depends on: 2.3.
  - Validation: integration.
  - Completion criteria: instalação limpa e reinício preservam estado; falha de
    migration interrompe readiness.

- [ ] 2.5 Construir workspace base não privilegiado
  - Objective: entregar OpenCode e ferramentas universais sem acoplar todas as
    stacks de linguagem.
  - Likely files/components: `docker/workspace/Dockerfile`, `entrypoint.sh`.
  - Depends on: 1.1, 2.3.
  - Validation: integration | security.
  - Completion criteria: versão esperada, usuário não-root, capabilities
    removidas e perfil de segurança testado.

- [ ] 2.6 Configurar OpenCode, agentes e permissões explícitas
  - Objective: definir provider interno, agentes especializados, AGENTS e
    deny/ask/allow por função.
  - Likely files/components: `opencode/opencode.json`, `opencode/agents/`,
    `opencode/AGENTS.md`.
  - Depends on: 1.2, 2.5.
  - Validation: contract | security.
  - Completion criteria: testes negativos cobrem `.env`, external directory,
    edit de reviewer, commit/push e comandos privilegiados.

- [ ] 2.7 Criar templates LiteLLM e renderizador
  - Objective: mapear aliases sem incorporar provider keys no arquivo gerado.
  - Likely files/components: `litellm/config.template.yaml`,
    `scripts/render-config.sh`.
  - Depends on: 1.1, 2.2.
  - Validation: contract | security.
  - Completion criteria: aliases válidos renderizam; ausência/inconsistência
    falha cedo; artefato não contém valor de credencial.

## 3. Foundation: bootstrap e aceite

- [ ] 3.1 Implementar bootstrap idempotente
  - Objective: validar pré-requisitos, criar estado/secrets ausentes, renderizar,
    construir e iniciar o core em ordem.
  - Likely files/components: `scripts/bootstrap.sh`, `Makefile`.
  - Depends on: 2.3, 2.4, 2.5, 2.7.
  - Validation: e2e.
  - Completion criteria: primeira e segunda execução passam; secrets e estado
    existentes mantêm fingerprint.

- [ ] 3.2 Implementar doctor com saída acionável
  - Objective: verificar host, configuração, permissões, versões, liveness e
    readiness.
  - Likely files/components: `scripts/doctor.sh`, `tests/acceptance/doctor.*`.
  - Depends on: 3.1.
  - Validation: integration.
  - Completion criteria: cada falha injetada produz `FAIL` e exit code não zero
    sem vazar segredo.

- [ ] 3.3 Implementar smoke da Foundation
  - Objective: provar aliases, API, workspace e negações críticas.
  - Likely files/components: `scripts/smoke.sh`, `tests/acceptance/foundation/`.
  - Depends on: 2.6, 3.2.
  - Validation: e2e | security.
  - Completion criteria: checklist da Foundation produz evidência machine-
    readable e humana.

- [ ] 3.4 Publicar README Quick Start e troubleshooting
  - Objective: permitir bootstrap e primeiro uso a partir de host suportado.
  - Likely files/components: `README.md`, `docs/runbook.md`.
  - Depends on: 3.3.
  - Validation: manual | e2e.
  - Completion criteria: pessoa sem contexto executa o fluxo documentado e
    encontra correção para falhas testadas.

- [ ] 3.5 Congelar release Foundation
  - Objective: pin de imagens por digest, SBOM e baseline de recursos.
  - Likely files/components: `versions.env`, release manifest, `docs/sizing.md`.
  - Depends on: 3.3, 3.4.
  - Validation: security | performance | e2e.
  - Completion criteria: clean-host acceptance passa com artefatos congelados e
    recursos medidos.

## 4. Engineering Harness

- [x] 4.1 Implementar persistência de task/run/stage
  - Objective: criar lifecycle transacional, versões de workflow/policy e
    idempotência.
  - Likely files/components: `harness/src/workflow/`, migrations `control`.
  - Depends on: 1.3, 3.5.
  - Validation: unit | integration.
  - Completion criteria: transições inválidas, replay e retomada têm testes.

- [x] 4.2 Implementar executor da máquina de estados
  - Objective: carregar workflow YAML, validar output e avançar somente por
    transições declaradas.
  - Likely files/components: `harness/src/workflow/`, `harness/workflows/`.
  - Depends on: 1.2, 4.1.
  - Validation: unit | contract | integration.
  - Completion criteria: happy, blocked, failed e resume paths são
    determinísticos em testes sem LLM real.

- [x] 4.3 Implementar budgets e detecção de progresso
  - Objective: limitar calls, tokens, custo, iterações, tool repetition,
    finding e diff fingerprints.
  - Likely files/components: `harness/src/budget/`, `harness/policies/budgets.yaml`.
  - Depends on: 4.1.
  - Validation: unit | integration.
  - Completion criteria: cada limite gera estado/reason esperado e impede nova
    chamada.

- [x] 4.4 Criar framework de adapters e findings normalizados
  - Objective: padronizar execução, timeout, artifacts, errors e fingerprints.
  - Likely files/components: `harness/src/scanners/`, `harness/src/gates/`.
  - Depends on: 1.3, 4.2.
  - Validation: contract | unit.
  - Completion criteria: fixtures de formatos válidos/corrompidos produzem
    resultado normalizado estável.

- [x] 4.5 Implementar gates build/test/lint/coverage configuráveis
  - Objective: detectar comandos por projeto sem inventar sucesso quando não há
    comando obrigatório.
  - Likely files/components: `harness/src/gates/`, project adapter contracts.
  - Depends on: 4.4.
  - Validation: integration.
  - Completion criteria: sample projects suportados cobrem sucesso, falha,
    timeout e tool unavailable.

- [x] 4.6 Implementar adapters Semgrep, Gitleaks e Trivy
  - Objective: fornecer baseline local gratuita para SAST, secrets, SCA/IaC.
  - Likely files/components: `harness/src/scanners/`, `security/semgrep/`.
  - Depends on: 4.4.
  - Validation: contract | integration | security.
  - Completion criteria: relatórios redigidos, fingerprints estáveis e exit
    codes distinguem finding de falha da ferramenta.

- [x] 4.7 Implementar adapters opcionais Snyk e Sonar
  - Objective: integrar ferramentas cloud/licenciadas sem bloqueá-las no core
    quando política as marca opcionais.
  - Likely files/components: `harness/src/scanners/`, profiles/policies.
  - Depends on: 4.4 e decisão de dados/licença.
  - Validation: contract | integration.
  - Completion criteria: modos disabled/optional/required são distintos e
    ausência de evidência requerida bloqueia.

- [x] 4.8 Implementar targeted repair e revisões independentes
  - Objective: compilar contexto do finding, reparar escopo mínimo, reexecutar
    scanner e regressão, depois revisores read-only.
  - Likely files/components: `harness/workflows/`, `harness/src/agents/`.
  - Depends on: 4.2, 4.3, 4.5, 4.6.
  - Validation: integration | e2e.
  - Completion criteria: reparo pontual não reinicia fluxo completo; reviewers
    não editam; terminal segue specs.

- [x] 4.9 Criar vulnerable-project e acceptance suite do Harness
  - Objective: injetar teste falho, fake secret, dependência vulnerável, SQL
    injection e erro Docker.
  - Likely files/components: `tests/fixtures/vulnerable-project/`,
    `tests/acceptance/harness/`.
  - Depends on: 4.8.
  - Validation: e2e | security.
  - Completion criteria: cada defeito bloqueia o gate correto e no-progress
    termina no limite.

## 5. Context e Memory

- [x] 5.1 Implementar migrations do Memory Ledger
  - Objective: criar scopes, current projection, source refs, append-only events
    e índices com invariantes.
  - Likely files/components: `memory-service/migrations/`.
  - Depends on: 1.3, 4.9.
  - Validation: database | integration.
  - Completion criteria: constraints, concorrência de versão e rollback/
    forward-fix são testados.

- [x] 5.2 Implementar API de memória e autorização de escopo
  - Objective: create/search/get/promote/invalidate/supersede com redaction,
    idempotência e actor identity.
  - Likely files/components: `memory-service/src/aicp_memory/api/`, domain,
    repository, ledger.
  - Depends on: 5.1.
  - Validation: unit | integration | contract | security.
  - Completion criteria: isolamento entre projetos/agentes e operações não
    autorizadas têm testes negativos.

- [x] 5.3 Implementar expiração e invalidação por proveniência
  - Objective: aplicar source hash, supersession, TTL e policy/schema version.
  - Likely files/components: `memory-service/.../invalidation/`.
  - Depends on: 5.2.
  - Validation: unit | integration.
  - Completion criteria: memória stale nunca entra em busca ativa e todo motivo
    gera evento.

- [ ] 5.4 Implementar indexador Git incremental
  - Objective: identificar deltas por blob OID/hash e cache keys versionadas.
  - Likely files/components: `context/indexer/git_index.*`, `scripts/index.sh`.
  - Depends on: 5.1.
  - Validation: unit | integration | performance.
  - Completion criteria: no-op parseia zero; alteração isolada limita o delta;
    branch reuse é comprovado.

- [ ] 5.5 Implementar parser/symbol index da primeira linguagem
  - Objective: extrair arquivos, símbolos, referências, testes e chunks com
    proveniência.
  - Likely files/components: `context/parsers/`, `context/indexer/symbol_index.*`.
  - Depends on: 5.4 e decisão da primeira linguagem.
  - Validation: unit | integration.
  - Completion criteria: corpus fixture cobre syntax error, rename, delete e
    símbolos ambíguos.

- [ ] 5.6 Implementar schema e projeção Neo4j
  - Objective: aplicar constraints/indexes e graph deltas reconstruíveis.
  - Likely files/components: `graph/cypher/`, `context/indexer/graph_index.*`.
  - Depends on: 5.5.
  - Validation: integration.
  - Completion criteria: rebuild, rename, delete e impact traversal passam sem
    depender de Redis.

- [ ] 5.7 Implementar retrieval lexical/vector como fallback
  - Objective: indexar chunks semanticamente estáveis, com modelo/dimensão
    versionados e cache.
  - Likely files/components: graph vector/fulltext indexes, embedding adapter.
  - Depends on: 5.6 e seleção do embedding model.
  - Validation: integration | performance.
  - Completion criteria: mudança do modelo invalida cache aplicável; dados
    inalterados não são re-embedded.

- [ ] 5.8 Implementar Context Compiler e budget exato
  - Objective: resolver escopo, ranking determinístico-first, dedup, token count
    e package provenance.
  - Likely files/components: `context/compiler/`, context API.
  - Depends on: 5.2, 5.3, 5.6; 5.7 para fallback semântico.
  - Validation: unit | integration | contract | performance.
  - Completion criteria: exact symbol precede vector, package cabe no budget e
    resultado é determinístico para mesma chave.

- [ ] 5.9 Integrar Context Compiler ao Harness
  - Objective: entregar apenas contexto de task/policy autorizado por estágio e
    registrar provenance/context ID.
  - Likely files/components: `harness/src/agents/`, `context/compiler/`.
  - Depends on: 4.8, 5.8.
  - Validation: integration | e2e | security.
  - Completion criteria: fixture prova isolamento, budget e ausência de memória
    superseded/stale.

## 6. Observabilidade e operação

- [ ] 6.1 Instrumentar Harness, Memory e Context com OTel
  - Objective: propagar task/run IDs e emitir spans/métricas sem payload sensível.
  - Likely files/components: `harness/src/telemetry/`, serviços, collector config.
  - Depends on: 4.9, 5.9.
  - Validation: integration | security.
  - Completion criteria: trace de teste liga estágios; teste garante ausência de
    source/prompt/secret por default.

- [ ] 6.2 Instrumentar gateway e cálculo de custo
  - Objective: capturar alias/resolved model, token count, cache, fallback,
    latência e custo.
  - Likely files/components: LiteLLM config, OTel collector, metrics.
  - Depends on: 6.1.
  - Validation: integration.
  - Completion criteria: custo/tokens por task são calculáveis e fallback aparece
    no trace.

- [ ] 6.3 Vendorizar deployment de observabilidade
  - Objective: pin de revisão oficial do Langfuse e dependências em perfil
    separado, com procedimento de atualização.
  - Likely files/components: `compose/observability.vendor.yaml`,
    `observability/langfuse/README.md`.
  - Depends on: 1.1, 6.1.
  - Validation: integration | security.
  - Completion criteria: perfil sobe/para independentemente e política de
    backup cobre PostgreSQL, ClickHouse e blob storage.

- [ ] 6.4 Criar dashboards e evaluation dataset inicial
  - Objective: medir cost/accepted task, first-pass rate, loops, deterministic
    retrieval, context reuse e model fallback.
  - Likely files/components: `observability/dashboards/`, `tests/evaluations/`.
  - Depends on: 6.2, 6.3.
  - Validation: observability.
  - Completion criteria: dataset reproduz métricas e thresholds começam como
    baseline documentada, não SLO inventado.

- [ ] 6.5 Implementar backup, restore e rebuild
  - Objective: proteger estado canônico/gateway e reconstruir graph/cache.
  - Likely files/components: `scripts/backup.sh`, `scripts/restore.sh`, runbook.
  - Depends on: 5.6, 6.2.
  - Validation: e2e | security.
  - Completion criteria: restore drill em ambiente limpo passa health, logical
    isolation e context acceptance.

- [ ] 6.6 Definir retenção, criptografia e destino de backup
  - Objective: impedir que dumps e telemetry virem nova fonte de exposição.
  - Likely files/components: policies, threat model, runbook.
  - Depends on: 6.5 e escolha do ambiente.
  - Validation: security | manual.
  - Completion criteria: owner, retenção, criptografia, acesso, restore cadence
    e descarte estão aprovados.

## 7. CI e multi-host

- [ ] 7.1 Implementar CI em checkout limpo
  - Objective: reproduzir build, tests, scanners, schemas, Compose e acceptance
    aplicáveis sem confiar em artifacts locais.
  - Likely files/components: CI workflows, scripts compartilhados.
  - Depends on: 4.9, 5.9, 6.1 e escolha da plataforma CI.
  - Validation: integration | e2e | security.
  - Completion criteria: fixture bloqueia CI; artifact inclui gates/findings
    normalizados; permissões seguem menor privilégio.

- [ ] 7.2 Implementar governança de suppressions
  - Objective: validar owner, approval, fingerprint, reason, ticket e expiry.
  - Likely files/components: `security/suppressions.yaml`, Harness policy/gate.
  - Depends on: 4.6, 7.1.
  - Validation: contract | security.
  - Completion criteria: suppression inválida/expirada não desbloqueia; válida é
    auditável e específica ao finding.

- [ ] 7.3 Elaborar threat model e executar testes de abuso
  - Objective: cobrir host/workspace, gateway, APIs, prompt injection,
    cross-scope, supply chain e telemetry.
  - Likely files/components: `docs/threat-model.md`, `tests/security/`.
  - Depends on: 7.1, 7.2.
  - Validation: security.
  - Completion criteria: ameaças têm boundary, mitigação, teste/evidência, risco
    residual e owner.

- [ ] 7.4 Definir identidade e transporte do perfil remoto
  - Objective: aprovar TLS/VPN, service/user identity, authz e rotação.
  - Likely files/components: ADR, production override example, runbook.
  - Depends on: 7.3 e decisão de infraestrutura.
  - Validation: security | architecture.
  - Completion criteria: nenhum serviço de dados é exposto sem autenticação,
    autorização de escopo e TLS validados.

- [ ] 7.5 Validar novo host com estado remoto
  - Objective: provar workspace descartável e reuso seguro de estado por
    protocolo de serviço.
  - Likely files/components: remote profile, acceptance multi-host.
  - Depends on: 6.5, 7.4.
  - Validation: e2e | security.
  - Completion criteria: host B acessa somente escopos autorizados; nenhum volume
    de banco é compartilhado; task trace permanece correlacionado.

## 8. Documentação e release

- [ ] 8.1 Consolidar documentação AI-readable
  - Objective: documentar arquitetura, API, memória, segurança, operação e
    referências com hierarquia clara e exemplos verificáveis.
  - Likely files/components: `README.md`, `docs/`, `llms.txt`.
  - Depends on: 7.5.
  - Validation: documentation | manual.
  - Completion criteria: links internos passam; quick start, diagrams, contracts
    e runbooks correspondem ao comportamento testado.

- [ ] 8.2 Executar checklist completo do avaliador
  - Objective: validar implementação contra proposal, specs, design e tasks.
  - Likely files/components: `evaluator-checklist.md`, acceptance artifacts.
  - Depends on: 8.1.
  - Validation: manual | e2e | security | observability.
  - Completion criteria: cada item tem PASS ou risco/exceção aprovada com
    evidência.

- [ ] 8.3 Publicar release candidate reproduzível
  - Objective: congelar Git tag, imagens/digests, schemas/policies e release
    notes.
  - Likely files/components: release manifest, changelog, SBOM, signatures.
  - Depends on: 8.2.
  - Validation: e2e | supply-chain.
  - Completion criteria: host limpo reproduz a release e todas as capabilities
    prometidas atingem seus critérios de aceite.
