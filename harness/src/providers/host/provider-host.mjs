import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, sep } from "node:path";
import { assertAgentExecutionRequest } from "../provider-contract.mjs";
import { ProviderError, PROVIDER_ERROR_CODES } from "../provider-errors.mjs";
import { providerEnvironment } from "./clean-environment.mjs";
import { ProviderCommandPolicy } from "./provider-command-policy.mjs";
import { ProviderProcessSupervisor } from "./provider-process-supervisor.mjs";

function inside(root, candidate) { const base = resolve(root); const value = resolve(candidate); return value === base || value.startsWith(`${base}${sep}`); }

export class ProviderHost {
  constructor({ commandPolicy = new ProviderCommandPolicy(), supervisor = new ProviderProcessSupervisor(), environment = process.env, extraAllowedEnvironment = [] } = {}) { this.commandPolicy = commandPolicy; this.supervisor = supervisor; this.environment = environment; this.extraAllowedEnvironment = extraAllowedEnvironment; }

  async execute({ providerId, executable, args, request, parser, environment = this.environment }) {
    assertAgentExecutionRequest(request);
    if (!inside(request.worktree.root, request.worktree.root)) throw new ProviderError(PROVIDER_ERROR_CODES.POLICY_DENIED, "provider worktree is invalid");
    const command = this.commandPolicy.validate({ providerId, executable, args });
    const schemaDirectory = await mkdtemp(join(tmpdir(), "aicp-provider-schema-"));
    const schemaPath = join(schemaDirectory, "output.schema.json");
    await writeFile(schemaPath, `${JSON.stringify(request.schema)}\n`, { mode: 0o600 });
    const argv = command.args.map((arg) => arg === "{{schemaPath}}" ? schemaPath : arg);
    const executionId = request.invocation.logicalInvocationId || `pex_${randomUUID()}`;
    try {
      const result = await this.supervisor.execute({ executionId, executable: command.executable, args: argv, cwd: request.worktree.root, env: providerEnvironment(environment, { extraAllowed: this.extraAllowedEnvironment }), timeoutMs: request.constraints.timeoutMs });
      if (result.code !== 0) {
        const diagnostic = `${result.stderr}\n${result.stdout}`.toLowerCase();
        if (/auth|login|unauthenticated|credential/.test(diagnostic)) throw new ProviderError(PROVIDER_ERROR_CODES.AUTH_REQUIRED, "provider authentication is required", { retryable: false });
        if (/quota|rate.?limit|429|credit/.test(diagnostic)) throw new ProviderError(PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED, "provider quota is unavailable", { retryable: true });
        throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_UNAVAILABLE, "provider process failed", { retryable: true, details: { exitCode: result.code, signal: result.signal } });
      }
      const parsed = parser(result.stdout, { request, durationMs: result.durationMs });
      return { ...parsed, executionId, durationMs: result.durationMs };
    } finally {
      await rm(schemaDirectory, { recursive: true, force: true });
    }
  }

  cancel(executionId) { return this.supervisor.cancel(executionId); }
}
