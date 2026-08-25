# Avaliação UI/UX do site LF Soluções — 2026-08-24

## Escopo e execução

Foi executado o workflow governado `ui-ux-assessment` em modo somente leitura sobre o mesmo `HEAD` limpo do repositório `site-lf-solucoes`, com a mesma consulta e fallback desabilitado.

| Provider | Run | Resultado | Estágios | Achados no assessment |
|---|---|---|---:|---:|
| Claude Code Subscription | `05f98fec-33c1-4e4d-8b5b-787059cf3528` | `ready-for-human-review` | 2 | 10 |
| Codex Subscription | `01ce0802-87ab-404b-99a8-5f637d8923d4` | `ready-for-human-review` | 2 | 10 |

Ambos os runs registraram provider explícito, settlement sem drift, `mutation.started` falso e worktree preservado. O baseline local também passou nos validadores de estrutura, smoke de qualidade, segurança e budget do site; as capturas visuais temporárias ficam em `/tmp/aicp-site-uiux-baseline/`.

## Convergências

- A home possui duas tags `canonical` conflitantes (`index.html:24` e `index.html:33`).
- O grupo antigo de páginas em `solucoes/` e `sobre/nossa-equipe.html` não replica o padrão de `canonical` e `skip-link` usado pelas páginas mais novas.
- `#diagnostic-result` e `#roi-result` são revelados dinamicamente sem `aria-live`/`role=status`.
- O design system e os componentes interativos apresentam boas referências internas no dashboard e nas três páginas de soluções mais novas, permitindo correção incremental por padronização.

## Achados complementares

O Codex identificou o risco de o formulário Formspree ser bloqueado pela CSP, falta de labels persistentes no formulário de contato, sitemap incompleto, ausência de cobertura Lighthouse móvel e problemas no API Sandbox. Claude identificou, adicionalmente, favicon ausente nas páginas de marketing, dimensões ausentes em imagens, variável CSS `--danger` não definida, ícone WhatsApp em emoji e lacuna de breakpoint entre 761–920px.

O ID Formspree `xpwzgkqd` e a política de indexação do dashboard permanecem perguntas abertas; não serão alterados automaticamente.

## Correções aplicadas nesta rodada

Foram aplicadas somente correções objetivas e verificáveis: CSP/feedback e labels do formulário sem trocar o ID externo, canonical duplicado, regiões dinâmicas acessíveis, skip links, favicon, dimensões de logo, variável `--danger` e padronização visual do CTA WhatsApp. Mudanças de copy, sitemap/indexação, breakpoint e template JSON-LD ficam como backlog separado por exigirem decisão de produto ou validação adicional.

## Validação pós-correção

No repositório do site, passaram:

- `python3 scripts/validate_site_structure.py`
- `python3 scripts/quality_smoke.py`
- `python3 scripts/security_smoke.py`
- `python3 scripts/budget_check.py`
- `git diff --check`
