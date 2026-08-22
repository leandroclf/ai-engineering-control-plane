#!/usr/bin/env node
import { readFile } from "node:fs/promises";
const path = process.argv[2] ?? "tests/evaluations/v1-paired.tasks.json";
const dataset = JSON.parse(await readFile(path, "utf8"));
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
process.stdout.write(`${JSON.stringify({ schemaVersion: 1, status: "ready", datasetId: dataset.id, tasks: dataset.tasks.length, composition: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value.length])) })}\n`);
