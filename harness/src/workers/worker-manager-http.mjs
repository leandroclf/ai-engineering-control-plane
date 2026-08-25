export const MAX_REQUEST_BODY_BYTES = 1_048_576;

export async function readJsonBody(request, limit = MAX_REQUEST_BODY_BYTES) {
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

export function validateCreateWorkerPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TypeError("request body must be an object");
  if (typeof payload.runId !== "string" || !payload.runId.trim()) throw new TypeError("runId is required");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(payload.runId)) throw new TypeError("runId has invalid format");
  if (typeof payload.project !== "string" || !payload.project.trim()) throw new TypeError("project is required");
  if (typeof payload.profile !== "string" || !payload.profile.trim()) throw new TypeError("profile is required");
  if (payload.environment !== undefined && (typeof payload.environment !== "object" || Array.isArray(payload.environment) || payload.environment === null)) {
    throw new TypeError("environment must be an object");
  }
  return {
    runId: payload.runId,
    project: payload.project,
    profile: payload.profile,
    environment: payload.environment ?? {},
    ...(payload.taskId ? { taskId: payload.taskId } : {}),
    ...(payload.baseCommit ? { baseCommit: payload.baseCommit } : {}),
  };
}

export function validateExecPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TypeError("request body must be an object");
  if (!Array.isArray(payload.command) || payload.command.length === 0 || payload.command.some((value) => typeof value !== "string" || !value.trim())) {
    throw new TypeError("command must contain non-empty strings");
  }
  return { command: payload.command };
}

export function validateCapabilityPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TypeError("request body must be an object");
  if (typeof payload.capability !== "string" || !payload.capability.trim()) throw new TypeError("capability is required");
  if (typeof payload.tool !== "string" || !payload.tool.trim()) throw new TypeError("tool is required");
  if (!Array.isArray(payload.args) || payload.args.some((value) => typeof value !== "string")) throw new TypeError("args must contain strings");
  if (payload.cwd !== undefined && (typeof payload.cwd !== "string" || !payload.cwd.trim())) throw new TypeError("cwd must be a non-empty string");
  return { capability: payload.capability, tool: payload.tool, args: payload.args, ...(payload.cwd ? { cwd: payload.cwd } : {}) };
}

export function statusForWorkerManagerError(error) {
  if (error instanceof RangeError) return 413;
  if (error instanceof SyntaxError || error instanceof TypeError) return 400;
  if (error.name === "WorkerCapabilityError") return 422;
  if (error.message?.startsWith("COMMAND_NOT_ALLOWED")) return 422;
  if (error.message?.startsWith("WORKER_ALREADY_EXISTS")) return 409;
  if (error.message?.startsWith("WORKER_CAPACITY_EXHAUSTED")) return 429;
  if (error.message?.startsWith("WORKER_NOT_FOUND")) return 404;
  if (error.message?.startsWith("WORKER_PROJECT_OUTSIDE_SERVER_ROOT")) return 400;
  if (error.message?.startsWith("WORKER_PROJECT_OUTSIDE_CLIENT_ROOT")) return 400;
  if (error.message?.startsWith("PROVIDER_CREDENTIAL_FORBIDDEN")) return 400;
  if (error.message?.startsWith("WORKER_SCOPED_CREDENTIAL_UNAVAILABLE")) return 500;
  if (error.message?.startsWith("WORKER_ATTESTATION_FAILED")) return 500;
  if (error.message?.startsWith("WORKER_AGENT_EXECUTION_UNAVAILABLE")) return 500;
  if (error.message?.startsWith("WORKER_AGENT_FAILED")) return 502;
  if (error.message?.startsWith("WORKER_DESTROY_FAILED")) return 500;
  if (error.message?.startsWith("WORKER_CREATE_FAILED")) return 500;
  if (error.message?.startsWith("WORKER_START_FAILED")) return 500;
  if (error.message?.startsWith("WORKER_INSPECT_FAILED")) return 500;
  if (error.message?.startsWith("WORKER_OWNERSHIP_MISMATCH")) return 500;
  return 500;
}
