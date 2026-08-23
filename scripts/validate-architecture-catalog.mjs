import { readFile } from "node:fs/promises";
import { parse } from "yaml";

const root = new URL("..", import.meta.url);
const catalog = parse(await readFile(new URL("architecture/catalog.yaml", root), "utf8"));
const schema = JSON.parse(await readFile(new URL("architecture/catalog.schema.json", root), "utf8"));
if (catalog.version !== schema.properties.version.const || !Array.isArray(catalog.components) || !catalog.components.length) throw new Error("architecture catalog must contain version 1 and components");
const ids = new Set();
for (const component of catalog.components) {
  for (const key of schema.properties.components.items.required) if (!(key in component)) throw new Error(`${component.id ?? "unknown"} is missing ${key}`);
  if (ids.has(component.id)) throw new Error(`duplicate component: ${component.id}`);
  ids.add(component.id);
}
for (const component of catalog.components) for (const dependency of component.dependencies) if (!ids.has(dependency) && !["docker", "project-repository", "provider-apis", "neo4j", "redis", "opencode"].includes(dependency)) throw new Error(`${component.id} references unknown component ${dependency}`);
console.log(JSON.stringify({ schemaVersion: 1, status: "pass", components: catalog.components.length }));
