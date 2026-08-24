import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WorktreeCheckpoint } from "../../../harness/src/providers/host/worktree-checkpoint.mjs";

const run = promisify(execFile);

test("worktree checkpoint attests a clean run worktree", async () => {
  const root = await mkdtemp(`${tmpdir()}/aicp-checkpoint-`);
  try {
    await run("git", ["init", "-q", root]);
    await run("git", ["-C", root, "config", "user.email", "aicp@example.test"]);
    await run("git", ["-C", root, "config", "user.name", "AICP"]);
    await writeFile(join(root, "file.txt"), "before\n");
    await run("git", ["-C", root, "add", "file.txt"]);
    await run("git", ["-C", root, "commit", "-qm", "initial"]);
    const checkpoint = await new WorktreeCheckpoint().create(root);
    await writeFile(join(root, "file.txt"), "mutated\n");
    await writeFile(join(root, "new.txt"), "untrusted\n");
    const restored = await new WorktreeCheckpoint().restore(checkpoint);
    assert.equal(restored.restored, true);
    assert.equal(await readFile(join(root, "file.txt"), "utf8"), "before\n");
  } finally { await rm(root, { recursive: true, force: true }); }
});
