import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, APIResponse } from "@playwright/test";

import {
  assertLastWorkspaceAdminGuard,
  createMockWorkspacePermissionAdapter,
} from "../src/features/auth/permission-resolver";
import {
  MOCK_AUTH_STORAGE_KEY,
  type MockAuthSession,
} from "../src/features/auth/mock-session";
import {
  SESSION_WORKSPACES_STORAGE_KEY,
  type SessionWorkspacesState,
} from "../src/features/auth/workspace-session";

async function postRoleUpdate(
  request: APIRequestContext,
  options: { actor?: string; membershipId?: string; roles?: string[] } = {}
) {
  return request.post(
    `/api/workspaces/workspace-a/memberships/${options.membershipId ?? "membership-vet"}/roles`,
    {
      headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
      data: { roles: options.roles ?? ["vet", "front_desk"] },
    }
  );
}

async function patchMembershipStatus(
  request: APIRequestContext,
  options: { actor?: string; membershipId?: string; status?: string } = {}
) {
  return request.patch(
    `/api/workspaces/workspace-a/memberships/${options.membershipId ?? "membership-vet"}/status`,
    {
      headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
      data: { status: options.status ?? "inactive" },
    }
  );
}

test("launch role routes deny last-admin demotion and deactivation", async ({
  request,
}) => {
  const demotion = await postRoleUpdate(request, {
    actor: "user-admin",
    membershipId: "membership-admin",
    roles: ["vet"],
  });
  expect(demotion.status()).toBe(409);
  await expectJson(demotion, {
    ok: false,
    denialReason: "last_admin_protected",
  });

  const deactivation = await patchMembershipStatus(request, {
    actor: "user-admin",
    membershipId: "membership-admin",
    status: "inactive",
  });
  expect(deactivation.status()).toBe(409);
  await expectJson(deactivation, {
    ok: false,
    denialReason: "last_admin_protected",
  });
});

test("role-change guard permits demoting one admin only after another active admin exists", () => {
  const singleAdminAdapter = createMockWorkspacePermissionAdapter({
    users: [{ id: "user-admin", status: "active" }],
    memberships: [
      {
        id: "membership-admin",
        workspaceId: "workspace-a",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
    ],
  });
  expect(
    assertLastWorkspaceAdminGuard(singleAdminAdapter, {
      workspaceId: "workspace-a",
      targetMembershipId: "membership-admin",
      nextRoles: ["vet"],
      nextStatus: "active",
    })
  ).toMatchObject({
    allowed: false,
    denialReason: "last_admin_protected",
  });

  const twoAdminAdapter = createMockWorkspacePermissionAdapter({
    users: [
      { id: "user-admin", status: "active" },
      { id: "user-admin-2", status: "active" },
    ],
    memberships: [
      {
        id: "membership-admin",
        workspaceId: "workspace-a",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-admin-2",
        workspaceId: "workspace-a",
        userId: "user-admin-2",
        roles: ["hospital_admin"],
        status: "active",
      },
    ],
  });
  expect(
    assertLastWorkspaceAdminGuard(twoAdminAdapter, {
      workspaceId: "workspace-a",
      targetMembershipId: "membership-admin",
      nextRoles: ["vet"],
      nextStatus: "active",
    })
  ).toMatchObject({ allowed: true });
});

test("invited hospital admin acceptance creates a second active admin membership", async ({
  page,
}) => {
  await page.addInitScript(
    ({ authKey, workspaceKey }) => {
      window.localStorage.removeItem(authKey);
      window.sessionStorage.removeItem(authKey);
      window.localStorage.removeItem(workspaceKey);
      window.sessionStorage.removeItem(workspaceKey);
    },
    {
      authKey: MOCK_AUTH_STORAGE_KEY,
      workspaceKey: SESSION_WORKSPACES_STORAGE_KEY,
    }
  );

  await page.goto(
    "/invite/invitation-admin-pending?workspaceId=workspace-a&email=admin2@hanbit.test"
  );

  await expect(page.getByRole("heading", { name: "초대 수락" })).toBeVisible();
  await expect(page.getByText("병원관리자")).toBeVisible();

  const acceptResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(
        "/api/workspaces/workspace-a/invitations/invitation-admin-pending/accept"
      ) && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "초대 수락하고 워크스페이스 열기" }).click();
  expect((await acceptResponse).status()).toBe(200);

  const authSession = await page.evaluate((storageKey) => {
    return JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as MockAuthSession | null;
  }, MOCK_AUTH_STORAGE_KEY);
  expect(authSession).toMatchObject({
    id: "invitee:admin2@hanbit.test",
    role: "hospital_admin",
  });

  const workspaceState = await page.evaluate((storageKey) => {
    return JSON.parse(
      window.localStorage.getItem(storageKey) ?? "null"
    ) as SessionWorkspacesState | null;
  }, SESSION_WORKSPACES_STORAGE_KEY);
  expect(workspaceState?.memberships).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        workspaceId: "workspace-a",
        userSessionId: "invitee:admin2@hanbit.test",
        email: "admin2@hanbit.test",
        roles: ["hospital_admin"],
        status: "active",
      }),
    ])
  );
});

test("role-change launch safety handoff keeps route and DB guard surfaces discoverable", () => {
  const roleRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts",
    "utf8"
  );
  const statusRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/status/route.ts",
    "utf8"
  );
  const dbWriteMigration = readFileSync(
    "supabase/migrations/20260518125000_workspace_role_status_write_transactions.sql",
    "utf8"
  );

  expect(roleRoute).toContain("readServerSession");
  expect(roleRoute).toContain("authorizeWorkspaceRoleUpdate");
  expect(statusRoute).toContain("authorizeWorkspaceRoleUpdate");
  expect(dbWriteMigration).toContain("protect_last_active_hospital_admin");
  expect(dbWriteMigration).toContain("private.update_workspace_membership_roles");
  expect(dbWriteMigration).toContain("public.clair_update_workspace_membership_status");
  expect(dbWriteMigration).toContain("p_next_status");
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
