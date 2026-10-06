import { defineConfig } from "@playwright/test";

// Own the server: never attach these synthetic tests to an existing or hosted app.
const baseURL = "http://127.0.0.1:3194";

export default defineConfig({
  testDir: "./tests",
  testMatch: "chart-order-save-session-browser.spec.ts",
  outputDir: "test-results/chart-save-session",
  timeout: 45_000,
  workers: 1,
  retries: 0,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    browserName: "chromium",
    serviceWorkers: "block",
    viewport: { width: 1920, height: 1080 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/fixtures/chart-order-save-session-server.mjs",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
