import { redactText } from "../security/redact.mjs";

function bounded(value, limit) {
  return redactText(value).slice(0, limit);
}

export class CommandGate {
  constructor({ runner, maxOutputBytes = 16_384 }) {
    this.runner = runner;
    this.maxOutputBytes = maxOutputBytes;
  }

  async evaluate({ name, required, command, cwd, timeoutMs }) {
    const startedAt = new Date().toISOString();
    if (!command?.length) {
      return this.#result(name, required ? "error" : "skipped", startedAt, "COMMAND_NOT_CONFIGURED");
    }
    const execution = await this.runner.run(command[0], command.slice(1), { cwd, timeoutMs });
    if (execution.kind !== "completed") {
      const reason = execution.kind === "timeout" ? "TIMEOUT" : "TOOL_UNAVAILABLE";
      return this.#result(name, required ? "error" : "skipped", startedAt, reason, execution);
    }
    return this.#result(name, execution.exitCode === 0 ? "pass" : "fail", startedAt, execution.exitCode === 0 ? null : "NON_ZERO_EXIT", execution);
  }

  #result(gate, status, startedAt, reason, execution = {}) {
    const stdout = bounded(execution.stdout, this.maxOutputBytes);
    const stderr = bounded(execution.stderr, this.maxOutputBytes);
    return {
      schemaVersion: 1,
      gate,
      status,
      startedAt,
      finishedAt: new Date().toISOString(),
      artifacts: [],
      reason,
      evidence: {
        exitCode: execution.exitCode ?? null,
        stdout,
        stderr,
        truncated: stdout.length < String(execution.stdout ?? "").length || stderr.length < String(execution.stderr ?? "").length,
      },
    };
  }
}
