import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, APIResponse } from "@playwright/test";
import { resolveRoleUpdateActorIdentity } from "../src/features/auth/server-role-update-identity";

const workspaceId = "workspace-a";

async function postRoleUpdate(
  request: APIRequestContext,
  options: {
    actor?: string;
    workspaceId?: string;
    membershipId?: string;
    roles?: string[];
  }
) {
  const targetWorkspaceId = options.workspaceId ?? workspaceId;
  const membershipId = options.membershipId ?? "membership-vet";
  return request.post(`/api/workspaces/${targetWorkspaceId}/memberships/${membershipId}/roles`, {
    headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
    data: { roles: options.roles ?? ["vet", "front_desk"] },
  });
}

test("role update server boundary allows hospital admin with active membership", async ({
  request,
}) => {
  const response = await postRoleUpdate(request, { actor: "user-admin" });

  expect(response.status()).toBe(200);
  await expectJson(response, {
    ok: true,
    workspaceId,
    targetMembershipId: "membership-vet",
    updatedRoles: ["vet", "front_desk"],
    enforcedBy: "server-permission-resolver",
  });
});

test("role update server boundary denies missing, inactive, and unauthorized actors", async ({
  request,
}) => {
  const unauthenticated = await postRoleUpdate(request, {});
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const noMembership = await postRoleUpdate(request, { actor: "user-no-membership" });
  expect(noMembership.status()).toBe(403);
  await expectJson(noMembership, {
    ok: false,
    denialReason: "workspace_membership_missing",
  });

  const inactiveMembership = await postRoleUpdate(request, { actor: "user-suspended" });
  expect(inactiveMembership.status()).toBe(403);
  await expectJson(inactiveMembership, {
    ok: false,
    denialReason: "workspace_membership_inactive",
  });

  const missingPermission = await postRoleUpdate(request, { actor: "user-vet" });
  expect(missingPermission.status()).toBe(403);
  await expectJson(missingPermission, { ok: false, denialReason: "permission_missing" });
});

test("role update server boundary protects the last active hospital admin", async ({
  request,
}) => {
  const response = await postRoleUpdate(request, {
    actor: "user-admin",
    membershipId: "membership-admin",
    roles: ["vet"],
  });

  expect(response.status()).toBe(409);
  await expectJson(response, { ok: false, denialReason: "last_admin_protected" });
});

test("role update server boundary denies cross-workspace admin access", async ({
  request,
}) => {
  const response = await postRoleUpdate(request, {
    actor: "user-admin",
    workspaceId: "workspace-b",
    membershipId: "membership-admin",
    roles: ["hospital_admin"],
  });

  expect(response.status()).toBe(403);
  await expectJson(response, {
    ok: false,
    denialReason: "workspace_membership_missing",
  });
});

test("role update route validates role input and stays server-only", async ({ request }) => {
  const invalidRoles = await postRoleUpdate(request, {
    actor: "user-admin",
    roles: ["owner"],
  });

  expect(invalidRoles.status()).toBe(400);
  await expectJson(invalidRoles, { ok: false, error: "invalid_roles" });

  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts",
    "utf8"
  );
  const enforcementSource = readFileSync(
    "src/features/auth/server-role-update-enforcement.ts",
    "utf8"
  );

  expect(routeSource).toContain("authorizeWorkspaceRoleUpdate");
  expect(routeSource).toContain("readServerSession");
  expect(enforcementSource).toContain('import "server-only"');
  expect(enforcementSource).not.toMatch(/sessionStorage|localStorage|window\\./);
});

test("role update actor identity uses verified session and limits demo header to mock mode", () => {
  expect(
    resolveRoleUpdateActorIdentity({
      serverSession: {
        ok: true,
        status: "authenticated",
        sessionUserId: "user-live-session",
        email: "admin@example.test",
        role: "authenticated",
        aal: "aal1",
        sessionId: "session-live",
        source: "supabase_claims",
      },
      demoHeaderUserId: "user-admin",
    })
  ).toEqual({
    ok: true,
    actorUserId: "user-live-session",
    source: "supabase_session",
  });

  expect(
    resolveRoleUpdateActorIdentity({
      serverSession: {
        ok: false,
        status: "unauthenticated",
        reason: "no_session",
        sessionUserId: null,
        source: "supabase_claims",
      },
      demoHeaderUserId: "user-admin",
    })
  ).toEqual({
    ok: false,
    denialReason: "unauthenticated",
    sessionStatus: "unauthenticated",
    sessionReason: "no_session",
  });

  expect(
    resolveRoleUpdateActorIdentity({
      serverSession: {
        ok: false,
        status: "mock_mode",
        reason: "mock_mode",
        sessionUserId: null,
        source: "mock_fallback",
      },
      demoHeaderUserId: "user-admin",
    })
  ).toEqual({
    ok: true,
    actorUserId: "user-admin",
    source: "demo_header_mock_mode",
  });

  expect(
    resolveRoleUpdateActorIdentity({
      serverSession: {
        ok: false,
        status: "mock_mode",
        reason: "mock_mode",
        sessionUserId: null,
        source: "mock_fallback",
      },
      demoHeaderUserId: null,
    })
  ).toEqual({
    ok: false,
    denialReason: "unauthenticated",
    sessionStatus: "mock_mode",
    sessionReason: "mock_mode",
  });
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
