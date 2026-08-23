import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260823140000_workspace_creation_creator_profile_preservation.sql",
  "utf8",
);
const replay = readFileSync(
  "supabase/snippets/workspace_creator_profile_preservation_replay.sql",
  "utf8",
);

test("creator profile preservation migration replaces only the five-argument RPC", () => {
  expect(
    migration.match(
      /create or replace function public\.clair_create_workspace_with_creator\(/g,
    ),
  ).toHaveLength(1);
  expect(migration).toContain(
    "p_workspace_id text,\n  p_display_name text,\n  p_admin_display_name text,\n  p_contact_email text default null,\n  p_contact_phone text default null",
  );
  expect(migration).toContain("security definer");
  expect(migration).toContain("set search_path = public, extensions, pg_temp");
  expect(migration).toContain("auth.uid()");
  expect(migration).toContain("for update");
  expect(migration).toContain("v_actor_user.status <> 'active'");
  expect(migration).toContain(
    "trim(p_admin_display_name) <> v_actor_user.display_name",
  );
  expect(migration).toContain("workspace_creator_inactive");
  expect(migration).toContain("workspace_creator_display_name_mismatch");
  expect(migration).toContain("upper(left(trim(p_admin_display_name), 1))");
  expect(migration).not.toMatch(/on conflict \(id\) do update/);
  expect(migration).toContain(
    "revoke all on function public.clair_create_workspace_with_creator(text, text, text, text, text)\n  from public;",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_create_workspace_with_creator(text, text, text, text, text)\n  from anon;",
  );
  expect(migration).toContain(
    "grant execute on function public.clair_create_workspace_with_creator(text, text, text, text, text)\n  to authenticated;",
  );
});

test("creator profile preservation replay is rollback-only and covers the focused contract", () => {
  expect(replay).toContain("\\set ON_ERROR_STOP on");
  expect(replay).toContain("begin;");
  expect(replay).toContain(
    "\\ir ../migrations/20260823140000_workspace_creation_creator_profile_preservation.sql",
  );
  expect(replay).toContain("rollback;");

  for (const check of [
    "existing_users_fingerprint",
    "existing_user_profiles_fingerprint",
    "new_actor_regression",
    "inactive_rejection",
    "name_rejection",
    "duplicate_rollback",
    "acl_search_path",
  ]) {
    expect(replay).toContain(`workspace_creator_profile_preservation_${check}`);
  }

  expect(replay).toContain("created_at");
  expect(replay).toContain("v_prosecdef");
  expect(replay).toContain("v_proconfig");
  expect(replay).toContain("has_function_privilege('authenticated'");
  expect(replay).toContain("has_function_privilege('anon'");
  expect(replay).toContain("has_function_privilege('public'");
  expect(replay).toContain("has_function_privilege('service_role'");
});
