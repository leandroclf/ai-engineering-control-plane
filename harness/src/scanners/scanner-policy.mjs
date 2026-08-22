export function evaluateScannerPolicy(policy, result) {
  const mode = policy.mode ?? (policy.required ? "required" : "optional");
  if (mode === "disabled") return { status: "skipped", reason: "DISABLED", findings: [] };
  if (["unavailable", "error"].includes(result.status)) {
    return mode === "required"
      ? { ...result, status: "error", reason: result.reason ?? "REQUIRED_EVIDENCE_UNAVAILABLE" }
      : { ...result, status: "skipped", reason: result.reason ?? "OPTIONAL_EVIDENCE_UNAVAILABLE" };
  }
  const blocked = new Set(policy.block ?? ["critical", "high"]);
  const blockingFindings = result.findings.filter((finding) => blocked.has(finding.severity));
  return { ...result, status: blockingFindings.length ? "fail" : "pass", blockingFindings };
}
