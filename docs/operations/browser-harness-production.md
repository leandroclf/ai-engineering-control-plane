# Browser Harness — operação de produção

## Pré-requisitos

1. Executar `bash scripts/bootstrap.sh`; ele cria
   `secrets/browser_worker_token` com modo `0600`, diferente de todos os outros
   tokens. Em uma instalação manual equivalente, gere o arquivo antes de rodar
   `docker compose up`.
2. Executar as migrações canônicas:

   ```bash
   bash scripts/migrate.sh
   ```

3. Construir as imagens com SBOM/proveniência:

   ```bash
   docker compose build browser-worker harness worker-manager
   ```

4. Subir o ambiente e validar readiness:

   ```bash
   docker compose up -d
   curl -fsS http://127.0.0.1:18081/ready
   docker compose ps
   ```

## Fronteiras

- O Harness não monta `/var/run/docker.sock`; somente o worker-manager de
  deployment possui essa responsabilidade.
- O browser worker não recebe credenciais físicas de providers. Ele recebe apenas
  seu token de serviço e o token escopado do memory-service.
- O browser worker não publica porta no host. Ele fica em `agent-internal` e
  `provider-egress`; o Harness acessa somente a API autenticada interna.
- Perfis ficam no volume `browser-profiles`, separados por `sessionId`. Tokens,
  passwords e credenciais são removidos antes do registro no memory-service.
- Sessões não são reutilizadas depois de `CLOSED`, `EXPIRED` ou `REVOKED`.

## Diagnóstico

```bash
docker compose logs --tail=200 browser-worker harness memory-service
curl -fsS http://127.0.0.1:18081/ready
curl -fsS -H "Authorization: Bearer $HARNESS_TOKEN" http://127.0.0.1:18081/v1/capability-providers
```

Falha no memory-service bloqueia a criação da sessão. Isso é intencional: uma
execução de browser sem episódio persistível não é considerada auditável.

## Rollback

O rollback deve ser feito para a imagem anterior pinada e para uma versão de
migração compatível. Não remover `013_agent_harness.sql`: as tabelas são aditivas e
necessárias para reprocessar episódios já observados.
