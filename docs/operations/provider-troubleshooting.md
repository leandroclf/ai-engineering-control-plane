# Provider Troubleshooting

- `AUTH_REQUIRED`: faça login pelo cliente oficial; não edite credential store.
- `QUOTA_EXHAUSTED`: aguarde/reset o ledger shadow; não aumente retry limits.
- `PROVIDER_OUTPUT_LIMIT_EXCEEDED`: investigue output e mantenha o limite.
- `PROVIDER_FALLBACK_CHECKPOINT_FAILED`: etapa bloqueada; revise worktree
  manualmente antes de qualquer novo provider.
- `POLICY_DENIED` em produção: esperado para subscription providers; use
  OpenCode/LiteLLM ou API/WIF.
