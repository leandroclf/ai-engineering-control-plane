import { relative, resolve, sep } from "node:path";
import { WorkerManager } from "../runtime/ephemeral-worker-contract.mjs";

export class HttpWorkerManager extends WorkerManager {
  constructor({ baseUrl, token, clientProjectRoot, transport = fetch }) {
    super();
    if (!baseUrl || !token || !clientProjectRoot) throw new TypeError("worker manager URL, token and client project root are required");
    this.baseUrl = baseUrl.replace(/\/$/, ""); this.token = token; this.clientProjectRoot = resolve(clientProjectRoot); this.transport = transport;
  }

  async #request(method, path, body) {
    const response = await this.transport(`${this.baseUrl}${path}`, { method, headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? `WORKER_MANAGER_HTTP_${response.status}`);
    return payload;
  }

  #project(projectDirectory) {
    const path = relative(this.clientProjectRoot, resolve(projectDirectory));
    if (path.startsWith(`..${sep}`) || path === ".." || resolve(this.clientProjectRoot, path) !== resolve(projectDirectory)) throw new Error("WORKER_PROJECT_OUTSIDE_CLIENT_ROOT");
    return path || ".";
  }

  async create(spec) { return this.#request("POST", "/v1/workers", { runId: spec.runId, ...(spec.taskId ? { taskId: spec.taskId } : {}), project: this.#project(spec.projectDirectory), profile: spec.profile, environment: spec.environment ?? {}, ...(spec.baseCommit ? { baseCommit: spec.baseCommit } : {}), ...(spec.credentials ? { credentials: spec.credentials } : {}) }); }
  async exec(runId, command) { return this.#request("POST", `/v1/workers/${encodeURIComponent(runId)}/exec`, { command }); }
  async execCapability(runId, request) { return this.#request("POST", `/v1/workers/${encodeURIComponent(runId)}/capability`, request); }
  async invokeAgent(runId, request) { return this.#request("POST", `/v1/workers/${encodeURIComponent(runId)}/agent`, request); }
  async collectEvidence(runId) { return this.#request("GET", `/v1/workers/${encodeURIComponent(runId)}/evidence`); }
  async getCredentials(runId) { return this.#request("GET", `/v1/workers/${encodeURIComponent(runId)}/credentials`); }
  async destroy(runId) { return this.#request("DELETE", `/v1/workers/${encodeURIComponent(runId)}`); }
  async ready() { return this.#request("GET", "/ready"); }
}
