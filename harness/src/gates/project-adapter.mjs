import { access, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { NodeProjectAdapter } from "./node-project-adapter.mjs";
import { GradleProjectAdapter } from "./gradle-project-adapter.mjs";
import { MavenProjectAdapter } from "./maven-project-adapter.mjs";
import { PythonProjectAdapter } from "./python-project-adapter.mjs";
import { GoProjectAdapter } from "./go-project-adapter.mjs";
import { capabilityMap, CapabilityStatus } from "./capability.mjs";

async function exists(path) { try { await access(path); return true; } catch { return false; } }
const IGNORED = new Set([".git", ".idea", ".aicp", "node_modules", "target", "build", "dist", ".venv", "venv", "__pycache__", "fixtures"]);
const MANIFESTS = new Map([["package.json", "node"], ["build.gradle", "gradle"], ["build.gradle.kts", "gradle"], ["pom.xml", "maven"], ["pyproject.toml", "python"], ["requirements.txt", "python"], ["go.mod", "go"]]);
const staticSiteScripts = [["structure", "validate_site_structure.py"], ["quality-smoke", "quality_smoke.py"], ["performance-budget", "budget_check.py"], ["accountability", "validate_product_accountability_gate.py"]];

async function findModules(root, maxDepth) {
  const found = new Map();
  async function visit(directory, depth) {
    if (depth > maxDepth) return;
    let entries; try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) if (entry.isFile() && MANIFESTS.has(entry.name)) found.set(`${relative(root, directory)}:${MANIFESTS.get(entry.name)}`, { directory, kind: MANIFESTS.get(entry.name) });
    await Promise.all(entries.filter((entry) => entry.isDirectory() && !IGNORED.has(entry.name)).map((entry) => visit(join(directory, entry.name), depth + 1)));
  }
  await visit(root, 0);
  return [...found.values()].sort((a, b) => a.directory.localeCompare(b.directory) || a.kind.localeCompare(b.kind));
}

function compositeCapabilities(modules) {
  const names = [...new Set(modules.flatMap((module) => Object.keys(module.capabilities)))].sort();
  return Object.fromEntries(names.map((name) => {
    const values = modules.map((module) => ({ module: module.path, capability: module.capabilities[name] })).filter((item) => item.capability);
    const available = values.filter((item) => item.capability.status === CapabilityStatus.AVAILABLE && (item.capability.command || item.capability.executions?.length));
    const requiredMissing = values.some((item) => item.capability.required && item.capability.status !== CapabilityStatus.AVAILABLE);
    return [name, { name, required: values.some((item) => item.capability.required), status: requiredMissing ? CapabilityStatus.MISCONFIGURED : available.length ? CapabilityStatus.AVAILABLE : CapabilityStatus.UNSUPPORTED,
      command: available.length === 1 && available[0].capability.command && !available[0].capability.executions?.length ? available[0].capability.command : null,
      executions: available.flatMap((item) => item.capability.executions?.length
        ? item.capability.executions.map((execution) => ({ cwd: item.module === "." ? execution.cwd : join(item.module, execution.cwd), command: execution.command }))
        : [{ cwd: item.module, command: item.capability.command }]),
      evidence: { source: "composite-project-profile", modules: values.map((item) => ({ path: item.module, status: item.capability.status, evidence: item.capability.evidence })) } }];
  }));
}

export class ProjectAdapter {
  constructor({ adapters = null, maxDepth = 5 } = {}) {
    this.adapters = adapters ?? { node: new NodeProjectAdapter(), gradle: new GradleProjectAdapter(), maven: new MavenProjectAdapter(), python: new PythonProjectAdapter(), go: new GoProjectAdapter() };
    this.maxDepth = maxDepth;
  }
  async detect(project) {
    const modules = [];
    for (const item of await findModules(project, this.maxDepth)) modules.push({ ...(await this.adapters[item.kind].detect(item.directory)), path: relative(project, item.directory) || "." });
    if (modules.length === 1) return modules[0];
    if (modules.length > 1) return { kind: "composite", languages: [...new Set(modules.flatMap((module) => module.languages))].sort(), modules, capabilities: compositeCapabilities(modules) };
    const gates = [];
    for (const [name, script] of staticSiteScripts) if (await exists(join(project, "scripts", script))) gates.push({ name, command: ["python3", "-B", `scripts/${script}`], required: true });
    if (gates.length) {
      const native = Object.fromEntries(gates.map((gate) => [gate.name, gate]));
      return { path: ".", kind: "static-site", languages: ["html", "css", "javascript"], gates, capabilities: capabilityMap({ build: native.structure, lint: native["quality-smoke"], "changed-tests": native["quality-smoke"], "unit-tests": native["quality-smoke"], "integration-tests": native.accountability, coverage: native["performance-budget"] }) };
    }
    throw new Error("unsupported project: no recognized manifest or validation scripts");
  }
}
