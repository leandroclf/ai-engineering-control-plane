import { createHash } from "node:crypto";
import { assertRuntimeContract } from "./runtime-contract.mjs";

function check(id, passed, detail = null, status = passed ? "PASS" : "FAIL") { return { id, status, detail }; }
function envMap(inspect) { return Object.fromEntries((inspect.Config?.Env ?? []).map((item) => { const index = item.indexOf("="); return [index < 0 ? item : item.slice(0, index), index < 0 ? "" : item.slice(index + 1)]; })); }

export async function runRuntimeCompliance({ inspect, exec = null, contract, manifest = null, runBehavioral = true } = {}) {
  assertRuntimeContract(contract);
  if (!inspect || typeof inspect !== "object") throw new TypeError("container inspection is required");
  const env = envMap(inspect);
  const mounts = inspect.Mounts ?? [];
  const tmpfs = inspect.HostConfig?.Tmpfs ?? {};
  const checks = [
    check("non-root", Boolean(inspect.Config?.User && !["0", "0:0", "root"].includes(String(inspect.Config.User)))),
    check("root-filesystem-read-only", inspect.HostConfig?.ReadonlyRootfs === true),
    check("home-ephemeral", env.HOME === contract.home.path && Boolean(tmpfs[contract.home.path])),
    check("workspace-only-rw", mounts.some((mount) => mount.Destination === contract.filesystem.workspace && mount.RW === true) && !mounts.some((mount) => mount.Destination === "/root" || mount.Destination === "/home")),
    check("host-home-absent", !mounts.some((mount) => /(?:^|\/)(?:home|Users)\/[^/]+$/.test(mount.Source ?? ""))),
    check("ssh-state-absent", !mounts.some((mount) => mount.Destination === "/root/.ssh" || mount.Destination === "/home/worker/.ssh")),
    check("docker-socket-absent", !mounts.some((mount) => mount.Destination === "/var/run/docker.sock")),
    check("capabilities-dropped", (inspect.HostConfig?.CapDrop ?? []).includes("ALL")),
    check("no-new-privileges", (inspect.HostConfig?.SecurityOpt ?? []).includes("no-new-privileges")),
    check("provider-credentials-not-in-env", !(inspect.Config?.Env ?? []).some((item) => /^(OPENAI|ANTHROPIC|GEMINI|GOOGLE)_.*(?:KEY|TOKEN|SECRET)=/i.test(item))),
    check("image-digest-present", Boolean(inspect.Image && /^sha256:[a-f0-9]{64}$/.test(inspect.Image)), "image digest must be immutable"),
    check("manifest-digest-match", !manifest || !manifest.digest || manifest.digest === inspect.Image, manifest ? `manifest=${manifest.digest ?? "none"}; observed=${inspect.Image ?? "none"}` : null),
  ];
  if (contract.extensions.policy === "STRICT") {
    checks.push(check("native-skills-forbidden", env.AICP_NATIVE_SKILLS === "forbidden" || env.AICP_EXTENSION_POLICY === "STRICT"));
    checks.push(check("plugins-forbidden", env.AICP_PLUGINS === "forbidden" || env.AICP_EXTENSION_POLICY === "STRICT"));
    checks.push(check("mcp-auto-discovery-forbidden", env.AICP_MCP_AUTO_DISCOVERY === "forbidden" || env.AICP_EXTENSION_POLICY === "STRICT"));
  }
  if (runBehavioral && exec) {
    const rootWrite = await exec(["sh", "-c", "touch /aicp-rootfs-write-test"]);
    checks.push(check("rootfs-write-denied", rootWrite.exitCode !== 0, `exitCode=${rootWrite.exitCode}`));
    const workspaceWrite = await exec(["sh", "-c", "test -w /workspace/project"]);
    checks.push(check("workspace-write-allowed", workspaceWrite.exitCode === 0, `exitCode=${workspaceWrite.exitCode}`));
    const socketProbe = await exec(["sh", "-c", "test ! -S /var/run/docker.sock"]);
    checks.push(check("socket-behavior-denied", socketProbe.exitCode === 0, `exitCode=${socketProbe.exitCode}`));
  }
  const failed = checks.filter((item) => item.status === "FAIL");
  const report = { schemaVersion: 1, provider: contract.provider, status: failed.length ? "FAIL" : "PASS", checks, checkedAt: new Date().toISOString(), reportHash: null };
  report.reportHash = createHash("sha256").update(JSON.stringify({ ...report, reportHash: null })).digest("hex");
  if (failed.length) throw Object.assign(new Error(`RUNTIME_COMPLIANCE_FAILED:${failed.map((item) => item.id).join(",")}`), { code: "RUNTIME_COMPLIANCE_FAILED", report });
  return Object.freeze(report);
}
