# Evaluation dashboards

The dashboard definitions are backend-neutral contracts. Each panel references
a metric emitted by `observability/evaluation/run-baseline.mjs`, allowing the
same report to be imported into Langfuse, Grafana or another approved backend
without changing metric semantics.

## Metric definitions

| Metric | Formula | Operational source |
|---|---|---|
| `acceptedTaskRate` | accepted terminal runs / all runs | `control.runs`, workflow terminal state |
| `costPerAcceptedTaskUsd` | sum of agent stage cost / accepted runs | `control.stages.evidence.handler.usage` |
| `firstPassRate` | accepted runs without `targeted-repair` / accepted runs | ordered stage history |
| `repairLoopCount` | number of `targeted-repair` stages | ordered stage history |
| `repairLoopsPerTask` | repair stages / all runs | ordered stage history |
| `deterministicRetrievalRate` | repeated request keys returning one context ID / repeated request keys | Context compilation evidence |
| `contextArtifactReuseRate` | artifact occurrences seen previously / all artifact occurrences | stage context provenance |
| `modelFallbackRate` | calls with attempted fallback / all model calls | LiteLLM headers/traces |

The initial dataset contains synthetic operational metadata and deliberately no
repository source, prompt, message or model response. Its values are an
`observation`, not a target, SLO or quality claim. A new baseline requires a
reviewed dataset version and explanation of changed workload composition.

Run:

```bash
npm run evaluate:baseline
jq . .aicp/evaluations/baseline.report.json
```
