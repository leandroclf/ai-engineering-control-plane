import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);

async function run(args, options = {}) {
  try {
    const result = await execute("docker", args, { encoding: "utf8", maxBuffer: 2_000_000, timeout: options.timeoutMs ?? 30_000 });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { exitCode: Number(error.code) || 1, stdout: error.stdout ?? "", stderr: error.stderr ?? error.message };
  }
}

export class ProcessDockerControl {
  async create(options) {
    const args = ["create", "--name", options.name, "--label", `aicp.run_id=${options.runId}`, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "512", "--memory", "4g", "--cpus", "4", "--network", options.network];
    for (const mount of options.mounts) args.push("--mount", `type=bind,src=${mount.source},dst=${mount.target}${mount.readOnly ? ",readonly" : ""}`);
    for (const tmpfs of options.tmpfs) args.push("--tmpfs", tmpfs);
    for (const [name, value] of Object.entries(options.environment)) args.push("--env", `${name}=${value}`);
    args.push(options.image);
    const created = await run(args);
    if (created.exitCode !== 0) throw new Error(`WORKER_CREATE_FAILED:${created.stderr}`);
    const id = created.stdout.trim();
    const started = await run(["start", id]);
    if (started.exitCode !== 0) throw new Error(`WORKER_START_FAILED:${started.stderr}`);
    return id;
  }
  async inspect(id) { const result = await run(["inspect", id]); if (result.exitCode !== 0) throw new Error("WORKER_INSPECT_FAILED"); return JSON.parse(result.stdout)[0]; }
  exec(id, command) { return run(["exec", id, ...command]); }
  diff(id) { return run(["diff", id]); }
  async remove(id) { const result = await run(["rm", "--force", id]); if (result.exitCode !== 0) throw new Error("WORKER_DESTROY_FAILED"); }
}

