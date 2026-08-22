import { createGitleaksAdapter, createSemgrepAdapter, createTrivyAdapter } from "../scanners/tool-adapters.mjs";
const adapters = { semgrep: createSemgrepAdapter(), gitleaks: createGitleaksAdapter(), trivy: createTrivyAdapter() };

export class ScannerCommandGate {
  constructor({ runner }) { this.runner = runner; }
  async evaluate({ name, scanner, required, command, cwd, timeoutMs }) {
    const startedAt = new Date().toISOString();
    if (!command?.length) return this.result(name, required ? "error" : "skipped", "COMMAND_NOT_CONFIGURED", startedAt);
    const parsed = adapters[scanner].fromExecution(await this.runner.run(command[0], command.slice(1), { cwd, timeoutMs }));
    const status = parsed.status === "pass" ? "pass" : parsed.status === "findings" ? "fail" : required ? "error" : "skipped";
    const reason = parsed.status === "findings" ? "SCANNER_FINDINGS" : parsed.reason ?? (parsed.status === "unavailable" ? "TOOL_UNAVAILABLE" : null);
    return this.result(name, status, reason, startedAt, parsed.findings);
  }
  result(gate, status, reason, startedAt, findings = []) { return { schemaVersion: 1, gate, status, reason, startedAt, finishedAt: new Date().toISOString(), artifacts: [], evidence: { findingCount: findings.length, findings } }; }
}
