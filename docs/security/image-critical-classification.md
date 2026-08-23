# Classificação dos findings CRITICAL das imagens próprias

Evidência gerada em 2026-08-23 com Trivy 0.74.0, banco atualizado de forma governada e scans offline após a atualização. Os SBOMs e relatórios completos estão em `.aicp/ci/images/` durante a execução local/CI.

Resultado: 103 ocorrências `CRITICAL` em quatro imagens. Nenhuma foi suprimida automaticamente. A decisão permanece `BLOCK_RELEASE` até upgrade, remoção, imagem-base corrigida ou aceitação de risco independente e registrada.

| CVE | Pacotes afetados / versão instalada | Versão corrigida indicada | Ocorrências | Classificação | Decisão |
|---|---|---:|---:|---|---|
| CVE-2023-45853 | `zlib1g`, `zlib1g-dev` / `1:1.2.13.dfsg-1` | não informada pelo feed | 6 | build/runtime conforme imagem; pacote OS alcançável por ferramentas nativas | upgrade de base; bloquear |
| CVE-2023-5841 | `libopenexr-3-1-30`, `libopenexr-dev` / `3.1.5-5` | não informada pelo feed | 6 | build-only nas imagens de Harness/workspace/worker-manager | upgrade/remover dependência; bloquear |
| CVE-2023-6879 | `libaom3` / `3.6.0-1+deb12u2` | não informada pelo feed | 3 | dependência transitiva OS; reachability não demonstrada | upgrade de base; bloquear |
| CVE-2025-7458 | `libsqlite3-0`, `libsqlite3-dev` / `3.40.1-2+deb12u2` | não informada pelo feed | 6 | runtime potencial em Node/CLI; não tratar como apenas build sem prova | upgrade de base; bloquear |
| CVE-2026-13221 | Perl runtime/base `5.36.0-7+deb12u3` e `5.40.1-6` | não informada pelo feed | 13 | runtime de ferramentas; build-only não aceito como mitigação suficiente | upgrade de base; bloquear |
| CVE-2026-33747 | `docker.io` / `20.10.24+dfsg1-1+deb12u1+b6` | não informada pelo feed | 1 | runtime crítico do Worker Manager, diretamente alcançável para lifecycle Docker | substituir/atualizar cliente; bloquear |
| CVE-2026-42216 | `libopenexr-3-1-30`, `libopenexr-dev` / `3.1.5-5` | não informada pelo feed | 6 | build-only nas imagens de Harness/workspace/worker-manager | upgrade/remover dependência; bloquear |
| CVE-2026-42217 | `libopenexr-3-1-30`, `libopenexr-dev` / `3.1.5-5` | não informada pelo feed | 6 | build-only nas imagens de Harness/workspace/worker-manager | upgrade/remover dependência; bloquear |
| CVE-2026-42496 | Perl runtime/base `5.36.0-7+deb12u3` e `5.40.1-6` | não informada pelo feed | 13 | runtime de ferramentas; sem exploitability comprovada no processo principal | upgrade de base; bloquear |
| CVE-2026-43185 | `linux-libc-dev` / `6.1.180-1` | não informada pelo feed | 3 | headers/build-only | upgrade de base; bloquear |
| CVE-2026-58016 | `libglib2.0-*` / `2.74.6-2+deb12u9` | não informada pelo feed | 15 | runtime/build conforme ferramenta; reachability não demonstrada | upgrade de base; bloquear |
| CVE-2026-59873 | `tar` / `7.5.11` | `7.5.19` | 3 | runtime de empacotamento; correção disponível | upgrade imediato; bloquear |
| CVE-2026-60002 | `openssh-client` / `1:9.2p1-2+deb12u10` | não informada pelo feed | 3 | ferramenta auxiliar; não necessária ao worker manager | remover ou atualizar; bloquear |
| CVE-2026-6653 | `libxml2`, `libxml2-dev` / `2.9.14+dfsg-1.3~deb12u6` | não informada pelo feed | 6 | runtime/build conforme ferramenta; reachability não demonstrada | upgrade de base; bloquear |
| CVE-2026-8376 | Perl runtime/base `5.36.0-7+deb12u3` e `5.40.1-6` | não informada pelo feed | 13 | runtime de ferramentas; build-only não aceito sem isolamento comprovado | upgrade de base; bloquear |

As contagens acima são ocorrências por imagem/pacote no relatório do scanner, não um conjunto de CVEs únicos. “Build-only” é uma classificação de uso esperado, não uma aprovação de risco. A remediação deve ser repetida com novo SBOM, novo scan e revisão humana; não alterar `release/v1-contract.json` para `PASS` apenas por documentação compensatória.
