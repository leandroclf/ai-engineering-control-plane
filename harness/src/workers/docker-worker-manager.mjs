import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { WorkerManager } from "../runtime/ephemeral-worker-contract.mjs";
import { WorkerCommandPolicy } from "./worker-command-policy.mjs";
import { WorkerAgentController } from "./worker-agent-controller.mjs";

const PHYSICAL_PROVIDER_CREDENTIAL = /^(?:OPENAI|ANTHROPIC|GEMINI|GOOGLE)_.*(?:KEY|TOKEN|SECRET)$/i;
function workerName(runId) { return `aicp-run-${createHash("sha256").update(runId).digest("hex").slice(0, 20)}`; }

export class DockerWorkerManager extends WorkerManager {
  constructor({ docker, profiles, identityService, network = "none", secretResolver = async () => null, commandPolicy = null, credentials = null, opencodeConfigSource = process.env.AICP_OPENCODE_CONFIG_SOURCE ?? null }) {
    super();
    if (!docker || !profiles || !identityService) throw new TypeError("docker control, profiles and identity service are required");
    this.docker = docker; this.profiles = profiles; this.identityService = identityService; this.network = network; this.secretResolver = secretResolver; this.commandPolicy = commandPolicy; this.credentials = credentials; this.opencodeConfigSource = opencodeConfigSource; this.workers = new Map();
  }

  async create(spec) {
    if (this.workers.has(spec.runId)) throw new Error(`WORKER_ALREADY_EXISTS:${spec.runId}`);
    this.identityService.verify(spec.identityToken, spec.runId);
    if (Object.keys(spec.environment).some((name) => PHYSICAL_PROVIDER_CREDENTIAL.test(name))) throw new Error("PROVIDER_CREDENTIAL_FORBIDDEN");
    const profile = this.profiles.get(spec.profile);
    const litellmToken = await this.secretResolver(spec.identity.litellmKeyRef);
    const memoryToken = await this.secretResolver(spec.identity.memoryTokenRef);
    if (!litellmToken || !memoryToken) throw new Error("WORKER_SCOPED_CREDENTIAL_UNAVAILABLE");
    const environment = {
      ...spec.environment,
      AICP_RUN_ID: spec.runId,
      LITELLM_BASE_URL: process.env.LITELLM_BASE_URL ?? "http://litellm:4000/v1",
      MEMORY_SERVICE_URL: process.env.MEMORY_SERVICE_URL ?? "http://memory-service:8080",
      LITELLM_API_KEY: litellmToken,
      MEMORY_SERVICE_TOKEN: memoryToken,
      ...(this.opencodeConfigSource ? { OPENCODE_CONFIG_DIR: "/opt/aicp/opencode" } : {}),
    };
    const workerMounts = [{ source: resolve(spec.projectDirectory), target: "/workspace/project", readOnly: false }];
    if (this.opencodeConfigSource) workerMounts.push({ source: resolve(this.opencodeConfigSource), target: "/opt/aicp/opencode", readOnly: true });
    const containerId = await this.docker.create({ name: workerName(spec.runId), runId: spec.runId, image: profile.image, network: this.network, environment, mounts: workerMounts, tmpfs: ["/tmp:rw,noexec,nosuid,size=512m", "/home/worker/.cache:rw,nosuid,size=512m", "/home/node/.cache:rw,nosuid,size=512m", "/home/node/.config:rw,nosuid,size=32m", "/home/node/.local:rw,nosuid,size=128m", "/home/node/.semgrep:rw,nosuid,size=32m"] });
    const inspected = await this.docker.inspect(containerId);
    const mounts = inspected.Mounts ?? [];
    const envNames = (inspected.Config?.Env ?? []).map((value) => value.split("=", 1)[0]);
    const attestation = {
      nonRoot: Boolean(inspected.Config?.User && inspected.Config.User !== "0" && inspected.Config.User !== "0:0"),
      readOnlyRoot: inspected.HostConfig?.ReadonlyRootfs === true,
      dockerSocket: mounts.some((mount) => mount.Destination === "/var/run/docker.sock"),
      providerSecrets: envNames.some((name) => PHYSICAL_PROVIDER_CREDENTIAL.test(name)),
      networkPolicy: inspected.HostConfig?.NetworkMode,
      capabilitiesDropped: inspected.HostConfig?.CapDrop ?? [],
      noNewPrivileges: (inspected.HostConfig?.SecurityOpt ?? []).includes("no-new-privileges"),
    };
    if (!attestation.nonRoot || !attestation.readOnlyRoot || attestation.dockerSocket || attestation.providerSecrets || !attestation.capabilitiesDropped.includes("ALL") || !attestation.noNewPrivileges) {
      await this.docker.remove(containerId); this.identityService.revoke(spec.identityToken); throw new Error("WORKER_ATTESTATION_FAILED");
    }
    const profileAttestation = await this.profiles.attest(spec.profile, { exec: (command) => this.docker.exec(containerId, command) });
    const handle = Object.freeze({ runId: spec.runId, workerId: containerId, profile: spec.profile, image: profile.image, imageDigest: inspected.Image, attestation: Object.freeze({ ...attestation, profileAttestation }) });
    this.workers.set(spec.runId, { handle, identityToken: spec.identityToken });
    return handle;
  }

  async invokeAgent(runId, request) {
    const worker = this.workers.get(runId);
    if (!worker) throw new Error(`WORKER_NOT_FOUND:${runId}`);
    this.identityService.verify(worker.identityToken, runId);
    return new WorkerAgentController({ docker: this.docker, commandPolicy: this.commandPolicy }).invoke({ workerId: worker.handle.workerId, profile: worker.handle.profile, ...request });
  }

  async exec(runId, command) {
    const worker = this.workers.get(runId);
    if (!worker) throw new Error(`WORKER_NOT_FOUND:${runId}`);
    this.identityService.verify(worker.identityToken, runId);
    if (this.commandPolicy) {
      if (!Array.isArray(command) || !command.length) throw Object.assign(new Error("COMMAND_NOT_ALLOWED"), { name: "WorkerCapabilityError", code: "COMMAND_NOT_ALLOWED" });
      const capability = this.commandPolicy.validate({ profile: worker.handle.profile, capability: "runtime:probe", tool: command[0], args: command.slice(1) });
      return this.docker.exec(worker.handle.workerId, [capability.tool, ...capability.args]);
    }
    return this.docker.exec(worker.handle.workerId, command);
  }

  async execCapability(runId, request) {
    const worker = this.workers.get(runId);
    if (!worker) throw new Error(`WORKER_NOT_FOUND:${runId}`);
    this.identityService.verify(worker.identityToken, runId);
    if (!this.commandPolicy?.validate) throw new Error("WORKER_COMMAND_POLICY_UNAVAILABLE");
    const capability = this.commandPolicy.validate({ profile: worker.handle.profile, ...request });
    const cwd = request.cwd ? String(request.cwd) : "/workspace/project";
    if (!cwd.startsWith("/workspace/project") || /(?:^|\/)\.\.(?:\/|$)/.test(cwd)) throw Object.assign(new Error("COMMAND_NOT_ALLOWED"), { name: "WorkerCapabilityError", code: "COMMAND_NOT_ALLOWED" });
    return this.docker.execCapability ? this.docker.execCapability(worker.handle.workerId, capability, { cwd }) : this.docker.exec(worker.handle.workerId, [capability.tool, ...capability.args]);
  }

  async collectEvidence(runId) {
    const worker = this.workers.get(runId);
    if (!worker) throw new Error(`WORKER_NOT_FOUND:${runId}`);
    const status = await this.docker.exec(worker.handle.workerId, ["git", "-C", "/workspace/project", "status", "--porcelain=v1"]);
    const diff = await this.docker.exec(worker.handle.workerId, ["git", "-C", "/workspace/project", "diff", "--binary", "--no-ext-diff"]);
    const evidence = `${status.stdout ?? ""}\n${diff.stdout ?? ""}`;
    return Object.freeze({ runId, workerId: worker.handle.workerId, image: worker.handle.image, imageDigest: worker.handle.imageDigest, attestation: worker.handle.attestation, ...(this.credentials ? { credentials: await this.credentials.describe(runId) } : {}), diffHash: createHash("sha256").update(evidence).digest("hex"), changedEntries: String(status.stdout ?? "").trim() ? String(status.stdout).trim().split("\n").length : 0 });
  }

  async destroy(runId) {
    const worker = this.workers.get(runId);
    if (!worker) return false;
    const inspected = await this.docker.inspect(worker.handle.workerId);
    if (inspected.Config?.Labels?.["aicp.run_id"] !== runId) throw new Error("WORKER_OWNERSHIP_MISMATCH");
    await this.docker.remove(worker.handle.workerId);
    this.identityService.revoke(worker.identityToken);
    this.workers.delete(runId);
    return true;
  }

  async reconcile() {
    if (!this.docker.listOwned) return { removed: 0 };
    const owned = await this.docker.listOwned();
    let removed = 0;
    for (const containerId of owned) {
      await this.docker.remove(containerId);
      removed += 1;
    }
    this.workers.clear();
    return { removed };
  }
}
