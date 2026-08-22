import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ProcessRunner } from "../adapters/process-runner.mjs";
import { CommandGate } from "../gates/command-gate.mjs";
import { normalizeFinding } from "./normalize-finding.mjs";

function lineOf(content, needle) {
  return content.slice(0, content.indexOf(needle)).split("\n").length;
}

function scannerGate(name, findings) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    gate: name,
    status: findings.length ? "fail" : "pass",
    startedAt: now,
    finishedAt: now,
    artifacts: [],
    reason: findings.length ? "BLOCKING_FINDINGS" : null,
  };
}

export class BaselineProjectAuditor {
  constructor({ runner = new ProcessRunner() } = {}) {
    this.commandGate = new CommandGate({ runner });
  }

  async audit(project) {
    const [source, dockerfile, packageLock] = await Promise.all([
      readFile(join(project, "app.js"), "utf8"),
      readFile(join(project, "Dockerfile"), "utf8"),
      readFile(join(project, "package-lock.json"), "utf8").then(JSON.parse),
    ]);
    const findings = [
      ...this.#secretFindings(source),
      ...this.#sastFindings(source),
      ...this.#dependencyFindings(packageLock),
      ...this.#containerFindings(dockerfile),
    ];
    const unitTests = await this.commandGate.evaluate({
      name: "unit-tests",
      required: true,
      command: ["npm", "test", "--", "--silent"],
      cwd: project,
      timeoutMs: 30_000,
    });
    const gates = [
      unitTests,
      scannerGate("gitleaks", findings.filter((finding) => finding.tool === "gitleaks")),
      scannerGate("semgrep", findings.filter((finding) => finding.tool === "semgrep")),
      scannerGate("trivy", findings.filter((finding) => finding.tool === "trivy")),
    ];
    return {
      schemaVersion: 1,
      status: gates.every((gate) => gate.status === "pass") ? "pass" : "blocked",
      gates,
      findings,
    };
  }

  #secretFindings(source) {
    const match = source.match(/AICP_FAKE_SECRET_[A-Za-z0-9_]+/);
    if (!match) return [];
    return [normalizeFinding("gitleaks", {
      ruleId: "generic-api-key",
      severity: "high",
      category: "secret",
      path: "app.js",
      line: lineOf(source, match[0]),
      message: `credential-like fixture ${match[0]}`,
      secret: match[0],
    })];
  }

  #sastFindings(source) {
    const needle = "db.query(`SELECT";
    if (!source.includes(needle) || !source.includes("${userInput}")) return [];
    return [normalizeFinding("semgrep", {
      ruleId: "javascript.lang.security.audit.sqli.node-postgres-sqli",
      severity: "high",
      category: "sast",
      path: "app.js",
      line: lineOf(source, needle),
      message: "User-controlled data is interpolated into a SQL query",
    })];
  }

  #dependencyFindings(lock) {
    const version = lock.packages?.["node_modules/lodash"]?.version;
    if (!version || !["4.17.19", "4.17.20"].includes(version)) return [];
    return [normalizeFinding("trivy", {
      ruleId: "CVE-2021-23337",
      severity: "high",
      category: "dependency",
      path: "package-lock.json",
      line: 1,
      message: `Known vulnerable lodash fixture version ${version}`,
    })];
  }

  #containerFindings(dockerfile) {
    const findings = [];
    if (/^FROM\s+\S+:latest\s*$/m.test(dockerfile)) {
      findings.push(normalizeFinding("trivy", {
        ruleId: "DS002",
        severity: "high",
        category: "container",
        path: "Dockerfile",
        line: lineOf(dockerfile, "FROM"),
        message: "Base image uses the mutable latest tag",
      }));
    }
    if (!/^USER\s+\S+/m.test(dockerfile)) {
      findings.push(normalizeFinding("trivy", {
        ruleId: "DS026",
        severity: "high",
        category: "container",
        path: "Dockerfile",
        line: 1,
        message: "Container runs as the default root user",
      }));
    }
    return findings;
  }
}
