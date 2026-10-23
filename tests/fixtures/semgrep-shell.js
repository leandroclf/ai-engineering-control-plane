import { exec, execSync } from "node:child_process";
// ruleid: aicp.shell-command-interpolation
exec(`echo ${input}`);
// ruleid: aicp.shell-command-interpolation
execSync(input);
// ok: aicp.shell-command-interpolation
exec("echo fixed");
// ok: aicp.shell-command-interpolation
execSync("echo fixed");
// ok: aicp.shell-command-interpolation
exec(["test", "-w", "/workspace/project"]);
