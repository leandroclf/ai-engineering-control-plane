import { access } from "node:fs/promises";
import { join } from "node:path";
import { ProcessRunner } from "../adapters/process-runner.mjs";
import { capabilityMap, CapabilityStatus } from "./capability.mjs";
async function exists(path) { try { await access(path); return true; } catch { return false; } }
export class GradleProjectAdapter {
  constructor({ runner = new ProcessRunner(), probeTimeoutMs = 15000 } = {}) { this.runner = runner; this.probeTimeoutMs = probeTimeoutMs; }
  async detect(project) {
    const wrapper = await exists(join(project, "gradlew"));
    const gradle = wrapper ? "./gradlew" : "gradle";
    const probe = await this.runner.run(gradle, ["tasks", "--all", "--console=plain"], { cwd: project, timeoutMs: this.probeTimeoutMs });
    const output = probe.kind === "completed" && probe.exitCode === 0 ? `${probe.stdout}\n${probe.stderr}` : "";
    const task = (name, required = false) => ({ command: [gradle, name], required,
      status: new RegExp(`(^|\\s)${name}(\\s|$)`, "m").test(output) ? CapabilityStatus.AVAILABLE : required ? CapabilityStatus.MISCONFIGURED : CapabilityStatus.UNSUPPORTED,
      evidence: { source: "gradle-task-list", probe: `${gradle} tasks --all`, probeStatus: probe.kind, exitCode: probe.exitCode ?? null } });
    return { path: ".", kind: "gradle", languages: ["java", "kotlin"], capabilities: capabilityMap({
      build: task("assemble", true), lint: task("check", true), "changed-tests": task("test", true), "unit-tests": task("test", true),
      "integration-tests": task("integrationTest"), coverage: task("jacocoTestReport"),
    }), dependencyFiles: ["build.gradle", "build.gradle.kts", "gradle/libs.versions.toml"], sourceRoots: ["src/main"], testRoots: ["src/test"] };
  }
}
