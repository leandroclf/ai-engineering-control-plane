# Invariantes de segurança AICP v1

Cada violação abaixo deve falhar fechada e produzir evidência auditável:

- o LLM não escolhe transição de workflow, aprovação de gate ou aumento de budget;
- código de projeto, OpenCode, build, teste e scanner não executam no Control Plane em produção;
- o worker não recebe provider API key físico, Docker socket ou credencial de outro run;
- cada run possui worktree físico independente e credential material distinto, expirável e revogável;
- capabilities de worker usam argv estruturado e uma allowlist semântica por profile;
- `sh -c`, `bash -c`, `eval`, `sudo`, `su`, `nsenter`, `mount`, Docker, ferramentas de exfiltração e path escape são negados;
- internet direta do worker não é requisito para executar código; acesso de inferência ocorre pela boundary autorizada do gateway;
- scanner obrigatório indisponível, pricing desconhecido, attestation inválida ou contexto fora do envelope nunca resulta em PASS;
- PostgreSQL permanece a fonte canônica de workflow, budget, memória e reconciliação;
- conteúdo sensível não entra em telemetry por padrão;
- run terminal não deixa worker, worktree ou credential ativo após reconciliação;
- CI protegido e revisão humana continuam as autoridades finais de merge/release.
- Codex e Claude Code não executam no ordinary worker; subscription runtime só roda no Agent Provider Host.
- O AICP não lê, copia, persiste ou exibe vendor OAuth material; login é delegado ao CLI oficial via TTY.
- Provider Host usa ambiente allowlisted sem `DATABASE_URL`, Harness/cloud/SSH/API credentials e nunca usa `danger-full-access`.
- Agent routing compara `providerFamily` real; runtime diversity isolada não satisfaz reviewer diversity.
- Subscription accounting mantém `billingMode` e `monetaryCostKnown`; custo desconhecido nunca vira custo real zero.
- Fallback após mutation exige checkpoint restore + attestation clean; falha bloqueia a etapa.
- Credential isolation real é release-blocking e permanece `BLOCKED` quando a prova OS/vendor não existe.

Evidência executável: `npm run test:adversarial`, `npm run test:budget-adversarial`, `npm run test:worker-e2e`, `npm run test:architecture`, `npm run test:providers`, `npm run test:providers:integration` e `npm run test:providers:adversarial`.
