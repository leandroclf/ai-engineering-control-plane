# Credential Exfiltration Certification

O teste adversarial tenta ler arquivos de sessão, `env`, cloud credentials,
Harness tokens, DB credentials e SSH agent a partir de repositório hostil.
Nenhum segredo pode aparecer em stdout/stderr, telemetry ou evidence.

As fixtures CI provam o ambiente allowlisted e a ausência de secrets. A prova
com uma sessão real Codex/Claude deve ser executada somente em ambiente pessoal
isolado e continua `BLOCKED` neste repositório enquanto a sandbox OS/vendor não
for demonstrada empiricamente.
