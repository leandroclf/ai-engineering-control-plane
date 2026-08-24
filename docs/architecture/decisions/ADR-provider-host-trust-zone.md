# ADR: Provider Host Trust Zone

- **Status:** Accepted, certification required
- **Decision:** CLIs com sessão vendor só executam em `Agent Provider Host`,
  nunca no ordinary worker.
- **Controls:** clean environment allowlist, no Harness/cloud/database tokens,
  argv sem shell, process-group supervision, bounded output, timeout,
  cancellation, sandbox flags e per-run checkpoint.
- **Residual risk:** a leitura de arquivos de sessão por child tools depende de
  isolamento OS/vendor que deve ser provado no ambiente alvo; o contrato fica
  `BLOCKED` enquanto essa prova não existir.
