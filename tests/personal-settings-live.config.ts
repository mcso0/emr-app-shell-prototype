import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./integration",
  testMatch: "personal-settings-live.pw.ts",
  timeout: 30_000,
  workers: 1,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:43114",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      cwd: path.resolve(__dirname, ".."),
      command: "node tests/fixtures/personal-settings-auth-server.mjs",
      url: "http://127.0.0.1:43113/health",
      reuseExistingServer: false,
    },
    {
      cwd: path.resolve(__dirname, ".."),
      command: "npm run dev -- -H 127.0.0.1 -p 43114",
      url: "http://127.0.0.1:43114/reset-password",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_AUTH_MODE: "supabase",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:43113",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
      },
    },
  ],
});
