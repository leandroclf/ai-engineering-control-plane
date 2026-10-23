# Estado das evidências de autenticação por provider — 2026-08

Status: **LIMITED / UNVALIDATED** para Codex, Claude Code e OpenCode.

O registro anterior declarava ciclos live e promoção local, mas não contém
atestação reproduzível ligada à imagem, aos comandos e aos resultados reais.
Essas alegações não são evidência de aprovação. Os manifests permanecem
UNVALIDATED e os scripts de promoção e geração de PASS estão bloqueados.

Nesta integração não foram executados login, logout, re-login, refresh nem
chamadas autenticadas dos três candidatos. O procedimento documentado de AUTH
fica separado do código do projeto. A validação candidata sem credenciais cobre
somente versão da CLI e fronteiras básicas do container, sem provar isolamento
de extensões nem prontidão de produção. O worker-manager preserva o caminho
governado existente, sem ativar automaticamente os novos contratos.

Para avançar, registrar evidência independente vinculada ao digest imutável da
imagem e a cada operação efetivamente realizada; só depois rever promoção e o
workload pareado P1.1. Não inferir rotação de tokens a partir de status válido.
