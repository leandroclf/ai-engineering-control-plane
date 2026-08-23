import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const flatten = (object, prefix = "") => Object.entries(object).flatMap(([key, value]) => value && typeof value === "object" ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`]);
const locales = ["en", "pt-PT"];
const keys = await Promise.all(locales.map(async (locale) => [locale, new Set(flatten(JSON.parse(await readFile(new URL(`apps/console/messages/${locale}.json`, root), "utf8"))))]));
const [referenceLocale, reference] = keys[0];
for (const [locale, values] of keys.slice(1)) {
  const missing = [...reference].filter((key) => !values.has(key));
  const extra = [...values].filter((key) => !reference.has(key));
  if (missing.length || extra.length) throw new Error(`locale parity failure ${locale}: missing=${missing.join(",")} extra=${extra.join(",")}`);
}
process.stdout.write(`${JSON.stringify({ status: "pass", locales, keys: reference.size, referenceLocale })}\n`);
