# AI Engineering Control Plane — documentação canónica

Esta pasta reúne a documentação viva do repositório. Quando houver sobreposição,
prefira a fonte canónica mais abaixo e trate o material histórico como
proveniência, não como requisito atual.

## Fontes canónicas atuais

| Precisa de… | Leia primeiro |
|---|---|
| Visão de produto, personas, IA e UX | `docs/product/product-vision.md`, `docs/product/personas.md`, `docs/product/information-architecture.md`, `docs/product/ux-principles.md`, `docs/product/terminology.md` |
| Arquitetura em vigor | `docs/architecture/current.md` e `docs/architecture/diagrams/*.md` |
| Catálogo e contratos de domínio | `docs/reference/component-catalog.md`, `docs/reference/configuration.md`, `docs/reference/events.md`, `docs/reference/glossary.md` |
| API pública e integrações | `docs/api/control-plane-v1.openapi.yaml`, `docs/api/memory-v1.md` |
| Segurança e invariantes | `docs/security/invariants.md`, `docs/security/ui-invariants.md`, `docs/security/adversarial-certification.md`, `docs/security/image-critical-classification.md`, `docs/threat-model.md` |
| Validação e evidência | `docs/validation/*.md`, `release/v1-contract.json`, `docs/evaluations/v1-roi.md` |
| Operação e recuperação | `docs/runbook.md`, `docs/operations/recovery.md`, `docs/compatibility.md`, `docs/external-dependencies.md`, `docs/memory-model.md` |
| Estado de implementação | `docs/implementation-progress.md` e `openspec/changes/bootstrap-ai-engineering-control-plane/implementation-status.md` |

## OpenSpec e planejamento

| Objetivo | Local |
|---|---|
| Base de planejamento do produto e bootstrap | `openspec/changes/bootstrap-ai-engineering-control-plane/` |
| Console e experiência de documentação | `openspec/changes/build-aicp-console-and-documentation-experience/` |
| Consolidação documental e roadmap do que falta | `openspec/changes/documentation-canonicalization-and-roadmap/` |

## Material histórico

Os arquivos numerados na raiz desta pasta continuam disponíveis para
proveniência, mas não são mais a fonte de verdade para planejamento atual.

| Grupo | Conteúdo | Status |
|---|---|---|
| `docs/01-05` | pacote de prompts e template OpenSpec | histórico |
| `docs/06-10` | guias de visão e evolução do control plane | histórico |
| `docs/11-12` | revisão UX/documentação e evolução do console | histórico |

Para o índice completo do material legado, leia `docs/archive/README.md`.

## Regra de edição

Se a mudança altera comportamento do produto, a documentação canónica e o
change OpenSpec correspondente devem ser atualizados em conjunto. Se a mudança
for apenas histórica, mantenha a proveniência em arquivo e não duplique a
descrição em novos documentos de produto.
