import { access } from "node:fs/promises";
import { join } from "node:path";

import { NodeProjectAdapter } from "./node-project-adapter.mjs";

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
      const commands = await new NodeProjectAdapter().detect(project);
      return {
        kind: "node",
        gates: Object.entries(commands)
          .filter(([, command]) => command)
          .map(([name, command]) => ({ name, command, required: true })),
      };
    }

    const gates = [];
    for (const [name, script] of staticSiteScripts) {
      if (await exists(join(project, "scripts", script))) {
        gates.push({ name, command: ["python3", "-B", `scripts/${script}`], required: true });
      }
    }
    if (gates.length) return { kind: "static-site", gates };
    throw new Error("unsupported project: no recognized manifest or validation scripts");
  }
}
