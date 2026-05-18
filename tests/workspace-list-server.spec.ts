import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test("workspace list server route requires an actor and preserves mock fallback", async ({
  request,
}) => {
  const unauthenticated = await request.get("/api/workspaces");
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const mockFallback = await request.get("/api/workspaces", {
    headers: { "x-clair-demo-session-user-id": "user-admin" },
  });
  expect(mockFallback.status()).toBe(200);
  await expectJson(mockFallback, {
    ok: true,
    workspaces: [],
    enforcedBy: "workspace-membership-reader",
  });
});

test("workspace list route defines persisted membership reader boundary", () => {
  const routeSource = readFileSync("src/app/api/workspaces/route.ts", "utf8");
  const readerSource = readFileSync("src/features/auth/server-workspace-list.ts", "utf8");
  const migrationSource = readFileSync(
    "supabase/migrations/20260518121000_workspace_membership_list_reader.sql",
    "utf8"
  );

  expect(routeSource).toContain("listActorWorkspaces");
  expect(routeSource).toContain("readServerSession");
  expect(readerSource).toContain('import "server-only"');
  expect(readerSource).not.toMatch(/service_role|sb_secret|SUPABASE_SECRET/);
  expect(migrationSource).toContain("create or replace function public.clair_list_active_workspaces_for_current_user");
  expect(migrationSource).toContain("auth.uid()");
  expect(migrationSource).toContain("grant execute on function public.clair_list_active_workspaces_for_current_user");
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
