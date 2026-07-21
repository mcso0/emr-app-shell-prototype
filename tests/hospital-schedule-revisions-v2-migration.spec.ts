import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const migrationPath = "supabase/migrations/20260721100000_hospital_schedule_revisions_v2.sql";

test("v2 schedule migration is additive, normalized, and protected by RPC/RLS boundaries", () => {
  const migration = readFileSync(migrationPath, "utf8");

  for (const table of [
    "hospital_schedule_revisions",
    "hospital_schedule_revision_validations",
    "hospital_schedule_work_blocks",
    "hospital_schedule_non_work_entries",
    "hospital_schedule_idempotency_requests",
    "hospital_schedule_workspace_policies",
    "hospital_schedule_required_job_positions",
  ]) {
    expect(migration).toContain(`public.${table}`);
    expect(migration).toContain(`alter table public.${table} enable row level security;`);
  }

  expect(migration).toContain("hospital_schedule_revisions_one_draft_per_week_idx");
  expect(migration).toContain("latest_published_revision_invalid");
  expect(migration).toContain("published_schedule_revision_immutable");
  expect(migration).toContain("hospital_schedule_v2_work_block_week_guard");
  expect(migration).toContain("hospital_schedule_v2_non_work_week_guard");
  expect(migration).toContain("schedule_work_block_overlaps_existing");
  expect(migration).toContain("schedule_work_block_overlaps_non_work");
  expect(migration).toContain("schedule_hospital_closed");
  expect(migration).toContain("schedule_work_block_outside_operating_hours");
  expect(migration).toContain("idempotency_key_reused");
  expect(migration).toContain("stale_schedule_revision");
  expect(migration).toContain("publication_blocked:");
  expect(migration).toContain("clair_schedule_v2_append_audit");
  expect(migration).toContain("hospital.schedule_revision_mutated");
  expect(migration).toContain("private.hospital_schedule_rollout_modes");
  expect(migration).toContain("'v1', 'compare', 'v2'");

  for (const rpc of [
    "hospital_schedule_resolve_week_start",
    "hospital_schedule_get_rollout_mode",
    "hospital_schedule_resolve_revision_week_start",
    "hospital_schedule_read_revision_snapshot",
    "hospital_schedule_verify_profile_readback_v2",
    "hospital_schedule_create_draft_v2",
    "hospital_schedule_validate_revision_v2",
    "hospital_schedule_save_work_block_v2",
    "hospital_schedule_save_non_work_entry_v2",
    "hospital_schedule_delete_entry_v2",
    "hospital_schedule_discard_draft_v2",
    "hospital_schedule_publish_revision_v2",
  ]) {
    expect(migration).toContain(`function public.${rpc}`);
  }

  expect(migration).toContain("on conflict (workspace_id, week_start) do nothing");
  expect(migration).toContain("where shift.shift_kind in ('clinical', 'support', 'reception')");
  expect(migration).toContain("where shift.shift_kind in ('leave', 'off')");
  expect(migration).toContain("hospital_schedule_read_profile_schedule");
  expect(migration).toContain("profile_projection_entry_count_mismatch");
  expect(migration).toContain("'publishedRevisions'");
  expect(migration).toContain("clair_staff_current_work_status_snapshot_v2");
});
