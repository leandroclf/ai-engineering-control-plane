# Agent Providers

Agent Providers são runtimes agentic governados. Eles recebem um envelope de
execução e devolvem structured output, usage, mutation evidence e termination
reason. O envelope não contém OAuth tokens e o resultado não escolhe workflow.

| Provider | Runtime | Billing | Zone | Default |
|---|---|---|---|---:|
| `opencode-litellm` | OpenCode | `api-metered` | worker | Sim |
| `codex-subscription` | Codex CLI | `subscription` | provider-host | Não |
| `claude-code-subscription` | Claude Code CLI | `subscription-credit` | provider-host | Não |

`models/catalog.json` e `litellm/config.template.yaml` continuam canônicos para
modelos/API. `harness/config/agent-providers.json` é o catálogo de runtimes.

Referências oficiais usadas pelos adapters: [Codex SDK](https://developers.openai.com/codex/sdk/),
[Codex non-interactive mode](https://developers.openai.com/codex/non-interactive-mode/),
[Codex auth](https://developers.openai.com/codex/auth/), [Claude authentication](https://code.claude.com/docs/en/authentication),
[Claude headless](https://code.claude.com/docs/en/headless), [Claude legal/compliance](https://code.claude.com/docs/en/legal-and-compliance)
e [LiteLLM](https://docs.litellm.ai/).
