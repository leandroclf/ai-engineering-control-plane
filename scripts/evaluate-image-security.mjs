#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const images = process.argv.slice(2);
if (!images.length) throw new Error("at least one owned image is required");
const evidence = [];
for (const image of images) {
  const name = image.split(":", 1)[0];
  const vulnerabilities = JSON.parse(await readFile(`.aicp/ci/images/${name}.vulnerabilities.json`, "utf8"));
  const sbom = JSON.parse(await readFile(`.aicp/ci/images/${name}.cdx.json`, "utf8"));
  if (sbom.bomFormat !== "CycloneDX" || !Array.isArray(sbom.components) || !sbom.components.length) throw new Error(`invalid CycloneDX SBOM: ${image}`);
  if (!vulnerabilities.Metadata?.ImageID) throw new Error(`image scan lacks immutable image identity: ${image}`);
  const findings = (vulnerabilities.Results ?? []).flatMap((result) => result.Vulnerabilities ?? []);
  evidence.push({ image, imageId: vulnerabilities.Metadata.ImageID, sbom: basename(`${name}.cdx.json`), components: sbom.components.length,
    high: findings.filter((item) => item.Severity === "HIGH").length, critical: findings.filter((item) => item.Severity === "CRITICAL").length });
}
const report = { schemaVersion: 1, status: "scanned", scannerExecution: "offline-after-governed-db-update", images: evidence };
await writeFile(".aicp/ci/images/evidence.json", `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report)}\n`);
