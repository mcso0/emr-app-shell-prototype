import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

const source = readFileSync(
  "supabase/migrations/20260711164859_workspace_job_position_lifecycle.sql",
  "utf8"
);

test("job position lifecycle stores deactivation metadata without rewriting members", () => {
  expect(source).toContain("deactivated_at");
  expect(source).toContain("deactivated_by_user_id");
  expect(source).toContain("public.clair_update_workspace_job_position_lifecycle");
  expect(source).not.toMatch(/update\s+public\.workspace_membership_job_position_assignments/i);
});

test("job position lifecycle only replaces pending invitation assignments", () => {
  expect(source).toContain("replacement_position_required");
  expect(source).toContain("replacement_position_invalid");
  expect(source).toContain("invitation.status = 'pending'");
  expect(source).toContain("retainedMembershipCount");
  expect(source).toContain("pendingInvitationCount");
});

test("job position lifecycle RPC is permission checked and narrowly granted", () => {
  expect(source).toContain("role_permission:manage required");
  expect(source).toContain("security definer");
  expect(source).toContain("set search_path = public, private, extensions");
  expect(source).toContain("from public, anon");
  expect(source).toContain("to authenticated");
  expect(source).toContain(
    "revoke all on function public.clair_update_workspace_membership_job_position"
  );
});
