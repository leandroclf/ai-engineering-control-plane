import test from "node:test";
import assert from "node:assert/strict";
import { parseCodexJsonl } from "../../../harness/src/providers/parsers/codex-jsonl-parser.mjs";

test("Codex parser accepts bounded structured JSONL and normalizes usage", () => {
  const result = parseCodexJsonl(`${JSON.stringify({ type: "turn.started" })}\n${JSON.stringify({ type: "result", result: { outcome: "pass", summary: "ok", artifacts: [] }, usage: { input_tokens: 3, output_tokens: 4 } })}\n`);
  assert.equal(result.structured.outcome, "pass");
  assert.equal(result.usage.inputTokens, 3);
});

test("Codex parser fails closed on malformed or unstructured output", () => {
  assert.throws(() => parseCodexJsonl("not-json\n"), /invalid Codex JSONL/);
  assert.throws(() => parseCodexJsonl(`${JSON.stringify({ type: "message", text: "not structured" })}\n`), /structured output/);
});
