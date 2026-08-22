#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const dataset = JSON.parse(await readFile(process.argv[2] ?? "tests/evaluations/v1-paired.tasks.json", "utf8"));
const ledger = JSON.parse(await readFile(process.argv[3] ?? ".aicp/evaluations/v1-run-results.json", "utf8"));
const required = ["runId", "evidenceRef", "modelAlias", "provider", "gatesPassed", "humanAccepted", "defectCount", "securityFindings", "inputTokens", "outputTokens", "costUsd", "latencyMs", "repairLoops", "filesChanged", "contextPrecision"];
const expected = new Set(dataset.tasks.flatMap((task) => ["baseline", "candidate"].flatMap((arm) => [1, 2, 3].map((repetition) => `${task.taskId}:${arm}:${repetition}`))));
if (ledger.schemaVersion !== 1 || ledger.datasetId !== dataset.id || ledger.observations?.length !== expected.size) throw new Error(`v1 evidence ledger requires ${expected.size} observations`);
for (const row of ledger.observations) {
  const key = `${row.taskId}:${row.arm}:${row.repetition}`;
  if (!expected.delete(key)) throw new Error(`duplicate or unexpected observation: ${key}`);
  for (const field of required) if (row[field] === undefined || row[field] === null) throw new Error(`${key} lacks ${field}`);
  if (typeof row.humanAccepted !== "boolean" || typeof row.gatesPassed !== "boolean") throw new Error(`${key} acceptance must be observed booleans`);
}
if (expected.size) throw new Error(`missing v1 observations: ${[...expected].slice(0, 3).join(",")}`);
for (const task of dataset.tasks) for (let repetition = 1; repetition <= 3; repetition += 1) {
  const pair = ledger.observations.filter((row) => row.taskId === task.taskId && row.repetition === repetition);
  if (new Set(pair.map((row) => row.modelAlias)).size !== 1) throw new Error(`${task.taskId}:${repetition} model alias drift`);
}
const arm = (name) => ledger.observations.filter((row) => row.arm === name);
const mean = (rows, field) => rows.reduce((sum, row) => sum + Number(row[field]), 0) / rows.length;
const summarize = (rows) => ({ humanAcceptanceRate: mean(rows, "humanAccepted"), gatePassRate: mean(rows, "gatesPassed"), meanCostUsd: mean(rows, "costUsd"), meanSecurityFindings: mean(rows, "securityFindings"), meanDefects: mean(rows, "defectCount") });
const baseline = summarize(arm("baseline")); const candidate = summarize(arm("candidate"));
const defensible = candidate.humanAcceptanceRate >= baseline.humanAcceptanceRate && candidate.gatePassRate >= baseline.gatePassRate && candidate.meanCostUsd <= baseline.meanCostUsd && candidate.meanSecurityFindings <= baseline.meanSecurityFindings && candidate.meanDefects <= baseline.meanDefects;
process.stdout.write(`${JSON.stringify({ schemaVersion: 1, status: defensible ? "V1_DEFENSIBLE" : "V1_NOT_YET_DEFENSIBLE", observations: ledger.observations.length, baseline, candidate })}\n`);
