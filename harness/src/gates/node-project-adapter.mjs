import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { capabilityMap, CapabilityStatus } from "./capability.mjs";
import { ProcessRunner } from "../adapters/process-runner.mjs";

export class NodeProjectAdapter {
  constructor({ runner = new ProcessRunner() } = {}) { this.runner = runner; }
  async detect(project) {
    const manifest = JSON.parse(await readFile(join(project, "package.json"), "utf8"));
    const scripts = manifest.scripts ?? {};
    const probe = await this.runner.run("npm", ["--version"], { cwd: project, timeoutMs: 5000 });
    const npmAvailable = probe.kind === "completed" && probe.exitCode === 0;
    const fromScript = (name, script, command, required = false) => ({ command: script && npmAvailable ? command : null, required,
      status: script && npmAvailable ? CapabilityStatus.AVAILABLE : required || script ? CapabilityStatus.MISCONFIGURED : CapabilityStatus.UNSUPPORTED,
      evidence: { source: "package.json#scripts+npm-version", declared: Boolean(script), script: script ? name : null, probeStatus: probe.kind, exitCode: probe.exitCode ?? null } });
    const capabilities = capabilityMap({
      build: scripts.build ? fromScript("build", scripts.build, ["npm", "run", "build"]) : { command: npmAvailable ? ["npm", "pack", "--dry-run"] : null, status: npmAvailable ? CapabilityStatus.AVAILABLE : CapabilityStatus.MISCONFIGURED, evidence: { source: "npm-pack-convention+npm-version", declared: true, probeStatus: probe.kind } },
      lint: fromScript("lint", scripts.lint, ["npm", "run", "lint"]),
      "changed-tests": scripts["test:changed"] ? fromScript("test:changed", scripts["test:changed"], ["npm", "run", "test:changed"], true) : fromScript("test", scripts.test, ["npm", "test"], true),
      "unit-tests": fromScript("test", scripts.test, ["npm", "test"], true),
      "integration-tests": fromScript("test:integration", scripts["test:integration"], ["npm", "run", "test:integration"]),
      coverage: fromScript("coverage", scripts.coverage, ["npm", "run", "coverage"]),
    });
    const unitCommands = [[scripts.test, ["npm", "test"]], [scripts["test:python"], ["npm", "run", "test:python"]]].filter(([script]) => script).map(([, value]) => ({ cwd: ".", command: value }));
    if (unitCommands.length > 1) capabilities["unit-tests"] = Object.freeze({ ...capabilities["unit-tests"], command: null, executions: unitCommands, evidence: { ...capabilities["unit-tests"].evidence, scripts: ["test", "test:python"] } });
    return {
      path: ".", kind: "node", languages: ["javascript", "typescript"], capabilities,
      ...Object.fromEntries(Object.entries(capabilities).map(([name, value]) => [name, value?.command ?? null])),
      dependencyFiles: ["package.json", "package-lock.json"], sourceRoots: ["src"], testRoots: ["test", "tests"],
    };
  }
}
