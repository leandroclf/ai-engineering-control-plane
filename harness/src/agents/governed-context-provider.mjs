export class GovernedContextProvider {
  constructor({ contextClient }) {
    if (!contextClient?.compile) throw new TypeError("context API client is required");
    this.contextClient = contextClient;
  }

  async load({ task, state, policy }) {
    const metadata = task.metadata ?? {};
    if (!metadata.repository || !metadata.query) throw new TypeError("task context requires repository and query");
    if (!Number.isInteger(policy?.budget) || policy.budget <= 0) throw new TypeError("stage context requires a positive budget");
    const allowedTypes = new Set(policy.scopeTypes ?? []);
    const scopes = (metadata.scopes ?? []).filter((scope) => allowedTypes.has(scope.split(":", 1)[0]));
    const result = await this.contextClient.compile({
      repository: metadata.repository,
      task_id: `${task.id}:${state}`,
      query: metadata.query,
      exact_symbols: metadata.exactSymbols ?? [],
      scopes,
      budget: policy.budget,
      model_window: policy.modelWindow ?? 128000,
      output_reserve: policy.outputReserve ?? 4096,
      system_reserve: policy.systemReserve ?? 2048,
      tool_schema_reserve: policy.toolSchemaReserve ?? 1024,
      safety_reserve: policy.safetyReserve ?? 2048,
      retrieval_policy_version: policy.retrievalPolicyVersion ?? "retrieval-v3",
      packing_policy_version: policy.packingPolicyVersion ?? "packing-v3",
      tokenizer_version: policy.tokenizerVersion ?? "1",
      commit: metadata.commit,
      changed_paths: metadata.changedPaths ?? [],
    });
    return {
      contextId: result.context_id,
      tokenCount: result.token_count,
      budget: result.budget,
      artifacts: result.artifacts,
      envelope: result.envelope,
      metrics: result.metrics,
      metadata: {
        schemaVersion: result.schema_version,
        requestedBudget: result.requested_budget,
        retrievalPolicyVersion: result.retrieval_policy_version,
        packingPolicyVersion: result.packing_policy_version,
        embeddingModel: result.embedding_model,
        tokenCountModel: result.token_count_model,
        tokenizerVersion: result.tokenizer_version,
        indexSnapshot: result.index_snapshot,
        graphSnapshot: result.graph_snapshot,
        ...(result.index_schema_version !== undefined ? { indexSchemaVersion: result.index_schema_version } : {}),
        ...(result.graph_schema_version !== undefined ? { graphSchemaVersion: result.graph_schema_version } : {}),
      },
    };
  }
}
