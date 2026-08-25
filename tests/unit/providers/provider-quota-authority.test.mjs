import test from "node:test";
import assert from "node:assert/strict";
import { ProviderQuotaAuthority } from "../../../harness/src/budget/provider-quota-ledger.mjs";

test("shadow quota allows at most one concurrent subscription execution", async () => {
  const authority = new ProviderQuotaAuthority({ policies: { codex: { maxConcurrent: 1, maxCallsPerRun: 1, maxPhysicalAttempts: 1 } } });
  const results = await Promise.allSettled([authority.reserve({ providerId: "codex", taskId: "task", runId: "run" }), authority.reserve({ providerId: "codex", taskId: "task", runId: "run" })]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected")[0].reason.code, "QUOTA_EXHAUSTED");
});

test("released reservations do not consume shadow quota", async () => {
  const authority = new ProviderQuotaAuthority({ policies: { codex: { maxConcurrent: 1, maxCallsPerRun: 1 } } });
  const reservation = await authority.reserve({ providerId: "codex", taskId: "task", runId: "run" });
  await authority.release(reservation.id);
  const next = await authority.reserve({ providerId: "codex", taskId: "task", runId: "run" });
  assert.equal(next.state, "RESERVED");
});
