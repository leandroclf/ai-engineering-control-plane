import { ProjectGateRunner } from "../gates/project-gate-runner.mjs";

function capabilityFor(command) {
  const [tool, ...args] = command;
  if (tool === "semgrep" || tool === "gitleaks" || tool === "trivy") return `scanner:${tool}`;
  if (tool === "npm" && args[0] === "test") return "test:unit";
  if (tool === "npm" && args[0] === "run" && args[1]) return args[1] === "build" ? "build" : args[1] === "lint" ? "lint" : args[1] === "coverage" ? "coverage" : args[1] === "test:integration" ? "test:integration" : "unknown";
  if (tool === "gradle" || tool === "mvn" || tool === "python" || tool === "python3" || tool === "go") return "build";
  return "unknown";
}

export class WorkerGateRunner {
  constructor({ workerManager, runId }) {
    if (!workerManager?.execCapability || !runId) throw new TypeError("worker capability transport is required");
    this.workerManager = workerManager;
    this.runId = runId;
  }

  async run(command, args, { cwd } = {}) {
    const capability = capabilityFor([command, ...args]);
    if (capability === "unknown") throw Object.assign(new Error("COMMAND_NOT_ALLOWED"), { name: "WorkerCapabilityError" });
    return this.workerManager.execCapability(this.runId, { capability, tool: command, args, cwd: cwd ?? "/workspace/project" });
  }
}

export async function runWorkerGates({ workerManager, runId, project = "/workspace/project", profile, gateNames, definitions }) {
  return new ProjectGateRunner({ runner: new WorkerGateRunner({ workerManager, runId }) }).run({ project, profile, gateNames, definitions });
}
