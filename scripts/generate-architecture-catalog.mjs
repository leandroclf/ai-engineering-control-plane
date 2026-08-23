import { readFile, writeFile } from "node:fs/promises";
import { parse } from "yaml";

const root = new URL("..", import.meta.url);
const output = new URL("../packages/architecture-catalog/src/generated/catalog.ts", import.meta.url);
const catalog = parse(await readFile(new URL("architecture/catalog.yaml", root), "utf8"));
const componentIds = new Set(catalog.components.map((component) => component.id));
const edges = catalog.components.flatMap((component) => component.dependencies.filter((dependency) => componentIds.has(dependency)).map((dependency) => [component.id, dependency]));
const generated = `/* This file is generated from architecture/catalog.yaml. Do not edit manually. */\nimport type { ArchitectureComponent } from "../index";\n\nexport const architectureCatalog: ArchitectureComponent[] = ${JSON.stringify(catalog.components, null, 2)};\n\nexport const architectureEdges: Array<[string, string]> = ${JSON.stringify(edges, null, 2)};\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(output, "utf8");
  if (current !== generated) throw new Error("architecture catalog generated TypeScript is out of date; run npm run generate:architecture-catalog");
} else {
  await writeFile(output, generated);
}

process.stdout.write(`${JSON.stringify({ status: "pass", components: catalog.components.length, edges: edges.length })}\n`);
