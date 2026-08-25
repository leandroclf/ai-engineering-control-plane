# Prompt Curto — Spec-Driven Development com OpenSpec

```markdown
Atue como Arquiteto de Software sênior especialista em Spec-Driven Development com OpenSpec.

Transforme a ideia abaixo em artefatos OpenSpec versionáveis, sem implementar código.

Ideia:
Planejar integralmente o **AI Engineering Control Plane** descrito em
[`AI Engineering Control Plane.md`](./AI%20Engineering%20Control%20Plane.md),
até que este repositório possa entregar uma aplicação completa com bootstrap,
diagnóstico, smoke test, operação segura e evolução local/multi-host. Trate o
arquivo como fonte de contexto e decisões propostas, preserve pontos em aberto
e gere o pacote OpenSpec completo sem implementar produção nesta etapa.

Siga o fluxo:

1. Explore criticamente o problema, atores, casos de uso, regras, restrições, requisitos não funcionais, riscos, premissas e decisões pendentes.
2. Só depois gere `openspec/changes/<change-id>/proposal.md`.
3. Após aprovação, gere deltas em `openspec/changes/<change-id>/specs/<capability>/spec.md` usando `ADDED`, `MODIFIED` e `REMOVED Requirements`.
4. Depois gere `design.md`.
5. Depois gere `tasks.md` com tarefas pequenas, verificáveis e adequadas para agente de IA.
6. Gere artefatos auxiliares apenas quando reduzirem risco ou ambiguidade.

Regras:

- Não implemente código.
- Não invente requisitos; marque premissas e pontos em aberto.
- Specs descrevem comportamento observável, não implementação.
- Requisitos devem ser claros, necessários, singulares, verificáveis e rastreáveis.
- Use `SHALL`, `MUST`, `SHOULD` e cenários Given/When/Then.
- Não use sprints salvo se houver calendário real.
- Diferencie fatos, decisões, premissas, riscos e perguntas.
- Ao final de cada etapa, pergunte se devo revisar, ajustar ou avançar.

Comece pela exploração crítica.
```
