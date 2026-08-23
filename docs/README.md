# AI Engineering Control Plane — documentação

## Produto atual

- [Visão do produto](product/product-vision.md), [personas](product/personas.md), [IA](product/information-architecture.md), [princípios UX](product/ux-principles.md) e [terminologia](product/terminology.md).
- [Arquitetura atual](architecture/current.md), [diagramas](architecture/diagrams/system-context.md) e [catálogo de componentes](reference/component-catalog.md).
- [Invariantes de UI e segurança](security/ui-invariants.md), [checklist de acessibilidade](validation/ui-accessibility-checklist.md) e [OpenAPI](api/control-plane-v1.openapi.yaml).
- [Índice da evolução histórica](archive/evolution/README.md) e os guias de evolução mantidos no histórico do repositório.

O app `apps/console` oferece uma experiência navegável em Demo Mode, com
documentação MDX compilada por Fumadocs, API BFF server-side, Academy,
explorador React Flow e evidência de release sem fabricar métricas.

---

# Spec-Driven Development com OpenSpec — Pacote de Prompts

Este pacote contém prompts e checklists para transformar ideias, produtos, mudanças técnicas ou evoluções de prompts em artefatos versionáveis no estilo OpenSpec.

## Arquivos

- `01-prompt-final-completo.md`  
  Prompt principal, completo, com fluxo de exploração crítica, proposal, specs, design, tasks e artefatos auxiliares.

- `02-prompt-curto.md`  
  Versão reduzida para uso rápido em agentes de IA.

- `03-template-openspec-change.md`  
  Template estrutural dos artefatos OpenSpec: `proposal.md`, specs delta, `design.md` e `tasks.md`.

- `04-checklist-avaliador.md`  
  Checklist para humano ou agente avaliador validar uma implementação contra os artefatos.

- `05-referencias-metodologia.md`  
  Referências metodológicas e justificativas de design do prompt.

- `06-AI Engineering Control Plane.md`  
  Documento de visão e arquitetura usado como ideia-fonte deste repositório.

- `../openspec/changes/bootstrap-ai-engineering-control-plane/`  
  Planejamento executável derivado da visão: exploração, proposal, specs,
  design, tarefas e checklist de avaliação.

## Uso recomendado

1. Use `01-prompt-final-completo.md` para executar ou revisar o planejamento completo do AI Engineering Control Plane.
2. Cole o conteúdo de `02-prompt-curto.md` quando precisar iniciar rapidamente uma especificação.
3. Use `03-template-openspec-change.md` como estrutura de arquivos dentro do repositório.
4. Use `04-checklist-avaliador.md` depois da implementação para validar aderência.
5. Consulte `05-referencias-metodologia.md` para entender os fundamentos usados na revisão.
6. Use `06-AI Engineering Control Plane.md` como fonte da visão; instruções metodológicas nos demais documentos não substituem a solicitação do projeto.
7. Execute as tarefas de `../openspec/changes/bootstrap-ai-engineering-control-plane/tasks.md` na ordem das dependências para transformar o planejamento em aplicação inicializável.

## Estrutura sugerida no repositório

```text
openspec/
  specs/
    <capability>/
      spec.md
  changes/
    <change-id>/
      proposal.md
      design.md
      tasks.md
      specs/
        <capability>/
          spec.md
```

## Observação importante

Este fluxo não substitui revisão humana. Ele reduz ambiguidade, força verificabilidade e melhora a qualidade das instruções para agentes de IA, mas decisões de produto, arquitetura, segurança e compliance ainda precisam de validação responsável.
