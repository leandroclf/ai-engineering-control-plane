import test from "node:test";
import assert from "node:assert/strict";

import { BudgetExceededError, TaskBudget } from "../../harness/src/budget/task-budget.mjs";
import { Workflow } from "../../harness/src/workflow/workflow.mjs";

test("workflow advances only through declared transitions", () => {
  const workflow = new Workflow({
    initial: "discover",
    terminal: ["ready", "failed"],
    states: {
      discover: { next: { success: "verify" } },
      verify: { next: { pass: "ready", fail: "failed" } },
      ready: {},
      failed: {},
    },
  });

  assert.equal(workflow.transition("discover", "success"), "verify");
  assert.throws(() => workflow.transition("discover", "pass"), /not declared/);
  assert.equal(workflow.isTerminal("ready"), true);
});

test("budget stops before a call that exceeds a hard limit", () => {
  const budget = new TaskBudget({ maxCalls: 2, maxInputTokens: 100, maxCostUsd: 1 });

  budget.consume({ inputTokens: 40, outputTokens: 5, costUsd: 0.25 });
  budget.consume({ inputTokens: 50, outputTokens: 5, costUsd: 0.25 });

  assert.throws(
    () => budget.consume({ inputTokens: 1, outputTokens: 1, costUsd: 0.01 }),
    (error) => error instanceof BudgetExceededError && error.limit === "maxCalls",
  );
});

test("budget limits repair iterations and repeated tool calls", () => {
  const budget = new TaskBudget({ maxIterations: 1, maxRepeatedToolCalls: 2 });

  budget.consumeIteration();
  budget.consumeToolCall("read:app.js");
  budget.consumeToolCall("read:app.js");

  assert.throws(() => budget.consumeIteration(), (error) => error.limit === "maxIterations");
  assert.throws(() => budget.consumeToolCall("read:app.js"), (error) => error.limit === "maxRepeatedToolCalls");
});

test("progress detector stops repeated finding and diff fingerprints", async () => {
  const { ProgressDetector } = await import("../../harness/src/workflow/progress-detector.mjs");
  const detector = new ProgressDetector({ repeatedThreshold: 2 });

  assert.equal(detector.observe({ finding: "ABC", diff: "123" }).stop, false);
  assert.deepEqual(detector.observe({ finding: "ABC", diff: "123" }), {
    stop: true,
    reason: "NO_PROGRESS",
  });
});

test("OpenCode controller creates a session and requests structured output", async () => {
  const calls = [];
  const client = {
    session: {
      create: async (options) => { calls.push(["create", options]); return { data: { id: "session-1" } }; },
      prompt: async (options) => { calls.push(["prompt", options]); return { data: { structured: { status: "success" } } }; },
    },
  };
  const { OpenCodeController } = await import("../../harness/src/agents/opencode-controller.mjs");
  const controller = new OpenCodeController(client);
  const schema = { type: "object", required: ["status"] };

  const result = await controller.run({ directory: "/workspace/project", agent: "architect", prompt: "Inspect", schema });

  assert.deepEqual(result, { status: "success" });
  assert.equal(calls[1][1].body.format.type, "json_schema");
  assert.deepEqual(calls[1][1].body.format.schema, schema);
});
