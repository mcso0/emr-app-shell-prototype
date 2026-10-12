import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Feature-local fetch mocks; no server, browser, env files or hosted API.
export default defineConfig({
  cacheDir: "node_modules/.cache/chart-catalog",
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/chart-order-catalog-client.test.ts"],
  },
});
