import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

import { resolveProjectDirectory } from "../cli/runtime-arguments.mjs";

function digest(value) {
  return createHash("sha256").update(String(value ?? "")).digest();
}

function authorized(request, token) {
  const supplied = request.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  return Boolean(token && supplied && timingSafeEqual(digest(supplied), digest(token)));
}

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(`${JSON.stringify(body)}\n`);
}

async function jsonBody(request, limit = 1_048_576) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > limit) throw new RangeError("request body exceeds limit");
  }
  return body ? JSON.parse(body) : {};
}

function startRequest(body, projectsRoot) {
  if (!body.project || !body.query || !body.idempotencyKey) {
    throw new TypeError("project, query and idempotencyKey are required");
  }
  return {
    idempotencyKey: body.idempotencyKey,
    metadata: {
      projectDirectory: resolveProjectDirectory(projectsRoot, body.project),
      query: body.query,
      repository: body.repository ?? body.project,
      scopes: body.scopes ?? [`REPOSITORY:${body.project}`],
      ...(body.exactSymbols ? { exactSymbols: body.exactSymbols } : {}),
    },
  };
}

export function createHarnessServer({ runtime, token, projectsRoot = "/workspace/projects" }) {
  if (!token) throw new TypeError("HARNESS_SERVICE_TOKEN is required");
  return createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        send(response, 200, { status: "ok" });
        return;
      }
      if (!authorized(request, token)) {
        send(response, 401, { error: "UNAUTHORIZED" });
        return;
      }
      if (request.method === "POST" && request.url === "/v1/runs") {
        send(response, 201, await runtime.start(startRequest(await jsonBody(request), projectsRoot)));
        return;
      }
      const resume = request.method === "POST" && request.url?.match(/^\/v1\/runs\/([^/]+):resume$/);
      if (resume) {
        send(response, 200, await runtime.resume(decodeURIComponent(resume[1])));
        return;
      }
      const getRun = request.method === "GET" && request.url?.match(/^\/v1\/runs\/([^/:?]+)$/);
      if (getRun) { send(response, 200, await runtime.getRun(decodeURIComponent(getRun[1]))); return; }
      const stages = request.method === "GET" && request.url?.match(/^\/v1\/runs\/([^/]+)\/stages$/);
      if (stages) { send(response, 200, (await runtime.getRun(decodeURIComponent(stages[1]))).stages); return; }
      const cancelRun = request.method === "POST" && request.url?.match(/^\/v1\/runs\/([^/]+):cancel$/);
      if (cancelRun) { send(response, 200, await runtime.cancelRun(decodeURIComponent(cancelRun[1]))); return; }
      const budget = request.method === "GET" && request.url?.match(/^\/v1\/tasks\/([^/]+)\/budget$/);
      if (budget) { send(response, 200, await runtime.getBudget(decodeURIComponent(budget[1]))); return; }
      const budgetEvents = request.method === "GET" && request.url?.match(/^\/v1\/tasks\/([^/]+)\/budget\/events$/);
      if (budgetEvents) { send(response, 200, await runtime.getBudgetEvents(decodeURIComponent(budgetEvents[1]))); return; }
      const cancelBudget = request.method === "POST" && request.url?.match(/^\/v1\/tasks\/([^/]+)\/budget:cancel$/);
      if (cancelBudget) { send(response, 200, await runtime.cancelBudget(decodeURIComponent(cancelBudget[1]))); return; }
      send(response, 404, { error: "NOT_FOUND" });
    } catch (error) {
      const clientError = error instanceof TypeError || error instanceof RangeError || error instanceof SyntaxError;
      send(response, clientError ? 400 : 500, {
        error: clientError ? "INVALID_REQUEST" : "RUNTIME_FAILURE",
        ...(clientError ? { message: error.message } : {}),
      });
    }
  });
}
