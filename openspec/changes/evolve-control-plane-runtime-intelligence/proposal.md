# Proposal: evolução P0/P1 do runtime e da inteligência governada

## Change ID

`evolve-control-plane-runtime-intelligence`

## Status

Implemented locally; provider-auth live validation and image promotion remain
explicitly blocked until candidate packages, credentials de teste e registry
digest are supplied.

## Context

O baseline `47ea973c4fffcfba86fd145e2b70b141f2a04396` já possui Harness,
worker-manager, providers, gates e Context API. A evolução deve reforçar as
fronteiras existentes sem criar um segundo Control Plane dentro de Codex,
Claude Code ou OpenCode.

## Goals

- tornar Planner, Architect, Implementer, Reviewer e Security Reviewer contratos
  cognitivos explícitos, mantendo workflow/budget/gates no Harness;
- impor execução com Runtime Contract, Compliance Check e política STRICT;
- separar AUTH MODE sem source tree de EXECUTION MODE sem login interativo;
- compilar contexto progressivamente, com budget, deduplication e provenance;
- fornecer pipeline candidate → compliance → contract/adversarial/evals →
  promote por digest e rollback;
- preservar limitações como `LIMITED`/`UNVALIDATED`, sem falsos PASS.

## Non-goals

- broker genérico de OAuth ou armazenamento de tokens no AICP;
- RAG/Neo4j adicional antes de benchmark;
- cross-model review obrigatório;
- promover pacote/versão de provider sem validação oficial e imagem imutável.
