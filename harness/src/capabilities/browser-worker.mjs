import { createServer } from "node:net";
import { mkdir, realpath } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve, sep } from "node:path";

const freePort = () => new Promise((resolvePort, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolvePort(port)); });
});

export class CdpWebSocketClient {
  constructor({ webSocket }) { if (!webSocket) throw new TypeError("WebSocket implementation is required"); this.WebSocket = webSocket; this.nextId = 0; this.pending = new Map(); }
  async connect(url) {
    this.socket = new this.WebSocket(url);
    await new Promise((resolveConnection, reject) => { this.socket.addEventListener("open", resolveConnection, { once: true }); this.socket.addEventListener("error", reject, { once: true }); });
    this.socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); const pending = this.pending.get(message.id); if (!pending) return; this.pending.delete(message.id); if (message.error) pending.reject(Object.assign(new Error(message.error.message), { code: "CDP_ERROR", details: message.error })); else pending.resolve(message.result); });
    return this;
  }
  send(method, params = {}) { if (!this.socket) return Promise.reject(new Error("CDP_NOT_CONNECTED")); const id = ++this.nextId; this.socket.send(JSON.stringify({ id, method, params })); return new Promise((resolveResult, reject) => this.pending.set(id, { resolve: resolveResult, reject })); }
  async close() { this.socket?.close(); for (const pending of this.pending.values()) pending.reject(new Error("CDP_CLOSED")); this.pending.clear(); }
}

export class BrowserWorker {
  constructor({ profileRoot, executable = process.env.BROWSER_EXECUTABLE ?? "google-chrome", spawnProcess = spawn, fetcher = fetch, webSocket = globalThis.WebSocket, portAllocator = freePort } = {}) {
    if (!profileRoot) throw new TypeError("profileRoot is required");
    this.profileRoot = resolve(profileRoot); this.executable = executable; this.spawnProcess = spawnProcess; this.fetcher = fetcher; this.webSocket = webSocket; this.portAllocator = portAllocator;
  }

  async start({ sessionId, agentId, projectId }) {
    if (!sessionId || !agentId || !projectId) throw new TypeError("sessionId, agentId and projectId are required");
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(sessionId)) throw new Error("BROWSER_SESSION_ID_INVALID");
    const root = await realpath(this.profileRoot).catch(async () => { await mkdir(this.profileRoot, { recursive: true }); return realpath(this.profileRoot); });
    const profileDirectory = resolve(root, sessionId);
    if (!profileDirectory.startsWith(`${root}${sep}`)) throw new Error("BROWSER_PROFILE_OUTSIDE_ROOT");
    await mkdir(profileDirectory, { recursive: true });
    if (!this.webSocket) throw new Error("BROWSER_WEBSOCKET_UNAVAILABLE");
    const port = await this.portAllocator();
    const child = this.spawnProcess(this.executable, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=${port}`, `--user-data-dir=${profileDirectory}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
    const version = await this.#waitForVersion(port, child);
    const cdp = await new CdpWebSocketClient({ webSocket: this.webSocket }).connect(version.webSocketDebuggerUrl);
    return Object.freeze({ sessionId, agentId, projectId, profileDirectory, port, pid: child.pid, cdp, process: child });
  }

  async #waitForVersion(port, child) {
    const endpoint = `http://127.0.0.1:${port}/json/version`;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (child.exitCode !== null) throw new Error("BROWSER_PROCESS_EXITED");
      try { const response = await this.fetcher(endpoint); if (response.ok) return response.json(); } catch { /* browser is still starting */ }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
    child.kill("SIGTERM"); throw new Error("BROWSER_START_TIMEOUT");
  }

  async stop(handle) { await handle.cdp.close(); if (!handle.process.killed) handle.process.kill("SIGTERM"); }
}
