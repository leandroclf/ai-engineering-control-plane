import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { ProviderError, PROVIDER_ERROR_CODES } from "../provider-errors.mjs";

const exec = promisify(execFile);
async function git(root, args) { return exec("git", ["-C", root, ...args], { maxBuffer: 1024 * 1024 }); }
function gitWithInput(root, args, input) { return new Promise((resolvePromise, reject) => { const child = spawn("git", ["-C", root, ...args], { shell: false, stdio: ["pipe", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; }); child.once("error", reject); child.once("close", (code) => code === 0 ? resolvePromise({ stdout, stderr }) : reject(new Error(stderr || `git exited ${code}`))); child.stdin.end(input); }); }

export class WorktreeCheckpoint {
  async create(root) {
    const worktree = resolve(root);
    const [head, status, diff, cached] = await Promise.all([
      git(worktree, ["rev-parse", "HEAD"]),
      git(worktree, ["status", "--porcelain=v1"]),
      git(worktree, ["diff", "--binary", "--no-ext-diff"]),
      git(worktree, ["diff", "--cached", "--binary", "--no-ext-diff"]),
    ]);
    const snapshot = { root: worktree, head: head.stdout.trim(), status: status.stdout, diff: diff.stdout, cachedDiff: cached.stdout, clean: !status.stdout.trim() };
    return Object.freeze({ ...snapshot, beforeTree: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"), createdAt: new Date().toISOString() });
  }

  async attest(root, expected = null) {
    const current = await this.create(root);
    return Object.freeze({ clean: current.clean, beforeTree: expected?.beforeTree ?? null, afterTree: current.beforeTree, restored: expected ? current.clean && current.head === expected.head : current.clean });
  }

  async restore(checkpoint, { allowDirtyRestore = false } = {}) {
    if (!checkpoint?.root) throw new TypeError("checkpoint is required");
    if (!checkpoint.clean && !allowDirtyRestore) throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_CHECKPOINT_FAILED, "refusing to overwrite a dirty worktree");
    try {
      await git(checkpoint.root, ["reset", "--hard", checkpoint.head]);
      await git(checkpoint.root, ["clean", "-fd"]);
      if (checkpoint.diff) await gitWithInput(checkpoint.root, ["apply", "--binary", "-"], checkpoint.diff);
      if (checkpoint.cachedDiff) await gitWithInput(checkpoint.root, ["apply", "--cached", "--binary", "-"], checkpoint.cachedDiff);
      const attestation = await this.attest(checkpoint.root, checkpoint);
      if (!attestation.restored) throw new Error("checkpoint attestation mismatch");
      return attestation;
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(PROVIDER_ERROR_CODES.PROVIDER_CHECKPOINT_FAILED, "worktree checkpoint could not be restored", { cause: error });
    }
  }
}
