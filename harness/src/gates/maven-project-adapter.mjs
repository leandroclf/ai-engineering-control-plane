import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { capabilityMap, CapabilityStatus } from "./capability.mjs";
import { ProcessRunner } from "../adapters/process-runner.mjs";
export class MavenProjectAdapter { constructor({ runner = new ProcessRunner() } = {}) { this.runner = runner; } async detect(project) {
  const pom = await readFile(join(project, "pom.xml"), "utf8");
  const hasFailsafe = /maven-failsafe-plugin|<id>[^<]*integration/i.test(pom);
  const hasJacoco = /jacoco-maven-plugin/i.test(pom);
  const probe = await this.runner.run("mvn", ["--version"], { cwd: project, timeoutMs: 5000 });
  const toolAvailable = probe.kind === "completed" && probe.exitCode === 0;
  const available = (command, required = true, evidence = {}) => ({ command: toolAvailable ? command : null, required, status: toolAvailable ? CapabilityStatus.AVAILABLE : CapabilityStatus.MISCONFIGURED, evidence: { source: "pom.xml+maven-version", probeStatus: probe.kind, exitCode: probe.exitCode ?? null, ...evidence } });
  return { path: ".", kind: "maven", languages: ["java"], capabilities: capabilityMap({
    build: available(["mvn", "-B", "-DskipTests", "package"]), lint: available(["mvn", "-B", "validate"]),
    "changed-tests": available(["mvn", "-B", "test"]), "unit-tests": available(["mvn", "-B", "test"]),
    "integration-tests": hasFailsafe ? available(["mvn", "-B", "verify"], false, { plugin: "maven-failsafe-plugin" }) : { command: null, status: CapabilityStatus.UNSUPPORTED, evidence: { source: "pom.xml", plugin: "maven-failsafe-plugin" } },
    coverage: hasJacoco ? available(["mvn", "-B", "jacoco:report"], false, { plugin: "jacoco-maven-plugin" }) : { command: null, status: CapabilityStatus.UNSUPPORTED, evidence: { source: "pom.xml", plugin: "jacoco-maven-plugin" } },
  }), dependencyFiles: ["pom.xml"], sourceRoots: ["src/main"], testRoots: ["src/test"] };
} }
