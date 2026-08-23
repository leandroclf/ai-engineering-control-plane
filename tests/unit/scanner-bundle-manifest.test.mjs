import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);

test("scanner manifest can be refreshed after its previous result became read-only", async () => {
  const directory = await mkdtemp(join(tmpdir(), "aicp-scanner-manifest-"));
  try {
    await mkdir(join(directory, "db"));
    await writeFile(join(directory, "db", "trivy.db"), "first database");
    await execute("node", ["scripts/scanner-bundle-manifest.mjs", directory]);
    await writeFile(join(directory, "db", "trivy.db"), "refreshed database");

    await execute("node", ["scripts/scanner-bundle-manifest.mjs", directory]);

    const manifest = JSON.parse(await readFile(join(directory, "aicp-runtime-manifest.json"), "utf8"));
    assert.equal(manifest.schemaVersion, 1);
    assert.equal((await stat(join(directory, "aicp-runtime-manifest.json"))).mode & 0o777, 0o444);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
