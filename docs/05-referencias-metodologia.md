# Referências e Metodologia

Este prompt foi estruturado para unir práticas de Spec-Driven Development com engenharia de requisitos e uso seguro de agentes de IA.

## Fontes principais

### OpenSpec

OpenSpec organiza o trabalho em mudanças versionáveis, geralmente contendo proposal, design, tasks e deltas de specs por capability.

Referências:

- https://openspec.dev/
- https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md
- https://github.com/Fission-AI/OpenSpec/blob/main/README.md

Decisões aplicadas no prompt:

- Uso de `openspec/changes/<change-id>/`.
- Separação entre specs permanentes e mudanças propostas.
- Uso de specs como fonte da verdade do comportamento.
- Uso de deltas por capability.
- Revisão antes de implementação.
- Tarefas pequenas e verificáveis.

## Engenharia de requisitos

### ISO/IEC/IEEE 29148

A norma ISO/IEC/IEEE 29148 trata de processos de engenharia de requisitos para sistemas e software ao longo do ciclo de vida e define informações relacionadas a requisitos.

Referências:

- https://www.iso.org/standard/72089.html
- https://standards.ieee.org/ieee/29148/6937/

Decisões aplicadas no prompt:

- Requisitos precisam ser claros, necessários, rastreáveis e verificáveis.
- A documentação deve separar necessidades, requisitos, decisões e tarefas.
- O processo é iterativo e pode ser aplicado em sistemas novos ou existentes.
- Ambiguidades devem ser explicitadas como premissas, riscos ou pontos em aberto.

## Boas práticas de escrita de requisitos

### NASA — How to Write a Good Requirement

A NASA recomenda requisitos no formato “o produto/sistema shall...”, com ação verificável e terminologia consistente.

Referência:

- https://www.nasa.gov/reference/appendix-c-how-to-write-a-good-requirement/

Decisões aplicadas no prompt:

- Uso de `SHALL`, `MUST`, `SHOULD` e `MAY`.
- Evitar termos vagos sem métrica.
- Exigir critérios verificáveis.
- Separar comportamento observável de detalhe de implementação.

## Racional das principais escolhas

### 1. `proposal.md` substitui PRD genérico

O PRD tradicional é útil para contexto de produto, mas pode virar documento paralelo e redundante. No fluxo proposto, o conteúdo de PRD é absorvido pelo `proposal.md`, preservando:

- problema;
- objetivos;
- fora de escopo;
- usuários;
- histórias ou jornadas;
- critérios de sucesso;
- impactos esperados.

### 2. Specs não são design técnico

Specs devem descrever comportamento observável. Decisões como bibliotecas, classes, frameworks, padrões de arquitetura, tabelas e endpoints pertencem ao `design.md`, salvo quando são parte explícita do contrato externo.

### 3. Tasks substituem sprints quando não há calendário

Sprints só fazem sentido com time, capacidade, duração e objetivo temporal. Sem isso, o mais correto é decompor o trabalho em tarefas pequenas, sequenciais e verificáveis.

### 4. Requisitos verificáveis reduzem falhas em agentes de IA

Agentes de IA tendem a preencher lacunas com suposições. O prompt força:

- perguntas bloqueantes;
- premissas explícitas;
- critérios de aceite testáveis;
- cenários Given/When/Then;
- checklist de validação.

### 5. Prompts também podem ser tratados como produto

Quando o “projeto” é um prompt, o prompt deve ser especificado como produto:

- usuários são humanos ou agentes;
- capabilities são etapas, regras, artefatos e formatos;
- requisitos descrevem o comportamento esperado do assistente;
- tarefas evoluem o prompt, exemplos, checklists e validações.
