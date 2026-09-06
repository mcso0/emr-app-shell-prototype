import { defineConfig } from "@playwright/test";

// These server contracts inject in-memory clients; no app server or DB is used.
export default defineConfig({
  testDir: "./tests",
  testMatch: [
    "chart-actual-contract.spec.ts",
    "inpatient-location-contract.spec.ts",
    "lab-result-profile-contract.spec.ts",
    "execution-result-contract.spec.ts",
    "treatment-planning-v2.spec.ts",
    "hospital-admin-catalog-scope.spec.ts",
    "hospital-admin-order-catalog-server.spec.ts",
    "hospital-admin-order-catalog-read-failures.spec.ts",
    "hospital-admin-persisted-defaults.spec.ts",
    "hospital-admin-classification-core.spec.ts",
    "hospital-admin-taxonomy-read.spec.ts",
    "chart-order-execution-domain.spec.ts",
    "plan-order-authority-domain.spec.ts",
  ],
  workers: 1,
  reporter: "list",
});
