import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, APIResponse } from "@playwright/test";

const workspaceId = "workspace-a";
const invitationId = "invitation-pending";

async function postLifecycle(
  request: APIRequestContext,
  action: "resend" | "cancel" | "accept",
  options: { actor?: string; workspaceId?: string; invitationId?: string } = {}
) {
  return request.post(
    `/api/workspaces/${options.workspaceId ?? workspaceId}/invitations/${options.invitationId ?? invitationId}/${action}`,
    {
      headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
    }
  );
}

test("invitation resend and cancel routes require admin permission", async ({ request }) => {
  const resend = await postLifecycle(request, "resend", { actor: "user-admin" });
  expect(resend.status()).toBe(200);
  await expectJson(resend, {
    ok: true,
    workspaceId,
    invitationId,
    action: "resend",
    status: "pending",
    resendCount: 1,
    enforcedBy: "workspace-invitation-lifecycle-server-route",
  });
  const resendBody = await resend.json();
  expect(resendBody.resentAt).toEqual(expect.any(String));
  expect(resendBody.auditEvents).toEqual([
    expect.objectContaining({
      type: "workspace.invitation_resent",
      workspaceId,
      invitationId,
      actorUserId: "user-admin",
    }),
  ]);

  const cancel = await postLifecycle(request, "cancel", { actor: "user-admin" });
  expect(cancel.status()).toBe(200);
  await expectJson(cancel, {
    ok: true,
    workspaceId,
    invitationId,
    action: "cancel",
    status: "canceled",
    enforcedBy: "workspace-invitation-lifecycle-server-route",
  });
  const cancelBody = await cancel.json();
  expect(cancelBody.canceledAt).toEqual(expect.any(String));
  expect(cancelBody.auditEvents).toEqual([
    expect.objectContaining({
      type: "workspace.invitation_canceled",
      workspaceId,
      invitationId,
      actorUserId: "user-admin",
    }),
  ]);

  const denied = await postLifecycle(request, "cancel", { actor: "user-vet" });
  expect(denied.status()).toBe(403);
  await expectJson(denied, { ok: false, denialReason: "permission_missing" });
});

test("invitation accept route creates active membership for invited actor", async ({ request }) => {
  const response = await postLifecycle(request, "accept", { actor: "user-vet" });

  expect(response.status()).toBe(200);
  await expectJson(response, {
    ok: true,
    workspaceId,
    invitationId,
    action: "accept",
    status: "accepted",
    enforcedBy: "workspace-invitation-lifecycle-server-route",
  });

  const body = await response.json();
  expect(body.membership).toMatchObject({
    workspaceId,
    userSessionId: "user-vet",
    roles: ["vet"],
    status: "active",
  });
  expect(body.auditEvents).toEqual([
    expect.objectContaining({
      type: "workspace.invitation_accepted",
      workspaceId,
      invitationId,
      actorUserId: "user-vet",
    }),
  ]);
});

test("invitation lifecycle blocks expired canceled accepted and unknown invite acceptance", async ({
  request,
}) => {
  const expired = await postLifecycle(request, "accept", {
    actor: "user-vet",
    invitationId: "invitation-expired",
  });
  expect(expired.status()).toBe(409);
  await expectJson(expired, { ok: false, denialReason: "invitation_expired" });
  expect((await expired.json()).membership).toBeUndefined();

  const canceled = await postLifecycle(request, "accept", {
    actor: "user-vet",
    invitationId: "invitation-canceled",
  });
  expect(canceled.status()).toBe(409);
  await expectJson(canceled, { ok: false, denialReason: "invitation_not_pending" });
  expect((await canceled.json()).membership).toBeUndefined();

  const accepted = await postLifecycle(request, "accept", {
    actor: "user-vet",
    invitationId: "invitation-accepted",
  });
  expect(accepted.status()).toBe(409);
  await expectJson(accepted, { ok: false, denialReason: "invitation_not_pending" });
  expect((await accepted.json()).membership).toBeUndefined();

  const unknown = await postLifecycle(request, "accept", {
    actor: "user-vet",
    invitationId: "unknown-invitation",
  });
  expect(unknown.status()).toBe(404);
  await expectJson(unknown, { ok: false, denialReason: "target_invitation_missing" });
  expect((await unknown.json()).membership).toBeUndefined();
});

test("invitation lifecycle route validates session and keeps server-owned DB functions", async ({
  request,
}) => {
  const unauthenticated = await postLifecycle(request, "resend");
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const resendRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/invitations/[invitationId]/resend/route.ts",
    "utf8"
  );
  const serverSource = readFileSync(
    "src/features/auth/server-workspace-invitation-lifecycle.ts",
    "utf8"
  );
  const migrationSource = readFileSync(
    "supabase/migrations/20260518123000_workspace_invitation_lifecycle_transactions.sql",
    "utf8"
  );

  expect(resendRoute).toContain("mutateWorkspaceInvitationLifecycle");
  expect(resendRoute).toContain("createPermissionAdapterFromMembershipStatus");
  expect(resendRoute).toContain("createResendWorkspaceInvitationEmailDelivery");
  expect(resendRoute).toContain("createSupabaseWorkspaceMembershipStatusGateway");
  expect(serverSource).toContain('import "server-only"');
  expect(serverSource).not.toMatch(/sessionStorage|localStorage|window\\./);
  expect(serverSource).toContain("workspace.invitation_resent");
  expect(serverSource).toContain("workspace.invitation_canceled");
  expect(serverSource).toContain("workspace.invitation_accepted");
  expect(serverSource).toContain("invitation_expired");
  expect(migrationSource).toContain("clair_resend_workspace_invitation");
  expect(migrationSource).toContain("clair_cancel_workspace_invitation");
  expect(migrationSource).toContain("clair_accept_workspace_invitation");
  expect(migrationSource).toContain("invitation_not_pending");
  expect(migrationSource).not.toMatch(/service_role|supabase_secret|db_password/i);
});

test("invite acceptance DB function links OTP-authenticated users into app users", () => {
  const migrationSource = readFileSync(
    "supabase/migrations/20260524121000_invite_acceptance_app_user_upsert.sql",
    "utf8"
  );

  expect(migrationSource).toContain("create or replace function public.clair_accept_workspace_invitation");
  expect(migrationSource).toContain("auth.uid()");
  expect(migrationSource).toContain("auth.jwt() ->> 'email'");
  expect(migrationSource).toContain("insert into public.users");
  expect(migrationSource).toContain("on conflict (id) do update");
  expect(migrationSource).toContain("v_app_user_email <> v_invitation.email");
  expect(migrationSource).toContain("public.user_memberships");
  expect(migrationSource).not.toMatch(/service_role|supabase_secret|db_password/i);
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
