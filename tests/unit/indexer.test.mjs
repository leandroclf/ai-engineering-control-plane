import test from "node:test";
import assert from "node:assert/strict";

import { planIncrementalIndex } from "../../context/indexer/incremental-index.mjs";

test("incremental index is a no-op for unchanged content and versions", () => {
  const previous = new Map([["a.js", { oid: "1", parserVersion: "p1", schemaVersion: "s1" }]]);
  const files = [{ path: "a.js", oid: "1" }];

  assert.deepEqual(planIncrementalIndex(previous, files, { parserVersion: "p1", schemaVersion: "s1" }), {
    changed: [],
    deleted: [],
    reused: ["a.js"],
  });
});

test("incremental index detects changed and deleted files", () => {
  const previous = new Map([
    ["a.js", { oid: "1", parserVersion: "p1", schemaVersion: "s1" }],
    ["deleted.js", { oid: "2", parserVersion: "p1", schemaVersion: "s1" }],
  ]);
  const files = [{ path: "a.js", oid: "3" }, { path: "new.js", oid: "4" }];

  assert.deepEqual(planIncrementalIndex(previous, files, { parserVersion: "p1", schemaVersion: "s1" }), {
    changed: ["a.js", "new.js"],
    deleted: ["deleted.js"],
    reused: [],
  });
});
