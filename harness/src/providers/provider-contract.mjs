import { resolve, relative, sep } from "node:path";
import { ProviderError, PROVIDER_ERROR_CODES } from "./provider-errors.mjs";

export const PROVIDER_KINDS = Object.freeze(["model-gateway", "agent-runtime"]);
export const BILLING_MODES = Object.freeze(["api-metered", "subscription", "subscription-credit", "local", "unknown"]);
export const AUTH_MODES = Object.freeze(["gateway", "vendor-browser-session", "api-key", "workload-identity"]);
export const EXECUTION_ZONES = Object.freeze(["worker", "provider-host", "control-plane"]);
export const ENVIRONMENT_CLASSES = Object.freeze(["LOCAL_PERSONAL", "TRUSTED_CI", "SHARED_PRODUCTION"]);

function oneOf(value, values, name) {
  if (!values.includes(value)) throw new TypeError(`${name} must be one of: ${values.join(", ")}`);
}

function string(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

export function environmentClass(environment = process.env) {
  const configured = environment.AICP_ENVIRONMENT_CLASS ?? environment.AICP_ENVIRONMENT;
  if (configured) {
    oneOf(configured, ENVIRONMENT_CLASSES, "environment class");
    return configured;
  }
  if (environment.AICP_RELEASE_MODE === "production") return "SHARED_PRODUCTION";
  if (environment.CI === "true" || environment.CI === "1") return "TRUSTED_CI";
  return "LOCAL_PERSONAL";
}

export function assertAgentExecutionRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) throw new TypeError("agent execution request is required");
  string(request.agent, "request.agent");
  string(request.prompt, "request.prompt");
  if (!request.schema || typeof request.schema !== "object" || Array.isArray(request.schema)) throw new TypeError("request.schema must be an object");
  for (const key of ["taskId", "runId", "stage", "reservationId", "logicalInvocationId"]) string(request.invocation?.[key], `request.invocation.${key}`);
  const worktree = request.worktree;
  if (!worktree || typeof worktree !== "object") throw new TypeError("request.worktree is required");
  string(worktree.root, "request.worktree.root");
  string(worktree.checkpoint, "request.worktree.checkpoint");
  const constraints = request.constraints ?? {};
  if (!Number.isFinite(constraints.timeoutMs) || constraints.timeoutMs <= 0) throw new TypeError("request.constraints.timeoutMs must be positive");
  oneOf(constraints.network ?? "provider-only", ["provider-only", "none"], "request.constraints.network");
  oneOf(constraints.mutation ?? "read-only", ["read-only", "workspace-write"], "request.constraints.mutation");
  if (constraints.maxTurns !== undefined && (!Number.isInteger(constraints.maxTurns) || constraints.maxTurns < 1)) throw new TypeError("request.constraints.maxTurns must be a positive integer");
  if (constraints.maxOutputTokens !== undefined && (!Number.isInteger(constraints.maxOutputTokens) || constraints.maxOutputTokens < 1)) throw new TypeError("request.constraints.maxOutputTokens must be a positive integer");
  const root = resolve(worktree.root);
  if (resolve(root, worktree.checkpoint) !== root && !resolve(worktree.checkpoint).startsWith(`${root}${sep}`)) throw new TypeError("request.worktree.checkpoint must be inside the worktree");
  if (relative(root, resolve(worktree.root)) !== "") throw new TypeError("request.worktree.root must be canonical");
  return request;
}

export function createProviderDescriptor(input) {
  if (!input || typeof input !== "object") throw new TypeError("provider descriptor is required");
  const descriptor = {
    id: string(input.id, "provider.id"),
    kind: input.kind,
    transport: string(input.transport, "provider.transport"),
    providerFamily: string(input.providerFamily, "provider.providerFamily"),
    runtime: string(input.runtime ?? input.transport, "provider.runtime"),
    authMode: input.authMode,
    billingMode: input.billingMode,
    executionZone: input.executionZone,
    enabled: input.enabled !== false,
    localOnly: input.localOnly === true,
    capabilities: [...new Set(input.capabilities ?? [])].map((item) => string(item, "provider.capability")).sort(),
    maxConcurrency: input.maxConcurrency === undefined ? null : input.maxConcurrency,
    featureFlag: input.featureFlag ?? input.enabledEnv ?? null,
  };
  oneOf(descriptor.kind, PROVIDER_KINDS, "provider.kind");
  oneOf(descriptor.authMode, AUTH_MODES, "provider.authMode");
  oneOf(descriptor.billingMode, BILLING_MODES, "provider.billingMode");
  oneOf(descriptor.executionZone, EXECUTION_ZONES, "provider.executionZone");
  if (descriptor.maxConcurrency !== null && (!Number.isInteger(descriptor.maxConcurrency) || descriptor.maxConcurrency < 1)) throw new TypeError("provider.maxConcurrency must be a positive integer");
  return Object.freeze(descriptor);
}

const SECRET_KEY = /(?:token|secret|password|cookie|credential|auth.?file|oauth|api.?key|private.?key)/i;
export function assertSanitizedProviderConfig(config) {
  const visit = (value, path = "provider") => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEY.test(key)) throw new ProviderError(PROVIDER_ERROR_CODES.POLICY_DENIED, `provider config contains forbidden credential field: ${path}.${key}`);
      visit(child, `${path}.${key}`);
    }
  };
  visit(config);
  return config;
}

export function sanitizeProvider(provider) {
  const descriptor = provider?.descriptor ?? provider;
  return {
    id: descriptor.id,
    kind: descriptor.kind,
    transport: descriptor.transport,
    runtime: descriptor.runtime,
    providerFamily: descriptor.providerFamily,
    authMode: descriptor.authMode,
    billingMode: descriptor.billingMode,
    executionZone: descriptor.executionZone,
    enabled: descriptor.enabled,
    localOnly: descriptor.localOnly,
    capabilities: descriptor.capabilities,
    maxConcurrency: descriptor.maxConcurrency,
    featureFlag: descriptor.featureFlag,
  };
}

export function assertStructuredOutput(value, schema, path = "output") {
  if (!schema || typeof schema !== "object") return value;
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, `${path} must be an object`);
    for (const name of schema.required ?? []) if (!(name in value)) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, `${path}.${name} is required`);
    if (schema.additionalProperties === false) for (const name of Object.keys(value)) if (!schema.properties?.[name]) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, `${path}.${name} is not declared by the schema`);
    for (const [name, childSchema] of Object.entries(schema.properties ?? {})) if (name in value) assertStructuredOutput(value[name], childSchema, `${path}.${name}`);
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, `${path} must be an array`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, `${path} exceeds maxItems`);
    for (const [index, item] of value.entries()) assertStructuredOutput(item, schema.items ?? {}, `${path}[${index}]`);
  } else if (schema.type === "string") {
    if (typeof value !== "string") throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, `${path} must be a string`);
    if (schema.minLength !== undefined && value.length < schema.minLength) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, `${path} is too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, `${path} is too long`);
    if (schema.enum && !schema.enum.includes(value)) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, `${path} is outside the enum`);
  } else if (schema.type === "number" || schema.type === "integer") {
    if (typeof value !== "number" || !Number.isFinite(value) || (schema.type === "integer" && !Number.isInteger(value))) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, `${path} must be ${schema.type}`);
  } else if (schema.type === "boolean" && typeof value !== "boolean") throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_INVALID_OUTPUT, `${path} must be boolean`);
  return value;
}

export class AIProvider {
  constructor(descriptor) { this.descriptor = createProviderDescriptor(descriptor); }
  get id() { return this.descriptor.id; }
  get kind() { return this.descriptor.kind; }
  capabilities() { return Promise.resolve([...this.descriptor.capabilities]); }
  health() { return Promise.resolve({ liveness: "ok", readiness: "unknown", auth: { status: "unknown" }, policy: { allowed: true }, quota: { status: "unknown", source: "aicp-shadow-ledger" }, liveInference: { status: "not_probed" } }); }
  estimate() { return Promise.resolve({ billingMode: this.descriptor.billingMode, monetaryCostKnown: this.descriptor.billingMode === "api-metered" }); }
}

export class AgentProvider extends AIProvider {
  constructor(descriptor) { super({ ...descriptor, kind: "agent-runtime" }); }
  async execute() { throw new Error("AgentProvider.execute must be implemented"); }
  async cancel() { return undefined; }
}
