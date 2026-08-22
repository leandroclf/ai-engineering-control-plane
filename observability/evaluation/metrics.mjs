const SENSITIVE_KEYS = new Set([
  "prompt", "completion", "content", "source", "sourcecode", "messages", "response", "secret",
]);

function assertNoSensitiveFields(value, path = "dataset") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveFields(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase().replaceAll(/[^a-z]/g, "");
    if (SENSITIVE_KEYS.has(normalized)) throw new TypeError(`sensitive field is forbidden: ${path}.${key}`);
    assertNoSensitiveFields(item, `${path}.${key}`);
  }
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function decimal(value) {
  return Math.round(value * 1e12) / 1e12;
}

function costOf(run) {
  return (run.stages ?? []).reduce((sum, stage) => sum + Number(stage.usage?.costUsd ?? 0), 0);
}

function retrievalRate(compilations) {
  const groups = new Map();
  for (const compilation of compilations) {
    const ids = groups.get(compilation.requestKey) ?? new Set();
    ids.add(compilation.contextId);
    groups.set(compilation.requestKey, ids);
  }
  const repeated = [...groups.entries()].filter(([key]) => compilations.filter((item) => item.requestKey === key).length > 1);
  return ratio(repeated.filter(([, ids]) => ids.size === 1).length, repeated.length);
}

function contextReuseRate(runs) {
  const seen = new Set();
  let total = 0;
  let reused = 0;
  for (const run of runs) {
    for (const stage of run.stages ?? []) {
      for (const artifactId of stage.contextArtifactIds ?? []) {
        total += 1;
        if (seen.has(artifactId)) reused += 1;
        seen.add(artifactId);
      }
    }
  }
  return ratio(reused, total);
}

function assertBaseline(expectedBaseline, metrics) {
  if (expectedBaseline?.status !== "observation") {
    throw new TypeError("baseline status must be observation, never an invented SLO");
  }
  for (const [name, expected] of Object.entries(expectedBaseline.metrics ?? {})) {
    if (!(name in metrics) || Math.abs(Number(metrics[name]) - Number(expected)) > 1e-12) {
      throw new Error(`baseline drift for ${name}: expected ${expected}, actual ${metrics[name]}`);
    }
  }
}

export function evaluateDataset(dataset) {
  if (dataset?.schemaVersion !== 1) throw new TypeError("evaluation dataset schemaVersion 1 is required");
  assertNoSensitiveFields(dataset);
  const runs = dataset.runs ?? [];
  const accepted = runs.filter((run) => run.terminalState === "ready-for-human-review");
  const repairLoopCount = runs.reduce(
    (sum, run) => sum + (run.stages ?? []).filter((stage) => stage.state === "targeted-repair").length,
    0,
  );
  const modelCalls = dataset.modelCalls ?? [];
  const metrics = {
    taskCount: runs.length,
    acceptedTaskCount: accepted.length,
    acceptedTaskRate: ratio(accepted.length, runs.length),
    costPerAcceptedTaskUsd: decimal(ratio(accepted.reduce((sum, run) => sum + costOf(run), 0), accepted.length)),
    firstPassRate: ratio(
      accepted.filter((run) => !(run.stages ?? []).some((stage) => stage.state === "targeted-repair")).length,
      accepted.length,
    ),
    repairLoopCount,
    repairLoopsPerTask: ratio(repairLoopCount, runs.length),
    deterministicRetrievalRate: retrievalRate(dataset.contextCompilations ?? []),
    contextArtifactReuseRate: contextReuseRate(runs),
    modelFallbackRate: ratio(modelCalls.filter((call) => Number(call.attemptedFallbacks) > 0).length, modelCalls.length),
  };
  assertBaseline(dataset.expectedBaseline, metrics);
  return { schemaVersion: 1, datasetId: dataset.id, metrics, baseline: dataset.expectedBaseline };
}
