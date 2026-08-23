import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";

const server = spawn("npm", ["run", "dev"], { env: { ...process.env, AICP_DEMO_MODE: "true", PORT: "3000" }, stdio: "ignore" });
const base = "http://127.0.0.1:3000";
try {
  for (let attempt = 0; attempt < 30; attempt += 1) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 500)); }
  await mkdir("../../docs/assets/screenshots", { recursive: true });
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  for (const [route, filename] of [["/", "overview"], ["/runs/demo-run", "run-detail"], ["/architecture", "architecture"], ["/release", "release"]]) { await page.goto(`${base}${route}`, { waitUntil: "networkidle" }); await page.screenshot({ path: `../../docs/assets/screenshots/${filename}.png`, fullPage: true }); }
  await browser.close();
} finally { server.kill("SIGTERM"); }
