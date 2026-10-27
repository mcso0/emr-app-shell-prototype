import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Run against this worktree's mock production build, never an existing server.
// Build first with NEXT_PUBLIC_AUTH_MODE=mock; no hosted credentials are needed.
const baseURL = "http://127.0.0.1:3417";
export default defineConfig({
  ...base,
  testMatch: ["queue-read-browser.spec.ts", "fulfillment-queue-lifecycle.spec.ts", "reception-read-coordinator.spec.ts", "reception-read-performance.spec.ts", "dispensing-fulfillment.spec.ts", "fulfillment-eligible-assignees-ui.spec.ts"],
  timeout: 60_000,
  use: {
    ...base.use, baseURL,
    storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: "clair.mockAuth.session.v1", value: JSON.stringify({ id: "playwright-default-session", role: "hospital_admin", roleLabel: "병원 관리자", storageMode: "local", issuedAt: "2026-05-02T00:00:00.000Z" }) }] }] },
  },
  webServer: { command: "npm run start -- -H 127.0.0.1 -p 3417", url: baseURL, reuseExistingServer: false, env: { NEXT_PUBLIC_AUTH_MODE: "mock", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" } },
});
