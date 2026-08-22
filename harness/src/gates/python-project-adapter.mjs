import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { capabilityMap, CapabilityStatus } from "./capability.mjs";
import { ProcessRunner } from "../adapters/process-runner.mjs";
async function optionalRead(path) { try { return await readFile(path, "utf8"); } catch { return ""; } }
export class PythonProjectAdapter { constructor({ runner = new ProcessRunner() } = {}) { this.runner = runner; } async detect(project) {
  const declaration = `${await optionalRead(join(project, "pyproject.toml"))}\n${await optionalRead(join(project, "requirements.txt"))}`.toLowerCase();
  const has = (tool) => new RegExp(`(^|[^a-z0-9_-])${tool}([^a-z0-9_-]|$)`, "m").test(declaration);
  const pythonProbe = await this.runner.run("python3", ["--version"], { cwd: project, timeoutMs: 5000 });
  const toolProbes = Object.fromEntries(await Promise.all(["pytest", "ruff", "coverage"].map(async (tool) => [tool, await this.runner.run("python3", ["-m", tool, "--version"], { cwd: project, timeoutMs: 5000 })])));
  const declared = (name, module, command, required = false) => { const probe = toolProbes[module]; const available = has(name) && probe.kind === "completed" && probe.exitCode === 0; return ({ command: available ? command : null, required,
    status: available ? CapabilityStatus.AVAILABLE : required || has(name) ? CapabilityStatus.MISCONFIGURED : CapabilityStatus.UNSUPPORTED,
    evidence: { source: "python-project-metadata+module-version", dependency: name, declared: has(name), probeStatus: probe.kind, exitCode: probe.exitCode ?? null } }); };
  return { path: ".", kind: "python", languages: ["python"], capabilities: capabilityMap({
    build: { command: pythonProbe.kind === "completed" ? ["python3", "-m", "compileall", "-q", "."] : null, required: true, status: pythonProbe.kind === "completed" ? CapabilityStatus.AVAILABLE : CapabilityStatus.MISCONFIGURED, evidence: { source: "python-version", probeStatus: pythonProbe.kind } },
    lint: declared("ruff", "ruff", ["python3", "-m", "ruff", "check", "."]),
    "changed-tests": declared("pytest", "pytest", ["python3", "-m", "pytest", "-q"]), "unit-tests": declared("pytest", "pytest", ["python3", "-m", "pytest", "-q"]),
    "integration-tests": declared("pytest", "pytest", ["python3", "-m", "pytest", "-q", "tests/integration"]), coverage: declared("pytest-cov", "coverage", ["python3", "-m", "pytest", "--cov", "--cov-report=term"]),
  }), dependencyFiles: ["pyproject.toml", "requirements.txt"], sourceRoots: ["src"], testRoots: ["tests"] };
} }
