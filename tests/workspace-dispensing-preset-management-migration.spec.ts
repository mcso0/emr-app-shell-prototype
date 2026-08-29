import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260829143000_workspace_dispensing_preset_management.sql",
  "utf8",
);

test("workspace dispensing migration enforces server-owned author and veterinarian review lifecycle", () => {
  expect(migration).toContain("workspace_dispensing_review_status");
  expect(migration).toContain("private.clair_is_workspace_admin(p_workspace_id)");
  expect(migration).toContain("private.clair_is_active_veterinarian_member");
  expect(migration).toContain("create or replace function public.clair_create_workspace_dispensing_order");
  expect(migration).toContain("create or replace function public.clair_review_workspace_dispensing_order");
  expect(migration).toContain("v_item.origin_type <> 'workspace_custom'");
  expect(migration).toContain("v_item.workspace_dispensing_review_status <> 'pending'");
  expect(migration).toContain("when p_action = 'approve' then 'active'");
});

test("workspace dispensing migration validates preset details and preserves fixed versus quantity pricing", () => {
  expect(migration).toContain("dispensing_required_detail_invalid");
  expect(migration).toContain("dispensing_manual_quantity_reason_required");
  expect(migration).toContain("v_price_basis not in ('unit_price', 'fixed_order_price')");
  expect(migration).toContain("when v_price_basis = 'fixed_order_price' then coalesce(c.price_krw, 0)");
  expect(migration).toContain("else p_quantity * coalesce(c.price_krw, 0)");
  expect(migration).toContain("'workspaceDispensingReview'");
});

test("workspace dispensing migration never accepts client master lineage or client-owned ids", () => {
  expect(migration).toContain("catalog_lineage_client_write_rejected");
  expect(migration).toContain("v_id text := 'ord-' ||");
  expect(migration).not.toContain("nullif(pg_catalog.btrim(p_item ->> 'id')");
  expect(migration).toContain("where workspace_id = p_workspace_id and id = p_item_id");
});

test("legacy public catalog writers cannot bypass dispensing review", () => {
  expect(migration).toContain(
    "rename to clair_create_order_catalog_item_pr020_legacy",
  );
  expect(migration).toContain(
    "return public.clair_create_workspace_dispensing_order(",
  );
  expect(migration).toContain("v_path_item_type = 'medication'");
  expect(migration).toContain("v_path_destination = 'dispensing'");
  expect(migration).toContain(
    "revoke all on function public.clair_create_order_catalog_item_pr020_legacy",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_update_order_catalog_item_pr020_legacy",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_update_order_catalog_item_a2_base",
  );
  expect(migration).toContain(
    "revoke all on function public.clair_update_order_catalog_item_a2_unlocked",
  );
});
