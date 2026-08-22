import { access, constants } from "node:fs/promises";
import { resolve, sep } from "node:path";

async function exists(path) { try { await access(path); return true; } catch { return false; } }
export class WorkspaceAttestationError extends Error { constructor(check) { super(`WORKSPACE_ATTESTATION_FAILED:${check}`); this.check = check; } }

export class WorkspaceAttestor {
  constructor({ projectRoot = "/workspace", environment = process.env } = {}) { this.projectRoot = resolve(projectRoot); this.environment = environment; }
  async attest(project) {
    const resolved = resolve(project);
    if (resolved !== this.projectRoot && !resolved.startsWith(`${this.projectRoot}${sep}`)) throw new WorkspaceAttestationError("PROJECT_OUTSIDE_ROOT");
    await access(resolved, constants.R_OK);
    if (process.getuid?.() === 0) throw new WorkspaceAttestationError("ROOT_USER");
    if (await exists("/var/run/docker.sock")) throw new WorkspaceAttestationError("DOCKER_SOCKET_PRESENT");
    for (const name of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY"]) {
      if (this.environment[name]) throw new WorkspaceAttestationError(`PROVIDER_CREDENTIAL:${name}`);
    }
    try { await access("/etc", constants.W_OK); throw new WorkspaceAttestationError("ROOT_FILESYSTEM_WRITABLE"); }
    catch (error) { if (error instanceof WorkspaceAttestationError) throw error; }
    return { version: "workspace-v1", user: process.getuid?.(), project: resolved, dockerSocket: false, providerCredentials: false, rootReadOnly: true };
  }
}
