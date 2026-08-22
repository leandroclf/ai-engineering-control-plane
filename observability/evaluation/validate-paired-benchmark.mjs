#!/usr/bin/env node
import { readFile } from "node:fs/promises";
const path = process.argv[2] ?? "tests/evaluations/v1-paired.tasks.json";
const experimentsPath = process.argv[3] ?? "tests/evaluations/v1-paired.experiments.json";
const dataset = JSON.parse(await readFile(path, "utf8"));
const experiments = JSON.parse(await readFile(experimentsPath, "utf8"));
if (dataset.tasks?.length !== 20) throw new Error("paired benchmark requires exactly 20 tasks");
const counts = dataset.tasks.reduce((groups, task) => ({ ...groups, [task.type]: [...(groups[task.type] ?? []), task] }), {});
for (const [type, expected] of Object.entries({ bug: 8, feature: 5, refactor: 4, security: 3 })) {
  if ((counts[type] ?? []).length !== expected) throw new Error(`expected ${expected} ${type} tasks`);
}
for (const task of dataset.tasks) {
  if (!task.baseCommit && !dataset.baseCommit) throw new Error(`${task.taskId} has no base commit`);
  if (task.order.join(",") !== (["baseline,treatment", "treatment,baseline"].includes(task.order.join(",")) ? task.order.join(",") : "")) throw new Error(`${task.taskId} has invalid paired order`);
  if (!task.acceptanceTests.length || !task.hiddenTests.length || !task.expectedScope.length) throw new Error(`${task.taskId} is incomplete`);
}
if (experiments.design !== "paired" || experiments.experiments?.length !== 20) throw new Error("E01-E20 paired experiment catalog is required");
for (let index = 1; index <= 20; index += 1) {
  const id = `E${String(index).padStart(2, "0")}`;
  const experiment = experiments.experiments[index - 1];
  if (experiment?.id !== id || !experiment.a || !experiment.b || !experiment.metrics?.length) throw new Error(`invalid paired experiment ${id}`);
}
process.stdout.write(`${JSON.stringify({ schemaVersion: 1, status: "ready", datasetId: dataset.id, tasks: dataset.tasks.length, experimentCatalogId: experiments.id, experiments: experiments.experiments.length, repetitions: experiments.repetitions, composition: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value.length])) })}\n`);
