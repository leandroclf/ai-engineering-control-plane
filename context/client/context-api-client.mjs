export class ContextApiClient {
  constructor({ baseUrl, token, request }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
    this.request = request ?? this.#fetch.bind(this);
  }

  async indexState(repository) {
    const response = await this.request(`/v1/index/repositories/${encodeURIComponent(repository)}`);
    return new Map(response.files.map((file) => [file.path, {
      oid: file.oid,
      parserVersion: file.parser_version ?? file.parserVersion,
      schemaVersion: file.schema_version ?? file.schemaVersion,
      commit: file.commit,
    }]));
  }

  sync(repository, payload, { rebuild = false } = {}) {
    return this.request(`/v1/index/repositories/${encodeURIComponent(repository)}:${rebuild ? "rebuild" : "sync"}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  compile(payload) {
    return this.request("/v1/context:compile", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  impact(payload) {
    return this.request("/v1/context:impact", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  ready() { return this.request("/ready"); }

  async #fetch(path, options = {}) {
    const response = await fetch(this.baseUrl + path, {
      ...options,
      headers: { Authorization: `Bearer ${this.token}`, ...(options.headers ?? {}) },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(`context API ${response.status}: ${body.error ?? body.message ?? "request failed"}`);
    return body;
  }
}
