# Certificação adversarial

## Controles entregues

O catálogo adversarial local cobre, com testes dinâmicos, shell arbitrário, command policy, execução local indevida nos handlers, isolamento de worktrees, credenciais per-run, coleta de evidência sem shell e boundary de worker. O runner fail-closed também verifica que `WorkerExecutionPlane` é conectado ao runtime de produção.

```bash
npm run test:adversarial
npm run test:budget-adversarial
npm run test:worker-e2e
```

## Limite honesto da evidência atual

O lifecycle Docker/HTTP real foi executado e confirmou worktree por run, criação, attestation, coleta e destruição. Ainda não há, neste repositório, uma execução observada de OpenCode real com provider configurado seguida de build, testes e scanners no mesmo worker. O controle `dynamic_worker_agent_gate_e2e` permanece `BLOCKED` no contrato de release; fixtures ou testes fake não são promovidos a evidência de produção.
