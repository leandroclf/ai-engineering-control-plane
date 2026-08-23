# ADR-008 — Lifecycle de skills e recovery controlado

Skills começam `EXPERIMENTAL` e só avançam com transição explícita e evidência.
Recovery pode registrar aprendizado experimental, mas não pode promover memória,
policy ou skill por conta própria. O loop limita steps, retries e tempo e sempre
passa pelo evaluator antes de reportar sucesso.
