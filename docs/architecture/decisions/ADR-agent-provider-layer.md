# ADR: Agent Provider Layer

- **Status:** Accepted, opt-in/experimental
- **Decision:** LiteLLM permanece Model Gateway. OpenCode, Codex e Claude Code
  implementam `AgentProvider` sob o Harness.
- **Context:** model routing e agent runtime têm lifecycle, auth, trust zone e
  accounting diferentes; misturá-los no `models/catalog.json` quebraria essas
  boundaries.
- **Consequences:** o default não muda; há registry/router auditável e adapters
  substituíveis; subscription providers exigem host separado e novas evidências.
- **Alternatives rejected:** adicionar `codex-cli`/`claude-code` ao LiteLLM;
  criar um microserviço independente antes de provar o boundary; permitir que o
  agente escolha transitions ou budget.
