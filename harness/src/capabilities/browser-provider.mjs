import { randomUUID } from "node:crypto";
import { CapabilityError, CapabilityProvider } from "./provider.mjs";

const BROWSER_CAPABILITIES = [
  "browser.navigate", "browser.inspect.dom", "browser.inspect.accessibility", "browser.click", "browser.fill",
  "browser.keyboard", "browser.tabs", "browser.screenshot", "browser.downloads", "browser.upload",
  "browser.network.inspect", "browser.cookies", "browser.localStorage", "browser.sessionStorage",
  "browser.evaluate", "browser.console", "browser.errors", "browser.session",
];

export class BrowserCapabilityProvider extends CapabilityProvider {
  constructor({ cdp, sessionStore = new Map(), version = "0.1.0" } = {}) {
    super({ name: "browser", version, capabilities: BROWSER_CAPABILITIES, permissions: Object.fromEntries(BROWSER_CAPABILITIES.map((item) => [item, true])) });
    if (!cdp || typeof cdp.send !== "function") throw new TypeError("browser provider requires a CDP client");
    this.cdp = cdp;
    this.sessions = sessionStore;
  }

  async healthcheck() {
    try { await this.cdp.send("Browser.getVersion"); return { status: "AVAILABLE", provider: this.name, version: this.version }; }
    catch (error) { return { status: "UNAVAILABLE", provider: this.name, reason: error.message }; }
  }

  async execute({ capability, input, context }) {
    const sessionId = input.sessionId ?? context.sessionId;
    if (capability !== "browser.session" && !sessionId) throw new CapabilityError("BROWSER_SESSION_REQUIRED", "browser actions require sessionId");
    const send = (method, params = {}) => this.cdp.send(method, params, sessionId);
    switch (capability) {
      case "browser.navigate": return send("Page.navigate", { url: input.url });
      case "browser.inspect.dom": return send("Runtime.evaluate", { expression: "document.documentElement.outerHTML", returnByValue: true });
      case "browser.inspect.accessibility": return send("Accessibility.getFullAXTree");
      case "browser.click": return send("Runtime.evaluate", { expression: `(() => { const e=document.querySelector(${JSON.stringify(input.selector)}); if (!e) throw new Error('element not found'); e.click(); return true; })()`, returnByValue: true, awaitPromise: true });
      case "browser.fill": return send("Runtime.evaluate", { expression: `(() => { const e=document.querySelector(${JSON.stringify(input.selector)}); if (!e) throw new Error('element not found'); e.value=${JSON.stringify(input.value)}; e.dispatchEvent(new Event('input',{bubbles:true})); return true; })()`, returnByValue: true });
      case "browser.keyboard": return send("Input.dispatchKeyEvent", { type: input.type ?? "keyDown", key: input.key });
      case "browser.tabs": return send("Target.getTargets");
      case "browser.screenshot": return send("Page.captureScreenshot", { format: input.format ?? "png" });
      case "browser.downloads": return send("Browser.setDownloadBehavior", { behavior: input.behavior ?? "allow", downloadPath: input.downloadPath });
      case "browser.upload": return send("DOM.setFileInputFiles", { files: input.files ?? [], nodeId: input.nodeId });
      case "browser.network.inspect": return send("Network.getAllCookies");
      case "browser.cookies": return send(input.operation === "clear" ? "Network.clearBrowserCookies" : "Network.getAllCookies");
      case "browser.localStorage": return send("Runtime.evaluate", { expression: input.expression ?? "Object.entries(localStorage)", returnByValue: true });
      case "browser.sessionStorage": return send("Runtime.evaluate", { expression: input.expression ?? "Object.entries(sessionStorage)", returnByValue: true });
      case "browser.evaluate": return send("Runtime.evaluate", { expression: input.expression, returnByValue: true, awaitPromise: true });
      case "browser.console": return send("Runtime.enable");
      case "browser.errors": return send("Runtime.enable");
      case "browser.session": {
        const id = input.sessionId ?? randomUUID();
        this.sessions.set(id, { id, profileId: input.profileId ?? null, agentId: input.agentId ?? null, projectId: input.projectId ?? null, createdAt: new Date().toISOString() });
        return this.sessions.get(id);
      }
      default: throw new CapabilityError("CAPABILITY_NOT_IMPLEMENTED", capability);
    }
  }
}
