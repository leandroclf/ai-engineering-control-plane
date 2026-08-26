# Runtime manifests

Cada manifesto registra somente uma imagem promovida após compliance, testes de
contrato, suíte adversarial e evals. `UNVALIDATED` é deliberadamente bloqueante:
nenhuma execução de produção pode resolver uma versão mais nova ou substituir o
digest silenciosamente.

Os manifests Codex, Claude Code e OpenCode começam sem digest porque o package e a
versão efetivamente candidatados precisam ser fornecidos pela pipeline. O fluxo
provider-specific está documentado em [investigação de autenticação](../docs/operations/provider-auth-investigation-2026-08.md).
