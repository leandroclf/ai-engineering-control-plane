# Design: Consolidação documental e roadmap OpenSpec

## Context

O repositório já possui documentação suficiente para operar, mas a navegação
entre arquivos não distingue com firmeza:

- o que é fonte canónica atual;
- o que é evidência/validação;
- o que é histórico;
- o que é planejamento.

O desenho abaixo organiza esses quatro planos sem apagar a história.

## Documentation taxonomy

### 1. Canonical current docs

Documentos que descrevem o comportamento atual do sistema:

- `docs/product/*`
- `docs/architecture/current.md`
- `docs/reference/*`
- `docs/security/*`
- `docs/api/*`
- `docs/validation/*`
- `docs/runbook.md`
- `docs/operations/recovery.md`
- `docs/compatibility.md`
- `docs/external-dependencies.md`
- `docs/memory-model.md`

### 2. Evidence and status

Documentos que espelham estado e validação:

- `docs/implementation-progress.md`
- `release/v1-contract.json`
- `docs/evaluations/v1-roi.md`

### 3. Historical material

Documentos mantidos por proveniência:

- `docs/01-05`
- `docs/06-12`

### 4. OpenSpec planning

Mudanças planejadas devem viver em `openspec/changes/<change-id>/` com
proposal, design, tasks e, quando necessário, delta specs.

## Decision

1. O `docs/README.md` será o índice principal da documentação viva.
2. O arquivo `docs/archive/README.md` será o índice canónico do legado.
3. `docs/archive/evolution/README.md` será apenas navegação legada.
4. `docs/implementation-progress.md` será um espelho curto com link para o
   ledger canónico do OpenSpec.
5. Novos planos devem entrar em OpenSpec antes de virar nova documentação
   dispersa.

## Consequences

- Menos duplicação e menos caminhos concorrentes para a mesma informação.
- Melhor onboarding para agentes e humanos.
- Mais fácil saber onde editar quando o comportamento muda.
- A história continua preservada, mas não compete com os contratos atuais.

