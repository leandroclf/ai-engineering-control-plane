import { spawn } from "node:child_process";
import { ProviderError, PROVIDER_ERROR_CODES } from "../provider-errors.mjs";

function killGroup(child, signal = "SIGTERM") {
  if (!child?.pid) return;
  try { process.kill(-child.pid, signal); } catch { try { child.kill(signal); } catch { /* already exited */ } }
}

export class ProviderProcessSupervisor {
  constructor({ maxOutputBytes = 2 * 1024 * 1024 } = {}) { this.maxOutputBytes = maxOutputBytes; this.active = new Map(); }

  execute({ executionId, executable, args, cwd, env, timeoutMs = 900_000 }) {
    if (!executionId) throw new TypeError("executionId is required");
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const child = spawn(executable, args, { cwd, env, shell: false, detached: true, stdio: ["ignore", "pipe", "pipe"] });
      this.active.set(executionId, child);
      let stdout = ""; let stderr = ""; let bytes = 0; let limited = false; let settled = false;
      const finish = (callback, value) => { if (settled) return; settled = true; this.active.delete(executionId); clearTimeout(timer); callback(value); };
      const append = (target, chunk) => {
        bytes += chunk.length;
        if (bytes > this.maxOutputBytes) {
          limited = true;
          killGroup(child);
          finish(reject, new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_OUTPUT_LIMIT_EXCEEDED, "provider output exceeded the configured limit"));
          return target;
        }
        return target + chunk.toString("utf8");
      };
      child.stdout.on("data", (chunk) => { stdout = append(stdout, chunk); });
      child.stderr.on("data", (chunk) => { stderr = append(stderr, chunk); });
      child.once("error", (error) => finish(reject, new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_UNAVAILABLE, "provider process could not start", { cause: error, retryable: true })));
      child.once("close", (code, signal) => {
        if (limited) return;
        finish(resolve, { executionId, code, signal, stdout, stderr, durationMs: Date.now() - startedAt });
      });
      const timer = setTimeout(() => {
        killGroup(child);
        finish(reject, new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_TIMEOUT, "provider process timed out", { retryable: true }));
      }, Math.max(1, timeoutMs));
    });
  }

  cancel(executionId) {
    const child = this.active.get(executionId);
    if (!child) return false;
    killGroup(child);
    return true;
  }
}
