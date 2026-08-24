import test from "node:test";
import assert from "node:assert/strict";
import { ProviderCommandPolicy } from "../../../harness/src/providers/host/provider-command-policy.mjs";

test("provider command policy only permits structured vendor argv", () => {
  const policy = new ProviderCommandPolicy({ commands: { fake: "node" } });
  assert.deepEqual(policy.validate({ providerId: "fake", executable: "node", args: ["fixture.mjs", "; echo attacker"] }).args, ["fixture.mjs", "; echo attacker"]);
  assert.throws(() => policy.validate({ providerId: "fake", executable: "sh", args: ["-c", "echo bad"] }), /not allowed/);
  assert.throws(() => policy.validate({ providerId: "fake", executable: "node", args: ["--danger-full-access"] }), /forbidden capability/);
});
