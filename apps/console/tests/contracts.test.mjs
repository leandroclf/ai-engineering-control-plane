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

test("console locale switcher accepts pt-BR and loads its messages", async () => {
  const request = await readFile(new URL("../i18n/request.ts", import.meta.url), "utf8");
  const switcher = await readFile(new URL("../app/components/command-palette.tsx", import.meta.url), "utf8");

  assert.match(request, /pt-BR/);
  assert.match(switcher, /value="pt-BR"/);
  await readFile(new URL("../messages/pt-BR.json", import.meta.url), "utf8");
});

test("admin surfaces are discoverable from navigation and compose exposes Neo4j Browser", async () => {
  const navigation = await readFile(new URL("../app/lib/navigation.ts", import.meta.url), "utf8");
  const adminPage = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const compose = await readFile(new URL("../../../compose.yaml", import.meta.url), "utf8");

  assert.match(navigation, /href: "\/admin"/);
  assert.match(adminPage, /Administrative surfaces/);
  assert.match(compose, /127\.0\.0\.1:7474:7474/);
});

test("admin center also exposes pgAdmin and RedisInsight", async () => {
  const adminSurfaces = await readFile(new URL("../app/lib/admin-surfaces.ts", import.meta.url), "utf8");
  const compose = await readFile(new URL("../../../compose.yaml", import.meta.url), "utf8");

  assert.match(adminSurfaces, /pgAdmin/);
  assert.match(adminSurfaces, /RedisInsight/);
  assert.match(compose, /127\.0\.0\.1:5050:80/);
  assert.match(compose, /127\.0\.0\.1:5540:5540/);
});
