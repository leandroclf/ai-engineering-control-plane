import { readFile } from "node:fs/promises";
import { join } from "node:path";

export class NodeProjectAdapter {
  async detect(project) {
    const manifest = JSON.parse(await readFile(join(project, "package.json"), "utf8"));
    const scripts = manifest.scripts ?? {};
    return {
      build: scripts.build ? ["npm", "run", "build"] : null,
      lint: scripts.lint ? ["npm", "run", "lint"] : null,
      "unit-tests": scripts.test ? ["npm", "test"] : null,
      "integration-tests": scripts["test:integration"] ? ["npm", "run", "test:integration"] : null,
      coverage: scripts.coverage ? ["npm", "run", "coverage"] : null,
    };
  }
}
