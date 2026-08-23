# Arquitetura atual — AICP v1 + Human Control Plane
O Harness continua sendo a autoridade exclusiva de workflow, budget, autorização, gates e lifecycle. PostgreSQL é o estado canônico; Neo4j é projeção reconstruível; Redis é cache efêmero.
O AICP Console é uma camada humana server-side. O browser fala apenas com o Next.js BFF; o BFF fala com a API do Harness. Não há acesso do browser a PostgreSQL, Neo4j, Redis, Docker, worker-manager ou provider credentials.
O modo demo é determinístico e não muta runs. O modo de produção exige configuração server-side de `HARNESS_URL` e token, sem `NEXT_PUBLIC_*` para credenciais.
O release contract permanece honesto: `dynamic_worker_agent_gate_e2e`, `paired_llm_human_benchmark` e `no_critical_regression` continuam `BLOCKED` até evidência verificável.
