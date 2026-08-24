# Provider Host

O host é um executor credential-bearing, não um segundo Control Plane. Ele não
possui DB/Memória/Harness tokens, não faz transitions/gates/merge/deploy e não
emite PASS authoritative.

O processo inicia com `spawn(..., { shell: false })`, argv validado por
provider, ambiente allowlisted, cwd dentro do worktree, timeout, output limit e
kill do process group. `danger-full-access`, shell launchers, Docker, SSH,
`sudo`, `mount` e `nsenter` são proibidos.
