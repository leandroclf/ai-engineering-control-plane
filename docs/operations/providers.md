# Operação de Providers

```bash
npm run aicp -- providers list
npm run aicp -- providers show codex-subscription
npm run aicp -- providers doctor codex-subscription
npm run aicp -- providers doctor claude-code-subscription
npm run aicp -- providers test codex-subscription --read-only
```

`doctor` não executa inference. `test` é live, read-only e exige
`AICP_LIVE_PROVIDER_TESTS=true`; não é executado pelo CI normal.
