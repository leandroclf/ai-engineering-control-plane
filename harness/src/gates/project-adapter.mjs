import { access } from "node:fs/promises";
import { join } from "node:path";

import { NodeProjectAdapter } from "./node-project-adapter.mjs";
import { GradleProjectAdapter } from "./gradle-project-adapter.mjs";
import { MavenProjectAdapter } from "./maven-project-adapter.mjs";
import { PythonProjectAdapter } from "./python-project-adapter.mjs";
import { GoProjectAdapter } from "./go-project-adapter.mjs";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const staticSiteScripts = [
  ["structure", "validate_site_structure.py"],
  ["quality-smoke", "quality_smoke.py"],
  ["performance-budget", "budget_check.py"],
  ["accountability", "validate_product_accountability_gate.py"],
];

export class ProjectAdapter {
  async detect(project) {
    if (await exists(join(project, "package.json"))) {
      return new NodeProjectAdapter().detect(project);
    }
    if (await exists(join(project, "build.gradle")) || await exists(join(project, "build.gradle.kts"))) return new GradleProjectAdapter().detect(project);
    if (await exists(join(project, "pom.xml"))) return new MavenProjectAdapter().detect(project);
    if (await exists(join(project, "pyproject.toml")) || await exists(join(project, "requirements.txt"))) return new PythonProjectAdapter().detect(project);
    if (await exists(join(project, "go.mod"))) return new GoProjectAdapter().detect(project);

    const gates = [];
    for (const [name, script] of staticSiteScripts) {
      if (await exists(join(project, "scripts", script))) {
        gates.push({ name, command: ["python3", "-B", `scripts/${script}`], required: true });
      }
    }
    if (gates.length) {
      const native = Object.fromEntries(gates.map((gate) => [gate.name, gate]));
      const capabilities = {
        ...native,
        build: native.structure,
        lint: native["quality-smoke"],
        "changed-tests": native["quality-smoke"],
        "unit-tests": native["quality-smoke"],
        "integration-tests": native.accountability,
        coverage: native["performance-budget"],
      };
      return { kind: "static-site", languages: ["html", "css", "javascript"], gates, capabilities };
    }
    throw new Error("unsupported project: no recognized manifest or validation scripts");
  }
}
