# ADR-007 — Agent Harness e Capability Router

## Contexto

O prompt de evolução requer agents desacoplados de browser e demais integrações.
O projeto já tem Harness, workers e gates com fronteiras de segurança.

## Decisão

Adicionar `CapabilityProvider` e `CapabilityRouter` dentro do Harness. O Browser é
um provider especializado que recebe um cliente CDP injetado. O agente só conhece
nomes de capabilities e recebe observações estruturadas.

## Trade-offs

Interfaces em processo entregam testes determinísticos e não adicionam dependências,
mas não são ainda um browser distribuído. Um worker CDP real será uma evolução
compatível e ficará atrás do mesmo contrato.

## Consequências

Permissões e ausência de provider falham fechado; a migração pode ser incremental.
Não se introduz Neo4j/Kafka/vector DB adicional: as relações e memória existentes
continuam nas autoridades atuais.
