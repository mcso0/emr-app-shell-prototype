import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// No web server, browser, env files or hosted service is needed for these mocks.
export default defineConfig({
  cacheDir: "node_modules/.cache/frontend-refresh",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/notification-poll-sharing.test.ts", "tests/notification-session-lifecycle.test.ts", "tests/billing-assignment-refresh.test.ts", "tests/shared-read-resources.test.ts", "tests/visible-refresh.test.ts", "tests/workspace-staff-heartbeat.test.ts", "tests/workspace-tabs-store.test.ts", "tests/workspace-tab-warning-preference.test.ts"],
  },
});
