import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/20260723110000_workspace_hospital_profiles.sql";
const logoMigrationPath = "supabase/migrations/20260723120000_private_hospital_logos.sql";
const finalAuditCatalogPath =
  "supabase/migrations/20260723223000_hospital_settings_audit_event_types.sql";

test("hospital profile migration creates tenant-bound profile and request tables", () => {
  const migration = readFileSync(migrationPath, "utf8");
  expect(migration).toContain("create table public.workspace_hospital_profiles");
  expect(migration).toContain("create table public.workspace_hospital_profile_change_requests");
  expect(migration).toContain("workspace_id text not null references public.workspaces(id) on delete cascade");
  expect(migration).toContain("revision bigint not null default 1");
  expect(migration).toContain("country_code text not null default 'KR'");
  expect(migration).toContain("customer_guide_memo");
  expect(migration).toContain("workspace_hospital_profile_change_requests_workspace_status_created_idx");
});

test("hospital profile migration backfills rows, creates future rows, and uses least privilege", () => {
  const migration = readFileSync(migrationPath, "utf8");
  expect(migration).toContain("insert into public.workspace_hospital_profiles");
  expect(migration).toContain("create trigger create_workspace_hospital_profile");
  expect(migration).toContain("enable row level security");
  expect(migration).toContain("private.clair_is_active_workspace_member(workspace_id)");
  expect(migration).toContain("private.clair_is_workspace_admin(workspace_id)");
  expect(migration).toContain("revoke all privileges on table public.workspace_hospital_profiles");
  expect(migration).not.toContain("grant insert, update, delete on table public.workspace_hospital_profiles");
});

test("hospital profile RPCs use fixed search paths, actor checks, locking, CAS, and safe audit events", () => {
  const migration = readFileSync(migrationPath, "utf8");
  expect(migration).toContain("public.clair_get_workspace_hospital_profile");
  expect(migration).toContain("public.clair_update_workspace_hospital_contact");
  expect(migration).toContain("public.clair_create_workspace_hospital_profile_change_request");
  expect(migration).toContain("set search_path = public, private, extensions, pg_temp");
  expect(migration).toContain("v_actor <> (select auth.uid())");
  expect(migration).toContain("for update");
  expect(migration).toContain("hospital_profile_stale");
  expect(migration).toContain("hospital.profile_contact_updated");
  expect(migration).toContain("hospital.profile_change_requested");
  expect(migration).toContain("p_request_id => nullif(btrim(p_request_id), '')");
  expect(migration).not.toContain("p_detail =>");
});

test("every hospital settings migration preserves previously deployed audit events", () => {
  for (const path of [migrationPath, logoMigrationPath, finalAuditCatalogPath]) {
    const migration = readFileSync(path, "utf8");
    expect(migration).toContain("hospital.schedule_revision_published");
    expect(migration).toContain("hospital.vital_settings_updated");
    expect(migration).toContain("hospital.space_archived");
    expect(migration).toContain("hospital.profile_contact_updated");
    expect(migration).toContain("hospital.profile_change_requested");
  }

  for (const path of [logoMigrationPath, finalAuditCatalogPath]) {
    const migration = readFileSync(path, "utf8");
    expect(migration).toContain("hospital.logo_updated");
    expect(migration).toContain("hospital.logo_removed");
  }
});
