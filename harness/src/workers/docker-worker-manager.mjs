import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { WorkerManager } from "../runtime/ephemeral-worker-contract.mjs";

const PHYSICAL_PROVIDER_CREDENTIAL = /^(?:OPENAI|ANTHROPIC|GEMINI|GOOGLE)_.*(?:KEY|TOKEN|SECRET)$/i;
function workerName(runId) { return `aicp-run-${createHash("sha256").update(runId).digest("hex").slice(0, 20)}`; }

export class DockerWorkerManager extends WorkerManager {
  constructor({ docker, profiles, identityService, network = "none", secretResolver = async () => null }) {
    super();
    if (!docker || !profiles || !identityService) throw new TypeError("docker control, profiles and identity service are required");
    this.docker = docker; this.profiles = profiles; this.identityService = identityService; this.network = network; this.secretResolver = secretResolver; this.workers = new Map();
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
      LITELLM_API_KEY: litellmToken,
      MEMORY_SERVICE_TOKEN: memoryToken,
    };
    const containerId = await this.docker.create({ name: workerName(spec.runId), runId: spec.runId, image: profile.image, network: this.network, environment, mounts: [{ source: resolve(spec.projectDirectory), target: "/workspace/project", readOnly: false }], tmpfs: ["/tmp:rw,noexec,nosuid,size=512m", "/home/worker/.cache:rw,nosuid,size=512m"] });
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

  async exec(runId, command) {
    const worker = this.workers.get(runId);
    if (!worker) throw new Error(`WORKER_NOT_FOUND:${runId}`);
    this.identityService.verify(worker.identityToken, runId);
    return this.docker.exec(worker.handle.workerId, command);
  }

  async collectEvidence(runId) {
    const worker = this.workers.get(runId);
    if (!worker) throw new Error(`WORKER_NOT_FOUND:${runId}`);
    const repositoryDiff = await this.docker.exec(worker.handle.workerId, ["sh", "-lc", "git -C /workspace/project status --porcelain=v1 && git -C /workspace/project diff --binary --no-ext-diff"]);
    const diff = repositoryDiff.exitCode === 0 ? repositoryDiff : await this.docker.diff(worker.handle.workerId);
    return Object.freeze({ runId, workerId: worker.handle.workerId, diffHash: createHash("sha256").update(diff.stdout ?? "").digest("hex"), changedEntries: String(diff.stdout ?? "").trim() ? String(diff.stdout).trim().split("\n").length : 0 });
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
}
