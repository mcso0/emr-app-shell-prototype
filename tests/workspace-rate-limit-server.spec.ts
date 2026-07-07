import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const protectedRoutes = [
  "src/app/api/workspaces/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/reinvite-request/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/resend/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/cancel/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/accept/route.ts",
  "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts",
  "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/status/route.ts",
  "src/app/api/workspaces/[workspaceId]/demo/session-reset/route.ts",
  "src/app/api/workspaces/[workspaceId]/lab-imaging/result-entries/route.ts",
  "src/app/api/workspaces/[workspaceId]/reception/patient-guardian-registration/route.ts",
  "src/app/api/workspaces/[workspaceId]/reception/walk-in-encounters/route.ts",
  "src/app/api/workspaces/[workspaceId]/reception/appointments/[appointmentId]/check-in/route.ts",
  "src/app/api/users/me/profile/route.ts",
];

const notificationMutationRoutes = [
  "src/app/api/workspaces/[workspaceId]/notifications/[notificationId]/archive/route.ts",
  "src/app/api/workspaces/[workspaceId]/notifications/[notificationId]/read/route.ts",
  "src/app/api/workspaces/[workspaceId]/notifications/[notificationId]/restore/route.ts",
  "src/app/api/workspaces/[workspaceId]/notifications/order-recheck-requests/route.ts",
  "src/app/api/workspaces/[workspaceId]/notifications/read-all/route.ts",
];

test("workspace mutation routes pass through the shared rate limit boundary", () => {
  const limiterSource = readFileSync("src/lib/security/rate-limit.ts", "utf8");

  expect(limiterSource).toContain('import "server-only"');
  expect(limiterSource).toContain("Retry-After");
  expect(limiterSource).toContain("rate_limited");

  for (const routePath of protectedRoutes) {
    const source = readFileSync(routePath, "utf8");
    expect(source).toMatch(
      /enforceWorkspaceMutationRateLimit|enforceRequestRateLimit/,
    );
  }

  const notificationActorSource = readFileSync(
    "src/features/notifications/server-notifications-route.ts",
    "utf8",
  );
  expect(notificationActorSource).toContain("enforceWorkspaceMutationRateLimit");

  for (const routePath of notificationMutationRoutes) {
    const source = readFileSync(routePath, "utf8");
    expect(source).toContain("mutationRateLimitOperation");
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

test("lab result entry mutation returns 429 before repeated writes continue", async ({
  request,
}, testInfo) => {
  const actor = `lab-rate-limit-${testInfo.workerIndex}-${Date.now()}`;
  const headers = { "x-clair-demo-session-user-id": actor };
  const data = {
    resultId: `rate-limit-result-${testInfo.workerIndex}-${Date.now()}`,
    rows: [
      {
        analyteName: "WBC",
        id: "wbc",
        value: "10.2",
      },
    ],
  };

  for (let index = 0; index < 60; index += 1) {
    const response = await request.post(
      "/api/workspaces/clair-demo/lab-imaging/result-entries",
      { headers, data },
    );
    expect(response.status(), `request ${index + 1}`).not.toBe(429);
  }

  const limited = await request.post(
    "/api/workspaces/clair-demo/lab-imaging/result-entries",
    { headers, data },
  );
  expect(limited.status()).toBe(429);
  expect(limited.headers()["retry-after"]).toBeTruthy();
  await expect(limited.json()).resolves.toMatchObject({
    ok: false,
    error: "rate_limited",
  });
});

test("notification mutation returns 429 before repeated writes continue", async ({
  request,
}, testInfo) => {
  const actor = `notification-rate-limit-${testInfo.workerIndex}-${Date.now()}`;
  const headers = { "x-clair-demo-session-user-id": actor };

  for (let index = 0; index < 60; index += 1) {
    const response = await request.post(
      "/api/workspaces/clair-demo/notifications/rate-limit-notification/read",
      { headers },
    );
    expect(response.status(), `request ${index + 1}`).not.toBe(429);
  }

  const limited = await request.post(
    "/api/workspaces/clair-demo/notifications/rate-limit-notification/read",
    { headers },
  );
  expect(limited.status()).toBe(429);
  expect(limited.headers()["retry-after"]).toBeTruthy();
  await expect(limited.json()).resolves.toMatchObject({
    ok: false,
    error: "rate_limited",
  });
});
