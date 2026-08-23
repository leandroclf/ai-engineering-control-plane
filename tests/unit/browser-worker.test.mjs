import test from "node:test";
import assert from "node:assert/strict";

import { BrowserWorker } from "../../harness/src/capabilities/browser-worker.mjs";
import { HttpBrowserCapabilityProvider } from "../../harness/src/capabilities/http-browser-provider.mjs";

test("browser worker scopes profile paths and starts Chrome with isolated CDP arguments", async () => {
  const calls = [];
  const child = { pid: 42, exitCode: null, killed: false, kill(signal) { this.killed = signal; } };
  const worker = new BrowserWorker({ profileRoot: "/tmp/aicp-browser-profiles", executable: "chrome", portAllocator: async () => 9333, spawnProcess: (...args) => { calls.push(args); return child; }, webSocket: class FakeWebSocket { constructor() { this.listeners = {}; } addEventListener(name, handler) { this.listeners[name] = handler; if (name === "open") queueMicrotask(handler); } close() {} }, fetcher: async () => ({ ok: true, json: async () => ({ webSocketDebuggerUrl: "ws://127.0.0.1/devtools/page/1" }) }) });
  const handle = await worker.start({ sessionId: "session-1", agentId: "agent-1", projectId: "project-1" });
  assert.equal(calls[0][0], "chrome");
  assert.ok(calls[0][1].some((value) => value.includes("--user-data-dir=/tmp/aicp-browser-profiles/session-1")));
  assert.equal(handle.port, 9333);
  await worker.stop(handle);
  assert.equal(child.killed, "SIGTERM");
});

test("browser worker rejects traversal and missing WebSocket runtime", async () => {
  const worker = new BrowserWorker({ profileRoot: "/tmp/aicp-browser-profiles", webSocket: null });
  await assert.rejects(worker.start({ sessionId: "../escape", agentId: "a", projectId: "p" }), /SESSION_ID_INVALID/);
  await assert.rejects(worker.start({ sessionId: "valid", agentId: "a", projectId: "p" }), /WEBSOCKET_UNAVAILABLE/);
});

test("HTTP browser provider keeps the agent behind the capability contract", async () => {
  const requests = [];
  const provider = new HttpBrowserCapabilityProvider({ baseUrl: "http://browser-worker:8091", token: "scoped", transport: async (url, options) => { requests.push([url, options]); return { ok: true, json: async () => ({ sessionId: "s1" }) }; } });
  const result = await provider.execute({ capability: "browser.session", input: { agentId: "a", projectId: "p" } });
  await provider.execute({ capability: "browser.navigate", input: { sessionId: result.sessionId, url: "https://example.test" } });
  assert.equal(requests[0][1].headers.Authorization, "Bearer scoped");
  assert.match(requests[1][0], /sessions\/s1\/capability$/);
});
