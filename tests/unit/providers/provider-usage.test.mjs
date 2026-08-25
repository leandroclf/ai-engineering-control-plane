import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProviderUsage } from "../../../harness/src/telemetry/provider-usage.mjs";
import { reconcilePhysicalUsage } from "../../../harness/src/budget/physical-usage.mjs";

test("subscription usage never becomes a canonical monetary zero", () => {
  const usage = normalizeProviderUsage({ inputTokens: 10, outputTokens: 5, costUsd: 0, monetaryCostKnown: false }, { billingMode: "subscription" });
  assert.equal(usage.costUsd, 0);
  assert.equal(usage.monetaryCostKnown, false);
  assert.equal(usage.providerReportedCostUsd, null);
  assert.equal(usage.billingMode, "subscription");
});

test("reported subscription cost remains provider-reported metadata", () => {
  const usage = normalizeProviderUsage({ providerReportedCostUsd: 1.24, monetaryCostKnown: true }, { billingMode: "subscription-credit" });
  assert.equal(usage.providerReportedCostUsd, 1.24);
  assert.equal(usage.monetaryCostKnown, true);
  assert.equal(usage.costUsd, 1.24);
});

test("physical usage accepts subscription attempts without inventing API pricing", () => {
  const result = reconcilePhysicalUsage({ billingMode: "subscription", monetaryCostKnown: false }, [{ provider: "codex-subscription", runtime: "codex", executionId: "pex-1", inputTokens: 2, outputTokens: 3 }]);
  assert.equal(result.actualUsage.billingMode, "subscription");
  assert.equal(result.actualUsage.monetaryCostKnown, false);
  assert.equal(result.physicalAttempts[0].pricingKnown, false);
  assert.equal(result.actualUsage.costUsd, 0);
});
