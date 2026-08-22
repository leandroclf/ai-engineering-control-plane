import { readFile } from "node:fs/promises";
import { join } from "node:path";

export class NodeProjectAdapter {
  async detect(project) {
    const manifest = JSON.parse(await readFile(join(project, "package.json"), "utf8"));
    const scripts = manifest.scripts ?? {};
    const command = (value, required = true) => value ? { command: value, required } : null;
    const capabilities = {
      build: command(scripts.build ? ["npm", "run", "build"] : ["npm", "pack", "--dry-run"], false),
      lint: command(scripts.lint ? ["npm", "run", "lint"] : null, false),
      "changed-tests": command(scripts["test:changed"] ? ["npm", "run", "test:changed"] : scripts.test ? ["npm", "test"] : null),
      "unit-tests": command(scripts.test ? ["npm", "test"] : null),
      "integration-tests": command(scripts["test:integration"] ? ["npm", "run", "test:integration"] : null, false),
      coverage: command(scripts.coverage ? ["npm", "run", "coverage"] : null, false),
    };
    return {
      kind: "node", languages: ["javascript", "typescript"], capabilities,
      ...Object.fromEntries(Object.entries(capabilities).map(([name, value]) => [name, value?.command ?? null])),
      dependencyFiles: ["package.json", "package-lock.json"], sourceRoots: ["src"], testRoots: ["test", "tests"],
    };
  }
}
