import { defineConfig, devices } from "@playwright/test";

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
    baseURL: "http://127.0.0.1:3000",
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:3000",
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
    command: "npm run dev -- -H 127.0.0.1",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
