import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const migrationPath =
  "supabase/migrations/20260714213000_workspace_member_activity_presence.sql";

test("member activity stores only workspace-scoped throttled last-seen timestamps", () => {
  const migration = readFileSync(migrationPath, "utf8");

  expect(migration).toContain("create table if not exists public.workspace_member_activity");
  expect(migration).toContain("primary key (workspace_id, user_id)");
  expect(migration).toContain("references public.user_memberships (workspace_id, user_id)");
  expect(migration).toContain("last_seen_at timestamptz");
  expect(migration).not.toMatch(/is_online|session|refresh_token/i);
  expect(migration).toContain("enable row level security");
  expect(migration).toContain("private.clair_is_active_workspace_member(workspace_id)");
  expect(migration).toContain("v_user_id uuid := auth.uid()");
  expect(migration).toContain("interval '60 seconds'");
  expect(migration).toContain("revoke all on table public.workspace_member_activity");
  expect(migration).toContain("grant select on table public.workspace_member_activity to authenticated");
  expect(migration).toContain("grant execute on function public.clair_touch_workspace_member_activity(text)");
});

test("staff Presence is private and restricted to active members of its topic workspace", () => {
  const migration = readFileSync(migrationPath, "utf8");

  expect(migration).toContain("realtime.messages.extension = 'presence'");
  expect(migration).toContain("for select");
  expect(migration).toContain("for insert");
  expect(migration).toContain("workspace:([^:]+):staff-presence");
  expect(migration).toContain("private.clair_is_active_workspace_member");
  expect(migration).not.toContain("using (true)");
  expect(migration).not.toContain("with check (true)");
});
