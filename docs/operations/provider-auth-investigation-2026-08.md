# Investigação de autenticação por provider — 2026-08

Esta matriz separa comportamento documentado de comportamento comprovado em uma
imagem candidata. O AICP não lê, copia ou serializa tokens; o provider mantém o
estado de autenticação e o usuário controla senha, MFA, CAPTCHA e consentimento.

| Provider | AUTH MODE oficial | status | Persistência documentada | Refresh/logout | Limitação atual |
|---|---|---|---|---|---|
| Codex | `codex login`, `codex login --device-auth` ou API key por stdin | DOCUMENTED | `CODEX_HOME/auth.json` ou credential store do SO | `codex login status`, `codex logout`, refresh automático de sessão ChatGPT | sem login live nesta execução; imagem/package candidato ainda não promovido |
| Claude Code | `claude auth login` / `/login` | DOCUMENTED | `CLAUDE_CONFIG_DIR/.credentials.json` no Linux ou keychain | `claude auth status`, `claude auth logout`, refresh gerenciado pelo provider | sem login live nesta execução; não usar OAuth de assinatura como broker de terceiros |
| OpenCode | `opencode auth login` / `/connect` | DOCUMENTED | `HOME/.local/share/opencode/auth.json` | `opencode auth list`, `opencode auth logout`; refresh depende do provider | documentação não define contrato genérico de refresh; sem login live |

Fontes oficiais consultadas:

- [Codex authentication](https://developers.openai.com/codex/auth/)
- [Claude Code authentication](https://code.claude.com/docs/en/authentication)
- [OpenCode CLI](https://opencode.ai/docs/cli/)
- [OpenCode providers](https://opencode.ai/docs/providers)

## Contrato de execução

`AUTH MODE` não monta o source tree. `EXECUTION MODE` monta somente o worktree
efêmero, usa `HOME=/run/aicp-home`, não inicia login interativo e não recebe o
host HOME, `.ssh`, socket Docker, skills nativas, plugins não autorizados ou MCP
auto-discovery. A evidência live obrigatória continua `LIMITED` até executar login,
restart, refresh, logout e re-login com uma conta de teste em cada imagem promovida.

Também não declaramos `network: provider-only` como PASS: o worker atual usa
default-deny (`none`). Allowlist efetiva de destinos exige enforcement externo de
firewall/proxy e uma prova comportamental adicional.
