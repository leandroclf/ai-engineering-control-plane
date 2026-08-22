export class OpenCodeController {
  constructor(client) {
    if (!client?.session?.create || !client?.session?.prompt) {
      throw new TypeError("OpenCode client with session APIs is required");
    }
    this.client = client;
  }

  async run({ directory, agent, prompt, schema }) {
    return (await this.runDetailed({ directory, agent, prompt, schema })).structured;
  }

  async runDetailed({ directory, agent, prompt, schema }) {
    const created = await this.client.session.create({ query: { directory }, body: { title: `aicp:${agent}` } });
    const session = created.data ?? created;
    if (!session?.id) throw new Error("OpenCode did not return a session id");

    const response = await this.client.session.prompt({
      path: { sessionID: session.id },
      query: { directory },
      body: {
        agent,
        format: { type: "json_schema", schema, retryCount: 1 },
        parts: [{ type: "text", text: prompt }],
      },
    });
    const data = response.data ?? response;
    const structured = data.structured ?? data.info?.structured;
    if (structured === undefined) throw new Error("OpenCode response did not contain structured output");
    const info = data.info ?? {};
    const tokens = info.tokens ?? {};
    return {
      structured,
      usage: {
        model: info.modelID ?? "unknown",
        provider: info.providerID ?? "unknown",
        costUsd: Number(info.cost ?? 0),
        inputTokens: Number(tokens.input ?? 0),
        outputTokens: Number(tokens.output ?? 0),
        reasoningTokens: Number(tokens.reasoning ?? 0),
        cacheReadTokens: Number(tokens.cache?.read ?? 0),
        cacheWriteTokens: Number(tokens.cache?.write ?? 0),
      },
    };
  }
}
