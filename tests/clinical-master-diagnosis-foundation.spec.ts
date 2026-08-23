import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const migrationPath =
  "supabase/migrations/20260823035126_clinical_master_diagnosis_foundation.sql";
const predecessorPath =
  "supabase/migrations/20260819172501_clinical_master_phase1b1_laboratory_slice.sql";
const replayPath =
  "supabase/snippets/clinical_master_diagnosis_foundation_replay.sql";

const migration = readFileSync(migrationPath, "utf8");
const predecessor = readFileSync(predecessorPath, "utf8");
const replay = readFileSync(replayPath, "utf8");

test("PR-007 reserves only the private diagnosis schema and preserves predecessor files", () => {
  for (const token of [
    "clinical_master_diagnosis_foundation_preflight_phase1_schema_missing",
    "clinical_master_diagnosis_foundation_preflight_publisher_missing",
    "clinical_master_diagnosis_foundation_preflight_record_type_check_missing",
    "clinical_master_diagnosis_foundation_preflight_unexpected_record_type",
    "drop constraint master_records_record_type_check;",
    "add constraint master_records_record_type_check",
    "'result_input_type', 'lab_test', 'lab_panel',\n    'diagnosis_category', 'diagnosis'",
    "'diagnosis_category', 'diagnosis'",
    "create table if not exists master.diagnosis_categories",
    "create table if not exists master.diagnoses",
    "create table if not exists master.diagnosis_category_links",
    "category_kind text not null check (category_kind in ('system', 'disease_group'))",
    "parent_category_id uuid references master.diagnosis_categories(master_record_id)",
    "constraint master_diagnosis_category_links_pkey",
    "constraint master_diagnosis_category_links_diagnosis_sort_key",
    "unique (diagnosis_record_id, sort_order)",
    "master_diagnosis_category_links_one_primary_key",
    "master_diagnosis_categories_type_guard",
    "master_diagnoses_type_guard",
    "master_diagnosis_category_links_target_guard",
    "master_diagnoses_link_completeness",
    "master_diagnosis_category_links_completeness",
    "deferrable initially deferred",
    "clinical_master_diagnosis_link_target_must_be_disease_group",
    "clinical_master_diagnosis_link_required_at_commit",
    "clinical_master_diagnosis_exactly_one_primary_at_commit",
    "clinical_master_typed_projection_immutable",
    "clinical_master_typed_identity_immutable",
    "clinical_master_diagnosis_category_kind_immutable",
    "alter table master.diagnosis_categories enable row level security",
    "alter table master.diagnoses enable row level security",
    "alter table master.diagnosis_category_links enable row level security",
    "comment on table master.diagnosis_categories",
    "comment on table master.diagnoses",
    "comment on table master.diagnosis_category_links",
    "revoke all on master.diagnosis_categories, master.diagnoses, master.diagnosis_category_links",
    "revoke all on schema master from public, anon, authenticated, service_role;",
    "revoke all on function master.assert_diagnosis_category_parent()",
    "revoke all on function master.reject_diagnosis_category_kind_mutation()",
    "revoke all on function master.assert_diagnosis_link_target()",
    "revoke all on function master.assert_diagnosis_link_completeness()",
  ]) {
    expect(migration).toContain(token);
  }

  const preflightStart = migration.indexOf(
    "if exists (\n    select 1\n    from master.master_records",
  );
  const preflightEnd = migration.indexOf("end\n$$;", preflightStart);
  expect(preflightStart).toBeGreaterThanOrEqual(0);
  expect(preflightEnd).toBeGreaterThan(preflightStart);
  expect(migration.slice(preflightStart, preflightEnd)).toContain(
    "'diagnosis_category', 'diagnosis'",
  );

  expect(migration).not.toMatch(
    /create\s+or\s+replace\s+function\s+private\.publish_clinical_master_release/i,
  );
  expect(migration).not.toMatch(/\bcreate\s+policy\b/i);
  for (const forbidden of [
    "public.diagnosis_catalog",
    "public.diagnoses",
    "public.chart",
    "public.workspace",
    "airtable",
    "care_guide",
  ]) {
    expect(migration.toLowerCase()).not.toContain(forbidden);
  }

  const changedMigrationFiles = execFileSync(
    "git",
    ["diff", "--name-only", "--", "supabase/migrations"],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter(Boolean);
  expect(changedMigrationFiles).not.toContain(predecessorPath);
  expect(changedMigrationFiles).not.toContain(
    "supabase/migrations/20260818120000_clinical_master_phase_1a1_private_foundation.sql",
  );
});

test("PR-007 keeps hierarchy, target, identity, and deferred completeness boundaries explicit", () => {
  expect(migration).toContain(
    "if new.category_kind = 'system' and new.parent_category_id is not null",
  );
  expect(migration).toContain(
    "if new.category_kind = 'disease_group' and new.parent_category_id is null",
  );
  expect(migration).toContain("parent.category_kind = 'system'");
  expect(migration).toContain("category.category_kind = 'disease_group'");
  expect(migration).toContain("before update or delete on master.diagnosis_categories");
  expect(migration).toContain("before update or delete on master.diagnoses");
  expect(migration).toContain("count(*) filter (where link.is_primary)");
  expect(migration).toContain("where candidate is not null");
  expect(migration).toContain("when tg_table_name = 'diagnoses'");
  expect(migration).toContain("when tg_table_name = 'diagnosis_category_links'");
  expect(migration).toContain(
    "pg_catalog.to_jsonb(new)->>'master_record_id'",
  );
  expect(migration).toContain(
    "pg_catalog.to_jsonb(old)->>'diagnosis_record_id'",
  );
  expect(migration).toContain("if tg_op = 'DELETE' then");
  expect(migration).toContain(
    "then (pg_catalog.to_jsonb(old)->>'diagnosis_record_id')::uuid",
  );

  const completenessStart = migration.indexOf(
    "create or replace function master.assert_diagnosis_link_completeness()",
  );
  const completenessEnd = migration.indexOf(
    "drop trigger if exists master_diagnosis_categories_type_guard",
    completenessStart,
  );
  expect(completenessStart).toBeGreaterThanOrEqual(0);
  expect(completenessEnd).toBeGreaterThan(completenessStart);
  const completeness = migration.slice(completenessStart, completenessEnd);
  expect(completeness).not.toContain("new.diagnosis_record_id");
  expect(completeness).not.toContain("old.diagnosis_record_id");
});

test("the applied B1 publisher remains diagnosis-unsupported", () => {
  const publisherStart = predecessor.indexOf(
    "create or replace function private.publish_clinical_master_release(",
  );
  const publisherEnd = predecessor.indexOf(
    "revoke all on function private.publish_clinical_master_release",
    publisherStart,
  );
  expect(publisherStart).toBeGreaterThanOrEqual(0);
  expect(publisherEnd).toBeGreaterThan(publisherStart);
  const publisher = predecessor.slice(publisherStart, publisherEnd);
  expect(publisher).toContain(
    "if v_record_type not in ('order_category','clinical_action','chart_group','task_route','order','species','unit','specimen_type','result_input_type','lab_test','lab_panel')",
  );
  expect(publisher).not.toContain("'diagnosis_category'");
  expect(publisher).not.toContain("'diagnosis'");
});

test("schema replay is rollback-only and covers valid, invalid, security, and publisher boundaries", () => {
  for (const token of [
    "begin;",
    "rollback;",
    "clinical_master_diagnosis_foundation_replay_cleanup_ok",
    "pr007.replay.system",
    "pr007.replay.group",
    "pr007.replay.diagnosis",
    "clinical_master_diagnosis_foundation_replay_system_parent_accepted",
    "clinical_master_diagnosis_foundation_replay_missing_parent_accepted",
    "clinical_master_diagnosis_foundation_replay_group_under_group_accepted",
    "clinical_master_diagnosis_foundation_replay_type_mismatch_accepted",
    "clinical_master_diagnosis_foundation_replay_system_link_accepted",
    "clinical_master_diagnosis_foundation_replay_duplicate_link_accepted",
    "clinical_master_diagnosis_foundation_replay_duplicate_sort_accepted",
    "clinical_master_diagnosis_foundation_replay_missing_link_accepted",
    "clinical_master_diagnosis_foundation_replay_zero_primary_accepted",
    "clinical_master_diagnosis_foundation_replay_multiple_primary_accepted",
    "clinical_master_diagnosis_foundation_replay_category_rekey_accepted",
    "clinical_master_diagnosis_foundation_replay_category_delete_accepted",
    "clinical_master_diagnosis_foundation_replay_diagnosis_rekey_accepted",
    "clinical_master_diagnosis_foundation_replay_diagnosis_delete_accepted",
    "clinical_master_diagnosis_foundation_replay_publisher_accepted",
    "clinical_master_diagnosis_system_parent_forbidden",
    "clinical_master_diagnosis_disease_group_parent_required",
    "clinical_master_diagnosis_parent_must_be_system",
    "clinical_master_record_type_mismatch",
    "clinical_master_diagnosis_link_target_must_be_disease_group",
    "clinical_master_diagnosis_link_required_at_commit",
    "clinical_master_diagnosis_exactly_one_primary_at_commit",
    "clinical_master_diagnosis_category_kind_immutable",
    "clinical_master_typed_identity_immutable",
    "clinical_master_typed_projection_immutable",
    "v_constraint_name = constraint_name",
    "master_diagnosis_category_links_pkey",
    "master_diagnosis_category_links_diagnosis_sort_key",
    "master_diagnosis_category_links_one_primary_key",
    "clinical_master_record_type_not_allowed",
    "returned_sqlstate",
    "v_sqlstate <> '22023'",
    "v_release, 'clinical-master-pr-007-replay', 10,",
    "v_releases_before",
    "v_records_before",
    "v_versions_before",
    "v_review_events_before",
    "clinical_master_diagnosis_foundation_replay_publisher_global_counts_changed",
    "clinical_master_diagnosis_foundation_replay_publisher_residue",
    "clinical_master_diagnosis_foundation_replay_rls_missing",
    "clinical_master_diagnosis_foundation_replay_policy_present",
    "clinical_master_diagnosis_foundation_replay_public_diagnosis_changed",
    "v_catalog_exists",
    "v_catalog_rows_before",
    "v_catalog_fingerprint_before",
    "v_catalog_exists_after",
    "v_catalog_rows_after",
    "v_catalog_fingerprint_after",
    "v_public_diagnoses_exists",
    "v_public_diagnoses_rows_before",
    "v_public_diagnoses_fingerprint_before",
    "v_public_diagnoses_exists_after",
    "v_public_diagnoses_rows_after",
    "v_public_diagnoses_fingerprint_after",
    "jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text)",
    "md5(coalesce(",
    "array['public', 'anon', 'authenticated', 'service_role']",
    "aclexplode(",
    "privilege.grantee = 0",
    "has_schema_privilege(v_role, 'master', 'USAGE')",
    "has_table_privilege(v_role, v_table, 'SELECT')",
    "has_table_privilege(v_role, v_table, 'INSERT')",
    "has_table_privilege(v_role, v_table, 'UPDATE')",
    "has_table_privilege(v_role, v_table, 'DELETE')",
    "has_table_privilege(v_role, v_table, 'TRUNCATE')",
    "has_table_privilege(v_role, v_table, 'REFERENCES')",
    "has_table_privilege(v_role, v_table, 'TRIGGER')",
    "has_function_privilege(v_role, v_function, 'EXECUTE')",
    "master.assert_diagnosis_category_parent()",
    "master.reject_diagnosis_category_kind_mutation()",
    "master.assert_diagnosis_link_target()",
    "master.assert_diagnosis_link_completeness()",
    "set constraints all immediate",
    "set constraints all deferred",
  ]) {
    expect(replay).toContain(token);
  }
  for (const [message, sqlstate] of [
    ["clinical_master_diagnosis_system_parent_forbidden", "23514"],
    ["clinical_master_diagnosis_disease_group_parent_required", "23514"],
    ["clinical_master_diagnosis_parent_must_be_system", "23514"],
    ["clinical_master_record_type_mismatch", "23514"],
    ["clinical_master_diagnosis_link_target_must_be_disease_group", "23514"],
    ["clinical_master_diagnosis_link_required_at_commit", "23514"],
    ["clinical_master_diagnosis_exactly_one_primary_at_commit", "23514"],
    ["clinical_master_diagnosis_category_kind_immutable", "55000"],
    ["clinical_master_typed_identity_immutable", "55000"],
    ["clinical_master_typed_projection_immutable", "55000"],
  ]) {
    expect(replay).toContain(
      `v_error <> '${message}' or v_sqlstate <> '${sqlstate}'`,
    );
  }
  expect(replay).toContain("v_sqlstate <> '23505'");
  for (const constraint of [
    "master_diagnosis_category_links_pkey",
    "master_diagnosis_category_links_diagnosis_sort_key",
    "master_diagnosis_category_links_one_primary_key",
  ]) {
    expect(replay).toContain(
      `duplicate key value violates unique constraint \"${constraint}\"`,
    );
  }
  expect(replay).toContain("v_constraint_name <> 'master_diagnosis_category_links_pkey'");
  expect(replay).toContain(
    "v_constraint_name <> 'master_diagnosis_category_links_diagnosis_sort_key'",
  );
  expect(replay).toContain(
    "v_constraint_name <> 'master_diagnosis_category_links_one_primary_key'",
  );
  expect(replay).not.toMatch(
    /if\s+v_error\s*=\s*'clinical_master_diagnosis_foundation_replay_[^']+_accepted'/,
  );
  expect(replay).not.toContain(
    "get stacked diagnostics v_error = message_text;",
  );
  expect(replay.match(/exception when others then/g)?.length).toBe(
    replay.match(/get stacked diagnostics/g)?.length,
  );

  const validGraphEnd = replay.indexOf("  -- Parent and type guards.");
  const validGraph = replay.slice(replay.indexOf("  -- Valid system"), validGraphEnd);
  expect(validGraph).toContain(
    "set constraints all immediate;\n  set constraints all deferred;",
  );
  const laterValidGraphStart = replay.indexOf(
    "  insert into master.diagnoses(master_record_id) values (v_diag_multi), (v_diag_rekey);",
  );
  expect(laterValidGraphStart).toBeGreaterThan(validGraphEnd);
  const laterValidLinksStart = replay.indexOf(
    "  insert into master.diagnosis_category_links(diagnosis_record_id, diagnosis_category_id, is_primary, sort_order)\n  values (v_diag_multi, v_group, true, 0), (v_diag_rekey, v_group, true, 0);",
    laterValidGraphStart,
  );
  expect(laterValidLinksStart).toBeGreaterThan(laterValidGraphStart);
  const multiplePrimaryProbeStart = replay.indexOf(
    "  begin\n    insert into master.diagnosis_category_links(diagnosis_record_id, diagnosis_category_id, is_primary, sort_order)\n    values (v_diag_multi, v_group_two, true, 1);",
    laterValidLinksStart,
  );
  expect(multiplePrimaryProbeStart).toBeGreaterThan(laterValidLinksStart);
  expect(
    replay.slice(laterValidLinksStart, multiplePrimaryProbeStart),
  ).toContain("set constraints all immediate;\n  set constraints all deferred;");

  const identityGuardStart = replay.indexOf("  -- Typed identity guards", multiplePrimaryProbeStart);
  expect(identityGuardStart).toBeGreaterThan(multiplePrimaryProbeStart);
  expect(replay.slice(multiplePrimaryProbeStart, identityGuardStart)).toContain(
    "set constraints all deferred;",
  );
  expect(replay).not.toContain("commit;");
  expect(replay.lastIndexOf("rollback;")).toBeLessThan(
    replay.lastIndexOf("clinical_master_diagnosis_foundation_replay_cleanup_ok"),
  );
});
