import { readFile } from "node:fs/promises";

const path = "security/adversarial-matrix.json";
const matrix = JSON.parse(await readFile(path, "utf8"));
const errors = [];
const expectedIds = Array.from({ length: 20 }, (_, index) => index + 1);
const ids = matrix.cases?.map((item) => item.id) ?? [];
if (matrix.schemaVersion !== 1) errors.push("schemaVersion must be 1");
if (JSON.stringify(ids) !== JSON.stringify(expectedIds)) errors.push("matrix must contain exactly cases 1 through 20 in order");
for (const item of matrix.cases ?? []) {
  if (!item.attack || !item.status || !Array.isArray(item.evidence) || item.evidence.length === 0) errors.push(`case ${item.id} is incomplete`);
  if (!["PASS", "LIMITED", "BLOCKED"].includes(item.status)) errors.push(`case ${item.id} has an invalid status`);
  if (item.status !== "PASS" && !item.limitation) errors.push(`case ${item.id} needs a limitation`);
  for (const evidence of item.evidence ?? []) {
    try { await readFile(evidence); } catch { errors.push(`case ${item.id} evidence does not exist: ${evidence}`); }
  }
}
if (errors.length) { process.stderr.write(`${errors.join("\n")}\n`); process.exit(1); }
const summary = Object.fromEntries(["PASS", "LIMITED", "BLOCKED"].map((status) => [status, matrix.cases.filter((item) => item.status === status).length]));
process.stdout.write(`${JSON.stringify({ schemaVersion: 1, status: matrix.status, cases: matrix.cases.length, summary })}\n`);
