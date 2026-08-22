import { createHash } from "node:crypto";

export class WorkerCapabilityError extends Error {
  constructor(profile, probe) { super(`WORKER_CAPABILITY_UNAVAILABLE:${profile}:${probe.join(" ")}`); this.name = "WorkerCapabilityError"; this.profile = profile; this.probe = probe; }
}

export class WorkerProfileRegistry {
  constructor(configuration) {
    if (configuration?.schemaVersion !== 1 || !configuration.profiles) throw new TypeError("worker profile registry v1 is required");
    this.profiles = new Map(Object.entries(structuredClone(configuration.profiles)));
    for (const [name, profile] of this.profiles) {
      if (!profile.image || !profile.dockerfile || !profile.projectKinds?.length || !profile.probes?.length) throw new TypeError(`invalid worker profile: ${name}`);
    }
  }

  select(projectProfile) {
    const kinds = projectProfile.kind === "composite" ? projectProfile.modules.map((module) => module.kind) : [projectProfile.kind];
    const selected = [...this.profiles].filter(([, profile]) => profile.projectKinds.some((kind) => kinds.includes(kind))).map(([name]) => name);
    if (!selected.length) throw new WorkerCapabilityError("unknown", [String(projectProfile.kind)]);
    return [...new Set(selected)].sort();
  }

  get(name) {
    const profile = this.profiles.get(name);
    if (!profile) throw new WorkerCapabilityError(name, ["profile"]);
    return structuredClone({ name, ...profile });
  }

  async attest(name, executor) {
    if (!executor?.exec) throw new TypeError("worker probe executor is required");
    const profile = this.get(name);
    const probes = [];
    for (const command of profile.probes) {
      const result = await executor.exec(command);
      if (result?.exitCode !== 0) throw new WorkerCapabilityError(name, command);
      probes.push({ command, exitCode: result.exitCode, outputHash: createHash("sha256").update(String(result.stdout ?? result.stderr ?? "")).digest("hex") });
    }
    const evidence = { schemaVersion: 1, profile: name, image: profile.image, probes, status: "AVAILABLE" };
    return Object.freeze({ ...evidence, attestationId: createHash("sha256").update(JSON.stringify(evidence)).digest("hex") });
  }
}

