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

test("console locale switcher only supports EN and PT-BR, with PT-BR as the default", async () => {
  const request = await readFile(new URL("../i18n/request.ts", import.meta.url), "utf8");
  const switcher = await readFile(new URL("../app/components/command-palette.tsx", import.meta.url), "utf8");

  assert.match(request, /pt-BR/);
  assert.match(request, /: "pt-BR"/);
  assert.doesNotMatch(request, /pt-PT/);
  assert.match(switcher, /aria-label=\{label\}/);
  assert.match(switcher, /value="pt-BR"/);
  assert.match(switcher, /value="en"/);
  assert.doesNotMatch(switcher, /pt-PT/);
  await readFile(new URL("../messages/pt-BR.json", import.meta.url), "utf8");
  await readFile(new URL("../messages/en.json", import.meta.url), "utf8");
});

test("admin surfaces are discoverable without exposing data stores on host ports", async () => {
  const navigation = await readFile(new URL("../app/lib/navigation.ts", import.meta.url), "utf8");
  const adminPage = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  const compose = await readFile(new URL("../../../compose.yaml", import.meta.url), "utf8");
  const gateway = await readFile(new URL("../../../remote/local-control.nginx.conf", import.meta.url), "utf8");

  assert.match(navigation, /href: "\/admin"/);
  assert.match(adminPage, /Administrative surfaces/);
  assert.doesNotMatch(compose, /127\.0\.0\.1:(?:7474|5050|5540)/);
  assert.match(gateway, /location = \/browser/);
});

test("admin center also exposes pgAdmin and RedisInsight", async () => {
  const adminSurfaces = await readFile(new URL("../app/lib/admin-surfaces.ts", import.meta.url), "utf8");
  const gateway = await readFile(new URL("../../../remote/local-control.nginx.conf", import.meta.url), "utf8");

  assert.match(adminSurfaces, /pgAdmin/);
  assert.match(adminSurfaces, /RedisInsight/);
  assert.match(gateway, /location = \/pgadmin/);
  assert.match(gateway, /location = \/redisinsight/);
});

test("primary navigation is laid out horizontally on desktop", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.sidebar nav \{[^}]*display:\s*flex;/s);
  assert.match(css, /\.sidebar nav \{[^}]*flex-direction:\s*row;/s);
  assert.match(css, /\.sidebar nav \{[^}]*overflow-x:\s*auto;/s);
});
