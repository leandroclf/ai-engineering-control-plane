import { normalizeFinding } from "./normalize-finding.mjs";

export class JsonScannerAdapter {
  constructor({ name, parse, map, findingExitCodes = [1] }) {
    this.name = name;
    this.parse = parse;
    this.map = map;
    this.findingExitCodes = new Set(findingExitCodes);
  }

  fromExecution(execution) {
    if (execution.kind === "unavailable") return { status: "unavailable", findings: [] };
    if (execution.kind !== "completed") return { status: "error", reason: execution.kind.toUpperCase(), findings: [] };
    if (execution.exitCode !== 0 && !this.findingExitCodes.has(execution.exitCode)) {
      return { status: "error", reason: "TOOL_EXECUTION_FAILED", findings: [] };
    }
    try {
      const document = JSON.parse(execution.stdout || "{}");
      const findings = this.parse(document).map((raw) => normalizeFinding(this.name, this.map(raw)));
      return { status: findings.length ? "findings" : "pass", findings };
    } catch (error) {
      return { status: "error", reason: "INVALID_SCANNER_OUTPUT", detail: error.message, findings: [] };
    }
  }
}
