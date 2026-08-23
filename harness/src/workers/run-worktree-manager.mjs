import { mkdir, rm, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, resolve } from "node:path";

const execute = promisify(execFile);

async function git(args, cwd) {
  try { return (await execute("git", args, { cwd, encoding: "utf8", timeout: 30_000 })).stdout.trim(); }
  catch (error) { throw new Error(`WORKTREE_GIT_FAILED:${String(error.stderr ?? error.message).trim()}`); }
}

export class RunWorktreeManager {
  constructor({ root }) {
    if (!root) throw new TypeError("worktree root is required");
    this.root = resolve(root);
    this.runs = new Map();
  }

  async create({ runId, sourceDirectory, baseCommit = "HEAD" }) {
    if (this.runs.has(runId)) throw new Error(`WORKTREE_ALREADY_EXISTS:${runId}`);
    const repositoryRoot = await git(["rev-parse", "--show-toplevel"], sourceDirectory);
    const target = join(this.root, runId, "repo");
    await mkdir(join(this.root, runId), { recursive: true });
    try {
      await git(["worktree", "add", "--detach", target, baseCommit], repositoryRoot);
    } catch (error) {
      await rm(join(this.root, runId), { recursive: true, force: true });
      throw error;
    }
    const handle = Object.freeze({ runId, repositoryRoot, path: target, baseCommit });
    this.runs.set(runId, handle);
    return handle;
  }

  async destroy(runId) {
    const handle = this.runs.get(runId);
    if (!handle) return false;
    try { await git(["worktree", "remove", "--force", handle.path], handle.repositoryRoot); }
    finally { await rm(join(this.root, runId), { recursive: true, force: true }); this.runs.delete(runId); }
    return true;
  }

  has(runId) { return this.runs.has(runId); }

  async reconcile() {
    let removed = 0;
    let entries = [];
    try { entries = await readdir(this.root, { withFileTypes: true }); } catch { return { removed }; }
    for (const entry of entries) {
      if (!entry.isDirectory() || this.runs.has(entry.name)) continue;
      await rm(join(this.root, entry.name), { recursive: true, force: true });
      removed += 1;
    }
    return { removed };
  }
}
