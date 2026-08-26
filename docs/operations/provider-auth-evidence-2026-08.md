# Evidência live de autenticação por provider — 2026-08

Execução realizada em containers candidatos isolados, sem source tree, sem HOME
do host, sem SSH e sem persistir tokens no repositório. A credencial Zen foi
revogada quando foi acidentalmente exposta no chat; nenhuma chave exposta foi
usada pelo runner.

| Provider | CLI | Imagem candidata | Digest | Resultado |
|---|---:|---|---|---|
| Codex | 0.148.0 | `aicp-runtime-codex:candidate-0.148.0` | `sha256:706d97e8064da4bb3d198b577b0229dd6ffdfc276f95a5fd1298082d337e969f` | PASS |
| Claude Code | 2.1.241 | `aicp-runtime-claude:candidate-2.1.241` | `sha256:30730327055d7eb06f816f73b1d7f64b667e340083d400f809a8993be9b54a78` | PASS |
| OpenCode Zen | 1.18.21 | `aicp-runtime-opencode:candidate-1.18.21` | `sha256:8b1637a14aef18124b7a72c7ddf6a19acbf567420b591838d9ac42f4272860ce` | PASS |

## Ciclo executado

Para cada provider:

1. Login real em volume Docker exclusivo do provider.
2. `status` em um novo container para comprovar persistência após restart.
3. Uma chamada mínima real `Reply exactly OK` sem ferramentas e sem source tree.
4. Novo `status` após uso autenticado.
5. Logout real.
6. `status` após logout falhando ou sem credenciais, conforme o CLI.
7. Re-login real no mesmo volume.
8. `status` final autenticado.

Além do ciclo de autenticação, os três candidatos passaram o compliance real de
container: rootfs read-only, usuário não-root, workspace gravável isolado, HOME
efêmero no modo de execução, capabilities removidas, `no-new-privileges` e
ausência de socket Docker.

## Limite de observabilidade do refresh

Codex e Claude mantiveram a sessão válida após uso real; isso comprova o caminho
de uso autenticado após restart, mas não permite afirmar que uma rotação interna
de access token ocorreu, pois os CLIs não expõem essa operação nem um comando
seguro para forçar expiração. OpenCode Zen usa API key, portanto não possui
refresh OAuth equivalente. Não foram lidos, alterados ou registrados tokens.

Os manifests foram promovidos localmente por digest após os gates de compliance,
contrato, adversarial e evidência live. A avaliação pareada CLI × AICP continua
pendente porque exige workload experimental dedicado, conforme P1.1.
