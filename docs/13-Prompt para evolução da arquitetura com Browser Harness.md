Você atuará como **Principal AI Platform Architect + Staff Software Engineer**, responsável por evoluir o repositório `ai-engineering-control-plane` para incorporar um modelo de **Agent Harness adaptativo, persistente, auditável e seguro**, inspirado nos conceitos de Browser Harness, porém generalizado para múltiplas capacidades de engenharia de software.

Seu objetivo não é apenas adicionar automação de browser. A meta é evoluir a arquitetura para que agentes possam executar tarefas, observar resultados, detectar falhas, criar ou aprimorar capacidades reutilizáveis e persistir conhecimento operacional com governança adequada.

A arquitetura final deve suportar, de forma modular:

```text
Agent
  ↓
Harness
  ↓
Skills
  ↓
Tools / Capability Providers
  ↓
Environment
  ↓
Observation
  ↓
Evaluation
  ↓
Learning / Improvement
  ↓
Validated Knowledge
  └──────────────→ Skills / Helpers / Memory
```

O Browser Harness deve ser tratado como **um capability provider especializado**, e não como o núcleo central da plataforma.

## 1. Contexto arquitetural

O projeto deve funcionar como um **AI Engineering Control Plane** para engenharia de software avançada, permitindo operar diferentes agentes e modelos através de uma camada centralizada.

Considere uma arquitetura semelhante a:

```text
                    AI ENGINEERING CONTROL PLANE

                              API / CLI
                                 │
                                 ▼
                         Agent Orchestrator
                                 │
             ┌───────────────────┼───────────────────┐
             │                   │                   │
             ▼                   ▼                   ▼
        Planner Agent       Coding Agent       Reviewer Agent
             │                   │                   │
             └───────────────────┼───────────────────┘
                                 │
                              Harness
                                 │
                        Capability Router
                                 │
       ┌─────────────┬───────────┼───────────┬──────────────┐
       ▼             ▼           ▼           ▼              ▼
     GitHub        Shell       Browser      AWS           Quality
                                 │
                                 ▼
                         Browser Harness
                                 │
                                CDP
                                 │
                              Chrome

             ┌────────────────────────────────────┐
             │ Persistent Knowledge / Memory      │
             ├────────────────────────────────────┤
             │ Skills                             │
             │ Domain knowledge                   │
             │ Helpers                            │
             │ Execution history                  │
             │ Failure patterns                   │
             │ Graph relationships                │
             │ Evaluations                        │
             └────────────────────────────────────┘
```

A arquitetura deve permitir adicionar posteriormente providers como:

- GitHub
- Git
- Shell
- Browser
- Kubernetes
- AWS
- Terraform
- Docker
- Sonar
- Snyk
- bancos de dados
- observabilidade
- CI/CD
- OpenAPI
- testes automatizados

sem acoplamento direto entre agentes e ferramentas.

---

# 2. Princípios obrigatórios

A implementação deve obedecer aos seguintes princípios.

### 2.1 Agent → Harness → Capability

Nenhum agente deve acessar diretamente integrações externas.

Evitar:

```text
Agent → Playwright
Agent → AWS SDK
Agent → kubectl
Agent → GitHub API
```

Preferir:

```text
Agent
  ↓
Harness
  ↓
Capability Router
  ↓
Capability Provider
```

---

### 2.2 Separação entre Core e Workspace evolutivo

O núcleo do harness deve ser protegido.

Exemplo:

```text
control-plane/
├── core/
│   ├── orchestrator/
│   ├── harness/
│   ├── capabilities/
│   ├── evaluation/
│   ├── memory/
│   └── governance/
│
├── agent-workspace/
│   ├── skills/
│   ├── helpers/
│   ├── domain-skills/
│   ├── experiments/
│   └── generated/
```

Agentes não devem alterar diretamente o `core`.

Alterações autônomas devem ocorrer inicialmente dentro de:

```text
agent-workspace/
```

---

# 3. Capability Provider abstraction

Criar uma abstração formal para providers.

Conceitualmente:

```text
CapabilityProvider

- name
- version
- capabilities()
- execute()
- observe()
- healthcheck()
- permissions()
```

Exemplo:

```text
BrowserCapabilityProvider
GitHubCapabilityProvider
ShellCapabilityProvider
KubernetesCapabilityProvider
```

O agente deve solicitar uma capacidade abstrata.

Exemplo:

```text
browser.navigate
browser.inspect
browser.click
browser.fill
browser.upload
browser.network.inspect
```

e não conhecer detalhes de Playwright/CDP.

---

# 4. Browser Harness

Implementar ou integrar Browser Harness como provider especializado.

Preferir arquitetura baseada em CDP quando tecnicamente apropriado.

Estrutura conceitual:

```text
BrowserCapabilityProvider
          │
          ▼
     Browser Harness
          │
          ▼
         CDP
          │
          ▼
 Chrome / Chromium
```

O provider deve suportar inicialmente:

- navegação;
- leitura DOM;
- accessibility tree;
- interação mouse;
- teclado;
- formulários;
- múltiplas abas;
- screenshots;
- downloads;
- uploads;
- inspeção de network;
- cookies;
- localStorage;
- sessionStorage;
- execução JavaScript;
- console;
- captura de erros;
- gerenciamento de sessão.

Evitar dependência excessiva de screenshots quando DOM/CDP forem suficientes.

---

# 5. Persistent Browser Sessions

A arquitetura deve suportar sessões persistentes.

Exemplo:

```text
workspace/browser/profiles/
```

ou armazenamento equivalente.

Permitir:

```text
session_id
profile_id
agent_id
project_id
```

Não armazenar credenciais em texto puro.

Credenciais devem ser fornecidas através de secret providers.

---

# 6. Self-Healing controlado

Implementar um mecanismo de self-healing.

Fluxo esperado:

```text
Execute
   ↓
Observe
   ↓
Success?
 ┌─┴─┐
 │   │
yes  no
 │   │
 │   ▼
 │ Diagnose
 │   ↓
 │ Recover
 │   ↓
 │ Retry
 │   ↓
 │ Learn
 │
 ▼
Complete
```

Porém é proibido transformar automaticamente qualquer correção em conhecimento global.

Utilizar estados:

```text
EXPERIMENTAL
VALIDATED
PROMOTED
DEPRECATED
REJECTED
```

Exemplo:

```text
agent-workspace/generated/browser/upload-file-v1
```

Após validação:

```text
agent-workspace/skills/browser/upload-file
```

---

# 7. Skill lifecycle

Criar ciclo explícito:

```text
DISCOVER
  ↓
GENERATE
  ↓
TEST
  ↓
EVALUATE
  ↓
VALIDATE
  ↓
PROMOTE
  ↓
MONITOR
```

Cada skill deve possuir metadata.

Exemplo:

```yaml
name: browser-github-create-pr
version: 1.0.0

domain: github
capabilities:
  - browser.navigate
  - browser.click
  - browser.fill

created_by: agent

status: validated

success_rate: 0.97

tests:
  - github-create-pr

risk:
  level: medium
```

---

# 8. Domain Skills

Criar suporte explícito a domain skills.

Estrutura sugerida:

```text
skills/

├── generic/
│
├── browser/
│
└── domains/
    ├── github/
    ├── aws/
    ├── kubernetes/
    ├── sonar/
    └── snyk/
```

Domain skills devem capturar conhecimento operacional específico.

Exemplo:

```text
domains/github/

inspect-pr
create-pr
review-pr
resolve-conflict
inspect-actions
```

Skills devem ser pequenas e composáveis.

Evitar mega-skills.

---

# 9. Memory architecture

Separar explicitamente:

```text
Short-Term Memory
Working Memory
Episodic Memory
Semantic Memory
Procedural Memory
```

## Working Memory

Estado da execução atual.

## Episodic Memory

Histórico de execuções.

Exemplo:

```text
Task #29384

Goal:
Corrigir pipeline GitHub.

Actions:
...

Failures:
...

Result:
success
```

## Semantic Memory

Conhecimento sobre:

```text
projetos
repositórios
serviços
arquitetura
dependências
```

## Procedural Memory

Skills e procedimentos.

---

# 10. Graph Memory

Adicionar camada de relacionamento.

Exemplo:

```text
Repository
    │
    ├── contains → Service
    │
    ├── uses → Skill
    │
    └── deployed_to → KubernetesCluster
```

Outro exemplo:

```text
Skill
 ├─ uses → Capability
 ├─ solved → FailurePattern
 └─ applies_to → Repository
```

Não introduzir banco de grafos apenas por moda arquitetural.

Inicialmente avaliar se relações estruturadas em banco relacional ou documentos são suficientes.

Caso Neo4j, Memgraph ou equivalente seja introduzido, justificar claramente.

---

# 11. Failure Knowledge Base

Criar representação reutilizável de falhas.

Exemplo:

```text
failure-patterns/

github/
browser/
gradle/
docker/
kubernetes/
aws/
```

Cada pattern deve conter:

```yaml
signature:
symptoms:
likely_causes:
diagnostics:
recovery:
confidence:
```

Exemplo:

```text
FAILURE

GitHub Actions:
Gradle dependency resolution failed

CAUSE

Repository rate limited.

RECOVERY

Use authenticated repository access.
```

---

# 12. Evaluation layer

Nenhuma alteração autônoma deve ser considerada correta apenas porque executou sem erro.

Criar evaluators.

Exemplos:

```text
CodeEvaluator
TestEvaluator
SecurityEvaluator
BrowserEvaluator
ArchitectureEvaluator
TaskEvaluator
```

Pipeline:

```text
Agent Result
      ↓
Evaluator
      ↓
Score
      ↓
Accept / Retry / Escalate
```

Métricas mínimas:

```text
task_success
test_pass_rate
retry_count
token_usage
execution_time
skill_success_rate
recovery_success_rate
```

---

# 13. Human approval

Definir níveis de autonomia.

### LEVEL 0

Somente leitura.

### LEVEL 1

Execução segura.

Exemplos:

```text
testes
lint
browser inspection
```

### LEVEL 2

Alterações reversíveis.

Exemplo:

```text
code changes
temporary branches
```

### LEVEL 3

Operações sensíveis.

Exemplo:

```text
merge
deploy
database modification
production
```

LEVEL 3 exige aprovação explícita.

---

# 14. Security boundary

Implementar uma sandbox clara.

Agentes não podem obter automaticamente acesso irrestrito ao host.

Preferir:

```text
Agent
  ↓
Sandbox
  ↓
Capability Proxy
  ↓
External Systems
```

Providers devem possuir permissões.

Exemplo:

```yaml
provider: kubernetes

allowed:
  - get
  - describe
  - logs

denied:
  - delete
  - exec-prod
```

---

# 15. Secret management

Nunca persistir:

```text
tokens
API keys
passwords
AWS credentials
browser credentials
```

dentro das memories ou skills.

Criar:

```text
SecretProvider
```

com implementações possíveis:

```text
EnvironmentSecretProvider
AWSSecretsManagerProvider
VaultSecretProvider
```

Skills devem referenciar secrets por identificador.

---

# 16. Observability

Toda execução deve gerar telemetry.

Exemplo:

```text
Task
 ↓
Agent
 ↓
Skill
 ↓
Capability
 ↓
Tool
```

Gerar correlation IDs:

```text
trace_id
task_id
agent_id
skill_id
project_id
```

Registrar:

```text
duration
model
tokens_in
tokens_out
tool_calls
retries
failures
cost
```

---

# 17. Token efficiency

A arquitetura deve otimizar utilização de contexto.

Implementar mecanismos de:

```text
context selection
memory retrieval
skill retrieval
summarization
result compression
```

Evitar enviar:

```text
historical conversation inteira
todos os logs
todo o repository
todas as skills
```

Selecionar somente informação relevante.

---

# 18. Skill retrieval

Implementar retrieval híbrido.

Utilizar combinação de:

```text
metadata
tags
text search
embeddings
graph relationships
usage history
success rate
```

Ranking conceitual:

```text
score =
semantic_similarity
+ historical_success
+ project_relevance
+ capability_match
```

---

# 19. Agent execution loop

Implementar execução estruturada.

```text
PLAN
 ↓
SELECT SKILLS
 ↓
SELECT CAPABILITIES
 ↓
EXECUTE
 ↓
OBSERVE
 ↓
EVALUATE
 ↓
RECOVER
 ↓
LEARN
 ↓
COMPLETE
```

Definir limites:

```text
max_steps
max_retries
max_tokens
max_cost
max_execution_time
```

---

# 20. Multi-agent

Evitar agentes conversando livremente entre si.

Preferir coordenação pelo orchestrator.

Exemplo:

```text
Task
 ↓
Planner
 ↓
Implementation Agent
 ↓
Test Agent
 ↓
Security Agent
 ↓
Reviewer
```

Cada agente deve receber apenas o contexto necessário.

---

# 21. Browser-specific agent strategy

Para tarefas browser, priorizar:

```text
DOM
Accessibility Tree
Network
CDP
```

antes de:

```text
Screenshot
Vision
```

Utilizar visão quando a interface não puder ser interpretada adequadamente via estrutura.

Isso reduz custo e aumenta determinismo.

---

# 22. Suggested repository structure

Avaliar a seguinte estrutura:

```text
ai-engineering-control-plane/

apps/
  api/
  cli/

core/

  orchestrator/

  harness/

  capabilities/
    browser/
    github/
    shell/
    kubernetes/
    aws/

  agents/

  evaluation/

  governance/

  security/

  telemetry/

memory/

  working/

  episodic/

  semantic/

  procedural/

skills/

  generic/

  browser/

  domains/

    github/
    aws/
    kubernetes/
    sonar/
    snyk/

failure-patterns/

agent-workspace/

  helpers/

  generated/

  experiments/

  sessions/

providers/

  browser-harness/

  github/

  shell/

  kubernetes/

  aws/

tests/

docs/
```

Não alterar a estrutura atual cegamente.

Antes, comparar com a estrutura existente e propor migração incremental.

---

# 23. Docker

A solução deve funcionar de maneira reproduzível.

Criar ou evoluir:

```text
docker-compose.yml
```

com componentes necessários.

Exemplo conceitual:

```text
control-plane
redis
postgres
browser
observability
```

O ambiente deve permitir:

```bash
docker compose up
```

e disponibilizar o control plane.

Persistências devem utilizar volumes.

Exemplo:

```text
control-plane-data
agent-memory
browser-profiles
```

---

# 24. Persistência

Garantir persistência mesmo após restart.

Persistir:

```text
skills
memory
evaluation history
failure patterns
browser profiles
execution metadata
```

Não depender do filesystem efêmero do container.

---

# 25. Browser isolation

Browsers devem executar isoladamente.

Preferir:

```text
browser-worker-1
browser-worker-2
browser-worker-N
```

O orchestrator deve criar e destruir sessões.

Deve ser possível futuramente executar workers distribuídos.

---

# 26. Concurrency

Projetar para múltiplos agentes.

Evitar estado global mutável.

Utilizar:

```text
task_id
workspace_id
session_id
```

como scopes.

Implementar locking quando necessário.

---

# 27. Testing

Criar testes para:

```text
CapabilityRouter
SkillRegistry
SkillLifecycle
Memory
Evaluation
SelfHealing
BrowserProvider
Governance
Permissions
```

Adicionar testes end-to-end para:

```text
Agent
→ browser
→ failure
→ recovery
→ success
```

---

# 28. Architecture Decision Records

Registrar decisões relevantes.

Criar:

```text
docs/adr/
```

Exemplos:

```text
ADR-001-agent-harness.md
ADR-002-capability-provider.md
ADR-003-browser-harness.md
ADR-004-memory-model.md
ADR-005-skill-lifecycle.md
ADR-006-security-boundaries.md
```

---

# 29. Métricas

Preparar a arquitetura para expor métricas como:

```text
agent_tasks_total
agent_tasks_success
agent_tasks_failed

agent_tokens_input
agent_tokens_output

skill_execution_total
skill_execution_success
skill_execution_failed

skill_recovery_total

browser_actions_total

capability_execution_duration

agent_cost_usd
```

---

# 30. Objetivo arquitetural maior

O resultado desejado não é:

```text
AI → tool
```

nem:

```text
AI → MCP → tool
```

O modelo desejado é:

```text
                   Control Plane

                       Task
                        │
                        ▼
                      Agent
                        │
                        ▼
                      Harness
                        │
                        ▼
                  Skill Selection
                        │
                        ▼
                 Capability Router
                        │
             ┌──────────┼──────────┐
             ▼          ▼          ▼
          Browser      GitHub    Kubernetes
             │
             ▼
           Tools
             │
             ▼
        Environment
             │
             ▼
         Observation
             │
             ▼
          Evaluation
             │
        ┌────┴────┐
        │         │
     Success    Failure
        │         │
        │         ▼
        │      Recovery
        │         │
        │         ▼
        │       Learn
        │         │
        └─────────┤
                  ▼
             Knowledge
```

Esse é o princípio arquitetural central do projeto.

---

# 31. Estratégia de implementação

Não tente implementar tudo simultaneamente.

Comece realizando uma inspeção profunda do repositório atual.

Produza inicialmente:

```text
CURRENT_STATE.md
TARGET_ARCHITECTURE.md
GAP_ANALYSIS.md
IMPLEMENTATION_PLAN.md
```

Identifique:

```text
o que já existe
o que pode ser reutilizado
o que deve ser refatorado
o que deve ser removido
o que deve ser criado
```

Depois organize implementação incremental.

Sugestão de fases:

```text
PHASE 1
Harness Core

PHASE 2
Capability Provider abstraction

PHASE 3
Browser Harness

PHASE 4
Skill Registry

PHASE 5
Execution / Evaluation Loop

PHASE 6
Memory

PHASE 7
Self-Healing

PHASE 8
Governance

PHASE 9
Observability

PHASE 10
Optimization
```

Cada fase deve resultar em código funcional.

---

# 32. Critérios de conclusão

Ao final, demonstrar pelo menos este cenário completo:

```text
USER TASK

"Abra uma aplicação web,
realize determinada operação
e valide o resultado."

↓

Planner

↓

Skill Retrieval

↓

Browser Capability

↓

Browser Harness

↓

Chrome

↓

Falha identificada

↓

Recovery

↓

Nova tentativa

↓

Sucesso

↓

Evaluator valida

↓

Execução registrada

↓

Conhecimento reutilizável armazenado
```

A demonstração deve evidenciar claramente:

```text
trace
skills utilizadas
capabilities
ações executadas
falhas
retries
resultado
tokens
tempo
memory updates
```

---

# 33. Restrições arquiteturais importantes

Não introduza complexidade sem justificativa.

Questione explicitamente qualquer proposta que introduza:

```text
Neo4j
Kafka
Kubernetes
vector database
event sourcing
microservices adicionais
MCP servers adicionais
```

se a necessidade atual puder ser resolvida de forma mais simples.

Preferir:

```text
simplicidade
composição
interfaces claras
baixo acoplamento
observabilidade
testabilidade
evolução incremental
```

---

# 34. Entregáveis

Ao concluir, fornecer:

```text
1. análise da arquitetura atual

2. arquitetura alvo

3. diagrama arquitetural

4. gap analysis

5. ADRs

6. implementação

7. testes

8. docker environment

9. documentação

10. exemplo end-to-end

11. riscos conhecidos

12. technical debt remanescente

13. próximos passos
```

Além disso, apresentar uma tabela final:

| Área | Antes | Depois | Benefício |
|---|---|---|---|
| Browser | automação isolada | Capability Provider | desacoplamento |
| Skills | estáticas | ciclo de vida | melhoria contínua |
| Falhas | retry simples | recovery knowledge | self-healing |
| Memory | contexto | memória estruturada | reutilização |
| Tools | chamadas diretas | capability router | segurança |
| Agents | autonomia ampla | orchestrated agents | previsibilidade |

---

# 35. Regra de engenharia

Não considere a arquitetura válida apenas porque "funciona".

Avalie continuamente:

```text
maintainability
security
observability
testability
determinism
cost
token efficiency
failure recovery
operational complexity
```

Se alguma decisão arquitetural proposta neste documento não for adequada à realidade encontrada no repositório, não a implemente mecanicamente.

Apresente:

```text
assumption
evidence
trade-off
decision
```

e escolha a solução tecnicamente mais sólida.

O objetivo final é transformar o `ai-engineering-control-plane` em um **harness de engenharia de software capaz de acumular experiência operacional de maneira controlada**, no qual agentes deixem de apenas "usar ferramentas" e passem a trabalhar sobre uma camada de capacidades, skills, memória, avaliação e governança que possa evoluir continuamente sem comprometer segurança e previsibilidade.