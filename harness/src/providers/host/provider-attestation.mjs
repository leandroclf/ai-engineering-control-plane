import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function attestProviderEnvironment(environment) {
  const names = Object.keys(environment ?? {});
  const forbidden = names.filter((name) => /(?:TOKEN|SECRET|PASSWORD|API.?KEY|CREDENTIAL|COOKIE|DATABASE|SSH_AUTH_SOCK)/i.test(name));
  return Object.freeze({ allowlisted: forbidden.length === 0, environmentFingerprint: createHash("sha256").update(names.sort().join("\n")).digest("hex"), forbiddenNames: forbidden });
}

export async function attestCredentialPath(path) {
  try { await readFile(join(path), { encoding: "utf8", flag: "r" }); return { accessible: true }; }
  catch { return { accessible: false }; }
}
