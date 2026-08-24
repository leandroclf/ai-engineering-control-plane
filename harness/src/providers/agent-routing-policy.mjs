import { createHash } from "node:crypto";
import { environmentClass } from "./provider-contract.mjs";
import { ProviderError, PROVIDER_ERROR_CODES } from "./provider-errors.mjs";

const ROLE_ALIASES = Object.freeze({ architect: "architect", implementer: "implementer", "security-reviewer": "security-reviewer", "code-reviewer": "code-reviewer", reviewer: "code-reviewer" });

function flag(environment, name, fallback = false) {
  if (!name) return fallback;
  return ["1", "true", "yes", "on"].includes(String(environment[name] ?? "").toLowerCase());
}

function digest(value) { return `apr_${createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24)}`; }

export class AgentRoutingPolicy {
  constructor({ configuration, registry, quotaAuthority = null, environment = process.env } = {}) {
    if (!configuration?.roles || !registry) throw new TypeError("agent routing configuration and provider registry are required");
    this.configuration = structuredClone(configuration);
    this.registry = registry;
    this.quotaAuthority = quotaAuthority;
    this.environment = environment;
  }

  async decide({ role, capability = null, producerProviderFamily = null, producerProviderId = null, mutation = "read-only", executionMode = "local", requestedProvider = null } = {}) {
    const normalizedRole = ROLE_ALIASES[role] ?? role;
    const configured = this.configuration.roles[normalizedRole] ?? this.configuration.roles.implementer ?? [];
    const preferred = requestedProvider ?? this.environment.AICP_AGENT_PROVIDER_DEFAULT ?? this.configuration.default;
    const order = preferred && configured.includes(preferred) ? [preferred, ...configured.filter((id) => id !== preferred)] : configured;
    const candidates = [];
    for (const providerId of order) {
      const provider = this.registry.get(providerId);
      const descriptor = provider?.descriptor;
      let eligible = true;
      let reason = null;
      if (!provider) { eligible = false; reason = "UNKNOWN_PROVIDER"; }
      else if (descriptor.enabled === false) { eligible = false; reason = "DISABLED"; }
      else if (descriptor.featureFlag && !flag(this.environment, descriptor.featureFlag, providerId === "opencode-litellm")) { eligible = false; reason = "FEATURE_DISABLED"; }
      else if (!flag(this.environment, "AICP_AGENT_PROVIDER_LAYER_ENABLED", false) && providerId !== "opencode-litellm") { eligible = false; reason = "LAYER_DISABLED"; }
      else if (descriptor.localOnly && environmentClass(this.environment) !== "LOCAL_PERSONAL" && !(environmentClass(this.environment) === "TRUSTED_CI" && flag(this.environment, "AICP_SUBSCRIPTION_PROVIDERS_CI_ENABLED", false) && this.environment.AICP_SUBSCRIPTION_PROVIDERS_LOCAL_ONLY === "false")) { eligible = false; reason = "LOCAL_ONLY"; }
      else if (executionMode === "ephemeral" && descriptor.executionZone === "provider-host") { eligible = false; reason = "EXECUTION_ZONE_DENIED"; }
      else if (capability && !descriptor.capabilities.includes(capability)) { eligible = false; reason = "CAPABILITY_UNSUPPORTED"; }
      else if (mutation === "workspace-write" && descriptor.executionZone === "worker" && providerId !== "opencode-litellm") { eligible = false; reason = "MUTATION_POLICY_DENIED"; }
      else if (producerProviderFamily && descriptor.providerFamily === producerProviderFamily) { eligible = false; reason = "SAME_PROVIDER_FAMILY"; }
      else if (producerProviderId && producerProviderId === providerId) { eligible = false; reason = "SAME_PROVIDER_RUNTIME"; }
      else if (this.quotaAuthority?.isEligible && !(await this.quotaAuthority.isEligible(providerId, { taskId: "unknown", runId: "unknown" }))) { eligible = false; reason = "QUOTA_EXHAUSTED"; }
      if (eligible && provider.health) {
        const health = await provider.health({ environment: this.environment, live: false });
        if (health?.policy?.allowed === false) { eligible = false; reason = health.policy.reason ?? "POLICY_DENIED"; }
        else if (health?.liveness === "error" || health?.binary?.available === false) { eligible = false; reason = "PROVIDER_UNAVAILABLE"; }
        else if (health?.auth?.status === "unauthenticated") { eligible = false; reason = "AUTH_REQUIRED"; }
        else if (health?.readiness === "quota_exhausted") { eligible = false; reason = "QUOTA_EXHAUSTED"; }
      }
      candidates.push({ providerId, providerFamily: descriptor?.providerFamily ?? null, eligible, ...(reason ? { reason } : {}) });
    }
    const selected = candidates.find((candidate) => candidate.eligible);
    const decision = {
      decisionId: digest({ policyVersion: this.configuration.policyVersion, role: normalizedRole, capability, mutation, executionMode, requestedProvider: preferred, candidates }),
      policyVersion: this.configuration.policyVersion,
      role: normalizedRole,
      candidates,
      selected: selected?.providerId ?? null,
      selectedProviderFamily: selected?.providerFamily ?? null,
      fallback: candidates.filter((candidate) => candidate.eligible).map((candidate) => candidate.providerId),
    };
    if (!selected) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_UNAVAILABLE, `no eligible agent provider for ${normalizedRole}`, { details: decision });
    return Object.freeze(decision);
  }
}
