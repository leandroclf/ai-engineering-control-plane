# Exploração crítica: AI Engineering Control Plane

## Entendimento atual

O projeto é greenfield e deve transformar este repositório em uma plataforma de
engenharia assistida por IA, reproduzível e governada por software
determinístico. A visão de referência está em
`docs/06-AI Engineering Control Plane.md`.

As instruções de `docs/01` a `docs/05` definem o método de especificação; elas
não são requisitos do produto. O documento `docs/06` é a fonte da ideia e
contém decisões propostas, exemplos, estimativas e pontos que ainda exigem
validação durante a implementação.

## Problema real

Ambientes de engenharia com agentes tendem a combinar contexto excessivo,
credenciais expostas, workflows controlados por prompts, validações não
reproduzíveis e memória sem proveniência. Isso dificulta confiar no resultado,
reproduzir o ambiente em outro host, limitar custo e demonstrar por que uma
mudança está pronta para revisão.

## Objetivos

- Inicializar o perfil `core` em host limpo por meio de comandos documentados e
  idempotentes.
- Governar execução de agentes com workflow, estados, limites e quality gates
  determinísticos.
- Isolar credenciais de providers atrás do LiteLLM e conceder ao workspace
  apenas uma credencial virtual limitada.
- Entregar contexto limitado, rastreável e priorizado por evidência.
- Persistir memória versionada e auditável sem transformar conversas em fonte
  de verdade.
- Produzir telemetria de tarefa, modelo, custo, contexto, gates e loops.
- Suportar evolução de ambiente local para serviços remotos e operação
  multi-host.
- Manter humano e CI governado como autoridades finais.

## Fora de escopo inicial

- Autonomia para merge, deploy ou operações destrutivas.
- Coordenação livre entre agentes sem Harness.
- Alta disponibilidade e escala de produção na primeira entrega.
- Suporte completo a toda linguagem e ferramenta no workspace base.
- Uso de Neo4j como fonte canônica.
- Observabilidade self-hosted completa como requisito do perfil mínimo.
- Garantia de disponibilidade comercial ou jurídica do nome do produto.

## Atores e stakeholders

- Pessoa desenvolvedora que usa terminal, IDE e OpenCode.
- Pessoa mantenedora da plataforma e das políticas.
- Pessoa revisora humana que aprova mudança, exceção ou supressão.
- CI, autoridade final dos gates reproduzidos em checkout limpo.
- Harness, controlador determinístico do workflow.
- Agentes especializados com permissões restritas.
- Providers de modelos acessados exclusivamente pelo gateway.
- Times de segurança, arquitetura e operação.

## Capabilities candidatas

- `platform-bootstrap`
- `governed-workflows`
- `model-gateway`
- `context-memory`
- `security-governance`
- `observability-operations`

## Casos de uso principais

1. Operador clona o repositório, configura secrets/model aliases e sobe o
   perfil `core`.
2. O diagnóstico comprova dependências, saúde, versão e isolamento.
3. Desenvolvedor monta um projeto e inicia trabalho no workspace.
4. Harness compila contexto, aciona agentes e executa gates em ordem.
5. Falha pontual gera reparo direcionado e limitado, não reinício integral.
6. Memória candidata é validada, promovida, invalidada ou substituída com
   proveniência.
7. Indexação incremental reutiliza artefatos inalterados e atualiza deltas.
8. CI reproduz gates em checkout limpo antes de qualquer aprovação final.
9. Operador executa backup/restore e reconstrói projeções derivadas.
10. Novo host usa estado remoto sem compartilhar volumes de banco por NFS.

## Edge cases e falhas relevantes

- Docker/Compose ausente ou host abaixo do perfil mínimo.
- Arquivo de ambiente ausente, permissões inseguras ou alias sem modelo.
- Provider indisponível, timeout, rate limit ou fallback esgotado.
- Migração parcialmente aplicada ou serviço não saudável.
- Mesmo finding e mesmo diff reaparecem sem progresso.
- Budget de chamadas, tokens, custo ou iterações é excedido.
- Conteúdo do repositório tenta promover prompt injection a política.
- Secret aparece em diff, relatório, log, memória ou trace.
- Memória pertence a outro projeto, está expirada ou perdeu validade da fonte.
- Rename/delete deixa nós órfãos no grafo.
- Restore de PostgreSQL funciona, mas projeção Neo4j está inconsistente.
- Stack de observabilidade excede recursos do host local.

## Regras confirmadas pela visão

- O Harness governa o workflow; LLMs executam trabalho limitado.
- Git, CI e políticas/ADRs aprovadas têm mais autoridade que memória e
  inferência.
- O estado de sucesso local é `READY_FOR_HUMAN_REVIEW`, não produção pronta.
- PostgreSQL é canônico; Neo4j é projeção reconstruível; Redis é efêmero.
- Credenciais reais de providers não chegam ao workspace.
- Docker socket, `git push`, merge e deploy não são permitidos na baseline.
- Conteúdo recuperado do repositório é dado não confiável, não política.
- Finding suprimido exige governança versionada.
- O perfil de observabilidade completa é separado do perfil `core`.

## Decisões propostas a validar

- TypeScript/Node para Harness e Python para Memory Service/Context Compiler.
- OpenCode `1.18.21`, PostgreSQL 16, Redis 7.2.4 e Neo4j 2026.07.1 como
  baseline inicial.
- REST antes de gRPC para APIs internas.
- Cobertura mínima de 80%, custo máximo de USD 10 e budgets de contexto
  apresentados no guia como defaults calibráveis.
- LiteLLM e Langfuse self-hosted versus serviços remotos por ambiente.

## Requisitos não funcionais

- Reprodutibilidade: bootstrap e CI devem partir de estado declarado.
- Segurança: menor privilégio, secrets fora do Git e negação explícita.
- Auditabilidade: decisões, findings, gates e memória devem ter proveniência.
- Confiabilidade: loops limitados, falhas classificadas e restore testável.
- Portabilidade: configuração em Git, estado via serviços e workspace
  descartável.
- Eficiência: recuperação determinística primeiro, indexação incremental e
  budget explícito de contexto.
- Operabilidade: health/readiness, diagnóstico, smoke, backup, restore,
  telemetria e runbooks.

## Matriz de riscos

| Risco | Tipo | Impacto | Probabilidade | Mitigação | Decisão necessária |
|---|---|---:|---:|---|---|
| Escopo exceder um MVP executável | Escopo | Alto | Alta | Implementar por fases e gates de saída | Aprovar corte da Foundation |
| Versões ou APIs divergirem do guia | Técnico | Alto | Média | Spike e pin por tag/digest | Congelar matriz validada |
| Credencial alcançar workspace/trace | Segurança | Crítico | Média | Secrets, chave virtual e testes negativos | Definir backend por ambiente |
| Harness depender de interpretação de prosa | Confiabilidade | Alto | Média | JSON Schema e máquina de estados | Fixar contratos estruturados |
| Memória contaminada ou entre tenants | Dados | Crítico | Média | Escopos, autoridade, proveniência e isolamento | Definir tenancy/authz |
| Grafo ficar obsoleto | Dados | Alto | Média | Projeção reconstruível e testes rename/delete | Definir SLA de indexação |
| Scanners cloud enviarem dados indevidos | Privacidade | Alto | Média | Classificação e perfis opt-in | Aprovar política Snyk/Sonar |
| Langfuse local inviabilizar host | Operação | Médio | Alta | Perfil separado ou remoto | Escolher padrão local/remoto |
| Loop consumir custo sem progresso | IA/agente | Alto | Alta | Budgets e fingerprints | Calibrar limites iniciais |
| CI divergir do preflight local | Operação | Alto | Média | Mesmos adapters/policies em checkout limpo | Escolher plataforma CI |

## Premissas usadas para avançar

- O pedido autoriza gerar o pacote completo de planejamento sem aprovações
  intermediárias.
- O primeiro marco executável é o perfil `core`; capacidades avançadas entram
  por fases sem bloquear esse marco.
- Linux com Docker Engine ou Docker Desktop e Compose v2 é a primeira
  plataforma de referência.
- Valores quantitativos ainda não comprovados serão defaults configuráveis,
  nunca garantias universais.

## Decisões pendentes não bloqueantes para o planejamento

- Provedores e IDs exatos de modelos.
- Plataforma CI e registry de imagens.
- Backend de secrets para produção.
- Modelo de identidade/autorização da API multi-host.
- Linguagens suportadas no primeiro indexador e nos workspaces especializados.
- Destino remoto padrão de telemetria.
- Licenças e disponibilidade de Snyk, Sonar e Langfuse.

## Conclusão da exploração

Não há bloqueio para especificar e decompor o produto. As decisões pendentes
afetam implementação e rollout, mas podem ser resolvidas por spikes e políticas
antes das tarefas que dependem delas.
