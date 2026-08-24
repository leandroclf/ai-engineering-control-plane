import { readFile } from "node:fs/promises";
import { AgentRoutingPolicy } from "./agent-routing-policy.mjs";
import { AgentProviderDispatcher } from "./agent-provider-dispatcher.mjs";
import { OpenCodeAgentProvider } from "./adapters/opencode-agent-provider.mjs";
import { CodexAgentProvider } from "./adapters/codex-agent-provider.mjs";
import { ClaudeCodeAgentProvider } from "./adapters/claude-code-agent-provider.mjs";
import { AgentProviderRegistry } from "./provider-registry.mjs";
import { ProviderQuotaAuthority, PostgresProviderQuotaAuthority } from "./provider-quota-authority.mjs";
import { ProviderHost } from "./host/provider-host.mjs";
import { ProviderProcessSupervisor } from "./host/provider-process-supervisor.mjs";
import { ProviderCommandPolicy } from "./host/provider-command-policy.mjs";
import { PostgresAgentProviderExecutionStore } from "./provider-execution-store.mjs";

export async function createAgentProviderLayer({ environment = process.env, controller, database = null, executionStore = null, providersPath = environment.HARNESS_AGENT_PROVIDERS_PATH ?? "harness/config/agent-providers.json", routingPath = environment.HARNESS_AGENT_ROUTING_PATH ?? "harness/config/agent-routing.json", supervisor = null } = {}) {
  const configuration = JSON.parse(await readFile(providersPath, "utf8"));
  const routingConfiguration = JSON.parse(await readFile(routingPath, "utf8"));
  AgentProviderRegistry.validateConfiguration(configuration);
  const registry = new AgentProviderRegistry({ configuration, environment });
  const processSupervisor = supervisor ?? new ProviderProcessSupervisor({ maxOutputBytes: Number(environment.AICP_PROVIDER_MAX_OUTPUT_BYTES ?? 2 * 1024 * 1024) });
  const host = new ProviderHost({ supervisor: processSupervisor, commandPolicy: new ProviderCommandPolicy(), environment });
  registry.register(new OpenCodeAgentProvider({ controller }));
  registry.register(new CodexAgentProvider({ host, executable: environment.AICP_CODEX_EXECUTABLE ?? "codex", environment }));
  registry.register(new ClaudeCodeAgentProvider({ host, executable: environment.AICP_CLAUDE_CODE_EXECUTABLE ?? "claude", environment }));
  const quotaAuthority = database ? new PostgresProviderQuotaAuthority({ database, policies: configuration.quotas ?? {} }) : new ProviderQuotaAuthority({ policies: configuration.quotas ?? {}, environment });
  const routingPolicy = new AgentRoutingPolicy({ configuration: routingConfiguration, registry, quotaAuthority, environment });
  const persistedExecutionStore = executionStore ?? (database ? new PostgresAgentProviderExecutionStore(database) : null);
  const dispatcher = new AgentProviderDispatcher({ registry, quotaAuthority, executionStore: persistedExecutionStore, environment });
  return { configuration, routingConfiguration, registry, host, quotaAuthority, routingPolicy, dispatcher, executionStore: persistedExecutionStore, environment };
}
