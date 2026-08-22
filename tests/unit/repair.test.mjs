import test from "node:test";
import assert from "node:assert/strict";

import { TargetedRepair } from "../../harness/src/workflow/targeted-repair.mjs";

test("targeted repair reruns the originating gate then regression gates", async () => {
  const calls = [];
  const repair = new TargetedRepair({
    maxIterations: 2,
    repairAgent: async ({ finding }) => { calls.push(`repair:${finding.fingerprint}`); return { diffFingerprint: "diff-2" }; },
    runGate: async (name) => { calls.push(`gate:${name}`); return { status: "pass" }; },
    reviewers: [async ({ readOnly }) => { calls.push(`review:${readOnly}`); return { status: "pass" }; }],
  });

  const result = await repair.execute({ finding: { fingerprint: "finding-1", gate: "semgrep" }, regressionGates: ["unit-tests"] });

  assert.equal(result.status, "repaired");
  assert.deepEqual(calls, ["repair:finding-1", "gate:semgrep", "gate:unit-tests", "review:true"]);
});

test("targeted repair stops repeated finding and diff at the configured limit", async () => {
  let repairs = 0;
  const repair = new TargetedRepair({
    maxIterations: 2,
    repairAgent: async () => { repairs += 1; return { diffFingerprint: "same-diff" }; },
    runGate: async () => ({ status: "fail", finding: { fingerprint: "same-finding", gate: "semgrep" } }),
  });

  const result = await repair.execute({ finding: { fingerprint: "same-finding", gate: "semgrep" }, regressionGates: [] });

  assert.equal(result.status, "human-review");
  assert.equal(result.reason, "NO_PROGRESS");
  assert.equal(repairs, 2);
});
