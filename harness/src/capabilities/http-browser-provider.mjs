import { CapabilityError, CapabilityProvider } from "./provider.mjs";
import { BrowserCapabilityProvider } from "./browser-provider.mjs";

export class HttpBrowserCapabilityProvider extends CapabilityProvider {
  constructor({ baseUrl, token, transport = fetch } = {}) {
    super({ name: "browser", version: "0.1.0", capabilities: [
      "browser.navigate", "browser.inspect.dom", "browser.inspect.accessibility", "browser.click", "browser.fill", "browser.keyboard", "browser.tabs", "browser.screenshot", "browser.downloads", "browser.upload", "browser.network.inspect", "browser.cookies", "browser.localStorage", "browser.sessionStorage", "browser.evaluate", "browser.console", "browser.errors", "browser.session",
    ] });
    if (!baseUrl || !token) throw new TypeError("browser worker URL and token are required");
    this.baseUrl = baseUrl.replace(/\/$/, ""); this.token = token; this.transport = transport;
  }
  async #request(method, path, body) {
    const response = await this.transport(`${this.baseUrl}${path}`, { method, headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new CapabilityError(payload.error ?? "BROWSER_WORKER_FAILURE", payload.error ?? `browser worker returned ${response.status}`);
    return payload;
  }
  async healthcheck() { try { return await this.#request("GET", "/ready"); } catch (error) { return { status: "UNAVAILABLE", reason: error.message }; } }
  async execute({ capability, input }) {
    if (capability === "browser.session") return this.#request("POST", "/v1/sessions", input);
    if (!input?.sessionId) throw new CapabilityError("BROWSER_SESSION_REQUIRED", "browser actions require sessionId");
    return this.#request("POST", `/v1/sessions/${encodeURIComponent(input.sessionId)}/capability`, { capability, input });
  }
}
