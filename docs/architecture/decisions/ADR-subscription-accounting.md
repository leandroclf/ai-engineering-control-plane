# ADR: Subscription Accounting

- **Status:** Accepted
- **Decision:** `metered-api`, `subscription` e `subscription-credit` são modos
  distintos. Apenas API metered exige pricing conhecido para custo canônico.
- **Subscription evidence:** calls, tokens quando disponíveis, turns, wall time,
  `monetaryCostKnown`, `providerReportedCostUsd` e `billingMode`.
- **Consequence:** o ledger monetário legado pode reservar dimensão zero durante
  a migração aditiva, mas a evidência não chama isso de custo real zero.
