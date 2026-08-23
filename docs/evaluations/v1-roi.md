# Avaliação econômica AICP v1

O protocolo observado é:

```text
30 tarefas × 2 braços (baseline/AICP) × 3 repetições = 180 runs
```

As métricas exigidas são custo por mudança aceita, custo por PR aceito, tempo humano por mudança aceita, first-pass, defeitos escapados, findings de segurança e violações de escopo. O benchmark determinístico de Context v3 já mede corpus, precisão, tokens e uso de vector; ele não mede geração LLM, custo, defeito ou aceitação humana.

O ledger observado de 180 runs com avaliação humana não foi fabricado neste ciclo e continua ausente. Portanto `paired_llm_human_benchmark` permanece `BLOCKED`; `npm run validate:benchmark-results` deve falhar até que o artefato observado exista e seja validado.
