# Runtime manifests

Cada manifesto registra somente uma imagem promovida após compliance, testes de
contrato, suíte adversarial e evals. `UNVALIDATED` é deliberadamente bloqueante:
nenhuma execução de produção pode resolver uma versão mais nova ou substituir o
digest silenciosamente.

Os manifests Codex, Claude Code e OpenCode começam sem digest porque o package e a
versão efetivamente candidatados precisam ser fornecidos pela pipeline. O fluxo
provider-specific está documentado em [investigação de autenticação](../docs/operations/provider-auth-investigation-2026-08.md).

## Estado após revisão de integração

Os três manifests permanecem `UNVALIDATED`. Os digests locais anteriores e as
alegações de login/execution não têm atestação reproduzível suficiente.
`record-live-auth-evidence.sh` e `promote.sh` encerram com erro: não produzem PASS
por autodeclaração. Reabilitar promoção exige evidência independente vinculada à
imagem exata e às operações de autenticação e execução realmente realizadas.

O worker-manager mantém seu caminho governado anterior; os contratos novos são
experimentais e não são ativados no servidor nem nos profiles de produção.
Compliance STRICT/CONTROLLED falha fechado enquanto não houver adapter que
comprove bloqueio de descoberta nativa; variáveis AICP não são prova comportamental.
A pipeline candidata verifica isolamento básico e a versão da CLI na imagem,
mas não atesta login live, isolamento de extensões ou prontidão de produção.
