const SHELL_SYNTAX = /[;&|`$()<>\n\r]/;
const ABSOLUTE_OR_ESCAPE = /(?:^|\/)\.\.(?:\/|$)/;

function matches(rule, tool, args) {
  if (rule.executable !== tool) return false;
  if (rule.subcommand && args[0] !== rule.subcommand) return false;
  if (rule.allowedScripts) {
    if (args[0] !== "run" || !rule.allowedScripts.includes(args[1])) return false;
  }
  return true;
}

export class WorkerCommandPolicy {
  constructor(configuration) {
    if (configuration?.schemaVersion !== 1 || !configuration.profiles) throw new TypeError("worker command policy v1 is required");
    this.profiles = structuredClone(configuration.profiles);
  }

  #rules(profileName, capability) {
    const profile = this.profiles[profileName];
    if (!profile) throw new Error(`WORKER_PROFILE_UNKNOWN:${profileName}`);
    if (profile.inherits) return [...this.#rules(profile.inherits, capability), ...(profile.capabilities?.[capability] ?? [])];
    return profile.capabilities?.[capability] ?? [];
  }

  validate({ profile, capability, tool, args = [] }) {
    if (typeof capability !== "string" || !capability || typeof tool !== "string" || !tool || !Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
      throw Object.assign(new Error("COMMAND_NOT_ALLOWED"), { name: "WorkerCapabilityError", code: "COMMAND_NOT_ALLOWED" });
    }
    if (tool === "sh" || tool === "bash" || tool === "zsh" || tool === "eval" || tool === "sudo" || tool === "su" || tool === "nsenter" || tool === "mount" || tool === "docker" || tool === "podman" || tool === "curl" || tool === "wget" || tool === "ssh" || tool === "scp" || tool === "nc" || tool === "socat") {
      throw Object.assign(new Error("COMMAND_NOT_ALLOWED"), { name: "WorkerCapabilityError", code: "COMMAND_NOT_ALLOWED" });
    }
    if (tool !== "opencode" && args.some((arg) => SHELL_SYNTAX.test(arg) || ABSOLUTE_OR_ESCAPE.test(arg))) {
      throw Object.assign(new Error("COMMAND_NOT_ALLOWED"), { name: "WorkerCapabilityError", code: "COMMAND_NOT_ALLOWED" });
    }
    const rule = this.#rules(profile, capability).find((candidate) => matches(candidate, tool, args));
    if (!rule) throw Object.assign(new Error("COMMAND_NOT_ALLOWED"), { name: "WorkerCapabilityError", code: "COMMAND_NOT_ALLOWED" });
    return Object.freeze({ capability, tool, args: [...args] });
  }
}
