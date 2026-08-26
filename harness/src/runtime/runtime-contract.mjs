import { createHash } from "node:crypto";

export const EXTENSION_POLICIES = Object.freeze(["STRICT", "CONTROLLED", "NATIVE"]);
export const RUNTIME_MODES = Object.freeze(["AUTH", "EXECUTION"]);

export const PROVIDER_AUTH_MATRIX = Object.freeze({
  codex: { cli: "codex", login: ["login"], status: ["login", "status"], logout: ["logout"], persistence: "CODEX_HOME/auth.json or OS credential store", refresh: "automatic during active use", officialDocs: "https://developers.openai.com/codex/auth/", verification: "DOCUMENTED_NOT_LIVE_VERIFIED" },
  claude: { cli: "claude", login: ["auth", "login"], status: ["auth", "status"], logout: ["auth", "logout"], persistence: "CLAUDE_CONFIG_DIR/.credentials.json or OS keychain", refresh: "provider-managed OAuth refresh", officialDocs: "https://code.claude.com/docs/en/authentication", verification: "DOCUMENTED_NOT_LIVE_VERIFIED" },
  opencode: { cli: "opencode", login: ["auth", "login"], status: ["auth", "list"], logout: ["auth", "logout"], persistence: "HOME/.local/share/opencode/auth.json", refresh: "provider-specific; no generic refresh contract documented", officialDocs: "https://opencode.ai/docs/cli/", verification: "DOCUMENTED_NOT_LIVE_VERIFIED" },
});

function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

export function createRuntimeContract({ provider, extensionPolicy = "STRICT", network = "none", imageManifest = null } = {}) {
  if (!PROVIDER_AUTH_MATRIX[provider]) throw new TypeError(`unsupported runtime provider: ${provider}`);
  if (!EXTENSION_POLICIES.includes(extensionPolicy)) throw new TypeError("invalid extension policy");
  const contract = {
    schemaVersion: 1,
    provider,
    mode: "EXECUTION",
    image: { versionPolicy: "validated", digestRequired: true, manifest: imageManifest },
    process: { runAsRoot: false, noNewPrivileges: true, capabilitiesDropped: ["ALL"] },
    home: { clean: true, ephemeral: true, path: "/run/aicp-home", hostMountForbidden: true },
    extensions: { policy: extensionPolicy, aicpSkills: "compiled-only", nativeSkills: extensionPolicy === "NATIVE" ? "allow" : "forbidden", plugins: extensionPolicy === "NATIVE" ? "allow" : extensionPolicy === "CONTROLLED" ? "allowlist" : "forbidden", mcpAutoDiscovery: extensionPolicy === "NATIVE" ? "allow" : "forbidden" },
    filesystem: { rootReadOnly: true, workspace: "/workspace/project", workspaceReadWrite: true, tmpfs: ["/run/aicp-home", "/tmp"], dockerSocketForbidden: true, hostSshForbidden: true },
    credentials: { projectVisible: false, interactiveLogin: false, providerSpecific: true },
    network: { mode: network, providerOnly: network !== "none", externallyEnforced: false },
    compliance: { preflightRequired: true, behavioralRequired: true },
  };
  return Object.freeze({ ...contract, contractHash: `rtc_${digest(contract)}` });
}

export function assertRuntimeContract(contract) {
  if (!contract || contract.schemaVersion !== 1 || !PROVIDER_AUTH_MATRIX[contract.provider]) throw new TypeError("Runtime Contract v1 is required");
  if (!EXTENSION_POLICIES.includes(contract.extensions?.policy) || contract.mode !== "EXECUTION") throw new TypeError("Runtime Contract has invalid execution policy");
  if (contract.process.runAsRoot || !contract.process.noNewPrivileges || !contract.filesystem.rootReadOnly || contract.filesystem.dockerSocketForbidden !== true || contract.home.hostMountForbidden !== true) throw new Error("RUNTIME_CONTRACT_NOT_HERMETIC");
  return contract;
}

export function createAuthContract(provider) {
  const auth = PROVIDER_AUTH_MATRIX[provider];
  if (!auth) throw new TypeError(`unsupported runtime provider: ${provider}`);
  return Object.freeze({ schemaVersion: 1, provider, mode: "AUTH", projectMounted: false, interactiveLoginAllowed: true, sourceTreeRequired: false, credentialsOwnedByProvider: true, commands: { login: auth.login, status: auth.status, logout: auth.logout }, documentation: auth.officialDocs, verification: auth.verification });
}

export function assertModeSeparation({ authContract, executionContract }) {
  if (!authContract || authContract.mode !== "AUTH" || authContract.projectMounted !== false) throw new Error("AUTH_MODE_PROJECT_MOUNT_FORBIDDEN");
  assertRuntimeContract(executionContract);
  if (executionContract.credentials.interactiveLogin !== false) throw new Error("EXECUTION_MODE_INTERACTIVE_LOGIN_FORBIDDEN");
  return true;
}
