import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// No web server, browser, env files or hosted service is needed for these mocks.
export default defineConfig({
  cacheDir: "node_modules/.cache/frontend-refresh",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/visible-refresh.test.ts", "tests/workspace-staff-heartbeat.test.ts", "tests/workspace-tabs-store.test.ts"],
  },
});
