import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, APIResponse } from "@playwright/test";

const workspaceId = "workspace-a";

async function postInvitation(
  request: APIRequestContext,
  options: {
    actor?: string;
    email?: string;
    roles?: string[];
    workspaceId?: string;
  }
) {
  return request.post(
    `/api/workspaces/${options.workspaceId ?? workspaceId}/invitations`,
    {
      headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
      data: {
        email: options.email ?? "VET@HANBIT.TEST",
        roles: options.roles ?? ["vet", "front_desk"],
        title: "진료팀장",
        department: "진료팀",
      },
    }
  );
}

test("workspace invitation route creates pending invitation for hospital admin", async ({
  request,
}) => {
  const response = await postInvitation(request, { actor: "user-admin" });

  expect(response.status()).toBe(201);
  await expectJson(response, {
    ok: true,
    workspaceId,
    enforcedBy: "workspace-invitation-server-route",
  });

  const json = await response.json();
  expect(json.invitation).toMatchObject({
    workspaceId,
    email: "vet@hanbit.test",
    invitedRoles: ["vet", "front_desk"],
    title: "진료팀장",
    department: "진료팀",
    status: "pending",
    invitedBySessionId: "user-admin",
  });
  expect(json.emailDelivery).toBe("not_sent_approval_gated");
  expect(json.inviteLink).toBe("not_generated_approval_gated");
  expect(JSON.stringify(json)).not.toMatch(/token|otp|magic.?link/i);
});

test("workspace invitation route blocks duplicate pending and active member email on the server", async ({
  request,
}) => {
  const duplicateWorkspaceId = "workspace-den159-duplicates";
  const duplicate = await postInvitation(request, {
    actor: "user-admin",
    email: "PENDING.STAFF@HANBIT.TEST",
    workspaceId: duplicateWorkspaceId,
  });
  expect(duplicate.status()).toBe(409);
  await expectJson(duplicate, {
    ok: false,
    denialReason: "duplicate_pending_invitation",
  });

  const activeMember = await postInvitation(request, {
    actor: "user-admin",
    email: "active.member@hanbit.test",
    workspaceId: duplicateWorkspaceId,
  });
  expect(activeMember.status()).toBe(409);
  await expectJson(activeMember, {
    ok: false,
    denialReason: "active_membership_exists",
  });
});

test("workspace invitation route denies missing, unauthorized, and invalid requests", async ({
  request,
}) => {
  const unauthenticated = await postInvitation(request, {});
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, {
    ok: false,
    denialReason: "unauthenticated",
  });

  const missingPermission = await postInvitation(request, { actor: "user-vet" });
  expect(missingPermission.status()).toBe(403);
  await expectJson(missingPermission, {
    ok: false,
    denialReason: "permission_missing",
  });

  const invalid = await postInvitation(request, {
    actor: "user-admin",
    email: "not-an-email",
    roles: [],
  });
  expect(invalid.status()).toBe(400);
  await expectJson(invalid, {
    ok: false,
    error: "invalid_input",
  });
});

test("workspace invitation persistence boundary stays server-only", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/invitations/route.ts",
    "utf8"
  );
  const serverSource = readFileSync(
    "src/features/auth/server-workspace-invitation.ts",
    "utf8"
  );
  const emailDeliverySource = readFileSync(
    "src/features/auth/workspace-invitation-email-delivery.ts",
    "utf8"
  );
  const migrationSource = readFileSync(
    "supabase/migrations/20260518122000_workspace_invitation_create_transaction.sql",
    "utf8"
  );

  expect(routeSource).toContain("createWorkspaceInvitation");
  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseWorkspacePermissionGateway");
  expect(serverSource).toContain('import "server-only"');
  expect(serverSource).not.toMatch(/sessionStorage|localStorage|window\\./);
  expect(`${serverSource}\n${emailDeliverySource}`).toContain("not_sent_approval_gated");
  expect(`${serverSource}\n${emailDeliverySource}`).toContain("not_generated_approval_gated");
  expect(serverSource).not.toMatch(/inviteToken|rawToken|magicLink|otp/i);
  expect(migrationSource).toContain("clair_create_workspace_invitation");
  expect(migrationSource).toContain("role_permission:manage");
  expect(migrationSource).toContain("duplicate_pending_invitation");
  expect(migrationSource).toContain("active_membership_exists");
  expect(migrationSource).not.toMatch(/service_role|supabase_secret|db_password/i);
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
