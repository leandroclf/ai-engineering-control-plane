import { capabilityMap } from "./capability.mjs";
import { ProcessRunner } from "../adapters/process-runner.mjs";
import { CapabilityStatus } from "./capability.mjs";
export class GoProjectAdapter { constructor({ runner = new ProcessRunner() } = {}) { this.runner = runner; } async detect(project) { const probe = await this.runner.run("go", ["list", "-e", "./..."], { cwd: project, timeoutMs: 10000 }); const ok = probe.kind === "completed" && probe.exitCode === 0; const cap = (command, required = false) => ({ command: ok ? command : null, required, status: ok ? CapabilityStatus.AVAILABLE : required ? CapabilityStatus.MISCONFIGURED : CapabilityStatus.UNSUPPORTED, evidence: { source: "go-list", probeStatus: probe.kind, exitCode: probe.exitCode ?? null } }); return { path: ".", kind: "go", languages: ["go"], capabilities: capabilityMap({
  build: cap(["go", "build", "./..."], true), lint: cap(["go", "vet", "./..."], true),
  "changed-tests": cap(["go", "test", "./..."], true), "unit-tests": cap(["go", "test", "./..."], true),
  "integration-tests": cap(["go", "test", "-tags=integration", "./..."]), coverage: cap(["go", "test", "-coverprofile=coverage.out", "./..."]),
}), dependencyFiles: ["go.mod", "go.sum"], sourceRoots: ["."], testRoots: ["."] }; } }
