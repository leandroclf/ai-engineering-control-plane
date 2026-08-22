#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const read = async (path) => readFile(path, "utf8");
const workflow = JSON.parse(await read("harness/workflows/feature.yaml"));
const gates = JSON.parse(await read("harness/config/gates.yaml"));
const opencode = JSON.parse(await read("opencode/opencode.json"));
const compose = await read("compose.yaml");
const handlers = await read("harness/src/runtime/workflow-handlers.mjs");
const executor = await read("harness/src/workflow/executor.mjs");

const requiredGates = [...new Set(Object.values(workflow.states).flatMap((state) => state.gates ?? []))];
const missing = requiredGates.filter((name) => !gates.gates[name]);
if (missing.length) throw new Error(`unresolved workflow gates: ${missing.join(",")}`);
if (opencode.permission["*"] !== "deny") throw new Error("OpenCode must be deny-by-default");
if (compose.includes("/var/run/docker.sock")) throw new Error("Docker socket must not be mounted");
if (!compose.includes("agent-internal:\n    internal: true")) throw new Error("agent network must be internal");
if (!compose.includes("read_only: true")) throw new Error("executor root filesystem must be read-only");
if (!handlers.includes("budgetAuthority.reserve") || !handlers.includes("budgetAuthority.commit")) throw new Error("agents must be wrapped by budget authority");
if (!executor.includes("this.workflow.transition")) throw new Error("Harness must own workflow transitions");
for (const reviewer of ["architect", "code-reviewer", "security-reviewer"]) {
  const content = await read(`opencode/agents/${reviewer}.md`);
  if (!content.includes("edit: deny")) throw new Error(`${reviewer} must not edit`);
}
process.stdout.write(`${JSON.stringify({ schemaVersion: 1, status: "pass", requiredGates, invariants: 8 })}\n`);
