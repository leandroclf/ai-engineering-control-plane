# Agent Routing

`AgentRoutingPolicy` opera acima de `RoutingPolicy` model-level. A decisão
considera role/capability, flags, environment class, local-only, trust zone,
auth health, shadow quota, mutation mode e provider-family diversity.

Runtime diversity não é provider diversity: Codex→OpenAI não é diverso de
OpenCode→LiteLLM→OpenAI quando review exige família diferente.

O default é `opencode-litellm`; fallback exige `AICP_PROVIDER_FALLBACK_ENABLED`
e checkpoint restore atestado.
