import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import {
  createApprovedTenantWorkspaceAndFirstAdminInvite,
  createDemoOpsOperatorAdapter,
  createDemoOpsTenantApprovalGateway,
} from "../src/features/ops/server-tenant-workspace-action-core";

async function postTenantWorkspaceAction(
  request: APIRequestContext,
  options: {
    applicationId?: string;
    actor?: string;
    firstAdminEmail?: string;
    firstAdminDisplayName?: string;
  } = {}
) {
  return request.post(
    `/api/ops/tenant-applications/${options.applicationId ?? "tenant-app-gaon"}/workspace`,
    {
      headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
      data: {
        firstAdminEmail: options.firstAdminEmail ?? "FIRST.ADMIN@GAON.TEST",
        firstAdminDisplayName: options.firstAdminDisplayName ?? "박민재",
      },
    }
  );
}

test("ops tenant workspace action creates workspace and first hospital admin invitation for approved tenant", async ({
  request,
}) => {
  const response = await postTenantWorkspaceAction(request, { actor: "clair-operator" });

  expect(response.status()).toBe(201);
  const body = await response.json();

  expect(body).toMatchObject({
    ok: true,
    enforcedBy: "clair-ops-tenant-workspace-action",
    tenantApplication: {
      id: "tenant-app-gaon",
      workspaceId: "workspace-gaon",
      firstAdminInvitationId: "workspace-gaon:invite:first.admin@gaon.test",
    },
    workspace: {
      id: "workspace-gaon",
      displayName: "가온동물메디컬센터",
      representativeName: "박민재",
    },
    firstAdminInvitation: {
      workspaceId: "workspace-gaon",
      email: "first.admin@gaon.test",
      invitedRoles: ["hospital_admin"],
      status: "pending",
      invitedBySessionId: "clair-operator",
    },
  });
  expect(body.auditEvents.map((event: { type: string }) => event.type)).toEqual([
    "ops.workspace_created_for_tenant",
    "ops.first_admin_invitation_created",
  ]);
});

test("ops tenant workspace action denies unapproved duplicate and unauthorized cases", async ({
  request,
}) => {
  const unauthenticated = await postTenantWorkspaceAction(request);
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const notOperator = await postTenantWorkspaceAction(request, { actor: "user-admin" });
  expect(notOperator.status()).toBe(403);
  await expectJson(notOperator, { ok: false, denialReason: "operator_missing" });

  const pending = await postTenantWorkspaceAction(request, {
    actor: "clair-operator",
    applicationId: "tenant-app-hanbit",
  });
  expect(pending.status()).toBe(409);
  await expectJson(pending, { ok: false, denialReason: "tenant_not_approved" });

  const duplicate = await postTenantWorkspaceAction(request, {
    actor: "clair-operator",
    applicationId: "tenant-app-pureun",
  });
  expect(duplicate.status()).toBe(409);
  await expectJson(duplicate, { ok: false, denialReason: "tenant_workspace_exists" });
});

test("ops tenant workspace action core exposes safe audit hook and invalid input handling", async () => {
  const result = await createApprovedTenantWorkspaceAndFirstAdminInvite({
    actorUserId: "clair-operator",
    applicationId: "tenant-app-gaon",
    input: {
      firstAdminEmail: "bad-email",
      firstAdminDisplayName: "박민재",
    },
    operatorAdapter: createDemoOpsOperatorAdapter(),
    gateway: createDemoOpsTenantApprovalGateway(),
    now: "2026-05-20T01:00:00.000Z",
  });

  expect(result).toEqual({
    ok: false,
    status: 400,
    error: "invalid_input",
    fieldErrors: {
      firstAdminEmail: "올바른 이메일 형식으로 입력하세요.",
    },
  });
});

test("ops tenant workspace route stays server-owned and avoids secret exposure", () => {
  const routeSource = readFileSync(
    "src/app/api/ops/tenant-applications/[applicationId]/workspace/route.ts",
    "utf8"
  );
  const serverSource = readFileSync(
    "src/features/ops/server-tenant-workspace-action.ts",
    "utf8"
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("createApprovedTenantWorkspaceAndFirstAdminInvite");
  expect(serverSource).toContain('import "server-only"');
  expect(serverSource).not.toMatch(/service_role|sb_secret|SUPABASE_SECRET|localStorage|sessionStorage|window\\./i);
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
