# Current Architecture

## Architectural principles

O Harness é a única autoridade para workflow transitions, gates, budget, quota
policy, autorização, terminação, lifecycle e evidence. PostgreSQL é o estado
persistente canônico; Neo4j é uma projeção reconstruível e Redis é efêmero.
Agentes e conteúdo de repositório são dados não confiáveis, nunca policy.

O caminho compatível e default permanece:

```text
Harness → OpenCode → LiteLLM → model APIs
```

Codex e Claude Code são runtimes agentic, não modelos do LiteLLM:

```text
Harness → Agent Provider Router
  ├─ OpenCodeAgentProvider → LiteLLM
  ├─ CodexAgentProvider → Agent Provider Host → Codex CLI
  └─ ClaudeCodeAgentProvider → Agent Provider Host → Claude Code CLI
```

## Trust zones

- **Control Plane:** Harness, router, registry, budget/quota authorities,
  PostgreSQL e API. Não executa código de projeto nem possui credenciais vendor.
- **Ordinary Execution Worker:** worker efêmero para OpenCode, gates, build,
  testes e scanners. Continua sem provider API keys físicos e sem socket Docker.
- **Model Gateway:** LiteLLM possui as credenciais API e o model catalog.
- **Agent Provider Host:** processo credential-bearing separado, local-only por
  padrão, com ambiente allowlisted, argv estruturado, timeout, output limit,
  cancelamento por process group e worktree checkpoint. Não acessa PostgreSQL,
  Memory Service, Harness tokens ou workflow policy.
- **Console/BFF:** apresentação humana server-side; browser nunca toca
  infraestrutura ou credenciais.

## Agent Provider Layer

`harness/src/providers/` contém o contrato `AIProvider`/`AgentProvider`, registry,
`AgentRoutingPolicy`, quota authority, adapters, parsers e Provider Host. A
decisão é determinística e evidenciada com `decisionId`, `policyVersion`,
candidates, rejection reasons, selected provider e provider family.

`AICP_AGENT_PROVIDER_LAYER_ENABLED=false` mantém o caminho legado. Subscription
providers exigem opt-in, classe `LOCAL_PERSONAL`, feature flag individual e
`provider-host`; nunca são selecionados em `SHARED_PRODUCTION` ou no
`WorkerExecutionPlane`.

## Budget and quota authority

Budget continua reservando antes da chamada e fazendo settlement depois. Quota é
um ledger shadow AICP separado para concorrência, calls, tentativas físicas e
wall time por provider/principal/task/run. Subscription usage mantém
`billingMode`, `monetaryCostKnown=false` e `providerReportedCostUsd` opcional;
`costUsd=0` de migração não é apresentado como custo real zero.

## Failure semantics

Fallback mutante só ocorre após checkpoint restore e attestation clean. Falha de
restore gera `PROVIDER_FALLBACK_CHECKPOINT_FAILED` e bloqueia a etapa. Auth,
quota, timeout, output inválido, output bomb e provider indisponível são estados
sanitizados e bounded; nunca há retry infinito.

## Observability

Spans permitidos incluem `aicp.provider.route`, `aicp.provider.execute`,
`aicp.provider.codex`, `aicp.provider.claude`, quota e checkpoint/rollback.
Prompt, source code, OAuth material, credential path, login URL e stdout/stderr
irrestrito nunca entram em telemetry.

## Deployment and certification

`LOCAL_PERSONAL` pode habilitar adapters por flag. `TRUSTED_CI` mantém
subscription providers desabilitados; API/WIF/LiteLLM é o caminho recomendado.
`SHARED_PRODUCTION` proíbe subscription adapters.

O contrato de certificação está em `release/agent-provider-contract.json`.
Credential isolation de uma sessão vendor precisa de prova OS/vendor específica;
até essa evidência existir, o controle permanece `BLOCKED`, sem ser promovido a
`PASS`.
