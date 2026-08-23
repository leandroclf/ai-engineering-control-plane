import assert from "node:assert/strict";
import test from "node:test";

import {
  presentationForGateStatus,
  presentationForRunStatus,
} from "../src/domain-status.ts";

test("maps every governed run status without promoting an unknown state to success", () => {
  const expected = {
    PENDING: "neutral",
    RUNNING: "running",
    BLOCKED: "blocked",
    FAILED: "failed",
    COMPLETED: "success",
    CANCELLED: "cancelled",
    HUMAN_REVIEW: "human-required",
  } as const;

  for (const [status, presentation] of Object.entries(expected)) {
    assert.equal(presentationForRunStatus(status), presentation, status);
  }

  assert.equal(presentationForRunStatus("CONTRACT_DRIFT"), "neutral");
});

test("maps gate results truthfully and preserves unknown evidence as neutral", () => {
  assert.equal(presentationForGateStatus("PASS"), "success");
  assert.equal(presentationForGateStatus("BLOCKED"), "blocked");
  assert.equal(presentationForGateStatus("FAILED"), "failed");
  assert.equal(presentationForGateStatus("RUNNING"), "running");
  assert.equal(presentationForGateStatus("UNRECOGNISED"), "neutral");
});
