import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const workspaceId = "clair-demo";
const headers = { "x-clair-demo-session-user-id": "user-vet" };
const routePath = "src/app/api/workspaces/[workspaceId]/app-shell/workspace-tabs/route.ts";
const migrationPath = "supabase/migrations/20260625090000_workspace_tabs_session.sql";

function buildPayload(route = `/w/${workspaceId}/treatment?encounterId=encounter-kong-260501&modulePanel=open`) {
  return {
    activeTabId: "tab-chart-kong",
    tabs: [
      {
        id: "tab-chart-kong",
        title: "진료/차트",
        closable: false,
        history: [route],
        historyIndex: 0,
        moduleId: "treatment",
        surfaceType: "encounter",
        surfaceId: "encounter-kong-260501",
        dedupeKey: `${workspaceId}:encounter:encounter-kong-260501`,
        lastRoute: route,
        updatedAt: "2026-06-25T09:00:00.000Z",
        patientId: "patient-kong",
        encounterId: "encounter-kong-260501",
      },
    ],
  };
}

test("workspace tab session API requires an actor and active workspace membership", async ({ request }) => {
  const unauthenticated = await request.get(`/api/workspaces/${workspaceId}/app-shell/workspace-tabs`);
  expect(unauthenticated.status()).toBe(401);
  await expect(unauthenticated.json()).resolves.toMatchObject({
    ok: false,
    denialReason: "unauthenticated",
  });

  const nonMember = await request.get("/api/workspaces/other-workspace/app-shell/workspace-tabs", {
    headers,
  });
  expect(nonMember.status()).toBe(403);
  await expect(nonMember.json()).resolves.toMatchObject({
    ok: false,
    denialReason: "workspace_membership_missing",
  });
});

test("workspace tab session API upserts sanitized route identity payload", async ({ request }) => {
  const saved = await request.put(`/api/workspaces/${workspaceId}/app-shell/workspace-tabs`, {
    headers,
    data: buildPayload(),
  });
  expect(saved.status()).toBe(200);
  await expect(saved.json()).resolves.toMatchObject({
    ok: true,
    enforcedBy: "workspace-tabs-session",
    payload: {
      activeTabId: "tab-chart-kong",
      tabs: [
        {
          dedupeKey: `${workspaceId}:encounter:encounter-kong-260501`,
          encounterId: "encounter-kong-260501",
          surfaceType: "encounter",
        },
      ],
    },
  });

  const readBack = await request.get(`/api/workspaces/${workspaceId}/app-shell/workspace-tabs`, {
    headers,
  });
  expect(readBack.status()).toBe(200);
  await expect(readBack.json()).resolves.toMatchObject({
    ok: true,
    payload: {
      activeTabId: "tab-chart-kong",
      tabs: [{ id: "tab-chart-kong", surfaceId: "encounter-kong-260501" }],
    },
  });
});

test("workspace tab session API rejects unsafe payloads and display-name leakage", async ({ request }) => {
  const crossWorkspaceRoute = "/w/other-workspace/treatment?encounterId=encounter-kong-260501";
  const crossWorkspace = await request.put(`/api/workspaces/${workspaceId}/app-shell/workspace-tabs`, {
    headers,
    data: buildPayload(crossWorkspaceRoute),
  });
  expect(crossWorkspace.status()).toBe(400);
  await expect(crossWorkspace.json()).resolves.toMatchObject({
    ok: false,
    error: "invalid_input",
  });

  const leakingPayload = buildPayload();
  const leaking = await request.put(`/api/workspaces/${workspaceId}/app-shell/workspace-tabs`, {
    headers,
    data: {
      ...leakingPayload,
      tabs: [
        {
          ...leakingPayload.tabs[0],
          patientName: "콩이",
        },
      ],
    },
  });
  expect(leaking.status()).toBe(400);
});

test("workspace tab session route and migration keep server-owned workspace scope", () => {
  const route = readFileSync(routePath, "utf8");
  const migration = readFileSync(migrationPath, "utf8");

  expect(route).toContain("readServerSession");
  expect(route).toContain("resolveRoleUpdateActorIdentity");
  expect(route).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(route).not.toMatch(/localStorage|sessionStorage|window\./);
  expect(migration).toContain("create table if not exists public.user_workspace_tab_sessions");
  expect(migration).toContain("unique (workspace_id, user_id)");
  expect(migration).toContain("private.clair_is_active_workspace_member(workspace_id)");
  expect(migration).toContain("Do not store patient/guardian display names");
});
