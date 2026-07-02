import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260518023715_workspace_auth_schema_foundation.sql",
  "utf8"
);
const roleModelMigration = readFileSync(
  "supabase/migrations/20260702090000_workspace_permission_role_model_foundation.sql",
  "utf8"
);

test("workspace auth schema migration defines the MVP auth foundation tables", () => {
  for (const table of [
    "users",
    "workspaces",
    "user_profiles",
    "user_memberships",
    "workspace_invitations",
    "permission_policies",
  ]) {
    expect(migration).toContain(`create table if not exists public.${table}`);
    expect(migration).toContain(`alter table public.${table} enable row level security`);
  }
});

test("workspace auth schema migration pins role, status, and workspace constraints", () => {
  expect(migration).toContain("auth.users(id)");
  expect(migration).toContain("roles <@ public.clair_workspace_role_values()");
  expect(migration).toContain("cardinality(roles) > 0");
  expect(migration).toContain("unique (workspace_id, user_id)");
  expect(migration).toContain("workspace_invitations_pending_email_key");
  expect(migration).toContain("permission_policies_role_scope_key");
  expect(migration).not.toMatch(/create policy/i);
});

test("workspace permission role model migration adds additive role, job, and assignment tables", () => {
  for (const table of [
    "workspace_permission_roles",
    "workspace_job_positions",
    "workspace_membership_permission_role_assignments",
    "workspace_membership_job_position_assignments",
    "workspace_invitation_permission_role_assignments",
    "workspace_invitation_job_position_assignments",
  ]) {
    expect(roleModelMigration).toContain(`create table if not exists public.${table}`);
    expect(roleModelMigration).toContain(`alter table public.${table} enable row level security`);
  }

  expect(roleModelMigration).toContain("alter table public.user_memberships");
  expect(roleModelMigration).toContain("user_memberships_workspace_id_id_key");
  expect(roleModelMigration).not.toMatch(/drop\s+column\s+roles/i);
  expect(migration).toContain("roles text[]");
});

test("workspace permission role model migration pins Korean defaults and custom-role guardrails", () => {
  for (const label of ["소유자", "관리자", "일반", "병원장", "수의사", "테크니션", "데스크"]) {
    expect(roleModelMigration).toContain(label);
  }

  expect(roleModelMigration).toContain("public.clair_permission_role_type_values()");
  expect(roleModelMigration).toContain("array['owner', 'admin', 'standard', 'custom']::text[]");
  expect(roleModelMigration).toContain("role_type <> 'custom'");
  expect(roleModelMigration).toContain("permissions->'allowed' ?|");
  expect(roleModelMigration).toContain("workspace:delete");
  expect(roleModelMigration).toContain("workspace:transfer_owner");
  expect(roleModelMigration).not.toContain("'게스트'");
});

test("workspace permission role model migration backfills legacy memberships without creating legacy custom roles", () => {
  expect(roleModelMigration).toContain("m.roles @> array['hospital_admin']::text[]");
  expect(roleModelMigration).toContain("m.roles @> array['vet']::text[]");
  expect(roleModelMigration).toContain("m.roles @> array['technician']::text[]");
  expect(roleModelMigration).toContain("m.roles @> array['front_desk']::text[]");
  expect(roleModelMigration).toContain("role_key = 'owner'");
  expect(roleModelMigration).toContain("role_key = 'general'");
  expect(roleModelMigration).not.toContain("role_key = 'vet'");
  expect(roleModelMigration).not.toContain("role_key = 'front_desk'");
});
