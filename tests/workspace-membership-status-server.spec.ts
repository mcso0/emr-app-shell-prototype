import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, APIResponse } from "@playwright/test";

async function getMembershipStatus(
  request: APIRequestContext,
  options: { actor?: string; workspaceId?: string } = {}
) {
  return request.get(`/api/workspaces/${options.workspaceId ?? "workspace-a"}/memberships`, {
    headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
  });
}

test("workspace membership status route requires admin read permission", async ({
  request,
}) => {
  const unauthenticated = await getMembershipStatus(request);
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const denied = await getMembershipStatus(request, { actor: "user-vet" });
  expect(denied.status()).toBe(403);
  await expectJson(denied, { ok: false, denialReason: "permission_missing" });

  const admin = await getMembershipStatus(request, { actor: "user-admin" });
  expect(admin.status()).toBe(200);
  await expectJson(admin, {
    ok: true,
    memberships: [],
    invitations: [],
    enforcedBy: "workspace-membership-status-reader",
  });
});

test("workspace membership status route stays server-owned", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/memberships/route.ts",
    "utf8"
  );
  const readerSource = readFileSync(
    "src/features/auth/server-workspace-membership-status.ts",
    "utf8"
  );
  const migrationSource = readFileSync(
    "supabase/migrations/20260518124000_workspace_member_status_reader.sql",
    "utf8"
  );

  expect(routeSource).toContain("readWorkspaceMembershipStatus");
  expect(routeSource).toContain("readServerSession");
  expect(readerSource).toContain('import "server-only"');
  expect(readerSource).not.toMatch(/sessionStorage|localStorage|window\\./);
  expect(migrationSource).toContain("clair_list_workspace_member_statuses");
  expect(migrationSource).toContain("role_permission:view");
  expect(migrationSource).not.toMatch(/service_role|supabase_secret|db_password/i);
});

test("workspace membership UI can render persisted status rows from server", async ({
  page,
}) => {
  await page.route("**/api/workspaces/clair-demo/memberships", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        memberships: [
          {
            id: "membership-admin",
            workspaceId: "clair-demo",
            userSessionId: "user-admin",
            displayName: "송민재",
            email: "admin@clair.local",
            roles: ["hospital_admin"],
            status: "active",
            title: "병원장",
            department: "운영",
            createdAt: "2026-05-18T00:00:00.000Z",
            activatedAt: "2026-05-18T00:00:00.000Z",
            deactivatedAt: null,
          },
          {
            id: "membership-vet",
            workspaceId: "clair-demo",
            userSessionId: "user-vet",
            displayName: "이수지",
            email: "vet@clair.local",
            roles: ["vet"],
            status: "active",
            title: "수의사",
            department: "진료",
            createdAt: "2026-05-18T00:00:00.000Z",
            activatedAt: "2026-05-18T00:00:00.000Z",
            deactivatedAt: null,
          },
          {
            id: "membership-inactive",
            workspaceId: "clair-demo",
            userSessionId: "user-old",
            displayName: "비활성",
            email: "old@clair.local",
            roles: ["front_desk"],
            status: "inactive",
            title: "데스크",
            department: "원무",
            createdAt: "2026-05-18T00:00:00.000Z",
            activatedAt: null,
            deactivatedAt: "2026-05-18T01:00:00.000Z",
          },
        ],
        invitations: [
          {
            id: "invite-persisted",
            workspaceId: "clair-demo",
            email: "pending@clair.local",
            invitedRoles: ["technician"],
            title: "테크니션",
            department: "검사",
            status: "pending",
            invitedBySessionId: "user-admin",
            acceptedBySessionId: null,
            expiresAt: "2026-05-25T00:00:00.000Z",
            acceptedAt: null,
            canceledAt: null,
            resentAt: null,
            resendCount: 0,
            createdAt: "2026-05-18T00:00:00.000Z",
            updatedAt: "2026-05-18T00:00:00.000Z",
          },
        ],
        enforcedBy: "workspace-membership-status-reader",
      }),
    });
  });

  await page.goto("/login?next=%2Fw%2Fclair-demo%2Forders%3FmodulePanel%3Dopen%26aside%3Dclosed");
  await page.getByRole("button", { name: /병원 관리자/ }).click();
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByRole("button", { name: "병원구성원 관리" }).click();

  await expect(page.getByText("활성 2명")).toBeVisible();
  await expect(page.getByText("대기 1건")).toBeVisible();
  await expect(page.getByText("비활성 1명")).toBeVisible();
  await expect(page.getByText("pending@clair.local")).toBeVisible();
  await expect(page.getByText("old@clair.local")).toBeVisible();
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
