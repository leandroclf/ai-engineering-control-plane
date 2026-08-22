#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";

const contract = JSON.parse(await readFile(process.argv[2] ?? "release/v1-contract.json", "utf8"));
if (contract.schemaVersion !== 1 || !Array.isArray(contract.controls) || !contract.controls.length) throw new Error("AICP v1 release contract is required");
const ids = new Set();
for (const control of contract.controls) {
  if (!control.id || ids.has(control.id) || !["PASS", "BLOCKED"].includes(control.status)) throw new Error(`invalid release control: ${control.id}`);
  ids.add(control.id);
  if (control.status === "BLOCKED" && !control.reason) throw new Error(`blocked control lacks reason: ${control.id}`);
  for (const evidence of control.evidence ?? []) await access(evidence);
}
const governance = JSON.parse(await readFile("docs/validation/github-governance.json", "utf8"));
const ruleset = JSON.parse(await readFile(".github/branch-ruleset.main.json", "utf8"));
const configuredChecks = ruleset.rules.find((rule) => rule.type === "required_status_checks")?.parameters.required_status_checks.map((item) => item.context).sort();
if (governance.enforcement !== "active" || governance.bypassActors !== 0 || JSON.stringify([...governance.requiredChecks].sort()) !== JSON.stringify(configuredChecks)) throw new Error("remote GitHub governance evidence drift");
const context = JSON.parse(await readFile("docs/validation/aicp-v1-context-benchmark.json", "utf8"));
if (context.delta.selectedTokenRatio > 1 || context.delta.contextPrecision < 0 || context.delta.vectorUseRate >= 0) throw new Error("context benchmark regression blocks release");
const images = JSON.parse(await readFile("docs/validation/owned-image-security.json", "utf8"));
const critical = images.images.reduce((sum, image) => sum + image.critical, 0);
if (critical > 0 && contract.controls.find((item) => item.id === "no_critical_regression")?.status !== "BLOCKED") throw new Error("critical image findings must block release");
try {
  await access(".aicp/evaluations/v1-run-results.json");
  if (contract.controls.find((item) => item.id === "paired_llm_human_benchmark")?.status !== "PASS") throw new Error("observed benchmark exists but contract was not reviewed/promoted");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  if (contract.controls.find((item) => item.id === "paired_llm_human_benchmark")?.status !== "BLOCKED") throw new Error("missing observed benchmark must block release");
}
const blocked = contract.controls.filter((control) => control.status === "BLOCKED");
process.stdout.write(`${JSON.stringify({ schemaVersion: 1, classification: blocked.length ? "V1_NOT_YET_DEFENSIBLE" : "V1_DEFENSIBLE", passed: contract.controls.length - blocked.length, blocked: blocked.map(({ id, reason }) => ({ id, reason })) })}\n`);
