#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";

const source = JSON.parse(await readFile("models/catalog.json", "utf8"));
if (source.schemaVersion !== 1 || !source.policyVersion || !source.aliases) throw new Error("invalid canonical model catalog");
const ids = new Set();
for (const [alias, route] of Object.entries(source.aliases)) {
  if (!route.class || !Array.isArray(route.deployments) || !route.deployments.length) throw new Error(`invalid route: ${alias}`);
  for (const deployment of route.deployments) {
    for (const field of ["id", "provider", "modelEnv", "apiKeyEnv", "inputPerMillionEnv", "outputPerMillionEnv"]) if (!deployment[field]) throw new Error(`missing ${field}: ${alias}`);
    if (ids.has(deployment.id)) throw new Error(`duplicate deployment id: ${deployment.id}`);
    ids.add(deployment.id);
  }
}

const routing = `${JSON.stringify(source, null, 2)}\n`;
const observable = `${JSON.stringify({ schemaVersion: source.schemaVersion, policyVersion: source.policyVersion, aliases: Object.fromEntries(Object.entries(source.aliases).map(([alias, route]) => [alias, { class: route.class, requireProviderDiversity: route.requireProviderDiversity === true, deployments: route.deployments.map(({ id, provider, modelEnv }) => ({ id, provider, modelEnv })) }])) }, null, 2)}\n`;
const lines = ["# Generated from models/catalog.json. Do not edit.", "model_list:"];
for (const [alias, route] of Object.entries(source.aliases)) for (const deployment of route.deployments) {
  lines.push(`  - model_name: ${alias}`, "    litellm_params:", `      model: \${${deployment.modelEnv}}`, `      api_key: os.environ/${deployment.apiKeyEnv}`, "    model_info:", `      deployment_id: ${deployment.id}`, `      provider_family: ${deployment.provider}`, `      capability_class: ${route.class}`);
  lines.push(`  - model_name: ${alias}-${deployment.provider}`, "    litellm_params:", `      model: \${${deployment.modelEnv}}`, `      api_key: os.environ/${deployment.apiKeyEnv}`, "    model_info:", `      deployment_id: ${deployment.id}`, `      provider_family: ${deployment.provider}`, `      capability_class: ${route.class}`);
}
lines.push(
  "  - model_name: aicp-fallback-smoke", "    litellm_params:", "      model: openai/aicp-intentional-fault",
  "router_settings:", "  routing_strategy: simple-shuffle", "  num_retries: 1",
  "  fallbacks:", "    - aicp-fallback-smoke: [coding-fast]",
  "general_settings:", "  master_key: os.environ/LITELLM_MASTER_KEY", "  database_url: os.environ/DATABASE_URL",
  "litellm_settings:", "  drop_params: true", "  success_callback: [otel]", "  failure_callback: [otel]", "",
);
const litellm = lines.join("\n");
const targets = [["harness/config/model-routing.json", routing], ["observability/generated/model-catalog.json", observable], ["litellm/config.template.yaml", litellm]];
if (process.argv.includes("--check")) {
  for (const [path, expected] of targets) if (await readFile(path, "utf8") !== expected) throw new Error(`generated model catalog is stale: ${path}`);
} else {
  await mkdir("observability/generated", { recursive: true });
  for (const [path, content] of targets) await writeFile(path, content);
}
