import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Console contract keeps credentials server-side and preserves release blockers", async () => {
  const route = await readFile(new URL("../app/api/runs/route.ts", import.meta.url), "utf8");
  const release = JSON.parse(await readFile(new URL("../../../release/v1-contract.json", import.meta.url), "utf8"));
  assert.doesNotMatch(route, /NEXT_PUBLIC_(?:HARNESS|LITELLM|MEMORY|WORKER)/);
  assert.match(route, /HARNESS_SERVICE_TOKEN/);
  assert.equal(release.controls.filter((control) => control.status === "BLOCKED").length, 3);
});

test("architecture and documentation contracts exist", async () => {
  const catalog = await readFile(new URL("../../../architecture/catalog.yaml", import.meta.url), "utf8");
  const docs = await readFile(new URL("../../../docs/security/ui-invariants.md", import.meta.url), "utf8");
  assert.match(catalog, /components:/);
  assert.match(docs, /Browser never receives provider credentials/);
});
