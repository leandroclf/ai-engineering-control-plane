# Browser Harness — relatório de prontidão

Data: 2026-08-23

## Resultado

**Classificação: READY_FOR_CONTROLLED_ROLLOUT**.

Os gaps arquiteturais do primeiro slice estão implementados e os gates locais
passam. Isso não altera controles de release existentes: merge/release/produção
continuam sujeitos ao `release/v1-contract.json`, CI protegido, aprovação humana e
evidência de ambiente real.

## Evidência

| Controle | Evidência | Resultado |
|---|---|---|
| Contracts/capabilities | `CapabilityProvider`, `CapabilityRouter`, provider HTTP CDP | PASS |
| Browser isolation | `docker/browser-worker/Dockerfile`, `compose.yaml`, sem Docker socket | PASS |
| Session persistence | `memory-service/migrations/013_agent_harness.sql`, volume `browser-profiles` | PASS |
| Sensitive data | redaction antes de memory-service e token boundary | PASS |
| API | OpenAPI + endpoints de providers, skills, retrieval e métricas | PASS |
| Tests | 97 Node + 40 Python + security + acceptance | PASS |
| Image supply chain | base pinada, Chromium pinado, SBOM/proveniência | PASS |
| Real external browser journey | ainda depende de ambiente com secrets e aplicação alvo | PENDING |
| Release certification | controles históricos existentes | BLOCKED até evidência protegida |

## Procedimento de rollout

1. Aplicar `bash scripts/migrate.sh` em uma janela controlada.
2. Criar `secrets/browser_worker_token` com modo `0600`.
3. Executar `docker compose build browser-worker harness worker-manager`.
4. Executar `docker compose up -d` e validar `/ready` de Harness, memory-service e
   browser-worker.
5. Rodar uma tarefa browser somente leitura em um projeto de staging.
6. Validar no PostgreSQL o episódio, a sessão encerrada e ausência de secrets.
7. Promover gradualmente a autonomia de 0 para 1; níveis 2/3 continuam sujeitos a
   política e aprovação humana.

## Riscos remanescentes

- Ainda não existe uma jornada E2E contra uma aplicação web real neste repositório;
  o teste de integração precisa ser fornecido pelo projeto consumidor/staging.
- Skills persistidas no memory-service são carregadas no `SkillRegistry` durante o
  bootstrap; falha de sincronização bloqueia produção por padrão (`AICP_SKILLS_REQUIRED`),
  podendo ser relaxada apenas em desenvolvimento.
- A imagem usa pacotes Debian pinados no `versions.env`; atualização do Chromium
  exige regenerar evidência de scanner e repetir o build.
