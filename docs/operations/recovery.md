# Recovery e reconciliação operacional

## Inventário

- PostgreSQL: estado canônico de tasks, runs, stages, budget, memória e eventos; backup obrigatório.
- Git/configuração e evidência de certificação: backup obrigatório.
- Neo4j e índices: reconstruíveis, usados para reduzir RTO.
- Redis, containers, worktrees e caches: efêmeros.

## Worker recovery

O `worker-manager` executa reconciliação no startup. Containers identificados pelo label `aicp.run_id` que não estão no inventário vivo são removidos; diretórios abandonados dentro do root dedicado de runs são removidos; credenciais do broker são expiradas/revogadas. O Harness deve reconciliar reservations no PostgreSQL antes de aceitar nova invocação.

```bash
npm run test:worker-e2e
bash tests/integration/backup-tamper.integration.sh
bash tests/integration/restore-clean-host.integration.sh
```

## Limite operacional

RPO/RTO de um host de produção e restore completo com provider/gateway reais ainda precisam de um drill operacional agendado. O código não declara esse drill como concluído apenas por testes de fixture.
