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
    });
    return {
      contextId: result.context_id,
      tokenCount: result.token_count,
      budget: result.budget,
      artifacts: result.artifacts,
    };
  }
}
