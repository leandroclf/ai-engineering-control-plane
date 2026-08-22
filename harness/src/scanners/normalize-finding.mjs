import { createHash } from "node:crypto";

const severities = new Set(["info", "low", "medium", "high", "critical"]);

export function normalizeFinding(tool, raw) {
  const severity = String(raw.severity ?? "medium").toLowerCase();
  if (!severities.has(severity)) throw new TypeError(`unsupported severity: ${severity}`);
  const identity = [tool, raw.ruleId, raw.path ?? "", raw.line ?? "", raw.message ?? ""].join("\0");
  const fingerprint = `sha256:${createHash("sha256").update(identity).digest("hex")}`;
  const secret = raw.secret ? String(raw.secret) : undefined;
  const message = secret ? String(raw.message ?? "").split(secret).join("[REDACTED]") : String(raw.message ?? "");
  return {
    schemaVersion: 1,
    tool,
    ruleId: String(raw.ruleId),
    fingerprint,
    severity,
    category: String(raw.category ?? "unknown"),
    message,
    path: raw.path ?? null,
    line: raw.line ?? null,
    status: "open",
  };
}
