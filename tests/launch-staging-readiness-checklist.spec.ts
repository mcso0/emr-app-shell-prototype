import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const checklistPath =
  "docs/engineering/auth-security/auth-login/staging-secret-deployment-readiness-checklist.md";

test("staging readiness checklist gives a non-developer launch gate summary", () => {
  expect(existsSync(checklistPath)).toBe(true);
  const source = readFileSync(checklistPath, "utf8");

  for (const section of [
    "Non-Developer Go/No-Go Summary",
    "Staging Env Variable Checklist",
    "Secret Handling And Scanning Checklist",
    "Supabase Staging Validation Checklist",
    "Email Sender Checklist",
    "Deploy And Rollback Preflight",
    "Blocked Or Ready Decision Table",
  ]) {
    expect(source).toContain(`## ${section}`);
  }

  expect(source).toContain("READY");
  expect(source).toContain("BLOCKED");
  expect(source).toContain("승욱 explicit approval required");
});

test("staging readiness checklist separates public env from server-only secrets", () => {
  const source = readFileSync(checklistPath, "utf8");

  for (const publicEnv of [
    "NEXT_PUBLIC_AUTH_MODE",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ]) {
    expect(source).toContain(publicEnv);
  }

  for (const secretName of [
    "Supabase secret key",
    "service_role",
    "Database password",
    "Postgres connection string",
    "Supabase CLI personal access token",
    "Email provider API key",
  ]) {
    expect(source).toContain(secretName);
  }

  expect(source).toContain("npm run security:secrets");
  expect(source).toContain("npm run build");
  expect(source).toContain("npm run docs:check");
});

test("staging readiness checklist references existing approval and env source docs", () => {
  const source = readFileSync(checklistPath, "utf8");

  expect(source).toContain("auth-db-env-secret-verification-gates.md");
  expect(source).toContain("saas-launch-approval-gates.md");
  expect(source).toContain("supabase-integration-readiness.md");
  expect(source).toContain("launch-rate-limit-abuse-handling.md");
  expect(source).not.toMatch(
    /sk_live_|sbp_[A-Za-z0-9_-]{24,}|service_role\\s*[:=]|DATABASE_URL\\s*=|SMTP_PASSWORD\\s*=|RESEND_API_KEY\\s*=/
  );
});
