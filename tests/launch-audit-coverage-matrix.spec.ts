import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, APIResponse } from "@playwright/test";

async function postWorkspaceCreation(request: APIRequestContext) {
  return request.post("/api/workspaces", {
    headers: { "x-clair-demo-session-user-id": "user-admin" },
    data: {
      hospitalName: "Audit Animal Hospital",
      adminDisplayName: "김감사",
      contactEmail: "audit.owner@hanbit.test",
      contactPhone: "010-0000-1111",
    },
  });
}

async function postStaffInvitation(request: APIRequestContext) {
  return request.post("/api/workspaces/workspace-a/invitations", {
    headers: { "x-clair-demo-session-user-id": "user-admin" },
    data: {
      email: "audit.staff@hanbit.test",
      roles: ["vet", "front_desk"],
      title: "진료팀장",
      department: "진료",
    },
  });
}

async function postInvitationLifecycle(
  request: APIRequestContext,
  action: "resend" | "cancel" | "accept"
) {
  return request.post(
    `/api/workspaces/workspace-a/invitations/invitation-pending/${action}`,
    {
      headers: { "x-clair-demo-session-user-id": action === "accept" ? "user-vet" : "user-admin" },
    }
  );
}

test("launch workspace and staff invitation mutations expose safe audit hooks", async ({
  request,
}) => {
  const workspace = await postWorkspaceCreation(request);
  expect(workspace.status()).toBe(201);
  const workspaceBody = await workspace.json();
  expect(workspaceBody.auditEvents).toEqual([
    expect.objectContaining({
      type: "workspace.created",
      workspaceId: "audit-animal-hospital",
      actorUserId: "user-admin",
      targetType: "workspace",
      targetId: "audit-animal-hospital",
    }),
  ]);

  const invitation = await postStaffInvitation(request);
  expect(invitation.status()).toBe(201);
  const invitationBody = await invitation.json();
  expect(invitationBody.auditEvents).toEqual([
    expect.objectContaining({
      type: "workspace.invitation_created",
      workspaceId: "workspace-a",
      actorUserId: "user-admin",
      targetType: "workspace_invitation",
      targetId: invitationBody.invitation.id,
    }),
  ]);

  const serializedAudit = JSON.stringify([
    ...workspaceBody.auditEvents,
    ...invitationBody.auditEvents,
  ]);
  expect(serializedAudit).not.toMatch(/password|secret|token|serviceRole|rawPayload|magicLink/i);
});

test("tenant approval and invitation lifecycle mutations carry actor and target audit events", async ({
  request,
}) => {
  const tenantWorkspace = await request.post(
    "/api/ops/tenant-applications/tenant-app-gaon/workspace",
    {
      headers: { "x-clair-demo-session-user-id": "clair-operator" },
      data: {
        firstAdminEmail: "audit.first.admin@gaon.test",
        firstAdminDisplayName: "김감사",
      },
    }
  );
  expect(tenantWorkspace.status()).toBe(201);
  const tenantWorkspaceBody = await tenantWorkspace.json();
  expect(tenantWorkspaceBody.auditEvents).toEqual([
    expect.objectContaining({
      type: "ops.workspace_created_for_tenant",
      tenantApplicationId: "tenant-app-gaon",
      operatorUserId: "clair-operator",
      workspaceId: "workspace-gaon",
    }),
    expect.objectContaining({
      type: "ops.first_admin_invitation_created",
      tenantApplicationId: "tenant-app-gaon",
      operatorUserId: "clair-operator",
      firstAdminInvitationId: expect.any(String),
    }),
  ]);

  for (const [action, eventType] of [
    ["resend", "workspace.invitation_resent"],
    ["cancel", "workspace.invitation_canceled"],
    ["accept", "workspace.invitation_accepted"],
  ] as const) {
    const response = await postInvitationLifecycle(request, action);
    expect(response.status()).toBe(200);
    await expectJson(response, {
      ok: true,
      auditEvents: [
        expect.objectContaining({
          type: eventType,
          workspaceId: "workspace-a",
          invitationId: "invitation-pending",
          actorUserId: action === "accept" ? "user-vet" : "user-admin",
        }),
      ],
    });
  }
});

test("role and status mutations are wired to live audit append with request id support", () => {
  const roleRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts",
    "utf8"
  );
  const statusRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/status/route.ts",
    "utf8"
  );

  for (const source of [roleRoute, statusRoute]) {
    expect(source).toContain("emitLiveMutationAuditEvent");
    expect(source).toContain("createSupabaseLiveAuditAppendGateway");
    expect(source).toContain("getAuditRequestId");
  }
  expect(roleRoute).toContain("workspace.membership_roles_changed");
  expect(statusRoute).toContain("workspace.membership_status_changed");
});

test("audit event registry and review surface include launch-critical workspace events", async ({
  request,
}) => {
  const registrySource = readFileSync(
    "src/features/audit/server-audit-log-persistence-core.ts",
    "utf8"
  );
  for (const eventType of [
    "workspace.created",
    "workspace.invitation_created",
    "workspace.invitation_resent",
    "workspace.invitation_canceled",
    "workspace.invitation_accepted",
    "workspace.membership_roles_changed",
    "workspace.membership_status_changed",
  ]) {
    expect(registrySource).toContain(`"${eventType}"`);
  }

  const review = await request.get("/api/workspaces/clair-demo/audit/events", {
    headers: { "x-clair-demo-session-user-id": "user-admin" },
  });
  expect(review.status()).toBe(200);
  await expectJson(review, {
    ok: true,
    enforcedBy: "live-audit-review-reader",
  });
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
