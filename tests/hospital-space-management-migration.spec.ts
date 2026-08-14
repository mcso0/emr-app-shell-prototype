import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const migrationPath = "supabase/migrations/20260723220927_workspace_space_management.sql";

test("space management migration defines workspace-scoped category and space records", () => {
  const sql = readFileSync(migrationPath, "utf8");

  expect(sql).toContain("create table public.workspace_space_categories");
  expect(sql).toContain("create table public.workspace_spaces");
  expect(sql).toContain("archived_at timestamptz");
  expect(sql).toContain("lower(name)");
  expect(sql).toContain("where archived_at is null");
  expect(sql).toContain("workspace_spaces_category_workspace_fk");
  expect(sql).toContain("on delete restrict");
});

test("space management migration keeps reads member-scoped and writes server-owned", () => {
  const sql = readFileSync(migrationPath, "utf8");

  expect(sql).toContain("private.clair_is_active_workspace_member(workspace_id)");
  expect(sql).toContain("revoke all privileges on table public.workspace_space_categories");
  expect(sql).toContain("revoke all privileges on table public.workspace_spaces");
  expect(sql).toContain("grant select on table public.workspace_space_categories to authenticated");
  expect(sql).toContain("grant select on table public.workspace_spaces to authenticated");
  expect(sql).not.toContain("grant insert, update, delete on table public.workspace_space_categories");
  expect(sql).not.toContain("grant insert, update, delete on table public.workspace_spaces");
});

test("space management RPCs enforce permission, atomic moves, archives, and audit events", () => {
  const sql = readFileSync(migrationPath, "utf8");

  expect(sql).toContain("clair_get_workspace_space_management");
  expect(sql).toContain("clair_mutate_workspace_space_management");
  expect(sql).toContain(
    "private.clair_current_user_has_workspace_permission(p_workspace_id, 'hospital_settings:manage')",
  );
  expect(sql).toContain("category_move_target_required");
  expect(sql).toContain("invalid_move_target");
  expect(sql).toContain("set category_id = v_move_target_category_id");
  expect(sql).toContain("set archived_at = v_now");
  expect(sql).toContain("hospital.space_category_created");
  expect(sql).toContain("hospital.space_category_renamed");
  expect(sql).toContain("hospital.space_category_archived");
  expect(sql).toContain("hospital.space_created");
  expect(sql).toContain("hospital.space_updated");
  expect(sql).toContain("hospital.space_archived");
  expect(sql).not.toContain("delete from public.workspace_space_categories");
  expect(sql).not.toContain("delete from public.workspace_spaces");
});

test("space management migration seeds the four semantic defaults without overwriting hospitals", () => {
  const sql = readFileSync(migrationPath, "utf8");

  expect(sql).toContain("'진료 공간', 'consult'");
  expect(sql).toContain("'처치 공간', 'treatment'");
  expect(sql).toContain("'검사 공간', 'exam'");
  expect(sql).toContain("'수술 공간', 'surgery'");
  expect(sql).toContain("on conflict do nothing");
  expect(sql).not.toContain("on conflict (workspace_id");
  expect(sql).not.toContain("do update set");
});
