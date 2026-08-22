# ADR-004 — Autoridades operacionais da v1

## Status

Aceito em 2026-08-22.

## Decisão

- PostgreSQL é a autoridade transacional de tasks, runs, budgets e memória.
- O Harness reserva budget antes de cada invocação, reconcilia usage real e controla transições.
- O Context Service Python é a implementação autoritativa do Context Compiler v2.
- O Gate Registry resolve todas as capabilities antes da primeira invocação de agente.
- Neo4j é uma projeção reconstruível; Redis não contém estado autoritativo.
- O executor opera com filesystem raiz read-only e apenas na rede interna; somente LiteLLM possui provider egress.

## Consequências

Resume não recria budget, falhas de preflight rejeitam o run antes de consumo de LLM e disaster recovery
requer reconstrução do índice/grafo após restaurar PostgreSQL e a configuração OpenCode.
