import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const migration = readFileSync(
  "supabase/migrations/20260901131810_clinical_master_beta_order_activation.sql",
  "utf8",
);

test("beta activation is pinned to the exact reviewed master set and synthetic workspaces", () => {
  expect(migration).toContain("647629e9-41fe-4d75-a572-99f34bf428ea");
  expect(migration).toContain(
    "bf03699073c59eb8344ae2011810dfad986ced4134e267e2bf4747b0bdd4f1bc",
  );
  expect(migration).toContain("release_row.release_no = 50");
  expect(migration).toContain("release_row.status = 'published'");
  expect(migration).toContain("'clair-demo'");
  expect(migration).toContain("'workspace-clair-cheongdam'");
  expect(migration).toContain("'workspace-clinical-master-pilot-v1'");
  expect(migration).toContain("'clair-foreign-demo'");
  expect(migration).toContain("v_reviewer_label constant text := '이수지 수의사'");
  expect(migration).toContain("'offline_master_order_validation'");
  expect(migration).toContain("'synthetic_beta_service_validation'");
});

test("approval evidence is private, immutable, and records one exact batch", () => {
  expect(migration).toContain(
    "create table if not exists master.order_execution_preset_activation_batches",
  );
  expect(migration).toContain("compatibility_preset_count = 108");
  expect(migration).toContain("before update or delete on master.order_execution_preset_activation_batches");
  expect(migration).toContain(
    "alter table master.order_execution_preset_activation_batches enable row level security",
  );
  expect(migration).toContain(
    "revoke all on table master.order_execution_preset_activation_batches",
  );
  expect(migration).toContain(
    "unique (source_release_id, approval_reference)",
  );
  expect(migration).toContain(
    "on conflict (source_release_id, approval_reference) do nothing",
  );
  expect(migration).not.toMatch(
    /grant\s+(?:select|insert|update|delete|all).*order_execution_preset_activation_batches/i,
  );
});

test("review creates append-only hash-valid revisions and advances only current pointers", () => {
  expect(migration).toContain("insert into master.order_execution_presets (");
  expect(migration).toContain("'clinically_reviewed'");
  expect(migration).toContain("'clinicalUseAllowed', true");
  expect(migration).toContain(
    "private.clair_order_execution_preset_hash_content(",
  );
  expect(migration).toContain(
    "update master.order_execution_preset_current current_preset",
  );
  expect(migration).toContain("v_inserted_count <> 522");
  expect(migration).toContain("v_updated_pointer_count <> 522");
  expect(migration).not.toMatch(
    /update\s+master\.order_execution_presets\b/i,
  );
  expect(migration).not.toMatch(
    /delete\s+from\s+master\.order_execution_presets\b/i,
  );
});

test("pinned dispensing revisions receive 108 reviewed compatibility copies", () => {
  expect(migration).toContain(
    "'workspace_pinned_dispensing_profile'",
  );
  expect(migration).toContain(
    "item.source_master_revision <> current_version.order_record_revision",
  );
  expect(migration).toContain(
    "v_compatibility_inserted_count <> 108",
  );
  expect(migration).toContain(
    "clinical_master_beta_activation_compatibility_readback_mismatch",
  );
  expect(migration).not.toMatch(
    /update\s+master\.dispensing_order_profiles\b/i,
  );
});

test("workspace copy preserves names and prices while making all 522 selectable", () => {
  expect(migration).toContain("v_updated_catalog_count not in (0, 1566)");
  expect(migration).toContain(
    "array['defaultDetailInputs', 'default_detail_inputs', '*']::text[]",
  );
  expect(migration).toContain(
    "when item.source_dispensing_profile_id is not null\n          then 'pending_activation'",
  );
  expect(migration).toContain("else 'active'");
  expect(migration).toContain(
    "when item.source_dispensing_profile_id is null\n          and item.price_krw is null\n          then false",
  );
  expect(migration).toContain(
    "clinical_master_beta_activation_name_price_mutation",
  );
  expect(migration).toContain(
    "clinical_master_beta_activation_workspace_copy_mismatch",
  );
  expect(migration).toContain("<> 414");
  expect(migration).toContain("<> 108");
  expect(migration).not.toMatch(/set\s+in_hospital_order_name\s*=/i);
  expect(migration).not.toMatch(/set\s+billing_name\s*=/i);
  expect(migration).not.toMatch(/set\s+price_krw\s*=/i);
  expect(migration).not.toMatch(/set\s+sales_unit\s*=/i);
});

test("foreign, confirmed order, fulfillment, and billing rows remain outside the write set", () => {
  expect(migration).toContain("v_foreign_after is distinct from v_foreign_before");
  expect(migration).toContain(
    "clinical_master_beta_activation_foreign_workspace_mutation",
  );
  expect(migration).not.toMatch(/(?:insert into|update|delete from)\s+public\.orders\b/i);
  expect(migration).not.toMatch(
    /(?:insert into|update|delete from)\s+public\.encounter_orders\b/i,
  );
  expect(migration).not.toMatch(
    /(?:insert into|update|delete from)\s+public\.order_fulfillment_work_items\b/i,
  );
  expect(migration).not.toMatch(
    /(?:insert into|update|delete from)\s+public\.invoice_/i,
  );
});
