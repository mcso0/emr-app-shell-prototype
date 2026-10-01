import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./tests", testMatch: /(?:patient-latest-vitals-client|patient-vital-server|workspace-vital-settings-model|workspace-vital-settings-server|reception-encounter-vital-server)\.spec\.ts/, workers: 1, use: { browserName: "chromium", headless: true }, reporter: "list" });
