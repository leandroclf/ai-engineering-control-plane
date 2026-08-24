# Provider Auth Boundary

O AICP delega login ao vendor e nunca é OAuth client. `aicp providers login
codex` executa `codex login` em TTY; `aicp providers login claude-code` delega ao
cliente Claude. Status Codex usa `codex login status`; Claude não tem parsing de
credential store.

O AICP nunca lê, copia, persiste, exporta ou exibe `~/.codex/auth.json`,
`~/.claude/.credentials.json`, tokens, cookies ou URLs de login. Login não passa
por HTTP/BFF/Console.
