export class AgentHarnessMemoryClient {
  constructor({ baseUrl, token, transport = fetch } = {}) {
    if (!baseUrl || !token) throw new TypeError("memory service URL and token are required");
    this.baseUrl = baseUrl.replace(/\/$/, ""); this.token = token; this.transport = transport;
  }
  async #request(path, options = {}) {
    const response = await this.transport(`${this.baseUrl}${path}`, { ...options, headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json", ...(options.headers ?? {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? `MEMORY_SERVICE_${response.status}`);
    return payload;
  }
  listSkills(scope = "PROJECT:local") { return this.#request(`/v1/agent-harness/skills?scope=${encodeURIComponent(scope)}`); }
  listFailurePatterns(scope = "PROJECT:local") { return this.#request(`/v1/agent-harness/failure-patterns?scope=${encodeURIComponent(scope)}`); }
  recordEpisode(episode) { return this.#request("/v1/agent-harness/episodes", { method: "POST", body: JSON.stringify(episode) }); }
}
