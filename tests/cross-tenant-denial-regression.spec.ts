import { expect, test } from "@playwright/test";
import type { APIRequestContext, APIResponse } from "@playwright/test";

import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
} from "../src/features/auth/permission-resolver";
import {
  createMockReceptionPatientGuardianLookupGateway,
  lookupReceptionPatientGuardians,
} from "../src/features/reception/server-patient-guardian-lookup-core";

const workspaceA = "workspace-a";
const workspaceB = "workspace-b";
const adminA = "user-admin";

async function createInvitationInWorkspace(
  request: APIRequestContext,
  workspaceId: string,
  actor: string
) {
  return request.post(`/api/workspaces/${workspaceId}/invitations`, {
    headers: { "x-clair-demo-session-user-id": actor },
    data: {
      email: "cross.tenant.staff@hanbit.test",
      roles: ["vet"],
      title: "진료팀장",
      department: "진료",
    },
  });
}

async function getMemberships(
  request: APIRequestContext,
  workspaceId: string,
  actor: string
) {
  return request.get(`/api/workspaces/${workspaceId}/memberships`, {
    headers: { "x-clair-demo-session-user-id": actor },
  });
}

async function resendInvitation(
  request: APIRequestContext,
  workspaceId: string,
  actor: string
) {
  return request.post(
    `/api/workspaces/${workspaceId}/invitations/invitation-pending/resend`,
    {
      headers: { "x-clair-demo-session-user-id": actor },
    }
  );
}

test("workspace admin from tenant A cannot manage tenant B invitations or memberships", async ({
  request,
}) => {
  const ownWorkspaceInvitation = await createInvitationInWorkspace(
    request,
    workspaceA,
    adminA
  );
  expect(ownWorkspaceInvitation.status()).toBe(201);

  const foreignInvitation = await createInvitationInWorkspace(
    request,
    workspaceB,
    adminA
  );
  expect(foreignInvitation.status()).toBe(403);
  await expectJson(foreignInvitation, {
    ok: false,
    denialReason: "workspace_membership_missing",
  });

  const foreignMemberships = await getMemberships(request, workspaceB, adminA);
  expect(foreignMemberships.status()).toBe(403);
  await expectJson(foreignMemberships, {
    ok: false,
    denialReason: "workspace_membership_missing",
  });

  const foreignResend = await resendInvitation(request, workspaceB, adminA);
  expect(foreignResend.status()).toBe(403);
  await expectJson(foreignResend, {
    ok: false,
    denialReason: "workspace_membership_missing",
  });
});

test("clinical patient and encounter handoff permissions stay scoped to the active workspace", async () => {
  const adapter = createTwoWorkspacePermissionFixture();

  for (const requiredPermission of ["patient:view", "encounter:view"] as const) {
    const result = resolveWorkspacePermission(adapter, {
      sessionUserId: adminA,
      workspaceId: workspaceB,
      requiredPermission,
    });

    expect(result.allowed).toBe(false);
    expect(result.denialReason).toBe("workspace_membership_missing");
  }

  const receptionLookup = await lookupReceptionPatientGuardians({
    actorUserId: adminA,
    workspaceId: workspaceB,
    query: "콩",
    permissionAdapter: adapter,
    gateway: createMockReceptionPatientGuardianLookupGateway(),
  });

  expect(receptionLookup).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "workspace_membership_missing",
  });
});

test("cross-tenant denial redirects users to the existing unauthorized login notice", async ({
  page,
}) => {
  await page.goto(
    "/login?reason=unauthorized&next=%2Fw%2Fworkspace-b%2Freception%3FmodulePanel%3Dopen%26aside%3Dclosed"
  );

  await expect(page.getByTestId("auth-session-notice")).toContainText(
    "이 워크스페이스에 접근할 권한이 없습니다."
  );
});

function createTwoWorkspacePermissionFixture() {
  return createMockWorkspacePermissionAdapter({
    now: "2026-05-20T00:00:00.000Z",
    users: [
      { id: adminA, status: "active", displayName: "송민재" },
      { id: "user-admin-b", status: "active", displayName: "김하늘" },
    ],
    memberships: [
      {
        id: "membership-admin-a",
        workspaceId: workspaceA,
        userId: adminA,
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-admin-b",
        workspaceId: workspaceB,
        userId: "user-admin-b",
        roles: ["hospital_admin"],
        status: "active",
      },
    ],
  });
}

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
