import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260831070431_clinical_master_execution_preset_runtime_transport.sql",
  "utf8",
);
const latestSearchAndSnapshot = readFileSync(
  "supabase/migrations/20260826200000_clinical_master_dispensing_master_presets.sql",
  "utf8",
);
const latestPricingSnapshot = readFileSync(
  "supabase/migrations/20260829143000_workspace_dispensing_preset_management.sql",
  "utf8",
);

test("runtime transport keeps the latest chart-search shape and service-review gate", () => {
  const returnBlock = migration.match(/returns table \(([\s\S]*?)\n\)/)?.[1] ?? "";
  expect(returnBlock.match(/^[ ]{2}[a-z_]+ /gm) ?? []).toHaveLength(20);
  expect(returnBlock).toContain("source_set_pending_review_count integer");
  expect(migration).toContain(
    "from public.clair_list_order_catalog_chart_search_v2_phase2_base(p_workspace_id)",
  );
  expect(migration).toContain("private.clair_catalog_effective_default_detail_inputs(item)");
  expect(migration).toContain("private.clair_catalog_effective_default_detail_inputs(catalog)");
  expect(migration).toContain("catalog.clinical_use_allowed");
  expect(migration).toContain("private.clair_dispensing_service_review_allowed(");
  expect(migration).toContain("'defaultDetailInputPolicies', catalog.default_detail_input_policies");
  expect(migration).toContain("'executionPresetLineage'");
  expect(migration).toContain("'sourceExecutionPresetId', catalog.source_execution_preset_id");
  expect(migration).toContain("'sourceExecutionPresetRevision', catalog.source_execution_preset_revision");
  expect(migration).toContain("'sourceExecutionPresetSha256', catalog.source_execution_preset_sha256");
  expect(migration).toContain("'presetStatus', (");
  expect(migration).toContain("'clinicalUseAllowed', (");
  expect((migration.match(/'presetStatus', \(/g) ?? []).length).toBeGreaterThanOrEqual(3);
  expect((migration.match(/'clinicalUseAllowed', \(/g) ?? []).length).toBeGreaterThanOrEqual(3);
  expect(migration).toContain(
    "grant execute on function public.clair_list_order_catalog_chart_search_v2(text)\n  to authenticated",
  );
});

test("snapshot transport preserves PR-020 price and review behavior and carries generic defaults", () => {
  expect(migration).toContain("v_price_basis := coalesce(c.pricing_rule ->> 'priceBasis', 'unit_price')");
  expect(migration).toContain("when v_price_basis = 'fixed_order_price' then coalesce(c.price_krw, 0)");
  expect(migration).toContain("private.clair_round_catalog_order_amount(");
  expect(migration).toContain("private.clair_dispensing_service_review_catalog_item_allowed(");
  expect(migration).toContain("'defaultDetailInputs', private.clair_catalog_effective_default_detail_inputs(c)");
  expect(migration).toContain("'defaultDetailInputPolicies', c.default_detail_input_policies");
  expect(migration).toContain("'executionPresetLineage'");
  expect(migration).toContain("'presetStatus', (");
  expect(migration).toContain("'clinicalUseAllowed', (");
  expect(migration).toContain("'workspaceDispensingReview'");
  expect(migration).not.toMatch(/update\s+public\.orders\b/i);
  expect(migration).not.toMatch(/update\s+public\.order_fulfillment_work_items\b/i);
  expect(migration).not.toMatch(/update\s+public\.invoice_/i);
  expect(latestSearchAndSnapshot).toContain("source_set_pending_review_count integer");
  expect(latestPricingSnapshot).toContain("when v_price_basis = 'fixed_order_price'");
});

test("catalog writers accept validated defaults but protect preset lineage and preserve CAS/audit", () => {
  expect(migration).toContain("create or replace function public.clair_update_order_catalog_item_a2_unlocked(");
  expect(migration).toContain("create or replace function private.clair_update_workspace_dispensing_order(");
  expect(migration).toContain("create or replace function public.clair_create_workspace_dispensing_order(");
  expect(migration).toContain("create or replace function public.clair_create_order_catalog_item_pr020_legacy(");
  const legacyCreateStart = migration.indexOf(
    "create or replace function public.clair_create_order_catalog_item_pr020_legacy(",
  );
  const legacyCreateEnd = migration.indexOf("$function$;", legacyCreateStart);
  expect(
    migration.slice(legacyCreateStart, legacyCreateEnd),
  ).toContain("default_detail_inputs,\n    default_detail_input_policies");
  expect(migration).toContain("private.clair_order_execution_preset_contract_is_valid(");
  expect(migration).toContain("catalog_default_detail_inputs_invalid");
  expect(migration).toContain("catalog_revision_conflict");
  expect(migration).toContain("catalog_revision = v_next.catalog_revision");
  expect(latestPricingSnapshot).toContain("insert into public.audit_events");
  expect(migration).toContain("'defaultDetailInputs', (p_item).default_detail_inputs");
  expect(migration).toContain("'defaultDetailInputPolicies', (p_item).default_detail_input_policies");
  for (const protectedKey of [
    "sourceExecutionPresetId",
    "sourceExecutionPresetRevision",
    "sourceExecutionPresetSha256",
    "defaultDetailInputPolicies",
  ]) {
    expect(migration).toContain(protectedKey);
  }
  expect(migration).toContain("catalog_protected_field_rejected:%");
  expect(migration).toContain("catalog_default_detail_inputs_alias_conflict");
  expect(migration).toContain(
    "v_next.pricing_rule := coalesce(v_next.pricing_rule, v_item.pricing_rule, '{}'::jsonb)",
  );
  expect(migration).toContain(
    "coalesce(pg_catalog.to_jsonb(v_next.price_krw), 'null'::jsonb)",
  );
  expect(migration).toContain("then 'order_catalog.paused' else 'order_catalog.updated' end");
  expect(migration).toContain("then 'pause' else 'update' end");
  expect(migration).toContain("grant execute on function public.clair_create_workspace_dispensing_order(text, jsonb)\n  to authenticated");
  expect(migration).toContain(
    "default_detail_inputs,\n    default_detail_input_policies\n  ) values (",
  );
});

test("dispensing compatibility mirrors nested defaults and fixes explicit empty fallback", () => {
  expect(migration).toContain("catalog_default_detail_inputs_mirror_conflict");
  expect(migration).toContain("v_next.medication_metadata -> 'defaultDetailInputs'");
  expect(migration).toContain("v_next.default_detail_inputs := v_nested");
  expect(migration).toContain("v_next.medication_metadata := pg_catalog.jsonb_set(");
  expect(migration).toContain("if v_generic <> '{}'::jsonb then");
  expect(migration).toContain(
    "Empty generic means \"use the legacy nested value\"",
  );
  expect(migration).toContain("private.clair_validate_workspace_dispensing_preset(");
});

test("security-definer transport functions use an empty search path and deny internal execution", () => {
  const securityDefinerCount = (migration.match(/security definer\nset search_path = ''/g) ?? []).length;
  expect(securityDefinerCount).toBeGreaterThanOrEqual(7);
  expect(migration).toContain("revoke all on function public.clair_update_order_catalog_item_a2_unlocked(");
  expect(migration).toContain("revoke all on function public.clair_update_order_catalog_item_a2_base(");
  expect(migration).toContain("revoke all on function private.clair_update_workspace_dispensing_order(");
  expect(migration).toContain("revoke all on function public.clair_create_order_catalog_item_pr020_legacy(");
  expect(migration).toContain("revoke all on function public.clair_create_workspace_dispensing_order(text, jsonb)");
  expect(migration).toContain("from public, anon, authenticated, service_role");
  expect(migration).not.toContain("grant execute on function public.clair_update_order_catalog_item_a2_base(");
  expect(migration).not.toContain("grant execute on function public.clair_update_order_catalog_item_a2_unlocked(");
  expect(migration).not.toContain("grant execute on function private.clair_update_workspace_dispensing_order(");
  expect(migration).not.toContain("grant execute on function public.clair_create_order_catalog_item_pr020_legacy(");
});

test("catalog writers enforce the canonical service-catalog permission at the DB boundary", () => {
  const writerSignatures = [
    "public.clair_update_order_catalog_item_a2_unlocked(",
    "public.clair_update_order_catalog_item_a2_base(",
    "private.clair_update_workspace_dispensing_order(",
    "public.clair_create_workspace_dispensing_order(",
    "public.clair_create_order_catalog_item_pr020_legacy(",
  ];

  for (const signature of writerSignatures) {
    const start = migration.indexOf(`create or replace function ${signature}`);
    expect(start, `${signature} definition`).toBeGreaterThanOrEqual(0);
    const bodyStart = migration.indexOf("as $function$", start);
    const bodyEnd = migration.indexOf("$function$;", bodyStart);
    expect(bodyStart, `${signature} body`).toBeGreaterThan(start);
    expect(bodyEnd, `${signature} terminator`).toBeGreaterThan(bodyStart);
    const body = migration.slice(bodyStart, bodyEnd);
    expect(body).toContain("private.clair_current_user_has_workspace_permission(");
    expect(body).toContain("'service_catalog:manage'");
    expect(body).not.toContain("private.clair_is_workspace_admin(");
  }

  // A role label in an exception is only a compatibility error code/message;
  // authorization itself must come from the canonical permission helper above.
  expect(migration).not.toContain("private.clair_is_workspace_admin(p_workspace_id)");
  expect(
    (migration.match(/private\.clair_current_user_has_workspace_permission\(/g) ?? []).length,
  ).toBeGreaterThanOrEqual(6);
});
