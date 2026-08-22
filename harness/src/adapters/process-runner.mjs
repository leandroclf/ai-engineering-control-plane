import { spawn } from "node:child_process";

export class ProcessRunner {
  async run(command, args = [], { cwd, env, timeoutMs = 120_000 } = {}) {
    return new Promise((resolve) => {
      let stdout = "";
      let stderr = "";
      let settled = false;
      const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ...result, stdout, stderr });
      };
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish({ kind: "timeout", exitCode: null, signal: "SIGKILL" });
      }, timeoutMs);
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", (error) => {
        finish({ kind: error.code === "ENOENT" ? "unavailable" : "error", exitCode: null, error: error.message });
      });
      child.on("close", (exitCode, signal) => finish({ kind: "completed", exitCode, signal }));
    });
  }
}
