# ADR-009: Neo4j opcional e desligado por padrão

## Status

Accepted. A decisão de default está concluída; a decisão de investimento em
grafo permanece condicionada a uma medição específica de ROI.

## Contexto

Neo4j é uma projeção reconstruível e não uma autoridade de workflow, budget ou
memória. Mantê-lo no startup padrão aumenta custo operacional, superfície de
falha e tempo de feedback local. O benchmark determinístico de Context v3
mede retrieval e provenance, mas não mede ganho de Neo4j: a variante atual usa
uma projeção nula e não contém uma execução observada com grafo populado.

## Decisão

- `AICP_GRAPH_ENABLED=false` continua sendo o default;
- Neo4j só inicia com o profile `graph` e a flag explícita;
- `NullGraphProjection` mantém o caminho sem grafo determinístico;
- não será adicionada nova dependência de grafo até existir benchmark pareado
  com dataset, custo, latência e qualidade de retrieval comparáveis;
- PostgreSQL permanece a fonte canônica e o grafo continua reconstruível.

## Evidência

O benchmark Context v3 de 25 de agosto de 2026 executou 90 pares baseline /
candidate em 30 tarefas e 3 repetições:

- precisão média de contexto: `0.133651` → `0.245065` (`+0.111414`);
- tokens selecionados: `4046.37` → `3947.53` (`-2.44%`);
- uso de vetor: `100%` → `83.33%`;
- não houve geração LLM, custo monetário, defeito ou aceitação humana medidos;
- não houve variante Neo4j populada, portanto nenhum ganho do grafo é
  declarado.

Relatório reproduzível: `npm run benchmark:context-v3 -- .aicp/evaluations/context-v3.report.json`.

## Consequências

O ambiente local fica menor e o custo de operação é reduzido. A equipe ainda
deve executar um benchmark específico antes de promover Neo4j a dependência
default; até lá, manter o profile opcional é a decisão mais simples e reversível.
