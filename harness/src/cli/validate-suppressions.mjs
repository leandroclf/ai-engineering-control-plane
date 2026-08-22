#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import process from "node:process";

import { evaluateSuppressions } from "../scanners/suppression-policy.mjs";

const path = process.argv[2] ?? "security/suppressions.yaml";
try {
  const document = JSON.parse(await readFile(path, "utf8"));
  const result = evaluateSuppressions(document, [], { now: new Date() });
  const report = {
    schemaVersion: 1,
    status: result.errors.length || result.expired.length ? "error" : "pass",
    configured: document.suppressions?.length ?? 0,
    errors: result.errors,
    expired: result.expired,
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === "pass" ? 0 : 1;
} catch (error) {
  process.stderr.write(`suppression validation failed: ${error.message}\n`);
  process.exitCode = 2;
}
