import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

import { resolveProjectDirectory } from "../cli/runtime-arguments.mjs";
import { ControlPlaneAuthorizer } from "../security/identity-authority.mjs";

export const API_OPERATIONS = Object.freeze([
  "health", "readiness", "createRun", "listRuns", "getRun", "listRunStages", "resumeRun", "cancelRun", "getRunAudit", "getRunGates", "getRunFindings",
  "getTask", "getTaskBudget", "listBudgetEvents", "cancelTaskBudget", "listCapabilities", "listCapabilityProviders", "listSkills", "retrieveSkills", "getAgentMetrics", "listWorkflows", "listPolicies", "listModels", "getContext", "getRunExecution", "getRunCredentials", "getRunAttestations", "getV1Certification", "getV1CertificationFindings", "getOverview", "getSystemStatus", "getCurrentActor", "listProjects", "getProject", "streamRunEvents",
]);

export const MAX_REQUEST_BODY_BYTES = 1_048_576;

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(`${JSON.stringify(body)}\n`);
}

async function jsonBody(request, limit = 1_048_576) {
  let bytes = 0;
  const chunks = [];
  let oversized = false;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > limit) oversized = true;
    if (!oversized) chunks.push(buffer);
  }
  if (oversized) throw new RangeError("request body exceeds limit");
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

const CREATE_RUN_FIELDS = new Set(["project", "repository", "query", "idempotencyKey", "exactSymbols", "scopes", "constraints", "workerProfile", "projectKind", "projectModules", "projectProfile", "baseCommit"]);
const CONSTRAINT_RULES = Object.freeze({
  maxCostUsd: { integer: false, minimum: 0, exclusive: true },
  maxCalls: { integer: true, minimum: 1 },
  maxInputTokens: { integer: true, minimum: 1 },
  maxOutputTokens: { integer: true, minimum: 1 },
  maxIterations: { integer: true, minimum: 0 },
});

export function startRequest(body, projectsRoot, idempotencyHeader = null) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new TypeError("request body must be an object");
  const unknown = Object.keys(body).find((name) => !CREATE_RUN_FIELDS.has(name));
  if (unknown) throw new TypeError(`unknown request field: ${unknown}`);
  const idempotencyKey = idempotencyHeader || body.idempotencyKey;
  if (typeof body.project !== "string" || !body.project.trim() || typeof body.query !== "string" || !body.query.trim() || typeof idempotencyKey !== "string" || idempotencyKey.length < 8) {
    throw new TypeError("project, query and idempotencyKey are required");
  }
  if (body.repository !== undefined && (typeof body.repository !== "string" || !body.repository.trim())) throw new TypeError("repository must be a non-empty string");
  if (body.exactSymbols !== undefined && (!Array.isArray(body.exactSymbols) || body.exactSymbols.some((value) => typeof value !== "string" || !value))) throw new TypeError("exactSymbols must contain non-empty strings");
  if (body.scopes !== undefined && (!Array.isArray(body.scopes) || body.scopes.some((value) => typeof value !== "string" || !value))) throw new TypeError("scopes must contain non-empty strings");
  if (body.workerProfile !== undefined && (typeof body.workerProfile !== "string" || !body.workerProfile.trim())) throw new TypeError("workerProfile must be a non-empty string");
  if (body.projectKind !== undefined && (typeof body.projectKind !== "string" || !body.projectKind.trim())) throw new TypeError("projectKind must be a non-empty string");
  if (body.projectModules !== undefined && (!Array.isArray(body.projectModules) || body.projectModules.some((value) => typeof value !== "string" || !value.trim()))) throw new TypeError("projectModules must contain non-empty strings");
  if (body.projectProfile !== undefined && (!body.projectProfile || typeof body.projectProfile !== "object" || Array.isArray(body.projectProfile))) throw new TypeError("projectProfile must be an object");
  if (body.baseCommit !== undefined && (typeof body.baseCommit !== "string" || !body.baseCommit.trim())) throw new TypeError("baseCommit must be a non-empty string");
  const constraints = body.constraints ?? {};
  if (!constraints || typeof constraints !== "object" || Array.isArray(constraints)) throw new TypeError("constraints must be an object");
  for (const [name, value] of Object.entries(constraints)) {
    const rule = CONSTRAINT_RULES[name];
    if (!rule || !Number.isFinite(value) || (rule.integer && !Number.isInteger(value)) || (rule.exclusive ? value <= rule.minimum : value < rule.minimum)) throw new TypeError(`invalid constraint: ${name}`);
  }
  return {
    idempotencyKey,
    constraints,
    metadata: {
      projectDirectory: resolveProjectDirectory(projectsRoot, body.project),
      query: body.query,
      repository: body.repository ?? body.project,
      scopes: body.scopes ?? [`REPOSITORY:${body.project}`],
      ...(body.workerProfile ? { workerProfile: body.workerProfile } : {}),
      ...(body.projectKind ? { projectKind: body.projectKind } : {}),
      ...(body.projectModules ? { projectModules: body.projectModules } : {}),
      ...(body.projectProfile ? { projectProfile: body.projectProfile } : {}),
      ...(body.baseCommit ? { baseCommit: body.baseCommit } : {}),
      ...(body.exactSymbols ? { exactSymbols: body.exactSymbols } : {}),
    },
  };
}

export function createHarnessServer({ runtime, token, authorizer = null, projectsRoot = "/workspace/projects", capabilityRouter = null, skillRegistry = null, metrics = null }) {
  const identityAuthority = authorizer ?? new ControlPlaneAuthorizer({ staticToken: token });
  if (!authorizer && !token) throw new TypeError("HARNESS_SERVICE_TOKEN is required");
  return createServer(async (request, response) => {
    const requestId = request.headers["x-request-id"] || `req_${randomUUID()}`;
    try {
      const url = new URL(request.url, "http://aicp.local");
      if (request.method === "GET" && url.pathname === "/health") {
        send(response, 200, { status: "ok" });
        return;
      }
      if (request.method === "GET" && url.pathname === "/ready") {
        const readiness = await runtime.ready();
        send(response, readiness.status === "ready" ? 200 : 503, readiness);
        return;
      }
      let principal;
      try { principal = await identityAuthority.authenticate(request); } catch {
        send(response, 401, { error: { code: "UNAUTHORIZED", message: "Authentication is required.", retryable: false, requestId, details: {} } });
        return;
      }
      principal.require(request.method === "GET" ? (url.pathname.startsWith("/v1/tasks") ? "tasks:read" : url.pathname.startsWith("/v1/runs") ? "runs:read" : "platform:read") : url.pathname.includes("budget") ? "budgets:write" : "runs:write");
      if (request.method === "POST" && url.pathname === "/v1/runs") {
        send(response, 201, await runtime.start(startRequest(await jsonBody(request), projectsRoot, request.headers["idempotency-key"])));
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/runs") { send(response, 200, await runtime.listRuns({ status: url.searchParams.get("status"), taskId: url.searchParams.get("taskId"), limit: url.searchParams.get("limit"), offset: url.searchParams.get("offset") })); return; }
      if (request.method === "GET" && url.pathname === "/v1/overview") { send(response, 200, await runtime.overview()); return; }
      if (request.method === "GET" && url.pathname === "/v1/system/status") { send(response, 200, runtime.systemStatus()); return; }
      if (request.method === "GET" && url.pathname === "/v1/me") { send(response, 200, runtime.currentActor()); return; }
      if (request.method === "GET" && url.pathname === "/v1/projects") { send(response, 200, await runtime.projects()); return; }
      const project = request.method === "GET" && url.pathname.match(/^\/v1\/projects\/([^/]+)$/);
      if (project) { send(response, 200, await runtime.project(decodeURIComponent(project[1]))); return; }
      if (request.method === "GET" && url.pathname === "/v1/capabilities") { const project = url.searchParams.get("project"); send(response, 200, await runtime.capabilities({ project: project ? resolveProjectDirectory(projectsRoot, project) : null })); return; }
      if (request.method === "GET" && url.pathname === "/v1/capability-providers") { send(response, 200, (capabilityRouter?.list?.() ?? []).map(({ name, version, capabilities }) => ({ name, version, capabilities }))); return; }
      if (request.method === "GET" && url.pathname === "/v1/skills") { send(response, 200, skillRegistry?.list?.() ?? await runtime.skills?.() ?? []); return; }
      if (request.method === "GET" && url.pathname === "/v1/skills:retrieve") { send(response, 200, skillRegistry?.retrieve?.({ query: url.searchParams.get("query") ?? "", capabilities: url.searchParams.getAll("capability"), domain: url.searchParams.get("domain") }) ?? []); return; }
      if (request.method === "GET" && url.pathname === "/v1/metrics/agent") { send(response, 200, metrics?.snapshot?.() ?? {}); return; }
      if (request.method === "GET" && url.pathname === "/v1/workflows") { send(response, 200, runtime.workflows()); return; }
      if (request.method === "GET" && url.pathname === "/v1/policies") { send(response, 200, runtime.policies()); return; }
      if (request.method === "GET" && url.pathname === "/v1/models") { send(response, 200, runtime.models()); return; }
      const storedContext = request.method === "GET" && url.pathname.match(/^\/v1\/contexts\/([^/]+)$/);
      if (storedContext) { send(response, 200, await runtime.getContext(decodeURIComponent(storedContext[1]))); return; }
      const resume = request.method === "POST" && url.pathname.match(/^\/v1\/runs\/([^/]+):resume$/);
      if (resume) {
        send(response, 200, await runtime.resume(decodeURIComponent(resume[1])));
        return;
      }
      const getRun = request.method === "GET" && url.pathname.match(/^\/v1\/runs\/([^/:?]+)$/);
      if (getRun) { send(response, 200, await runtime.getRun(decodeURIComponent(getRun[1]))); return; }
      const stages = request.method === "GET" && url.pathname.match(/^\/v1\/runs\/([^/]+)\/stages$/);
      if (stages) { send(response, 200, (await runtime.getRun(decodeURIComponent(stages[1]))).stages); return; }
      const cancelRun = request.method === "POST" && url.pathname.match(/^\/v1\/runs\/([^/]+):cancel$/);
      if (cancelRun) { send(response, 200, await runtime.cancelRun(decodeURIComponent(cancelRun[1]))); return; }
      const audit = request.method === "GET" && url.pathname.match(/^\/v1\/runs\/([^/]+)\/audit$/);
      if (audit) { send(response, 200, await runtime.getAudit(decodeURIComponent(audit[1]))); return; }
      const gates = request.method === "GET" && url.pathname.match(/^\/v1\/runs\/([^/]+)\/gates$/);
      if (gates) { send(response, 200, await runtime.getGates(decodeURIComponent(gates[1]))); return; }
      const findings = request.method === "GET" && url.pathname.match(/^\/v1\/runs\/([^/]+)\/findings$/);
      if (findings) { send(response, 200, await runtime.getFindings(decodeURIComponent(findings[1]))); return; }
      const execution = request.method === "GET" && url.pathname.match(/^\/v1\/runs\/([^/]+)\/execution$/);
      if (execution) { send(response, 200, runtime.getExecution(decodeURIComponent(execution[1]))); return; }
      const credentials = request.method === "GET" && url.pathname.match(/^\/v1\/runs\/([^/]+)\/credentials$/);
      if (credentials) { send(response, 200, runtime.getCredentials(decodeURIComponent(credentials[1]))); return; }
      const attestations = request.method === "GET" && url.pathname.match(/^\/v1\/runs\/([^/]+)\/attestations$/);
      if (attestations) { send(response, 200, runtime.getAttestations(decodeURIComponent(attestations[1]))); return; }
      const events = request.method === "GET" && url.pathname.match(/^\/v1\/runs\/([^/]+)\/events$/);
      if (events) {
        response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
        let closed = false;
        const emitted = new Set();
        const emit = async () => {
          if (closed) return;
          for (const event of await runtime.events(decodeURIComponent(events[1]))) {
            if (emitted.has(event.id)) continue;
            emitted.add(event.id);
            response.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
          }
          response.write(`: heartbeat ${Date.now()}\n\n`);
        };
        const close = () => { if (closed) return; closed = true; clearInterval(interval); clearTimeout(timeout); };
        const interval = setInterval(() => { void emit().catch(() => close()); }, 1000);
        const timeout = setTimeout(() => { close(); response.end(); }, 30000);
        request.on("close", close);
        response.on("close", close);
        await emit();
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/certifications/v1") {
        const contract = JSON.parse(await readFile("release/v1-contract.json", "utf8"));
        send(response, 200, contract); return;
      }
      if (request.method === "GET" && url.pathname === "/v1/certifications/v1/findings") {
        const contract = JSON.parse(await readFile("release/v1-contract.json", "utf8"));
        const items = (contract.controls ?? []).filter((control) => control.status !== "PASS").map((control) => ({ id: control.id, status: control.status, reason: control.reason ?? null, evidence: control.evidence ?? [] }));
        send(response, 200, { certification: "v1", items }); return;
      }
      const task = request.method === "GET" && url.pathname.match(/^\/v1\/tasks\/([^/]+)$/);
      if (task) { send(response, 200, await runtime.getTask(decodeURIComponent(task[1]))); return; }
      const budget = request.method === "GET" && url.pathname.match(/^\/v1\/tasks\/([^/]+)\/budget$/);
      if (budget) { send(response, 200, await runtime.getBudget(decodeURIComponent(budget[1]))); return; }
      const budgetEvents = request.method === "GET" && url.pathname.match(/^\/v1\/tasks\/([^/]+)\/budget\/events$/);
      if (budgetEvents) { send(response, 200, await runtime.getBudgetEvents(decodeURIComponent(budgetEvents[1]))); return; }
      const cancelBudget = request.method === "POST" && url.pathname.match(/^\/v1\/tasks\/([^/]+)\/budget:cancel$/);
      if (cancelBudget) { send(response, 200, await runtime.cancelBudget(decodeURIComponent(cancelBudget[1]))); return; }
      send(response, 404, { error: { code: "NOT_FOUND", message: "The requested resource was not found.", retryable: false, requestId, details: {} } });
    } catch (error) {
      const payloadTooLarge = error instanceof RangeError;
      const clientError = error instanceof TypeError || error instanceof SyntaxError;
      const unavailable = error.name === "GateResolutionError" || error.name === "PricingUnknownError";
      const forbidden = error.name === "AuthorizationError";
      const conflict = error.name === "IdempotencyConflictError";
      const notFound = /^unknown (?:run|task|context|task budget|execution)/.test(error.message);
      send(response, payloadTooLarge ? 413 : clientError ? 400 : forbidden ? 403 : notFound ? 404 : conflict ? 409 : unavailable ? 422 : 500, { error: {
        code: payloadTooLarge ? "PAYLOAD_TOO_LARGE" : clientError ? "INVALID_REQUEST" : forbidden ? "FORBIDDEN" : notFound ? "NOT_FOUND" : conflict ? "IDEMPOTENCY_CONFLICT" : unavailable ? error.code ?? error.name : "RUNTIME_FAILURE",
        message: payloadTooLarge || clientError || unavailable ? error.message : "The control plane could not complete the request.", retryable: false, requestId, details: {},
      } });
    }
  });
}
