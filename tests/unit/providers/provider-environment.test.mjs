import test from "node:test";
import assert from "node:assert/strict";
import { providerEnvironment, forbiddenProviderEnvironmentNames } from "../../../harness/src/providers/host/clean-environment.mjs";

test("provider host uses an allowlist and strips Harness/provider secrets", () => {
  const environment = providerEnvironment({ PATH: "/bin", HOME: "/home/user", LANG: "C", GITHUB_TOKEN: "secret", DATABASE_URL: "db", OPENAI_API_KEY: "key", CUSTOM: "ignored" });
  assert.deepEqual(environment, { PATH: "/bin", HOME: "/home/user", LANG: "C" });
  assert.deepEqual(forbiddenProviderEnvironmentNames({ GITHUB_TOKEN: "secret", DATABASE_URL: "db", HOME: "/home" }), ["GITHUB_TOKEN", "DATABASE_URL"]);
});
