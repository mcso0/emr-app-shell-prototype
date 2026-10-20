import { defineConfig } from "@playwright/test";

// The spec starts a loopback-only harness and blocks all external requests.
// It needs no Next server, hosted service, credentials, or environment files.
export default defineConfig({
  testDir: "./tests",
  testMatch: "notification-poll-sharing-browser.spec.ts",
  timeout: 30_000,
  workers: 1,
  use: { browserName: "chromium", headless: true },
});
