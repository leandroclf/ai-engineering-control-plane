# Certificação adversarial

## Controles entregues

O catálogo adversarial local cobre, com testes dinâmicos, shell arbitrário, command policy, execução local indevida nos handlers, isolamento de worktrees, credenciais per-run, coleta de evidência sem shell e boundary de worker. O runner fail-closed também verifica que `WorkerExecutionPlane` é conectado ao runtime de produção.

```bash
npm run test:adversarial
npm run test:budget-adversarial
npm run test:providers:adversarial
npm run test:worker-e2e
```

Para a camada de adapters, a evidência dinâmica também inclui os contratos unitários
e as integrações com executáveis fake, sempre usando `shell:false`, argv limitado,
parser estruturado, limite de saída, checkpoint/restore e negação de credenciais.

```bash
npm run test:providers
npm run test:providers:integration
npm run test:providers:adversarial
```

O resultado atual da certificação está em
[`docs/evaluations/agent-provider-certification.md`](../evaluations/agent-provider-certification.md)
e no contrato [`release/agent-provider-contract.json`](../../release/agent-provider-contract.json).
O status geral permanece `BLOCKED` porque o isolamento real de credenciais do
processo filho/vendor ainda não foi provado por evidência de SO/vendor.

## Limite honesto da evidência atual

O lifecycle Docker/HTTP real foi executado e confirmou worktree por run, criação, attestation, coleta e destruição. Ainda não há, neste repositório, uma execução observada de OpenCode real com provider configurado seguida de build, testes e scanners no mesmo worker. O controle `dynamic_worker_agent_gate_e2e` permanece `BLOCKED` no contrato de release; fixtures ou testes fake não são promovidos a evidência de produção.
