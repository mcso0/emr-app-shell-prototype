import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("role management handoff regression matrix covers UI, server, and DB guards", () => {
  const authSpec = readFileSync("tests/auth.spec.ts", "utf8");
  const serverSpec = readFileSync("tests/server-permission-enforcement.spec.ts", "utf8");
  const writeSpec = readFileSync("tests/workspace-role-status-write-server.spec.ts", "utf8");
  const permissionSpec = readFileSync("tests/permission-resolver.spec.ts", "utf8");

  expect(authSpec).toContain("hospital admin can edit active member permission role");
  expect(authSpec).toContain("role management UI blocks last active workspace owner");
  expect(authSpec).toContain("hospital admin manages custom role and job catalogs outside the invitation sheet");
  expect(authSpec).toContain("role_permission:view fixture can inspect roles but cannot manage invitations or catalogs");
  expect(serverSpec).toContain("role update server boundary denies missing, inactive, and unauthorized actors");
  expect(serverSpec).toContain("role update server boundary denies cross-workspace admin access");
  expect(writeSpec).toContain("membership status route enforces admin and last-admin guard");
  expect(permissionSpec).toContain("last active hospital admin guard blocks demotion or deactivation");
});

test("role management live handoff keeps route and DB boundaries discoverable", () => {
  const roleRoute = readFileSync(
    "src/app/api/workspaces/[workspaceId]/memberships/[membershipId]/roles/route.ts",
    "utf8"
  );
  const membershipManagement = readFileSync(
    "src/features/auth/workspace-membership-management.tsx",
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
  expect(roleRoute).toContain("clair_update_workspace_membership_roles");
  expect(roleRoute).toContain("p_permission_role_key");
  expect(roleRoute).toContain("p_job_position_key");
  expect(membershipManagement).toContain("permissionRoleKey: editingPermissionRoleKey");
  expect(membershipManagement).toContain(
    "jobPositionKey: getSessionWorkspaceEffectiveJobPositionKey(editingMembership)"
  );
  expect(statusRoute).toContain("clair_update_workspace_membership_status");
  expect(dbWriteMigration).toContain("protect_last_active_hospital_admin");
  expect(dbWriteMigration).toContain("audit hook");
});
