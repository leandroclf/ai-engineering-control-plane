import { assertAgentExecutionRequest, assertStructuredOutput } from "./provider-contract.mjs";
import { isFallbackEligible, normalizeAgentResult } from "./agent-result.mjs";
import { ProviderError, PROVIDER_ERROR_CODES } from "./provider-errors.mjs";
import { WorktreeCheckpoint } from "./host/worktree-checkpoint.mjs";

function enabled(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "false").toLowerCase());
}

/**
 * The single execution boundary for approved agent adapters.
 * Routing, budget authority and durable run state remain owned by the Harness.
 */
export class AgentLauncher {
  constructor({ registry, quotaAuthority = null, budgetAuthority = null, checkpoint = new WorktreeCheckpoint(), executionStore = null, environment = process.env } = {}) {
    if (!registry) throw new TypeError("provider registry is required");
    this.registry = registry;
    this.quotaAuthority = budgetAuthority?.providerQuotaAuthority ?? quotaAuthority;
    this.checkpoint = checkpoint;
    this.executionStore = executionStore;
    this.environment = environment;
  }

  async execute(request, routing) {
    assertAgentExecutionRequest(request);
    if (!routing?.fallback?.length) throw new TypeError("provider routing decision is required");
    const maxAttempts = Math.max(1, Number(routing.maxProviderAttempts ?? 2));
    const providerIds = routing.fallback.slice(0, maxAttempts);
    const attempts = [];
    let checkpoint = null;

    for (const providerId of providerIds) {
      const provider = this.registry.require(providerId);
      const descriptor = provider.descriptor;
      let quota;
      try {
        quota = this.quotaAuthority
          ? await this.quotaAuthority.reserve({
            providerId,
            principalId: request.invocation.principalId ?? "local",
            taskId: request.invocation.taskId,
            runId: request.invocation.runId,
            physicalAttempts: 1,
            wallTimeMs: request.constraints.timeoutMs,
          })
          : null;
        checkpoint ??= await this.checkpoint.create(request.worktree.root);
        const result = await provider.execute(request, { routing, checkpoint });
        const after = await this.checkpoint.attest(request.worktree.root, checkpoint);
        const mutated = !after.clean;
        if (request.constraints.mutation === "read-only" && mutated) {
          await this.checkpoint.restore(checkpoint);
          throw new ProviderError(PROVIDER_ERROR_CODES.POLICY_DENIED, "read-only provider mutated the worktree");
        }
        result.mutation = { ...(result.mutation ?? {}), started: result.mutation?.started === true || mutated };
        assertStructuredOutput(result.structured, request.schema);
        const normalized = normalizeAgentResult(result, descriptor);
        if (quota) await this.quotaAuthority.commit(quota.id, normalized.usage);
        if (this.executionStore) await this.executionStore.record({ request, result: normalized, beforeTree: checkpoint?.beforeTree ?? null, afterTree: after.afterTree });
        return { ...normalized, routing, providerAttempts: [...(normalized.providerAttempts ?? []), ...attempts] };
      } catch (error) {
        if (quota) await this.quotaAuthority.release(quota.id).catch(() => undefined);
        let mutationStarted = false;
        if (checkpoint) {
          try {
            const attestation = await this.checkpoint.attest(request.worktree.root, checkpoint);
            mutationStarted = !attestation.clean;
            if (mutationStarted) await this.checkpoint.restore(checkpoint);
          } catch (restoreError) {
            throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_CHECKPOINT_FAILED, "provider fallback checkpoint could not be attested", { cause: restoreError });
          }
        }
        attempts.push({ providerId, providerFamily: descriptor.providerFamily, status: "failed", code: error.code ?? error.name ?? "PROVIDER_FAILURE", mutationStarted });
        if (this.executionStore) {
          await this.executionStore.record({
            request,
            result: { provider: { providerId, providerFamily: descriptor.providerFamily, runtime: descriptor.runtime, authMode: descriptor.authMode, billingMode: descriptor.billingMode }, usage: {}, mutation: { started: mutationStarted }, terminationReason: error.code ?? error.name },
            status: "failed",
            terminationReason: error.code ?? error.name,
            beforeTree: checkpoint?.beforeTree ?? null,
            afterTree: null,
          }).catch(() => undefined);
        }
        const hasNext = providerId !== providerIds.at(-1);
        if (!enabled(this.environment.AICP_PROVIDER_FALLBACK_ENABLED) || !hasNext || !isFallbackEligible(error)) throw error;
      }
    }
    throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_UNAVAILABLE, "all agent providers failed");
  }

  cancel(executionId) {
    return this.registry.list().map((provider) => provider.cancel(executionId));
  }
}
