import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const devServerUrl = new URL(baseURL);

const mockAuthSession = {
  id: "playwright-default-session",
  role: "hospital_admin",
  roleLabel: "병원 관리자",
  storageMode: "local",
  issuedAt: "2026-05-02T00:00:00.000Z",
};

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            {
              name: "clair.mockAuth.session.v1",
              value: JSON.stringify(mockAuthSession),
            },
          ],
        },
      ],
    },
    trace: "on-first-retry",
    viewport: { width: 1920, height: 1080 },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- -H ${devServerUrl.hostname} -p ${devServerUrl.port || "3000"}`,
    env: {
      NEXT_PUBLIC_AUTH_MODE: "mock",
    },
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
