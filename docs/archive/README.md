# Arquivo histórico

Este diretório reúne material legado que ajuda a entender a evolução do
AI Engineering Control Plane, mas não deve ser tratado como fonte de verdade
para o estado atual.

## Pacote de prompts OpenSpec

Arquivos:

- `docs/01-prompt-final-completo.md`
- `docs/02-prompt-curto.md`
- `docs/03-template-openspec-change.md`
- `docs/04-checklist-avaliador.md`
- `docs/05-referencias-metodologia.md`

Uso:

- preservam o encadeamento original entre visão, prompt e template OpenSpec;
- servem como referência metodológica;
- não descrevem o estado atual do produto.

## Guias de evolução

Arquivos:

- `docs/06-AI Engineering Control Plane.md`
- `docs/07-AI Engineering Control Plane_evolution.md`
- `docs/08-AI Engineering Control Plane_evolution.md`
- `docs/09-AI Engineering Control Plane_evolution.md`
- `docs/10-AI Engineering Control Plane_evolution.md`
- `docs/11-AI Engineering Control Plane_evolution-ux.md`
- `docs/12-AI Engineering Control Plane_evolution-ux.md`

Leitura recomendada:

1. `docs/06-AI Engineering Control Plane.md` para a visão inicial.
2. `docs/07-10` para entender como a arquitetura foi endurecida ao longo das
   revisões.
3. `docs/11-12` para o histórico de UX, console e documentação.

Estado:

- histórico;
- parcialmente superado por implementação real e pelos índices canónicos;
- útil apenas para proveniência e comparação.

## Fontes atuais que substituem o legado

| Legado | Substituído por |
|---|---|
| Vision/prompt pack | `docs/product/*`, `docs/architecture/current.md`, `docs/reference/*`, `openspec/changes/*` |
| Evolution guides | `docs/README.md`, `docs/implementation-progress.md`, `docs/security/*`, `docs/validation/*` |

Se precisar reconstruir a história de uma decisão, use os arquivos acima e
depois volte para os contratos canónicos atuais.
