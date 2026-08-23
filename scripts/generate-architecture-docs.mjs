import { readFile, writeFile } from "node:fs/promises";
import { parse } from "yaml";

const root = new URL("..", import.meta.url);
const catalog = parse(await readFile(new URL("architecture/catalog.yaml", root), "utf8"));
const lines = ["# Component Catalog", "", "Generated from `architecture/catalog.yaml`. Do not edit this table manually.", "", "| Component | Plane | Authority | Failure mode | Purpose |", "|---|---|---|---|---|"];
for (const component of catalog.components) lines.push(`| [${component.name}](${component.docs}) | ${component.plane} | ${component.authority} | ${component.failureMode} | ${component.purpose} |`);
await writeFile(new URL("docs/reference/component-catalog.md", root), `${lines.join("\n")}\n`);
process.stdout.write(`${JSON.stringify({ status: "generated", components: catalog.components.length })}\n`);
