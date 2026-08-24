# Provider API

Read-only/sanitized endpoints:

- `GET /v1/providers`
- `GET /v1/providers/{id}`
- `GET /v1/providers/{id}/health`
- `GET /v1/providers/{id}/quota`
- `POST /v1/providers/{id}:probe`
- `GET /v1/runs/{id}/provider-attempts`
- `GET /v1/tasks/{id}/provider-quota`
- `GET /v1/provider-policies`

Nenhum endpoint retorna token, cookie, credential path, auth file ou conteúdo de
credential. Probe live é opt-in e não ocorre em `/ready`.
