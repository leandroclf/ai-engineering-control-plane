import assert from "node:assert/strict";
import test from "node:test";
import { academyModules } from "../src/index.ts";

test("Academy exposes distinct learning modules with verifiable checkpoints", () => {
  assert.equal(academyModules.length, 14);
  assert.equal(new Set(academyModules.map((module) => module.id)).size, academyModules.length);
  assert.ok(academyModules.every((module) => module.lessons.length > 0 && module.checkpoint.options.length >= 2));
});
