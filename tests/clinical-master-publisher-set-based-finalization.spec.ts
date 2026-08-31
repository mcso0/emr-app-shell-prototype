import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260831135847_clinical_master_publisher_set_based_finalization.sql",
  "utf8",
);

test("finalization migration replaces the exact row-wise tail once", () => {
  for (const marker of [
    "$old_finalization$",
    "$new_finalization$",
    "clinical_master_set_based_finalization_patch_anchor_missing",
    "clinical_master_set_based_finalization_patch_postcondition_failed",
  ]) {
    expect(migration).toContain(marker);
  }
  expect(migration).toContain("v_old_count=1 and v_new_count=0");
  expect(migration).toContain("v_old_count<>0 or v_new_count<>1");
  expect(migration).toContain("clinical_master_owner_stage_contract_invalid");
  expect(migration).toContain("clinical_master.publisher_canonical_sha256");
  expect(migration).toContain(
    "clinical_master_omitted_lab_dependency_revision_missing",
  );
});

test("new finalization derives the changed set only from the private release stage", () => {
  const newStart = migration.indexOf("$new_finalization$");
  const newEnd = migration.indexOf("$new_finalization$", newStart + 1);
  const finalization = migration.slice(newStart, newEnd);

  expect(finalization).toContain("with finalize as materialized (");
  expect(finalization).toContain("stage.release_id=v_release.id");
  expect(finalization).toContain("version.revision=stage.effective_revision");
  expect(finalization).toContain(
    "stage.base_content || stage.relation_content",
  );
  expect(finalization).toContain("records.value->'names'");
  expect(finalization).toContain("records.value->'source'");
  expect(finalization).not.toContain("create temporary table");
  expect(finalization).not.toContain("pg_temp.");
  expect(finalization).not.toContain("for v_record in");
  expect(finalization).not.toContain(
    "clinical_master_lab_relation_content(v_payload",
  );
});

test("names sources versions and review events are written in bounded sets", () => {
  for (const statement of [
    "delete from master.master_record_names",
    "insert into master.master_record_names(",
    "insert into master.master_sources(",
    "insert into master.master_record_sources(",
    "insert into master.master_record_versions(",
    "insert into master.master_review_events(",
  ]) {
    expect(migration).toContain(statement);
  }
  expect(migration).toContain("values ('validated'::text),('published'::text)");
  expect(migration).toContain("inserted_sources as (");
  expect(migration).toContain("inserted_links as (");
  expect(migration).toContain(
    "clinical_master_finalization_stage_contract_invalid",
  );
  expect(migration).toContain(
    "clinical_master_finalization_name_count_invalid",
  );
  expect(migration).toContain(
    "clinical_master_finalization_source_count_invalid",
  );
  expect(migration).toContain(
    "clinical_master_finalization_version_count_invalid",
  );
  expect(migration).toContain(
    "clinical_master_finalization_review_count_invalid",
  );
  expect(migration).toContain(
    "clinical_master_finalization_postcondition_failed",
  );
  expect(migration).toContain("version.release_id=v_release.id");
  expect(migration).toContain(
    "owner.current_revision is distinct from finalize.revision",
  );
  expect(migration).toContain(
    "owner.current_release_id is distinct from v_release.id",
  );
  expect(migration).toContain(
    "review.actor_user_id is not distinct from p_actor_user_id",
  );
  expect(migration).toContain(
    "review.actor_label is not distinct from v_payload->>'publishedByLabel'",
  );
});

test("dynamic replacement preserves the installed function security contract", () => {
  for (const attribute of [
    "function.proowner",
    "function.prosecdef",
    "function.proconfig",
    "function.proacl",
    "function.provolatile",
    "function.proparallel",
  ]) {
    expect(migration).toContain(attribute);
  }
  expect(migration).toContain(
    "clinical_master_set_based_finalization_security_contract_changed",
  );
  expect(migration).toContain(
    "revoke all on function private.publish_clinical_master_release_cumulative(jsonb,uuid)",
  );
});

test("finalization candidate stays inside the private master publisher boundary", () => {
  expect(migration).not.toMatch(
    /(?:insert into|update|delete from)\s+public\./i,
  );
  expect(migration).not.toMatch(/\badopt_clinical_master_release\s*\(/i);
  expect(migration).not.toMatch(/clinicalUseAllowed'\s*,\s*true/i);
  expect(migration).not.toMatch(
    /statement_timeout\s*=\s*'[^']*(?:3|4|5|6|7|8|9)\d{2}s'/i,
  );
  expect(migration).not.toMatch(
    /create or replace function private\.publish_clinical_master_release\s*\(/i,
  );
});
