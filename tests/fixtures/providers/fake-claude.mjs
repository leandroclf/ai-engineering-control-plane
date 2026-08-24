#!/usr/bin/env node
import { appendFileSync } from "node:fs";

const mode = process.env.FAKE_PROVIDER_MODE ?? "success";
if (mode === "timeout") await new Promise(() => {});
if (mode === "auth") { process.stdout.write(JSON.stringify({ is_error: true, error: "login required" })); process.exit(0); }
if (mode === "quota") { process.stdout.write(JSON.stringify({ is_error: true, error: "quota exhausted" })); process.exit(0); }
if (mode === "malformed") { process.stdout.write("not-json"); process.exit(0); }
if (mode === "mutation" || mode === "crash-after-mutation") {
  appendFileSync(`${process.cwd()}/fake-provider-mutation.txt`, "mutation\n");
  if (mode === "crash-after-mutation") process.exit(9);
}
process.stdout.write(JSON.stringify({ structured_output: { outcome: "pass", summary: "fake provider", artifacts: [] }, usage: { input_tokens: 5, output_tokens: 7 }, total_cost_usd: 0.12, num_turns: 1 }));
