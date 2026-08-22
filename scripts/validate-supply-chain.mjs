#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const versions = await readFile("versions.env", "utf8");
const imageLines = versions.split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*_IMAGE=/.test(line));
if (!imageLines.length) throw new Error("no governed images found");
for (const line of imageLines) {
  const [name, value] = line.split("=", 2);
  if (/(^|:)latest(?:@|$)/i.test(value)) throw new Error(`floating latest image forbidden: ${name}`);
  if (!/@sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`image must be pinned by sha256 digest: ${name}`);
}
const workflow = await readFile(".github/workflows/ci.yml", "utf8");
for (const match of workflow.matchAll(/uses:\s*([^\s#]+)/g)) if (!/@[a-f0-9]{40}$/.test(match[1])) throw new Error(`GitHub Action must be pinned by commit SHA: ${match[1]}`);
process.stdout.write(`${JSON.stringify({ status: "pass", immutableImages: imageLines.length })}\n`);
