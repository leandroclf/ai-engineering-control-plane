import test from "node:test";
import assert from "node:assert/strict";

import { CapabilityProvider, CapabilityRouter, CapabilityError } from "../../harness/src/capabilities/provider.mjs";
import { BrowserCapabilityProvider } from "../../harness/src/capabilities/browser-provider.mjs";
import { SkillRegistry } from "../../harness/src/skills/registry.mjs";
import { AgentHarnessLoop } from "../../harness/src/workflow/agent-harness-loop.mjs";
import { SelfHealing } from "../../harness/src/recovery/self-healing.mjs";
import { TaskEvaluator } from "../../harness/src/evaluation/agent-evaluator.mjs";
import { AutonomyPolicy } from "../../harness/src/governance/autonomy.mjs";
import { BrowserSessionManager } from "../../harness/src/capabilities/browser-session-manager.mjs";

class FakeProvider extends CapabilityProvider {
  constructor() { super({ name: "fake", capabilities: ["test.ok", "test.fail"], permissions: { "test.ok": true, "test.fail": false } }); }
  async execute({ capability }) { if (capability === "test.fail") throw new Error("failed"); return { observed: true }; }
}

test("capability router resolves providers and fails closed on denied capability", async () => {
  const router = new CapabilityRouter().register(new FakeProvider());
  assert.deepEqual((await router.execute({ capability: "test.ok" })).result, { observed: true });
  await assert.rejects(router.execute({ capability: "test.fail" }), (error) => error instanceof CapabilityError && error.code === "CAPABILITY_DENIED");
  await assert.rejects(router.execute({ capability: "unknown" }), /CAPABILITY_UNAVAILABLE/);
});

test("browser provider exposes CDP actions and persistent scoped sessions without credentials", async () => {
  const calls = [];
  const browser = new BrowserCapabilityProvider({ cdp: { send: async (...args) => { calls.push(args); return { ok: true }; } } });
  const router = new CapabilityRouter().register(browser);
  const session = await router.execute({ capability: "browser.session", input: { agentId: "a", projectId: "p" } });
  await router.execute({ capability: "browser.navigate", input: { sessionId: session.result.id, url: "https://example.test" } });
  assert.equal(calls.at(-1)[0], "Page.navigate");
  assert.equal(browser.capabilities().includes("browser.inspect.accessibility"), true);
  assert.equal(Object.hasOwn(session.result, "password"), false);
});

test("skill lifecycle requires evidence and retrieval ranks matching capabilities", () => {
  const registry = new SkillRegistry();
  registry.register({ name: "browser-login", version: "1.0.0", domain: "browser", capabilities: ["browser.fill"], tags: ["login"] });
  assert.throws(() => registry.transition("browser-login", "1.0.0", "VALIDATED", { actor: "agent" }), /EVIDENCE/);
  registry.transition("browser-login", "1.0.0", "VALIDATED", { actor: "ci", evidence: ["test-login"] });
  assert.equal(registry.retrieve({ query: "login", capabilities: ["browser.fill"] })[0].skill.status, "VALIDATED");
});

test("harness loop observes failure, performs bounded recovery, evaluates and records episodic result", async () => {
  let attempts = 0; const memories = []; const router = new CapabilityRouter().register(new class extends CapabilityProvider {
    constructor() { super({ name: "unstable", capabilities: ["unstable.run"] }); }
    async execute() { attempts += 1; if (attempts === 1) throw Object.assign(new Error("transient"), { code: "TRANSIENT" }); return { done: true }; }
  }());
  const recovery = new SelfHealing({ patterns: [{ name: "transient", code: "TRANSIENT", recovery: async () => ({ retry: true }) }] });
  const loop = new AgentHarnessLoop({ router, recovery, evaluator: new TaskEvaluator({ checks: [async ({ observations }) => ({ passed: observations.at(-1)?.done === true })] }), memory: { record: async (item) => memories.push(item) }, policy: new AutonomyPolicy(1) });
  const result = await loop.run({ steps: [{ capability: "unstable.run", requiredLevel: 1 }] });
  assert.equal(result.status, "success"); assert.equal(result.retries, 1); assert.equal(memories[0].kind, "episodic");
});

test("sensitive autonomy requires human approval", () => {
  assert.throws(() => new AutonomyPolicy(3).authorize(3), /HUMAN_APPROVAL_REQUIRED/);
  assert.doesNotThrow(() => new AutonomyPolicy(3).authorize(3, { humanApproval: true }));
});

test("browser session manager persists scoped lifecycle and serializes operations", async () => {
  let now = Date.parse("2026-08-23T12:00:00Z"); const persisted = [];
  const manager = new BrowserSessionManager({ provider: {}, now: () => now, ttlMs: 1000, persist: async (session) => persisted.push(session) });
  await manager.create({ sessionId: "s1", agentId: "a", projectId: "p" });
  const order = [];
  await Promise.all([manager.withLock("s1", async () => { order.push("first"); await new Promise((resolve) => setTimeout(resolve, 5)); order.push("first-done"); }), manager.withLock("s1", async () => order.push("second"))]);
  assert.deepEqual(order, ["first", "first-done", "second"]);
  await manager.close("s1"); assert.equal(persisted.at(-1).status, "CLOSED");
  now += 2000; await assert.rejects(Promise.resolve().then(() => manager.get("s1")), /BROWSER_SESSION_CLOSED/);
});
