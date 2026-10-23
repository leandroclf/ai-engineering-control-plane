#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const providers = ["codex", "claude", "opencode"];
for (const provider of providers) {
  const manifest = JSON.parse(await readFile(join("runtime-manifests", `${provider}.json`), "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.provider !== provider) throw new Error(`invalid runtime manifest: ${provider}`);
  if (manifest.status === "VALIDATED") {
    if (!manifest.cliVersion || !manifest.image || !/^sha256:[a-f0-9]{64}$/.test(manifest.digest)) throw new Error(`validated manifest is incomplete: ${provider}`);
    if (manifest.executionModeValidated !== true) throw new Error(`execution mode is not validated: ${provider}`);
  }
  if (manifest.digest && !/^sha256:[a-f0-9]{64}$/.test(manifest.digest)) throw new Error(`invalid digest: ${provider}`);
}
process.stdout.write(`${JSON.stringify({ status: "pass", manifests: providers.length })}\n`);
