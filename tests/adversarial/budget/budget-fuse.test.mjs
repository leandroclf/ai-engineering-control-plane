import test from "node:test";
import assert from "node:assert/strict";

import { InvocationEstimator, RoutingPricingCatalog } from "../../../harness/src/budget/invocation-estimator.mjs";
import { reconcilePhysicalUsage } from "../../../harness/src/budget/physical-usage.mjs";

test("physical fuse reserves every allowed provider attempt pessimistically", async () => {
  const estimator = new InvocationEstimator({
    tokenizer: { count: async (value) => String(value).length }, fixedOverheadTokens: 0, safetyMargin: 1,
    pricingCatalog: new RoutingPricingCatalog({ coding: { deployments: [{ inputPerMillion: 1, outputPerMillion: 2 }] } }),
  });
  const single = await estimator.estimate({ alias: "coding", prompt: "1234", maxOutputTokens: 10 });
  const fallback = await estimator.estimate({ alias: "coding", prompt: "1234", maxOutputTokens: 10, maxPhysicalAttempts: 2 });
  assert.equal(fallback.inputTokens, single.inputTokens * 2);
  assert.equal(fallback.outputTokens, single.outputTokens * 2);
  assert.equal(fallback.costUsd, single.costUsd * 2);
  assert.equal(fallback.calls, 1);
});

test("physical fuse rejects duplicate attempt identity and unknown pricing", () => {
  assert.throws(() => reconcilePhysicalUsage({}, [
    { attempt: 1, provider: "a", model: "m", providerRequestId: "r1", pricingKnown: true },
    { attempt: 1, provider: "b", model: "m", providerRequestId: "r2", pricingKnown: true },
  ]), /unique positive integers/);
  assert.throws(() => reconcilePhysicalUsage({}, [{ attempt: 1, provider: "a", model: "m", providerRequestId: "r1", pricingKnown: false }]), /PRICING_UNKNOWN/);
});
