import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("candidate workflow passes dispatch values as data rather than shell commands", (t) => {
  const workflow = readFileSync(new URL("../../.github/workflows/runtime-candidate.yml", import.meta.url), "utf8");
  const body = workflow.match(/name: Build candidate image\s*\n\s*run: ([^\n]+)/)?.[1];
  assert.ok(body, "candidate build command must be exercised");
  const directory = mkdtempSync(join(tmpdir(), "aicp-dispatch-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(join(directory, "scripts/runtime"), { recursive: true });
  writeFileSync(join(directory, "scripts/runtime/build-candidate.sh"), 'printf "%s\\n" "$@" > "$OUT"\n');
  const marker = join(directory, "injected");
  const output = join(directory, "arguments");
  const attack = `1.2.3"; touch "${marker}"; #`;
  const values = { provider: "codex", cli_package: "@openai/codex", cli_version: attack };
  const command = body.replace(/\$\{\{ inputs\.(\w+) \}\}/g, (_, name) => values[name]);
  const result = spawnSync("bash", ["-c", command], { cwd: directory, encoding: "utf8",
    env: { ...process.env, PROVIDER: values.provider, CLI_PACKAGE: values.cli_package, CLI_VERSION: attack, OUT: output } });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(marker), false, "untrusted dispatch input executed a shell command");
  assert.deepEqual(readFileSync(output, "utf8").trimEnd().split("\n"), ["codex", "@openai/codex", attack]);
});
