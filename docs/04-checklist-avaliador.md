# Checklist de Avaliação — Spec-Driven Development com OpenSpec

Use este checklist para validar se uma implementação, criada por humano ou agente de IA, está aderente aos artefatos OpenSpec.

## 1. Alinhamento com `proposal.md`

- [ ] A implementação resolve o problema descrito no proposal.
- [ ] Os objetivos definidos foram atendidos.
- [ ] Nenhum item fora de escopo foi implementado sem aprovação.
- [ ] Os atores impactados foram considerados.
- [ ] As regras de negócio relevantes foram respeitadas.
- [ ] Os critérios de sucesso são verificáveis.
- [ ] As premissas usadas continuam válidas ou foram atualizadas.
- [ ] As perguntas em aberto foram resolvidas ou explicitamente aceitas como risco.

## 2. Conformidade com specs

- [ ] Cada requirement `SHALL` tem implementação correspondente.
- [ ] Cada requirement `MUST` tem implementação correspondente.
- [ ] Cada behavior opcional `MAY` foi implementado apenas quando aprovado.
- [ ] Nenhum comportamento externo à spec foi adicionado sem justificativa.
- [ ] Cenários Given/When/Then possuem teste ou validação equivalente.
- [ ] Caminhos felizes foram cobertos.
- [ ] Entradas inválidas foram cobertas.
- [ ] Permissões insuficientes foram cobertas.
- [ ] Recursos inexistentes foram cobertos.
- [ ] Estados conflitantes foram cobertos.
- [ ] Falhas de integração externa foram cobertas quando aplicável.
- [ ] Concorrência foi considerada quando aplicável.
- [ ] Limites de performance ou volume foram validados quando especificados.

## 3. Conformidade com `design.md`

- [ ] A arquitetura implementada segue o design aprovado.
- [ ] Decisões técnicas aprovadas foram respeitadas.
- [ ] Alternativas descartadas não foram reintroduzidas sem justificativa.
- [ ] Trade-offs documentados continuam válidos.
- [ ] Componentes afetados batem com o escopo definido.
- [ ] Fluxos principais foram implementados.
- [ ] Fluxos de erro foram implementados.
- [ ] Estratégia de autenticação/autorização foi respeitada.
- [ ] Estratégia de persistência foi respeitada.
- [ ] Estratégia de migração foi respeitada.
- [ ] Estratégia de observabilidade foi implementada.
- [ ] Plano de rollback é viável.

## 4. Qualidade de tarefas

- [ ] Todas as tarefas do `tasks.md` foram concluídas ou explicitamente canceladas.
- [ ] Cada tarefa possui evidência de validação.
- [ ] Não há tarefas grandes demais marcadas como concluídas sem decomposição.
- [ ] Dependências entre tarefas foram respeitadas.
- [ ] Tarefas de teste não foram omitidas.
- [ ] Tarefas de observabilidade não foram omitidas quando especificadas.
- [ ] Tarefas de rollback/migração não foram omitidas quando aplicáveis.

## 5. Testes

- [ ] Testes unitários relevantes passam.
- [ ] Testes de integração relevantes passam.
- [ ] Testes de contrato passam quando há API, evento ou integração.
- [ ] Testes end-to-end existem quando o fluxo crítico exige.
- [ ] Testes de segurança existem quando há autenticação, autorização ou dados sensíveis.
- [ ] Testes de performance existem quando há critério de volume ou latência.
- [ ] Testes não validam apenas implementação interna; validam comportamento esperado.

## 6. API, contratos e compatibilidade

- [ ] Contratos HTTP, eventos ou schemas estão documentados.
- [ ] Mudanças breaking foram explicitamente aprovadas.
- [ ] Versionamento foi tratado quando necessário.
- [ ] Idempotência foi considerada quando aplicável.
- [ ] Paginação, rate limit e códigos de erro foram definidos quando aplicável.
- [ ] Clientes existentes não quebram sem plano de migração.
- [ ] Mensagens de erro não vazam dados sensíveis.

## 7. Dados e migração

- [ ] Alterações de schema estão documentadas.
- [ ] Migrações são reversíveis ou têm estratégia de mitigação.
- [ ] Backfill foi tratado quando necessário.
- [ ] Índices necessários foram considerados.
- [ ] Invariantes de dados foram preservadas.
- [ ] Retenção e privacidade foram consideradas quando aplicável.

## 8. Segurança e privacidade

- [ ] Autenticação foi validada.
- [ ] Autorização foi validada em cenários positivos e negativos.
- [ ] Dados sensíveis não aparecem em logs.
- [ ] Inputs externos são validados.
- [ ] A implementação não amplia superfície de ataque sem mitigação.
- [ ] Segredos não foram hardcoded.
- [ ] Princípio do menor privilégio foi respeitado.

## 9. Observabilidade e operação

- [ ] Logs relevantes foram adicionados.
- [ ] Métricas relevantes foram adicionadas.
- [ ] Tracing foi considerado em fluxos distribuídos.
- [ ] Alertas foram definidos para falhas críticas.
- [ ] Runbook foi atualizado quando necessário.
- [ ] Degradação ou fallback foi tratado quando especificado.
- [ ] Rollback foi testado ou revisado.

## 10. Revisão final

- [ ] A implementação está alinhada com o problema, não apenas com uma solução presumida.
- [ ] Não há requisitos inventados durante a implementação.
- [ ] Não há escopo oculto.
- [ ] Riscos remanescentes foram documentados.
- [ ] Decisões divergentes foram justificadas.
- [ ] O artefato final pode ser revisado por humano ou agente sem depender de contexto implícito.
