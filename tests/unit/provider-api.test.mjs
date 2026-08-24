import test from "node:test";
import assert from "node:assert/strict";
import { createHarnessServer } from "../../harness/src/runtime/http-server.mjs";

test("provider API exposes sanitized descriptors, health and shadow quota only", async () => {
  const runtime = {
    ready: async () => ({ status: "ready" }),
    providers: () => ({ items: [{ id: "codex-subscription", runtime: "codex", authMode: "vendor-browser-session", billingMode: "subscription", executionZone: "provider-host", secret: undefined }] }),
    provider: async (id) => ({ id, authMode: "vendor-browser-session", billingMode: "subscription" }),
    providerHealth: async (id) => ({ id, liveness: "ok", readiness: "auth_required", auth: { status: "unknown" } }),
    providerQuota: async (id) => ({ source: "aicp-shadow-ledger", providerId: id, items: [], reservations: [] }),
    providerPolicies: () => ({ policyVersion: "agent-routing-v1" }),
  };
  const server = createHarnessServer({ runtime, token: "test-token" });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const port = server.address().port;
    const get = (path) => fetch(`http://127.0.0.1:${port}${path}`, { headers: { authorization: "Bearer test-token" } });
    const providers = await (await get("/v1/providers")).json();
    assert.equal(providers.items[0].secret, undefined);
    assert.equal((await (await get("/v1/providers/codex-subscription/health")).json()).auth.status, "unknown");
    assert.equal((await (await get("/v1/providers/codex-subscription/quota")).json()).source, "aicp-shadow-ledger");
    assert.equal((await (await get("/v1/provider-policies")).json()).policyVersion, "agent-routing-v1");
  } finally { await new Promise((resolve) => server.close(resolve)); }
});
