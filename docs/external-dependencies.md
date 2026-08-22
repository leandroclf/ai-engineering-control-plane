# Dependências externas pós-v1 local

O runtime local mantém autenticação por token estático e já expõe contratos para
JWT/OIDC, identidade mTLS, RBAC, identidade curta por workload e workers
efêmeros. A ativação corporativa permanece `BLOCKED_EXTERNAL` até existirem:

- IdP OIDC com issuer, audience, JWKS, política de roles e procedimento de revogação;
- PKI organizacional com SANs, emissão, rotação e revogação auditáveis;
- secret manager com workload identity e credenciais curtas;
- runtime rootless com seccomp/AppArmor ou SELinux aprovado no host;
- worker manager de deployment que crie e destrua um container por run;
- infraestrutura de filas/HA e SLOs baseados em volume histórico real.

Esses requisitos não são simulados pelo Compose local. Os adapters devem ser
ligados às interfaces existentes somente depois de revisão de segurança.
