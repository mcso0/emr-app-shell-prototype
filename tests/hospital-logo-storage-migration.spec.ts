import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const path = "supabase/migrations/20260723120000_private_hospital_logos.sql";
const replayPath = "supabase/snippets/private_hospital_logo_replay.sql";
const storageCheckPath = "scripts/check-private-hospital-logo-storage.mjs";

test("hospital logo migration creates a private bounded bucket and exact pointer constraint", () => {
  const migration = readFileSync(path, "utf8");
  expect(migration).toContain("'hospital-logos'");
  expect(migration).toMatch(/'hospital-logos'[\s\S]*false[\s\S]*5242880/);
  expect(migration).toContain("array['image/jpeg', 'image/png', 'image/webp']");
  expect(migration).toContain("workspace_hospital_profiles_logo_storage_path_check");
  expect(migration).toContain("^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]/logos/");
});

test("hospital logo Storage policies let workspace admins finalize objects and expose the current pointer to members", () => {
  const migration = readFileSync(path, "utf8");
  expect(migration).toContain("hospital_logos_insert_workspace_admin");
  expect(migration).toContain("hospital_logos_delete_workspace_admin");
  expect(migration).toContain("hospital_logos_select_authorized");
  expect(migration).toContain("(storage.foldername(name))[1]");
  expect(migration).toContain("(storage.foldername(name))[3] = (select auth.uid()::text)");
  expect(migration).toContain("profile.logo_storage_path = storage.objects.name");
  expect(migration).toContain("owner_id = (select auth.uid()::text)");
  expect(migration).toContain("private.clair_is_workspace_admin");
  expect(migration).toContain("private.clair_is_active_workspace_member");
  expect(migration).toMatch(
    /create policy hospital_logos_delete_workspace_admin[\s\S]*bucket_id = 'hospital-logos'[\s\S]*private\.clair_is_workspace_admin/
  );
});

test("hospital logo pointer RPC locks, uses CAS, audits safe state, and is least privilege", () => {
  const migration = readFileSync(path, "utf8");
  expect(migration).toContain("public.clair_set_workspace_hospital_logo_state");
  expect(migration).toContain("set search_path = public, private, extensions, pg_temp");
  expect(migration).toContain("for update");
  expect(migration).toContain("hospital_logo_state_conflict");
  expect(migration).toContain("hospital.logo_updated");
  expect(migration).toContain("hospital.logo_removed");
  expect(migration).toContain("p_request_id => nullif(btrim(p_request_id), '')");
  expect(migration).toContain("'hasLogo'");
  expect(migration).not.toContain("grant update on table public.workspace_hospital_profiles");
});

test("hospital logo local verification covers authorization, CAS, redaction, and cleanup without enabling remote checks", () => {
  const replay = readFileSync(replayPath, "utf8");
  const storageCheck = readFileSync(storageCheckPath, "utf8");
  expect(replay).toContain("direct_logo_pointer_write_unexpectedly_succeeded");
  expect(replay).toContain("stale_logo_pointer_write_unexpectedly_succeeded");
  expect(replay).toContain("member_logo_pointer_write_unexpectedly_succeeded");
  expect(replay).toContain("hospital_logo_audit_redaction_mismatch");
  expect(replay).toContain("rollback;");
  expect(storageCheck).toContain("ALLOW_REMOTE_HOSPITAL_LOGO_QA");
  expect(storageCheck).toContain("member_unpointed_sign_unexpectedly_succeeded");
  expect(storageCheck).toContain("workspace_admin_cross_owner_cleanup_failed");
  expect(storageCheck).toContain("restorePointer");
  expect(storageCheck).not.toContain("signedUrl:");
});
