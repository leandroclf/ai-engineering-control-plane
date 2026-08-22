import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { validateThreatMatrix } from "../../security/threat-matrix.mjs";

test("threat matrix covers every required boundary with accountable evidence", async () => {
  const matrix = JSON.parse(await readFile("security/threat-control-matrix.json", "utf8"));
  const result = validateThreatMatrix(matrix);

  assert.equal(result.errors.length, 0);
  assert.deepEqual(new Set(result.boundaries), new Set([
    "host-workspace", "gateway", "apis", "repository-agent", "memory-scope", "supply-chain", "telemetry",
  ]));
  assert.ok(result.openRisks.includes("THR-SUPPLY-CHAIN"));
});

test("threat matrix rejects missing owner evidence and residual risk", () => {
  const result = validateThreatMatrix({ schemaVersion: 1, threats: [{ id: "THR-1", boundary: "gateway" }] });
  assert.ok(result.errors.some((error) => error.includes("owner")));
  assert.ok(result.errors.some((error) => error.includes("evidence")));
  assert.ok(result.errors.some((error) => error.includes("residualRisk")));
});
