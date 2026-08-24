import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { BrowserCapabilityProvider } from "./browser-provider.mjs";
import { BrowserWorker } from "./browser-worker.mjs";

const token = await readFile(process.env.BROWSER_WORKER_TOKEN_FILE ?? "/run/secrets/browser_worker_token", "utf8").then((value) => value.trim());
const memoryToken = process.env.MEMORY_SERVICE_TOKEN_FILE ? await readFile(process.env.MEMORY_SERVICE_TOKEN_FILE, "utf8").then((value) => value.trim()) : null;
const memoryUrl = process.env.MEMORY_SERVICE_URL?.replace(/\/$/, "");
const worker = new BrowserWorker({ profileRoot: process.env.BROWSER_PROFILE_ROOT ?? "/var/lib/aicp/browser-profiles", executable: process.env.BROWSER_EXECUTABLE ?? "chromium" });
const sessions = new Map();
const maxBody = 512 * 1024;
async function persistSession(session) {
  if (!memoryUrl || !memoryToken) throw new Error("BROWSER_SESSION_PERSISTENCE_UNAVAILABLE");
  const response = await fetch(`${memoryUrl}/v1/agent-harness/browser-sessions`, { method: "POST", headers: { Authorization: `Bearer ${memoryToken}`, "Content-Type": "application/json" }, body: JSON.stringify(session) });
  if (!response.ok) throw new Error("BROWSER_SESSION_PERSISTENCE_FAILED");
}

async function body(request) { let size = 0; const chunks = []; for await (const chunk of request) { size += chunk.length; if (size > maxBody) throw new RangeError("payload too large"); chunks.push(chunk); } return JSON.parse(Buffer.concat(chunks).toString() || "{}"); }
function send(response, status, payload) { const encoded = JSON.stringify(payload); response.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(encoded), "Cache-Control": "no-store" }); response.end(encoded); }

const server = createServer(async (request, response) => {
  try {
    if (request.method === "GET" && request.url === "/ready") return send(response, 200, { status: "ready", browser: process.env.BROWSER_EXECUTABLE ?? "chromium" });
    if (request.headers.authorization !== `Bearer ${token}`) return send(response, 401, { error: "UNAUTHORIZED" });
    if (request.method === "POST" && request.url === "/v1/sessions") {
      const payload = await body(request); const handle = await worker.start(payload);
      try { await persistSession({ session_id: handle.sessionId, agent_id: handle.agentId, project_id: handle.projectId, status: "ACTIVE", metadata: {} }); } catch (error) { await worker.stop(handle); throw error; }
      sessions.set(handle.sessionId, handle);
      return send(response, 201, { sessionId: handle.sessionId, agentId: handle.agentId, projectId: handle.projectId, status: "ACTIVE" });
    }
    const match = request.url?.match(/^\/v1\/sessions\/([^/]+)(?:\/capability)?$/); if (!match) return send(response, 404, { error: "NOT_FOUND" });
    const sessionId = decodeURIComponent(match[1]); const handle = sessions.get(sessionId); if (!handle) return send(response, 404, { error: "SESSION_NOT_FOUND" });
    if (request.method === "POST" && request.url.endsWith("/capability")) {
      const payload = await body(request); const provider = new BrowserCapabilityProvider({ cdp: handle.cdp });
      return send(response, 200, await provider.execute({ capability: payload.capability, input: { ...(payload.input ?? {}), sessionId }, context: { sessionId } }));
    }
    if (request.method === "DELETE" && request.url === `/v1/sessions/${encodeURIComponent(sessionId)}`) {
      await worker.stop(handle); await persistSession({ session_id: handle.sessionId, agent_id: handle.agentId, project_id: handle.projectId, status: "CLOSED", metadata: {} }); sessions.delete(sessionId); return send(response, 200, { closed: true, sessionId });
    }
    return send(response, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (error) { return send(response, error instanceof RangeError ? 413 : 500, { error: error.message }); }
});

const port = Number(process.env.BROWSER_WORKER_PORT ?? 8091);
server.listen(port, process.env.BROWSER_WORKER_HOST ?? "0.0.0.0", () => process.stdout.write(`aicp browser worker listening on ${port}\n`));
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => Promise.all([...sessions.values()].map((handle) => worker.stop(handle))).finally(() => server.close(() => process.exit(0))));
