#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { ProviderHost } from "../providers/host/provider-host.mjs";
import { ProviderProcessSupervisor } from "../providers/host/provider-process-supervisor.mjs";
import { ProviderCommandPolicy } from "../providers/host/provider-command-policy.mjs";
import { CodexAgentProvider } from "../providers/adapters/codex-agent-provider.mjs";
import { ClaudeCodeAgentProvider } from "../providers/adapters/claude-code-agent-provider.mjs";
import { createProviderDescriptor, sanitizeProvider } from "../providers/provider-contract.mjs";
import { providerEnvironment } from "../providers/host/clean-environment.mjs";

const binaries = Object.freeze({ codex: "codex", "claude-code": "claude" });
const providerIds = Object.freeze({ codex: "codex-subscription", "claude-code": "claude-code-subscription" });

export function officialAuthCommand(provider, action) {
  const executable = binaries[provider];
  if (!executable || !["login", "logout"].includes(action)) throw new TypeError("unsupported vendor auth command");
  return Object.freeze({ executable, args: action === "login" ? ["login"] : ["logout"] });
}

function usage() { process.stderr.write("Usage: aicp providers <list|show|doctor|login|logout|test> [provider-id|codex|claude-code] [--read-only]\n"); }

export async function main(argv = process.argv.slice(2), io = process) {
  if (argv[0] !== "providers") { usage(); return 2; }
  const action = argv[1]; const subject = argv[2];
  const config = JSON.parse(await readFile(process.env.HARNESS_AGENT_PROVIDERS_PATH ?? "harness/config/agent-providers.json", "utf8"));
  if (action === "list") { io.stdout.write(`${JSON.stringify(Object.entries(config.providers).map(([id, value]) => sanitizeProvider(createProviderDescriptor({ id, ...value }))), null, 2)}\n`); return 0; }
  if (!["show", "doctor", "login", "logout", "test"].includes(action) || !subject) { usage(); return 2; }
  if (["login", "logout"].includes(action)) {
    const command = officialAuthCommand(subject, action);
    const result = spawnSync(command.executable, command.args, { stdio: "inherit", shell: false, env: providerEnvironment(process.env) });
    return result.status ?? 1;
  }
  const descriptor = config.providers[subject];
  if (!descriptor) { io.stderr.write(`Unknown provider: ${subject}\n`); return 2; }
  if (action === "show") { io.stdout.write(`${JSON.stringify(sanitizeProvider(createProviderDescriptor({ id: subject, ...descriptor })), null, 2)}\n`); return 0; }
  const supervisor = new ProviderProcessSupervisor();
  const host = new ProviderHost({ supervisor, commandPolicy: new ProviderCommandPolicy(), environment: process.env });
  const provider = subject === "codex-subscription" ? new CodexAgentProvider({ host, environment: process.env }) : new ClaudeCodeAgentProvider({ host, environment: process.env });
  if (action === "doctor") { io.stdout.write(`${JSON.stringify({ id: subject, ...(await provider.health()) }, null, 2)}\n`); return 0; }
  if (action === "test") {
    if (!argv.includes("--read-only")) { io.stderr.write("Provider test requires --read-only.\n"); return 2; }
    if (process.env.AICP_LIVE_PROVIDER_TESTS !== "true") { io.stderr.write("Live provider tests are disabled; set AICP_LIVE_PROVIDER_TESTS=true explicitly.\n"); return 2; }
    const root = process.env.PROJECTS_ROOT ?? process.cwd();
    const request = { agent: "code-reviewer", prompt: "Return a minimal structured health result without modifying files.", schema: { type: "object", additionalProperties: true }, worktree: { root, checkpoint: root }, constraints: { timeoutMs: 120000, mutation: "read-only", network: "provider-only" }, invocation: { taskId: "provider-test", runId: "provider-test", stage: "provider-test", reservationId: "provider-test", logicalInvocationId: `provider-test-${Date.now()}` } };
    const result = await provider.execute(request);
    io.stdout.write(`${JSON.stringify({ id: subject, status: "completed", usage: result.usage, terminationReason: result.terminationReason }, null, 2)}\n`);
    return 0;
  }
  return 2;
}

if (import.meta.url === `file://${process.argv[1]}`) main().then((code) => { process.exitCode = code; }).catch((error) => { process.stderr.write(`aicp providers failed: ${error.message}\n`); process.exitCode = 1; });
