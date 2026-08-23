import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const required = ["docs/README.md", "docs/reference/component-catalog.md", "docs/reference/glossary.md", "docs/security/ui-invariants.md", "docs/architecture/diagrams/system-context.md"];
for (const file of required) await readFile(new URL(file, root));
const broken = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
      const content = await readFile(path, "utf8");
      const guide = /AI Engineering Control Plane_evolution/i.test(entry.name);
      if (!guide && !content.match(/^#\s+\S/m) && !content.match(/^---\n[\s\S]*?title:/m)) broken.push(`${path}: missing title`);
      if (!guide && content.includes("[TODO]")) broken.push(`${path}: TODO marker`);
      for (const match of content.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        const href = match[1];
        if (/^(https?:|mailto:|#)/.test(href)) continue;
        const target = decodeURIComponent(href.split("#", 1)[0]);
        if (!target) continue;
        const candidate = target.startsWith("/docs/")
          ? resolve(fileURLToPath(root), `apps/console/content/docs/${target.slice("/docs/".length)}.mdx`)
          : target.startsWith("/") ? resolve(fileURLToPath(root), `.${target}`) : resolve(dirname(path), target);
        try { await stat(candidate); } catch { broken.push(`${path}: broken local link ${href}`); }
      }
    }
  }
}
await walk(fileURLToPath(new URL("docs", root)));
if (broken.length) throw new Error(broken.join("\n"));
process.stdout.write(`${JSON.stringify({ status: "pass", requiredFiles: required.length })}\n`);
