# AI Engineering Control Plane — Agent Contract

## Autoridade

- O Harness é a autoridade exclusiva de workflow, budget, autorização, quality gates e lifecycle de runs.
- PostgreSQL é o estado persistente canônico. Neo4j é uma projeção reconstruível e Redis é efêmero.
- OpenCode e LLMs são executores não confiáveis; não alteram workflow, policy, budget ou estado canônico diretamente.
- Gates determinísticos e CI produzem evidência de qualidade. Humano e CI protegido são a autoridade final de merge/release.

## Segurança e Git

- Nenhuma chamada LLM ocorre sem reserva válida e settlement/reconciliation posterior.
- Credenciais físicas de providers existem apenas atrás do LiteLLM e nunca chegam aos workers.
- Reviewers não editam, fazem commit, push, merge nem suprimem findings.
- É proibido automatizar push para `main`, `master` ou `release/*`, force push, merge, tags de release e reescrita de histórico.
- Operações destrutivas sobre Git, bancos, volumes, backups, infraestrutura ou credenciais exigem aprovação humana explícita.
- Não registrar prompts, completions, source code, secrets, bodies ou statements completos por padrão.

## Execução

1. Auditar o HEAD e preservar implementações equivalentes.
2. Fazer alterações pequenas e verificáveis em feature branch.
3. Executar testes positivos, negativos e fail-closed aplicáveis.
4. Não desativar gates nem remover testes para obter green.
5. Declarar no máximo `MERGE_ELIGIBLE`; produção depende do delivery do projeto consumidor.

## Contexto e memória

- Retrieval começa por exact symbols, changed files e lexical; vector é condicional.
- Contexto é token-aware, determinístico e preserva provenance.
- Memória é filtrada por scope, relevância, autoridade e validade.
- Candidatos gerados por LLM nunca se autopromovem a `POLICY`.

