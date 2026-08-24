# Codex Login

Use `npm run aicp -- providers login codex`. O comando anexa TTY e delega ao
`codex login` oficial. Logout delega a `codex logout`; status usa
`codex login status`. Nunca copie auth cache para CI ou leia `~/.codex/auth.json`.
