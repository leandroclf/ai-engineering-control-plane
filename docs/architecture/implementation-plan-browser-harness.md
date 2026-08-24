# Plano incremental

1. **Concluído — contratos:** provider, router, permissões, browser CDP adapter,
   registry de skills, evaluator, recovery e loop governado.
2. **Concluído — persistência:** tabelas/handlers no memory-service para skill
   metadata, execution episodes, failure patterns e browser sessions.
3. **Concluído — browser worker:** processo Chromium isolado com CDP, perfil
   persistente por `sessionId`, autenticação e gravação de lifecycle.
4. **Concluído — API:** providers, skills, retrieval e métricas expostos pelo
   Harness, com OpenAPI e contrato arquitetural.
5. **Próximo — promoção:** conectar evidências de CI/humano a `VALIDATED`/`PROMOTED`
   através de um fluxo de revisão independente e UI operacional.

Cada fase deve manter testes positivos, negativos e fail-closed, sem alterar a
autoridade de workflow, budget ou release já definida no projeto.
