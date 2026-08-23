# Arquitetura atual — AICP v1

## Autoridade e fronteiras

O Harness continua sendo a autoridade exclusiva de workflow, budget, autorização, gates e lifecycle. PostgreSQL é o estado canônico; Neo4j é projeção reconstruível; Redis é cache efêmero.

O caminho de produção usa `WorkerExecutionPlane`. O Harness cria a execução lógica, reserva budget e persiste evidência; o `worker-manager` deployment-side cria um worktree Git por run, inicia o worker e executa OpenCode, gates e scanners por capabilities estruturadas. O Harness não recebe um bind mount RW do projeto e não recebe Docker socket.

O modo local usa `LocalExecutionPlane` apenas para desenvolvimento. `AICP_RELEASE_MODE=production` falha antes de iniciar quando `AICP_EXECUTION_MODE` não é `ephemeral`.

## Execution Plane

```text
Harness
  ├─ workflow / budget / policy / evidence
  └─ ExecutionPlane
       ├─ LocalExecutionPlane (development)
       └─ WorkerExecutionPlane (release/production)
            └─ worker-manager
                 └─ one Git worktree + one worker per run
```

As interfaces de agente e capability não aceitam mais `ProcessRunner` ou `OpenCodeController` concretos nos handlers. O worker manager valida `profile + capability + tool + argv` antes de qualquer `docker exec`; shell genérico, comandos arbitrários e path escape são rejeitados.

## Evidência e estado residual

O worker coleta `git status` e `git diff` com duas chamadas argv distintas. Ao terminar, o manager revoga credenciais, remove o container e remove o worktree. Na inicialização, o deployment-side reconciliates containers e diretórios de runs abandonados em seu boundary dedicado.

## Estado de certificação

O código, testes unitários, testes adversariais, worktree Docker e lifecycle HTTP foram entregues neste ciclo. A certificação dinâmica de OpenCode real + build/test/scanners ainda é um controle bloqueado até ser executada com o gateway/provider de certificação e evidência de runtime correspondente.
