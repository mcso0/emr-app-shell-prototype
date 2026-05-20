import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, APIResponse } from "@playwright/test";

const launchProtectedMutationRoutes = [
  "src/app/api/ops/tenant-applications/[applicationId]/workspace/route.ts",
  "src/app/api/workspaces/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/resend/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/cancel/route.ts",
  "src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/accept/route.ts",
  "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts",
  "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/status/route.ts",
  "src/app/api/users/me/profile/route.ts",
];

async function postOpsTenantWorkspace(request: APIRequestContext, actor: string) {
  return request.post("/api/ops/tenant-applications/tenant-app-hanbit/workspace", {
    headers: { "x-clair-demo-session-user-id": actor },
    data: {
      firstAdminEmail: "rate.first.admin@hanbit.test",
      firstAdminDisplayName: "레이트리밋",
    },
  });
}

test("launch-critical auth invite ops and role mutation routes share rate-limit boundary", () => {
  const limiterSource = readFileSync("src/lib/security/rate-limit.ts", "utf8");

  expect(limiterSource).toContain('import "server-only"');
  expect(limiterSource).toContain("Retry-After");
  expect(limiterSource).toContain("rate_limited");
  expect(limiterSource).not.toMatch(/password|secret|token|serviceRole|stackTrace|sqlError/i);

  for (const routePath of launchProtectedMutationRoutes) {
    const source = readFileSync(routePath, "utf8");
    expect(source).toContain("enforceWorkspaceMutationRateLimit");
  }
});

test("ops tenant workspace action returns safe 429 envelope after repeated attempts", async ({
  request,
}, testInfo) => {
  const actor = `clair-operator-rate-${testInfo.workerIndex}-${Date.now()}`;

  for (let index = 0; index < 60; index += 1) {
    const response = await postOpsTenantWorkspace(request, actor);
    expect(response.status(), `request ${index + 1}`).not.toBe(429);
  }

  const limited = await postOpsTenantWorkspace(request, actor);
  expect(limited.status()).toBe(429);
  expect(limited.headers()["retry-after"]).toBeTruthy();
  await expectJson(limited, {
    ok: false,
    error: "rate_limited",
  });
  expect(JSON.stringify(await limited.json())).not.toMatch(
    /password|secret|token|serviceRole|rawPayload|stackTrace|sqlError/i
  );
});

test("invite duplicate handling remains a conflict and does not leak raw invitation secrets", async ({
  request,
}) => {
  const response = await request.post("/api/workspaces/workspace-den168/invitations", {
    headers: { "x-clair-demo-session-user-id": "user-admin" },
    data: {
      email: "pending.staff@hanbit.test",
      roles: ["vet"],
      title: "진료팀",
      department: "진료",
    },
  });

  expect(response.status()).toBe(409);
  await expectJson(response, {
    ok: false,
    denialReason: "duplicate_pending_invitation",
  });
  expect(JSON.stringify(await response.json())).not.toMatch(
    /inviteToken|magicLink|otp|password|secret|serviceRole|stackTrace|sqlError/i
  );
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
