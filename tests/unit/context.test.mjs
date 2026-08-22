import test from "node:test";
import assert from "node:assert/strict";

import { compileContext } from "../../context/compiler/compiler.mjs";

test("compiler prioritizes exact evidence and stays inside token budget", () => {
  const result = compileContext({
    budget: 12,
    candidates: [
      { id: "semantic", priority: 6, tokens: 8, contentHash: "s" },
      { id: "exact", priority: 1, tokens: 7, contentHash: "e" },
      { id: "test", priority: 2, tokens: 5, contentHash: "t" },
    ],
  });

  assert.deepEqual(result.artifacts.map(({ id }) => id), ["exact", "test"]);
  assert.equal(result.tokenCount, 12);
});

test("compiler deduplicates candidates by content hash", () => {
  const result = compileContext({
    budget: 20,
    candidates: [
      { id: "a", priority: 1, tokens: 5, contentHash: "same" },
      { id: "b", priority: 2, tokens: 5, contentHash: "same" },
    ],
  });

  assert.deepEqual(result.artifacts.map(({ id }) => id), ["a"]);
});
