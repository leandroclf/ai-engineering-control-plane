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
const compose = await readFile("compose.yaml", "utf8");
for (const service of ["memory-service", "workspace", "harness"]) {
  const definition = compose.match(new RegExp(`^  ${service}:\\n([\\s\\S]*?)(?=^  [a-zA-Z0-9_-]+:|\\z)`, "m"))?.[0] ?? "";
  if (!/\n      sbom: true\n/.test(definition) || !/\n      provenance: mode=max\n/.test(definition)) {
    throw new Error(`owned image must enable BuildKit SBOM and provenance: ${service}`);
  }
}
process.stdout.write(`${JSON.stringify({ status: "pass", immutableImages: imageLines.length })}\n`);
