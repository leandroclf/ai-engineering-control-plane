import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { evaluateDataset } from "../../observability/evaluation/metrics.mjs";

test("evaluation dataset reproduces cost quality context and fallback baseline", async () => {
  const dataset = JSON.parse(await readFile("tests/evaluations/baseline.dataset.json", "utf8"));
  const result = evaluateDataset(dataset);

  assert.deepEqual(result.metrics, {
    taskCount: 3,
    acceptedTaskCount: 2,
    acceptedTaskRate: 2 / 3,
    costPerAcceptedTaskUsd: 0.95,
    firstPassRate: 0.5,
    repairLoopCount: 1,
    repairLoopsPerTask: 1 / 3,
    deterministicRetrievalRate: 2 / 3,
    contextArtifactReuseRate: 2 / 9,
    modelFallbackRate: 0.25,
  });
  assert.deepEqual(result.baseline, dataset.expectedBaseline);
});

test("evaluation rejects sensitive payload fields and unverifiable baselines", () => {
  assert.throws(() => evaluateDataset({
    schemaVersion: 1,
    expectedBaseline: {},
    runs: [{ id: "run-1", terminalState: "ready-for-human-review", prompt: "secret" }],
    contextCompilations: [], modelCalls: [],
  }), /sensitive field/i);
  assert.throws(() => evaluateDataset({
    schemaVersion: 1,
    expectedBaseline: { status: "SLO" },
    runs: [], contextCompilations: [], modelCalls: [],
  }), /baseline status/i);
});
