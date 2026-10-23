import test from "node:test";
import assert from "node:assert/strict";
import { compileProgressiveContext } from "../../context/compiler/context-intelligence.mjs";

test("metadata disclosure does not expose the deferred body", () => {
  const body = "deferred-body-must-not-be-disclosed";
  const result = compileProgressiveContext({ candidates: [{ id: "meta", content: body, tokens: 0, disclosure: "metadata" }], budget: { maxInputTokens: 1 } });
  assert.equal(result.artifacts[0].content, "");
  assert.equal(result.instructions.includes(body), false);
});

test("a zero supplied token count cannot bypass the context budget", () => {
  const result = compileProgressiveContext({ candidates: [{ id: "body", content: "x".repeat(100), tokens: 0 }], budget: { maxInputTokens: 2 } });
  assert.equal(result.artifacts.length, 0);
  assert.equal(result.expandable[0].id, "body");
});
