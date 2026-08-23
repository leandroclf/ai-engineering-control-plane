#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const cache = process.argv[2] ?? ".aicp/scanners/trivy";
const db = await readFile(join(cache, "db/trivy.db"));
const manifest = { schemaVersion: 1, downloadedAt: new Date().toISOString(), dbSha256: createHash("sha256").update(db).digest("hex") };
const output = join(cache, "aicp-runtime-manifest.json");
const temporary = `${output}.tmp-${process.pid}`;
await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
await chmod(temporary, 0o444);
await rename(temporary, output);
process.stdout.write(`${JSON.stringify({ status: "pass", ...manifest })}\n`);
