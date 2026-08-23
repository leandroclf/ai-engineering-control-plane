#!/usr/bin/env node
import { readFile } from "node:fs/promises";

const runtime = await readFile("harness/src/runtime/production-runtime.mjs", "utf8");
const provider = await readFile("harness/src/agents/governed-context-provider.mjs", "utf8");
const service = await readFile("memory-service/src/aicp_memory/context_service.py", "utf8");
const server = await readFile("memory-service/src/aicp_memory/server.py", "utf8");
if (runtime.includes("context-v2") || provider.includes("context-v2")) throw new Error("legacy context-v2 runtime advertisement remains");
for (const [name, source, marker] of [
  ["provider retrieval", provider, "retrieval-v3"],
  ["provider packing", provider, "packing-v3"],
  ["service retrieval", service, '"retrieval-v3"'],
  ["service packing", service, '"packing-v3"'],
  ["ready context schema", server, '"contextSchema": 3'],
]) if (!source.includes(marker)) throw new Error(`version contract missing ${name}`);
process.stdout.write(JSON.stringify({ schemaVersion: 1, status: "pass", contextSchema: 3, retrievalPolicy: "retrieval-v3", packingPolicy: "packing-v3" }) + "\n");
