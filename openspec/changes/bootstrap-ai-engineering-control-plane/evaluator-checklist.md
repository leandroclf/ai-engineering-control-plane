# Evaluator Checklist: AI Engineering Control Plane

## Proposal alignment

- [ ] A implementação entrega um ambiente governado, não agentes livremente
  auto-orquestrados.
- [ ] O core inicializável foi priorizado antes de GraphRAG e multi-host.
- [ ] Nenhuma capacidade fora de escopo foi apresentada como pronta.
- [ ] `READY_FOR_HUMAN_REVIEW` não foi confundido com produção pronta.

## Bootstrap e operação

- [ ] Um host limpo suportado conclui bootstrap, doctor e smoke.
- [ ] A segunda execução preserva secrets e estado.
- [ ] Falta de requisito/configuração falha cedo e sem vazamento.
- [ ] O core funciona sem observabilidade self-hosted completa.
- [ ] Versões e imagens estão congeladas conforme o ambiente-alvo.
- [ ] README e runbook reproduzem os comandos realmente testados.

## Workflow e qualidade

- [ ] O Harness, não o agente, controla estados e transições.
- [ ] Outputs são validados por schemas versionados.
- [ ] Gates obrigatórios indisponíveis não viram `PASS`.
- [ ] Budgets de calls, tokens, custo e iterações são aplicados.
- [ ] Finding/diff repetido interrompe loop sem progresso.
- [ ] Targeted repair reexecuta scanner original e regressão.
- [ ] CI reconstrói evidências em checkout limpo.

## Context e memória

- [x] Os sete escopos estão implementados com autorização server-side.
- [x] Memória de projeto A não aparece em projeto B.
- [x] Toda memória ativa tem authority/status/version/provenance aplicáveis.
- [x] Invalidation/supersession/expiry gera evento auditável.
- [x] Raw secret é rejeitado ou redigido antes da persistência.
- [x] Reindex no-op processa zero arquivos.
- [x] Rename/delete atualiza projeções sem órfãos relevantes.
- [x] Neo4j é reconstruído de Git + estado canônico.
- [x] Exact-symbol precede fallback semântico.
- [x] ContextPackage respeita o budget calculado e explica seleção.

## Gateway e segurança

- [ ] Provider credentials existem somente no gateway/secret backend.
- [ ] Workspace usa chave virtual limitada e aliases por capability.
- [ ] Docker socket do host não está montado no workspace.
- [ ] `.env`, external directory, push, merge e deploy são negados.
- [ ] Reviewer read-only não consegue editar.
- [ ] Prompt injection em source não sobrepõe política/tarefa humana.
- [ ] Findings de secret são persistidos apenas com redaction/fingerprint.
- [ ] Suppressions exigem metadados/approval e respeitam expiry.
- [ ] Containers/networks seguem baseline de menor privilégio.

## Observabilidade, backup e multi-host

- [ ] Task ID correlaciona contexto, agentes, modelos, tools, gates e loops.
- [ ] Tokens, custo, fallback, gate status e context mix são calculáveis.
- [ ] Source code/full prompts não são exportados por default.
- [ ] Backup inclui estado canônico e material gateway indispensável.
- [ ] Restore drill recupera estado e reconstrói projeções.
- [ ] Novo host usa protocolos seguros, não volumes de banco compartilhados.
- [ ] Falha de telemetry não altera evidência dos gates.

## Final evidence

- [ ] Todos os requirements SHALL/MUST têm teste ou validação equivalente.
- [ ] Todos os cenários críticos têm evidência anexada.
- [ ] Tasks incompletas estão explicitamente fora da release, não ocultas.
- [ ] Riscos residuais, ADRs e decisões pendentes estão atualizados.
- [ ] SBOM, digests, schemas, policies e release manifest identificam exatamente
  o que foi avaliado.
