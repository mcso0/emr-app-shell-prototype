import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const protectedRoutes = [
  "src/app/api/workspaces/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/resend/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/cancel/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/accept/route.ts",
  "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts",
  "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/status/route.ts",
  "src/app/api/workspaces/[workspaceId]/reception/patient-guardian-registration/route.ts",
  "src/app/api/workspaces/[workspaceId]/reception/walk-in-encounters/route.ts",
  "src/app/api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in/route.ts",
  "src/app/api/users/me/profile/route.ts",
];

test("workspace mutation routes pass through the shared rate limit boundary", () => {
  const limiterSource = readFileSync("src/lib/security/rate-limit.ts", "utf8");

  expect(limiterSource).toContain('import "server-only"');
  expect(limiterSource).toContain("Retry-After");
  expect(limiterSource).toContain("rate_limited");

  for (const routePath of protectedRoutes) {
    const source = readFileSync(routePath, "utf8");
    expect(source).toContain("enforceWorkspaceMutationRateLimit");
  }
});

test("personal profile mutation returns 429 before repeated writes continue", async ({
  request,
}, testInfo) => {
  const actor = `rate-limit-${testInfo.workerIndex}-${Date.now()}`;
  const headers = { "x-clair-demo-session-user-id": actor };
  const data = {
    displayName: "Rate Limit User",
    initials: "RL",
    phone: "010-9999-0000",
    notificationOptIn: false,
  };

  for (let index = 0; index < 60; index += 1) {
    const response = await request.patch("/api/users/me/profile", { headers, data });
    expect(response.status(), `request ${index + 1}`).toBe(200);
  }

  const limited = await request.patch("/api/users/me/profile", { headers, data });
  expect(limited.status()).toBe(429);
  expect(limited.headers()["retry-after"]).toBeTruthy();
  await expect(limited.json()).resolves.toMatchObject({
    ok: false,
    error: "rate_limited",
  });
});
