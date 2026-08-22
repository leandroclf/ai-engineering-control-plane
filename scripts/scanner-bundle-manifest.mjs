#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const cache = process.argv[2] ?? ".aicp/scanners/trivy";
const db = await readFile(join(cache, "db/trivy.db"));
const manifest = { schemaVersion: 1, downloadedAt: new Date().toISOString(), dbSha256: createHash("sha256").update(db).digest("hex") };
await writeFile(join(cache, "aicp-runtime-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o444 });
process.stdout.write(`${JSON.stringify({ status: "pass", ...manifest })}\n`);

