# Estado atual e gap analysis — Browser Harness

## O que já existe

O repositório já possui Harness como autoridade de workflow, budget, identidade,
workers efêmeros, gates de projeto, memory-service com escopos/proveniência,
Neo4j reconstruível e telemetria OTLP. Isso é reutilizado; não há migração para um
novo orchestrator nem um novo datastore.

## Gaps fechados neste slice

| Área | Antes | Depois |
|---|---|---|
| Browser | sem contrato transversal | `BrowserCapabilityProvider` baseado em CDP injetável |
| Tools | gates e workers específicos | `CapabilityProvider` + `CapabilityRouter` |
| Skills | sem lifecycle no Harness | registry, retrieval e transições evidenciadas |
| Falhas | recuperação dispersa | loop bounded + `SelfHealing` experimental |
| Avaliação | gates de projeto | `TaskEvaluator` para resultado observado |
| Autonomia | políticas existentes por workflow | níveis 0–3 também no loop de capability |

## Gaps remanescentes

Persistência de skills/sessões e worker Chrome real precisam ser ligados ao
memory-service/worker-manager em uma fase posterior. Network events, console e
download/upload devem receber collectors CDP dedicados; os comandos atuais deixam
essa fronteira explícita sem fingir que `Runtime.enable` já é um log collector.
