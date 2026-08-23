import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:3000", ...devices["Desktop Chrome"] },
  webServer: [
    { command: "node e2e/admin-upstream.mjs", port: 19081, reuseExistingServer: true },
    { command: "AICP_DEMO_MODE=true AICP_ADMIN_UPSTREAM_URL=http://127.0.0.1:19081 npm run dev", url: "http://127.0.0.1:3000", reuseExistingServer: true },
  ],
  reporter: "line",
});
