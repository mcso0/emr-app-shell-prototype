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
    enforcedBy: "workspace-invitation-lifecycle-server-route",
  });

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
  expect(serverSource).toContain('import "server-only"');
  expect(serverSource).not.toMatch(/sessionStorage|localStorage|window\\./);
  expect(migrationSource).toContain("clair_resend_workspace_invitation");
  expect(migrationSource).toContain("clair_cancel_workspace_invitation");
  expect(migrationSource).toContain("clair_accept_workspace_invitation");
  expect(migrationSource).toContain("invitation_not_pending");
  expect(migrationSource).not.toMatch(/service_role|supabase_secret|db_password/i);
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
