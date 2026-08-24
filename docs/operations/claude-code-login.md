# Claude Code Login

Use `npm run aicp -- providers login claude-code`; o cliente oficial conduz o
browser/login flow. Logout delega a `claude logout`. O baseline não automatiza
`claude setup-token` e não habilita `CLAUDE_CODE_OAUTH_TOKEN` em CI.
