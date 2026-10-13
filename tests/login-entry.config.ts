import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./integration", testMatch: "login-entry.pw.ts", timeout: 30_000, workers: 1,
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:3223", viewport: { width: 1920, height: 1080 }, trace: "retain-on-failure" },
  webServer: [
    { cwd: path.resolve(__dirname, ".."), command: "node tests/fixtures/login-entry-auth-server.mjs", url: "http://127.0.0.1:3224/health", reuseExistingServer: false },
    { cwd: path.resolve(__dirname, ".."), command: "npm run dev -- --webpack -H 127.0.0.1 -p 3223", url: "http://127.0.0.1:3223/login", reuseExistingServer: false, timeout: 120_000,
      env: { NEXT_PUBLIC_AUTH_MODE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:3224", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key" } },
  ],
});
