# Baseline antes da certificação AICP v1

- HEAD: `417a4d2d9935ba42c0c5ffa8b58a301a724b718d`
- branch de trabalho: `feat/aicp-v1-production-certification`
- `npm ci`: PASS
- `npm run validate`: PASS (81 testes Node, 36 Python, suppressions, segurança e acceptance)
- `npm run test:e2e:mock-gateway`: PASS
- `npm run test:architecture`: PASS
- `npm run validate:supply-chain`: PASS
- `npm run validate:model-catalog`: PASS
- `npm run validate:benchmark`: PASS para o protocolo estrutural 30 tarefas × 20 experimentos × 3 repetições
- `npm run benchmark:context-v3`: PASS estrutural, sem claim de LLM/custo/aceitação humana
- `npm run test:integration`: bloqueado no host por `ECONNREFUSED 127.0.0.1:5432`; o Compose local não publica PostgreSQL no host
- `npm run release:evaluate`: `V1_NOT_YET_DEFENSIBLE`

O baseline foi capturado antes das alterações deste ciclo. O guia fornecido pelo
usuário permaneceu no worktree como arquivo não rastreado e não foi alterado.
