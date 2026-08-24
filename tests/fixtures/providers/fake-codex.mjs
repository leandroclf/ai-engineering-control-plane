#!/usr/bin/env node
import { appendFileSync, readFileSync } from "node:fs";

const mode = process.env.FAKE_PROVIDER_MODE ?? "success";
if (mode === "timeout") await new Promise(() => {});
if (mode === "auth") { process.stderr.write("login required\n"); process.exit(3); }
if (mode === "quota") { process.stderr.write("rate limit quota exhausted\n"); process.exit(4); }
if (mode === "malformed") { process.stdout.write("{not-json}\n"); process.exit(0); }
if (mode === "bomb") { process.stdout.write("x".repeat(4 * 1024 * 1024)); process.exit(0); }
if (mode === "mutation" || mode === "crash-after-mutation") {
  const root = process.cwd();
  appendFileSync(`${root}/fake-provider-mutation.txt`, "mutation\n");
  if (mode === "crash-after-mutation") process.exit(9);
}
const schemaFlag = process.argv.indexOf("--output-schema");
if (schemaFlag !== -1 && process.argv[schemaFlag + 1]) readFileSync(process.argv[schemaFlag + 1], "utf8");
process.stdout.write(`${JSON.stringify({ type: "turn.started" })}\n`);
process.stdout.write(`${JSON.stringify({ type: "result", result: { outcome: "pass", summary: "fake provider", artifacts: [] }, usage: { input_tokens: 5, output_tokens: 7 } })}\n`);
