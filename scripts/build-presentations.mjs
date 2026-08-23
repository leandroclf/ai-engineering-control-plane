import { access, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";

const format = process.argv.includes("--format") ? process.argv[process.argv.indexOf("--format") + 1] : "html";
const decks = ["engineering/aicp-engineering", "users/aicp-user-guide", "executive/aicp-executive"];
try { await access("node_modules/.bin/marp"); } catch { console.log(JSON.stringify({ status: "skipped", reason: "Marp CLI is optional until dependencies are installed" })); process.exit(0); }
await mkdir("presentations/dist", { recursive: true });
for (const deck of decks) await new Promise((resolve, reject) => {
  const child = spawn("node_modules/.bin/marp", [`presentations/${deck}.md`, "--theme", "presentations/theme/aicp.css", `--${format}`, "-o", `presentations/dist/${deck.split("/")[1]}.${format}`], { stdio: "inherit" });
  child.on("exit", (code) => code ? reject(new Error(`Marp failed for ${deck}`)) : resolve());
});
console.log(JSON.stringify({ status: "built", format, decks: decks.length }));
