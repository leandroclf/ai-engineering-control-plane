import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { EphemeralWorkerSpec, WorkloadIdentity } from "../runtime/ephemeral-worker-contract.mjs";
import { DockerWorkerManager } from "./docker-worker-manager.mjs";
import { readJsonBody, statusForWorkerManagerError, validateCreateWorkerPayload, validateExecPayload } from "./worker-manager-http.mjs";
import { ProcessDockerControl } from "./process-docker-control.mjs";
import { WorkerProfileRegistry } from "./worker-profile-registry.mjs";
import { WorkloadIdentityService } from "./workload-identity-service.mjs";

const required = (name) => process.env[name] || (() => { throw new TypeError(`${name} is required`); })();
const apiToken = required("WORKER_MANAGER_TOKEN");
const projectsRoot = resolve(required("AICP_WORKER_PROJECTS_ROOT"));
const identities = new WorkloadIdentityService({ secret: required("WORKER_IDENTITY_SIGNING_SECRET"), ttlSeconds: Number(process.env.WORKER_IDENTITY_TTL_SECONDS ?? 900) });
const profiles = new WorkerProfileRegistry(JSON.parse(await readFile(process.env.WORKER_PROFILES_PATH ?? "harness/config/worker-profiles.json", "utf8")));
const manager = new DockerWorkerManager({
  docker: new ProcessDockerControl(), profiles, identityService: identities, network: process.env.WORKER_NETWORK ?? "none",
  secretResolver: async (reference) => reference.startsWith("llm/") ? required("WORKER_LITELLM_TOKEN") : reference.startsWith("memory/") ? required("WORKER_MEMORY_TOKEN") : null,
});

function projectPath(project) {
  const candidate = resolve(projectsRoot, project);
  if (candidate !== projectsRoot && !candidate.startsWith(`${projectsRoot}${sep}`)) throw new Error("WORKER_PROJECT_OUTSIDE_SERVER_ROOT");
  return candidate;
}
function send(response, status, payload) { const encoded = JSON.stringify(payload); response.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(encoded) }); response.end(encoded); }

const server = createServer(async (request, response) => {
  try {
    if (request.headers.authorization !== `Bearer ${apiToken}`) return send(response, 401, { error: "UNAUTHORIZED" });
    if (request.method === "GET" && request.url === "/ready") return send(response, 200, { status: "ready", profiles: [...profiles.profiles.keys()].sort() });
    if (request.method === "POST" && request.url === "/v1/workers") {
      const payload = validateCreateWorkerPayload(await readJsonBody(request));
      const token = identities.issue(payload.runId);
      const identity = new WorkloadIdentity({ runId: payload.runId, litellmKeyRef: `llm/${payload.runId}`, memoryTokenRef: `memory/${payload.runId}`, expiresAt: new Date(Date.now() + Number(process.env.WORKER_IDENTITY_TTL_SECONDS ?? 900) * 1000) });
      return send(response, 201, await manager.create(new EphemeralWorkerSpec({ runId: payload.runId, projectDirectory: projectPath(payload.project), profile: payload.profile, environment: payload.environment, identity, identityToken: token })));
    }
    const match = request.url?.match(/^\/v1\/workers\/([^/]+)(?:\/(exec|evidence))?$/);
    if (!match) return send(response, 404, { error: "NOT_FOUND" });
    const runId = decodeURIComponent(match[1]);
    if (request.method === "POST" && match[2] === "exec") {
      const { command } = validateExecPayload(await readJsonBody(request));
      return send(response, 200, await manager.exec(runId, command));
    }
    if (request.method === "GET" && match[2] === "evidence") return send(response, 200, await manager.collectEvidence(runId));
    if (request.method === "DELETE" && !match[2]) return send(response, 200, { destroyed: await manager.destroy(runId) });
    return send(response, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    const status = statusForWorkerManagerError(error);
    return send(response, status, { error: error.message });
  }
});

const port = Number(process.env.WORKER_MANAGER_PORT ?? 8090);
server.listen(port, process.env.WORKER_MANAGER_HOST ?? "127.0.0.1", () => process.stdout.write(`aicp worker manager listening on ${port}\n`));
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close(() => process.exit(0)));
