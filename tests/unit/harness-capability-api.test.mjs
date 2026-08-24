import test from "node:test";
import assert from "node:assert/strict";
import { createHarnessServer } from "../../harness/src/runtime/http-server.mjs";
import { CapabilityProvider, CapabilityRouter } from "../../harness/src/capabilities/provider.mjs";
import { SkillRegistry } from "../../harness/src/skills/registry.mjs";
import { AgentHarnessMemoryClient } from "../../harness/src/memory/agent-harness-memory-client.mjs";

test("Harness exposes providers, skills, retrieval and metrics without exposing provider internals", async (t) => {
  const router = new CapabilityRouter().register(new class extends CapabilityProvider { constructor() { super({ name: "test", capabilities: ["test.read"] }); } }());
  const skills = new SkillRegistry(); skills.register({ name: "test-skill", version: "1.0.0", capabilities: ["test.read"] });
  const server = createHarnessServer({ token: "token", projectsRoot: process.cwd(), capabilityRouter: router, skillRegistry: skills, metrics: { snapshot: () => ({ counters: { test: 1 } }) }, runtime: { ready: async () => ({ status: "ready" }), capabilities: async () => [], skills: async () => [] } });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve)); t.after(() => server.close());
  const port = server.address().port; const get = (path) => fetch(`http://127.0.0.1:${port}${path}`, { headers: { Authorization: "Bearer token" } });
  const providers = await (await get("/v1/capability-providers")).json(); assert.equal(providers[0].name, "test"); assert.equal(providers[0].permissions, undefined);
  const listed = await (await get("/v1/skills")).json(); assert.equal(listed[0].name, "test-skill");
  const retrieved = await (await get("/v1/skills:retrieve?capability=test.read")).json(); assert.equal(retrieved[0].skill.name, "test-skill");
  assert.deepEqual(await (await get("/v1/metrics/agent")).json(), { counters: { test: 1 } });
});

test("memory client retrieves governed persisted skills through scoped API", async () => {
  let request;
  const client = new AgentHarnessMemoryClient({ baseUrl: "http://memory:8080", token: "memory-token", transport: async (url, options) => { request = [url, options]; return { ok: true, json: async () => ({ items: [{ name: "persisted", version: "1.0.0" }] }) }; } });
  const result = await client.listSkills("PROJECT:site");
  assert.equal(result.items[0].name, "persisted"); assert.match(request[0], /scope=PROJECT%3Asite/); assert.equal(request[1].headers.Authorization, "Bearer memory-token");
});
