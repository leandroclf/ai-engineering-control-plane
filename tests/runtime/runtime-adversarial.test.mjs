import test from "node:test";
import assert from "node:assert/strict";

import { createAuthContract, createRuntimeContract } from "../../harness/src/runtime/runtime-contract.mjs";
import { SkillManifestRegistry } from "../../harness/src/skills/manifest-resolver.mjs";

test("AUTH contract never receives a source tree and EXECUTION cannot start login", () => {
  const auth = createAuthContract("claude");
  const execution = createRuntimeContract({ provider: "claude" });
  assert.equal(auth.projectMounted, false);
  assert.equal(execution.credentials.interactiveLogin, false);
  assert.equal(execution.extensions.policy, "STRICT");
});

test("STRICT manifest resolution exposes metadata and no native skill body", () => {
  const registry = new SkillManifestRegistry({ schemaVersion: 1, manifests: [{ id: "native", version: "1", capabilities: ["code-review"], appliesWhen: ["review"], knowledge: { source: "skills/native", disclosure: "on-demand" } }] });
  const result = registry.resolve({ capabilities: ["code-review"], query: "review" });
  assert.deepEqual(Object.keys(result[0]).sort(), ["capabilities", "disclosure", "id", "manifestHash", "source", "version"]);
  assert.equal(result[0].source, "skills/native");
  assert.equal("content" in result[0], false);
});
