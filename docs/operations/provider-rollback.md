# Rollback

Defina `AICP_AGENT_PROVIDER_LAYER_ENABLED=false` e reinicie o Harness. O fluxo
volta a `OpenCode → LiteLLM`; Codex, Claude e fallback permanecem desligados.
Migrations são aditivas e não removem o caminho legado.
