import test from "node:test";
import assert from "node:assert/strict";
import { parseClaudeJson } from "../../../harness/src/providers/parsers/claude-json-parser.mjs";

test("Claude parser returns structured result and preserves reported subscription cost", () => {
  const result = parseClaudeJson(JSON.stringify({ structured_output: { outcome: "pass", summary: "ok", artifacts: [] }, usage: { input_tokens: 2, output_tokens: 5 }, total_cost_usd: 1.24, num_turns: 2 }));
  assert.equal(result.structured.outcome, "pass");
  assert.equal(result.usage.providerReportedCostUsd, 1.24);
  assert.equal(result.usage.agentTurns, 2);
});

test("Claude parser rejects arbitrary text and auth errors", () => {
  assert.throws(() => parseClaudeJson("plain text"), /invalid Claude JSON/);
  assert.throws(() => parseClaudeJson(JSON.stringify({ is_error: true, error: "login required" })), /authentication/);
});
