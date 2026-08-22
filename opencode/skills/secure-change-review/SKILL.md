---
name: secure-change-review
description: Avalia mudanças que atravessam trust boundaries ou findings de segurança
compatibility: OpenCode 1.x
metadata:
  owner: platform-engineering
  version: "1"
---

# Secure Change Review

Use quando houver finding SAST/SCA, mudança de autenticação/autorização, input
externo, acesso a banco ou tratamento de secrets.

## Inputs obrigatórios

- findings normalizados;
- git diff;
- símbolos afetados;
- contexto da trust boundary.

## Processo

1. Valide a reprodução do finding.
2. Identifique source, sink e boundary.
3. Determine exploitability e impacto.
4. Verifique validação e sanitização.
5. Proponha a alteração mínima.
6. Exija o scanner original e regression gate.

## Output

Devolva somente o schema `secure-review-result` solicitado pelo Harness.
