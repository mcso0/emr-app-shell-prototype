import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260609112000_lab_result_entry_persistence.sql",
  "utf8",
);
const route = readFileSync(
  "src/app/api/workspaces/[workspaceId]/lab-imaging/result-entries/route.ts",
  "utf8",
);
const labModule = readFileSync("src/features/lab-imaging/module.tsx", "utf8");
const emrTypes = readFileSync("src/types/emr-domain.ts", "utf8");

test("lab result entry migration creates durable header and row tables", () => {
  expect(migration).toContain("create table if not exists public.lab_result_entries");
  expect(migration).toContain("create table if not exists public.lab_result_entry_rows");
  expect(migration).toContain("unique (workspace_id, result_id)");
  expect(migration).toContain("references public.encounters(id)");
  expect(migration).toContain("references public.orders(id)");
  expect(migration).toContain("references public.order_fulfillment_work_items(id)");
  expect(migration).toContain("references public.lab_test_items(id)");
  expect(migration).toContain("result_payload jsonb");
});

test("lab result entry migration enforces workspace RLS and RPC membership checks", () => {
  expect(migration).toContain("alter table public.lab_result_entries enable row level security");
  expect(migration).toContain("alter table public.lab_result_entry_rows enable row level security");
  expect(migration).toContain("private.clair_is_active_workspace_member(workspace_id)");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migration).toContain("grant execute on function public.clair_save_lab_result_entry");
  expect(migration).toContain("grant execute on function public.clair_get_lab_result_entry");
});

test("lab result save RPC validates encounter, lab order, and lab work item scope", () => {
  expect(migration).toContain("encounter.workspace_id = p_workspace_id");
  expect(migration).toContain("order_row.workspace_id = p_workspace_id");
  expect(migration).toContain("order_row.encounter_id = p_encounter_id");
  expect(migration).toContain("order_row.order_type = 'lab'");
  expect(migration).toContain("work_item.workspace_id = p_workspace_id");
  expect(migration).toContain("work_item.queue_type = 'lab'");
  expect(migration).toContain("work_item_unavailable");
  expect(migration).toContain("v_affected_lab_test_item_ids");
  expect(migration).toContain("saved_result_usage_count = (");
});

test("result-entry route uses Supabase RPC path with server permission checks", () => {
  expect(route).toContain('requiredPermission: "lab:view"');
  expect(route).toContain('requiredPermission: "lab:complete"');
  expect(route).toContain('client.rpc("clair_get_lab_result_entry"');
  expect(route).toContain('client.rpc("clair_save_lab_result_entry"');
  expect(route).toContain("createSupabaseWorkspacePermissionGateway");
  expect(route).toContain("resolveWorkspacePermission");
  expect(route).toContain("lab-result-entry-server-boundary");
});

test("lab UI forwards seeded lab test item ids into result save payload", () => {
  expect(emrTypes).toContain("labTestItemId?: EmrId");
  expect(labModule).toContain("labTestItemId: item.id");
  expect(labModule).toContain("saveLabResultEntry");
});
