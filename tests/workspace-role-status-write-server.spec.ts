import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { APIRequestContext, APIResponse } from "@playwright/test";

async function patchMembershipStatus(
  request: APIRequestContext,
  options: { actor?: string; workspaceId?: string; membershipId?: string; status?: string } = {}
) {
  return request.patch(
    `/api/workspaces/${options.workspaceId ?? "workspace-a"}/memberships/${options.membershipId ?? "membership-vet"}/status`,
    {
      headers: options.actor ? { "x-clair-demo-session-user-id": options.actor } : {},
      data: { status: options.status ?? "inactive" },
    }
  );
}

test("membership status route enforces admin and last-admin guard in mock fallback", async ({
  request,
}) => {
  const unauthenticated = await patchMembershipStatus(request);
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const denied = await patchMembershipStatus(request, { actor: "user-vet" });
  expect(denied.status()).toBe(403);
  await expectJson(denied, { ok: false, denialReason: "permission_missing" });

  const allowed = await patchMembershipStatus(request, { actor: "user-admin" });
  expect(allowed.status()).toBe(200);
  await expectJson(allowed, {
    ok: true,
    workspaceId: "workspace-a",
    targetMembershipId: "membership-vet",
    updatedStatus: "inactive",
    enforcedBy: "server-permission-resolver",
  });

  const lastAdmin = await patchMembershipStatus(request, {
    actor: "user-admin",
    membershipId: "membership-admin",
  });
  expect(lastAdmin.status()).toBe(409);
  await expectJson(lastAdmin, { ok: false, denialReason: "last_admin_protected" });
});

test("role and status write paths define DB transaction wrappers", () => {
  const roleRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts",
    "utf8"
  );
  const statusRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/status/route.ts",
    "utf8"
  );
  const migrationSource = readFileSync(
    "supabase/migrations/20260518125000_workspace_role_status_write_transactions.sql",
    "utf8"
  );
  const roleJobUpdateMigration = readFileSync(
    "supabase/migrations/20260702133000_workspace_membership_role_job_key_update.sql",
    "utf8"
  );

  expect(roleRoute).toContain("clair_update_workspace_membership_roles");
  expect(roleRoute).toContain("p_permission_role_key");
  expect(roleRoute).toContain("p_job_position_key");
  expect(statusRoute).toContain("clair_update_workspace_membership_status");
  expect(statusRoute).toContain("workspace.membership_deactivated");
  expect(statusRoute).toContain("workspace.membership_reactivated");
  expect(migrationSource).toContain("private.update_workspace_membership_roles");
  expect(migrationSource).toContain("last_admin");
  expect(migrationSource).toContain("audit hook");
  expect(migrationSource).not.toMatch(/service_role|supabase_secret|db_password/i);
  expect(roleJobUpdateMigration).toContain("p_permission_role_key text");
  expect(roleJobUpdateMigration).toContain("p_job_position_key text");
  expect(roleJobUpdateMigration).toContain("private.update_workspace_membership_permission_role");
  expect(roleJobUpdateMigration).toContain("private.update_workspace_membership_job_position");
  expect(roleJobUpdateMigration).not.toMatch(/drop\\s+(column|table|function)|service_role|db_password/i);
});

async function expectJson(response: APIResponse, shape: Record<string, unknown>) {
  await expect(response.json()).resolves.toEqual(expect.objectContaining(shape));
}
