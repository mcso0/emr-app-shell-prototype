import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migrationPath =
  "supabase/migrations/20260821063113_clinical_master_phase1_permission_source_assignment_precedence.sql";
const replayPath =
  "supabase/snippets/clinical_master_phase1_permission_source_replay.sql";
const orderSetsRoutePath =
  "src/app/api/workspaces/[workspaceId]/hospital-admin/order-sets/route.ts";
const orderSetsPanelPath = "src/features/hospital-admin/order-sets-panel.tsx";

const migration = readFileSync(migrationPath, "utf8");
const replay = readFileSync(replayPath, "utf8");
const orderSetsRoute = readFileSync(orderSetsRoutePath, "utf8");
const orderSetsPanel = readFileSync(orderSetsPanelPath, "utf8");

test("Phase 1 permission helper gives active assignments authoritative precedence", () => {
  for (const token of [
    "create or replace function private.clair_current_user_has_workspace_permission(",
    "language sql",
    "stable",
    "security definer",
    "set search_path = public, private, pg_temp",
    "membership.status = 'active'",
    "app_user.status = 'active'",
    "exists (",
    "not exists (",
    "workspace_membership_permission_role_assignments",
    "assigned_role.workspace_id = assignment.workspace_id",
    "assigned_role.status = 'active'",
    "permissions -> 'allowed'",
    "membership.roles @> array['hospital_admin']::text[]",
    "policy.scope = 'role'",
    "policy.scope = 'user'",
    "revoke all on function private.clair_current_user_has_workspace_permission(text, text)",
    "from public, anon",
    "grant execute on function private.clair_current_user_has_workspace_permission(text, text)",
    "to authenticated",
  ]) {
    expect(migration).toContain(token);
  }

  expect(migration).not.toContain("is_assignable");
  expect(migration).toContain("coalesce(assigned_role.permissions -> 'allowed', '[]'::jsonb) ? '*'");
  expect(migration).toContain("coalesce(policy.permissions -> 'allowed', '[]'::jsonb) ? '*'");
});

test("permission replay covers assigned, legacy, membership, and Order Set boundaries", () => {
  for (const assertion of [
    "clinical_master_phase1_permission_assigned_general_view_denied",
    "clinical_master_phase1_permission_assigned_custom_view_denied",
    "clinical_master_phase1_permission_assigned_missing_permission_allowed",
    "clinical_master_phase1_permission_general_manage_allowed",
    "clinical_master_phase1_permission_assigned_wildcard_denied",
    "clinical_master_phase1_permission_empty_assignment_fell_back",
    "clinical_master_phase1_permission_inactive_assignment_allowed",
    "clinical_master_phase1_permission_legacy_role_fallback_denied",
    "clinical_master_phase1_permission_legacy_user_fallback_denied",
    "clinical_master_phase1_permission_legacy_hospital_admin_denied",
    "clinical_master_phase1_permission_inactive_membership_allowed",
    "clinical_master_phase1_permission_inactive_user_allowed",
    "clinical_master_phase1_permission_order_set_select_count",
    "clinical_master_phase1_permission_order_set_cross_workspace_visible",
    "clinical_master_phase1_permission_order_set_rpc_select_count",
    "clinical_master_phase1_permission_order_set_cross_workspace_rpc_allowed",
    "set local role authenticated",
    "rollback;",
  ]) {
    expect(replay).toContain(assertion);
  }
});

test("Order Set API/UI maps empty 200 to no-data and non-2xx reads to read-error", () => {
  expect(orderSetsRoute).toContain("if (result.ok)");
  expect(orderSetsRoute).toContain("status: 200");
  expect(orderSetsRoute).toContain("Response.json(result, { status: result.status })");

  expect(orderSetsPanel).toContain(
    "if (!response.ok || !Array.isArray(body.summaries)) throw new Error(\"order_set_read_failed\")",
  );
  expect(orderSetsPanel).toContain('setStatus("error")');
  expect(orderSetsPanel).toContain('if (summaries.length === 0)');
  expect(orderSetsPanel).toContain('kind="read-error"');
  expect(orderSetsPanel).toContain('kind="no-data"');
});
