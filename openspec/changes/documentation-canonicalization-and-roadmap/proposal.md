# Proposal: Consolidação documental e roadmap OpenSpec

## Change ID

`documentation-canonicalization-and-roadmap`

## Status

Draft

## Context

A documentação do repositório cresceu em várias ondas e hoje mistura fontes
canónicas, evidência, história e prompts legados. Isso dificulta saber onde
está o estado atual, o que já foi implementado e o que ainda precisa de
planejamento formal. Também há sobreposição entre `docs/implementation-progress.md`
e o ledger canónico do OpenSpec.

## Problem

Sem uma taxonomia documental clara, novos leitores tendem a seguir arquivos
históricos como se fossem requisitos atuais. Isso gera duplicação, ruído e
risco de reimplementar comportamento já entregue.

## Goals

- Definir uma fonte canónica única para docs atuais.
- Isolar material histórico em arquivo explícito.
- Reduzir duplicação entre `docs/implementation-progress.md` e OpenSpec.
- Registrar, de forma legível, o que já está implementado e o que ainda falta.
- Criar um roadmap OpenSpec para as próximas ações documentais e de produto.

## Non-Goals

- Reescrever comportamento de produto.
- Apagar proveniência histórica.
- Converter OpenSpec em backlog genérico fora do repositório.
- Mover todas as páginas de uma só vez se isso quebrar links externos.

## Acceptance

- `docs/README.md` passa a apontar rapidamente para as fontes canónicas.
- Arquivos numerados e guias antigos ficam claramente marcados como históricos.
- `docs/implementation-progress.md` vira um espelho curto, não um segundo ledger.
- O OpenSpec passa a carregar o plano de consolidação e os próximos passos.

## Scope

### In scope

- Índice canónico da documentação.
- Arquivo histórico consolidado.
- Mapa de “implementado vs. falta”.
- Change OpenSpec para o trabalho documental contínuo.

### Out of scope

- Reescrita de toda a documentação de produto.
- Mudança de arquitetura ou runtime.
- Remoção destrutiva dos arquivos legados.

