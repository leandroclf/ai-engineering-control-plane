import { JsonScannerAdapter } from "./json-scanner-adapter.mjs";

const semgrepSeverity = { ERROR: "high", WARNING: "medium", INFO: "low" };

export function createSemgrepAdapter() {
  return new JsonScannerAdapter({
    name: "semgrep",
    parse: (document) => document.results ?? [],
    map: (finding) => ({
      ruleId: finding.check_id,
      severity: semgrepSeverity[finding.extra?.severity] ?? finding.extra?.severity ?? "medium",
      category: "sast",
      message: finding.extra?.message,
      path: finding.path,
      line: finding.start?.line,
    }),
  });
}

export function createGitleaksAdapter() {
  return new JsonScannerAdapter({
    name: "gitleaks",
    parse: (document) => Array.isArray(document) ? document : [],
    map: (finding) => ({
      ruleId: finding.RuleID,
      severity: "high",
      category: "secret",
      message: finding.Description,
      secret: finding.Secret,
      path: finding.File,
      line: finding.StartLine,
    }),
  });
}

export function createTrivyAdapter() {
  return new JsonScannerAdapter({
    name: "trivy",
    parse: (document) => (document.Results ?? []).flatMap((result) => [
      ...(result.Vulnerabilities ?? []).map((finding) => ({ ...finding, target: result.Target, kind: "dependency" })),
      ...(result.Misconfigurations ?? []).map((finding) => ({ ...finding, target: result.Target, kind: "container" })),
      ...(result.Secrets ?? []).map((finding) => ({ ...finding, target: result.Target, kind: "secret" })),
    ]),
    map: (finding) => ({
      ruleId: finding.VulnerabilityID ?? finding.ID ?? finding.RuleID,
      severity: finding.Severity,
      category: finding.kind,
      message: finding.Title ?? finding.Message ?? finding.Description,
      path: finding.target,
      line: finding.CauseMetadata?.StartLine ?? finding.StartLine ?? 1,
    }),
  });
}

export function createSnykAdapter() {
  return new JsonScannerAdapter({
    name: "snyk",
    parse: (document) => document.vulnerabilities ?? [],
    map: (finding) => ({
      ruleId: finding.id,
      severity: finding.severity,
      category: "dependency",
      message: finding.title,
      path: finding.from?.join(" > ") ?? null,
      line: 1,
    }),
  });
}

export function createSonarAdapter() {
  return new JsonScannerAdapter({
    name: "sonar",
    findingExitCodes: [],
    parse: (document) => document.issues ?? [],
    map: (finding) => ({
      ruleId: finding.rule,
      severity: ({ BLOCKER: "critical", CRITICAL: "critical", MAJOR: "high", MINOR: "medium", INFO: "info" })[finding.severity] ?? "medium",
      category: "sast",
      message: finding.message,
      path: finding.component,
      line: finding.line ?? 1,
    }),
  });
}
