#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const inputPath = process.argv[2] ?? "tests/evaluations/evolution-experiments.json";
const outputPath = process.argv[3] ?? ".aicp/evaluations/evolution-evals.json";
const input = JSON.parse(await readFile(inputPath, "utf8"));
if (input.schemaVersion !== 1 || input.baselineCommit !== "47ea973c4fffcfba86fd145e2b70b141f2a04396") throw new TypeError("evolution eval baseline is invalid");
const observations = input.observations ?? [];
const byMetric = (metric) => observations.filter((item) => Number.isFinite(item[metric]));
const metrics = ["first_pass_success", "time_to_green_ms", "input_tokens", "output_tokens", "useful_context_ratio", "repair_loops", "requirement_coverage", "runtime_overhead_ms", "skill_hit_precision", "context_expansion_count", "blocking_findings", "regression_findings", "review_tokens", "adversarial_pass_rate"];
const report = {
  schemaVersion: 1,
  baselineCommit: input.baselineCommit,
  status: observations.length ? "observed" : "design-ready",
  experimentCount: input.experiments.length,
  observationCount: observations.length,
  metrics: Object.fromEntries(metrics.map((metric) => [metric, { observed: byMetric(metric).length, values: byMetric(metric).map((item) => ({ experiment: item.experiment, arm: item.arm, value: item[metric] })) }])),
  experiments: input.experiments,
  limitation: input.limitation,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
