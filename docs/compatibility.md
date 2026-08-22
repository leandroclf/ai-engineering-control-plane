# Compatibility baseline

Validated on 2026-08-21 against package and OCI registries.

| Component | Baseline | Registry evidence |
|---|---|---|
| OpenCode | `1.18.21` | npm latest, MIT, integrity recorded below |
| PostgreSQL | `16` (`16.15` at validation) | OCI index `sha256:e17e86066e5ef83e0952a9347f5c792b7ece00972e2aa787a6986f471b3dd3d5` |
| Redis | `7.2.4` | OCI index `sha256:5a93f6b2e391b78e8bd3f9e7e1e1e06aeb5295043b4703fb88392835cec924a0` |
| Neo4j | `2026.07.1` community | OCI index `sha256:0ddfa71c8f0bfe0d780d74fb66b985de4767bbd274bab70c0806cb3a6deec101` |
| LiteLLM database | temporary `latest` | OCI index `sha256:4b3226f4ccd7793d7dca6862d3681604d7ab640d8d6285be6061fd48514e6e71` |

OpenCode npm integrity:
`sha512-BxQyxpD0y2X0sXJUKLOooXVmi9QIoeKPtdH68r7QRiqXJ/YulK1MQvSe8KyA8183zoPV0G6JAtgz1OqmE3OGUw==`.

LiteLLM remains a release blocker until `latest` is replaced by a validated
immutable version/digest in `versions.env`. Digests are evidence from the date
above and must be refreshed deliberately, never silently.
