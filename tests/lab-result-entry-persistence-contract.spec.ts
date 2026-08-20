import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const foundationMigration = readFileSync(
  "supabase/migrations/20260609112000_lab_result_entry_persistence.sql",
  "utf8",
);
const b1Migration = readFileSync(
  "supabase/migrations/20260819172501_clinical_master_phase1b1_laboratory_slice.sql",
  "utf8",
);
const migration =
  foundationMigration +
  b1Migration;
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

test("B1 result persistence keeps the frozen definition immutable and v2 writes strict", () => {
  expect(b1Migration).toContain("lab_result_entries_canonical_order_unique");
  expect(b1Migration).toContain("result_definition_origin = 'canonical'");
  expect(b1Migration).toContain("lab_result_definition_snapshot_invalid");
  expect(b1Migration).toContain("p_expected_entry_write_revision");
  expect(b1Migration).toContain("p_request_id");
  expect(b1Migration).toContain("v_entry.result_status not in ('received','entered')");
  expect(b1Migration).toContain("result_definition_snapshot drop default");
  expect(b1Migration).toContain(
    "format('lab-result-row:v1:%s:%s:%s',p_order_id::text,v_link.id::text,v_ordinal::text)",
  );
  expect(b1Migration).toContain("jsonb_typeof(v_row->'required')");
});

test("result-entry route uses Supabase RPC path with server permission checks", () => {
  expect(route).toContain('requiredPermission: "lab:view"');
  expect(route).toContain('requiredPermission: "lab:complete"');
  expect(route).toContain('client.rpc("clair_get_lab_result_entry"');
  expect(route).toContain('functionName: "clair_save_lab_result_entry_v2"');
  expect(route).toContain("p_expected_entry_write_revision");
  expect(route).toContain("p_request_id");
  expect(route).toContain("createSupabaseWorkspacePermissionGateway");
  expect(route).toContain("resolveWorkspacePermission");
  expect(route).toContain("lab-result-entry-server-boundary");
});

test("lab UI forwards seeded lab test item ids into result save payload", () => {
  expect(emrTypes).toContain("labTestItemId?: EmrId");
  expect(labModule).toContain("labTestItemId: item.id");
  expect(labModule).toContain("saveLabResultEntry");
});
