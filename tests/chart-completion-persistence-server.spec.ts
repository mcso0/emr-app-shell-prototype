import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  completeChart,
  createMockChartCompletionGateway,
  createSupabaseChartCompletionGateway,
} from "../src/features/chart/server-chart-completion-core";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const migrationPath = "supabase/migrations/20260519190000_chart_completion_persistence_rpc.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

const validCompletionInput = {
  encounterId,
};

test("chart completion route requires an actor, saves via mock fallback, and reads after save", async ({
  request,
}) => {
  const unauthenticated = await request.patch(
    `/api/workspaces/${workspaceId}/chart/completion`,
    { data: validCompletionInput }
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const saved = await request.patch(`/api/workspaces/${workspaceId}/chart/completion`, {
    data: validCompletionInput,
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(saved.status()).toBe(200);
  const savedBody = await saved.json() as {
    ok: true;
    completion: {
      encounterId: string;
      status: string;
      chartCompletedAt?: string;
      chartCompletedByUserId?: string;
    };
    enforcedBy: string;
  };

  expect(savedBody.ok).toBe(true);
  expect(savedBody.enforcedBy).toBe("chart-completion-persistence");
  expect(savedBody.completion).toMatchObject({
    encounterId,
    status: "ready_for_billing",
    chartCompletedByUserId: "user-vet",
  });
  expect(savedBody.completion.chartCompletedAt).toBeTruthy();

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/chart/completion?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } }
  );
  expect(readBack.status()).toBe(200);
  const readBody = await readBack.json() as {
    ok: true;
    completion: { chartCompletedAt?: string; status: string };
  };
  expect(readBody.completion.status).toBe("ready_for_billing");
  expect(readBody.completion.chartCompletedAt).toBe(savedBody.completion.chartCompletedAt);
});

test("chart completion core enforces active workspace membership, chart update permission, and encounter scope", async () => {
  const frontDeskDenied = await completeChart({
    actorUserId: "user-front-desk",
    workspaceId,
    input: validCompletionInput,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-front-desk", status: "active" }],
      memberships: [
        {
          id: "membership-front-desk",
          workspaceId,
          userId: "user-front-desk",
          roles: ["front_desk"],
          status: "active",
        },
      ],
    }),
  });
  expect(frontDeskDenied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });

  const crossWorkspaceDenied = await completeChart({
    actorUserId: "user-vet",
    workspaceId: "other-workspace",
    input: validCompletionInput,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-vet", status: "active" }],
      memberships: [
        {
          id: "membership-vet-other",
          workspaceId: "other-workspace",
          userId: "user-vet",
          roles: ["vet"],
          status: "active",
        },
      ],
    }),
  });
  expect(crossWorkspaceDenied).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "encounter_unavailable",
  });

  const allowedVet = await completeChart({
    actorUserId: "user-vet",
    workspaceId,
    input: validCompletionInput,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-vet", status: "active" }],
      memberships: [
        {
          id: "membership-vet",
          workspaceId,
          userId: "user-vet",
          roles: ["vet"],
          status: "active",
        },
      ],
    }),
    gateway: createMockChartCompletionGateway(undefined, () => "2026-05-19T13:00:00.000Z"),
  });
  expect(allowedVet).toMatchObject({
    ok: true,
    status: 200,
    completion: {
      chartCompletedAt: "2026-05-19T13:00:00.000Z",
      chartCompletedByUserId: "user-vet",
      status: "ready_for_billing",
    },
  });
});

test("chart completion Supabase gateway keeps workspace and encounter scope in RPC calls", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseChartCompletionGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_encounter_id}`);
      return {
        data: {
          encounterId,
          workspaceId,
          status: "ready_for_billing",
          chartCompletedAt: "2026-05-19T13:00:00.000Z",
          chartCompletedByUserId: "00000000-0000-4000-8000-000000000002",
          updatedAt: "2026-05-19T13:00:00.000Z",
        },
        error: null,
      };
    },
  });

  const result = await gateway.completeChart({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId,
  });

  expect(calls).toEqual([`clair_complete_chart:${workspaceId}:${encounterId}`]);
  expect(result).toMatchObject({
    ok: true,
    completion: { encounterId, status: "ready_for_billing" },
  });
});

test("chart completion migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain("add column if not exists chart_completed_at");
  expect(migration).toContain("add column if not exists chart_completed_by_user_id");
  expect(migration).toContain("create or replace function public.clair_get_chart_completion");
  expect(migration).toContain("create or replace function public.clair_complete_chart");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migration).toContain("for update");
  expect(migration).toContain("then 'ready_for_billing'");
  expect(migration).toContain("signed_at");
  expect(migration).toContain("queue_type = 'consultation'");
  expect(migration).toContain("'billing'");
  expect(migration).toContain("grant execute on function public.clair_complete_chart");
  expect(migration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
});

test("chart completion route stays server-owned and secret-free", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/completion/route.ts",
    "utf8"
  );
  const serverSource = readFileSync(
    "src/features/chart/server-chart-completion.ts",
    "utf8"
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET/i);
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
