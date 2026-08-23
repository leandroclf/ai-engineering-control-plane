import assert from "node:assert/strict";
import test from "node:test";

import { architectureCatalog, architectureEdges } from "../src/generated/catalog.ts";

test("exports the canonical architecture catalog for production consumers", () => {
  assert.ok(architectureCatalog.length > 0);
  assert.ok(architectureCatalog.some((component) => component.id === "harness"));
  assert.ok(architectureCatalog.every((component) => component.docs.startsWith("/docs/")));
  assert.ok(architectureEdges.some(([from, to]) => from === "console" && to === "harness"));
});
