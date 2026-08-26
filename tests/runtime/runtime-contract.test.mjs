import test from "node:test";
import assert from "node:assert/strict";

import { createAuthContract, createRuntimeContract, assertModeSeparation } from "../../harness/src/runtime/runtime-contract.mjs";
import { runRuntimeCompliance } from "../../harness/src/runtime/runtime-compliance.mjs";

function inspected({ image = "sha256:" + "a".repeat(64), env = [], mounts = [], tmpfs = { "/run/aicp-home": "rw" }, user = "10001", readOnly = true } = {}) {
  return { Config: { User: user, Env: ["HOME=/run/aicp-home", "AICP_EXTENSION_POLICY=STRICT", "AICP_NATIVE_SKILLS=forbidden", "AICP_PLUGINS=forbidden", "AICP_MCP_AUTO_DISCOVERY=forbidden", ...env] }, HostConfig: { ReadonlyRootfs: readOnly, Tmpfs: tmpfs, CapDrop: ["ALL"], SecurityOpt: ["no-new-privileges"] }, Mounts: [{ Destination: "/workspace/project", RW: true }, ...mounts], Image: image };
}

test("AUTH and EXECUTION contracts are explicitly separated", () => {
  const auth = createAuthContract("codex");
  const execution = createRuntimeContract({ provider: "codex" });
  assert.equal(auth.projectMounted, false);
  assert.equal(execution.credentials.interactiveLogin, false);
  assert.equal(assertModeSeparation({ authContract: auth, executionContract: execution }), true);
});

test("runtime compliance passes only with immutable, non-root, isolated behavior", async () => {
  const contract = createRuntimeContract({ provider: "opencode" });
  const report = await runRuntimeCompliance({ inspect: inspected(), contract, exec: async (command) => ({ exitCode: command[2].includes("touch") ? 1 : 0 }), manifest: { digest: "sha256:" + "a".repeat(64) } });
  assert.equal(report.status, "PASS");
  assert.ok(report.checks.every((item) => item.status === "PASS"));
});

test("runtime compliance fails closed for host credential mounts and writable root", async () => {
  const contract = createRuntimeContract({ provider: "claude" });
  await assert.rejects(runRuntimeCompliance({ inspect: inspected({ readOnly: false, mounts: [{ Destination: "/root/.ssh", Source: "/home/user/.ssh", RW: true }] }), contract, exec: async () => ({ exitCode: 0 }) }), /RUNTIME_COMPLIANCE_FAILED/);
});
