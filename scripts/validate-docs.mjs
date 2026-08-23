import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const required = ["docs/README.md", "docs/reference/component-catalog.md", "docs/reference/glossary.md", "docs/security/ui-invariants.md", "docs/architecture/diagrams/system-context.md"];
for (const file of required) await readFile(new URL(file, root));
const broken = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.name.endsWith(".md")) {
      const content = await readFile(path, "utf8");
      if (!content.match(/^#\s+\S/m)) broken.push(`${path}: missing title`);
      if (content.includes("[TODO]")) broken.push(`${path}: TODO marker`);
    }
  }
}
await walk(fileURLToPath(new URL("docs", root)));
if (broken.length) throw new Error(broken.join("\n"));
console.log(JSON.stringify({ status: "pass", requiredFiles: required.length }));
