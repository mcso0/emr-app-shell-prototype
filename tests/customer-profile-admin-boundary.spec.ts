import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("customer profile admin permissions are separate from operational patient update", () => {
  const domain = readFileSync("src/types/emr-domain.ts", "utf8");
  const seeds = readFileSync("src/mocks/emr-domain.ts", "utf8");
  const roles = readFileSync("src/features/auth/workspace-session.ts", "utf8");

  for (const permission of [
    "patient_profile:manage",
    "guardian_profile:manage",
    "patient_guardian_relationship:manage",
  ]) {
    expect(domain).toContain(permission.split(":")[0]);
    expect(seeds).toContain(permission);
    expect(roles).toContain(permission);
  }
});

test("customer profile RLS keeps reads workspace-scoped and writes admin-only with auditable outcomes", () => {
  const migration = readFileSync(
    "supabase/migrations/20260720150000_customer_profile_admin_boundary.sql",
    "utf8",
  );

  expect(migration).toContain("private.clair_is_active_workspace_member(workspace_id)");
  expect(migration).toContain("private.clair_is_workspace_admin(workspace_id)");
  expect(migration).toContain("customer_profile_change_logs");
  expect(migration).toContain("request_id");
  expect(migration).toContain("result");
  expect(migration).toContain("patient_guardians");
});

test("live customer profile routes resolve permissions from the workspace database", () => {
  for (const routePath of [
    "src/app/api/workspaces/[workspaceId]/customer/patients/[patientId]/profile/route.ts",
    "src/app/api/workspaces/[workspaceId]/customer/guardians/[guardianId]/profile/route.ts",
    "src/app/api/workspaces/[workspaceId]/customer/relationships/route.ts",
  ]) {
    const route = readFileSync(routePath, "utf8");
    expect(route).toContain("loadWorkspacePermissionAdapterFromDb");
    expect(route).toContain("createSupabaseWorkspacePermissionGateway");
    expect(route).toContain("permissionAdapter");
  }
});
