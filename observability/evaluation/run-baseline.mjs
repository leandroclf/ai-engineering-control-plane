#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { evaluateDataset } from "./metrics.mjs";

const datasetPath = process.argv[2] ?? "tests/evaluations/baseline.dataset.json";
const outputPath = process.argv[3] ?? ".aicp/evaluations/baseline.report.json";
const dashboardPaths = [
  "observability/dashboards/workflow-quality.json",
  "observability/dashboards/context-model-routing.json",
];

const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
const result = evaluateDataset(dataset);
const dashboards = await Promise.all(dashboardPaths.map(async (path) => JSON.parse(await readFile(path, "utf8"))));
for (const dashboard of dashboards) {
  for (const panel of dashboard.panels) {
    if (!(panel.metric in result.metrics)) throw new Error(`dashboard references unknown metric: ${panel.metric}`);
  }
}
const report = {
  ...result,
  dashboards: dashboards.map(({ id, title, panels }) => ({ id, title, panelCount: panels.length })),
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
