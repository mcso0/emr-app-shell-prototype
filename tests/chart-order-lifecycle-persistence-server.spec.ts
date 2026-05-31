import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockChartOrderLifecycleGateway,
  createSupabaseChartOrderLifecycleGateway,
  saveChartOrderLifecycleStatus,
} from "../src/features/chart/server-order-lifecycle-persistence-core";

const workspaceId = "clair-demo";
const encounterId = "encounter-kong-260501";
const orderId = "order-kong-maropitant";
const migrationPath = "supabase/migrations/20260519230000_chart_order_lifecycle_persistence_rpc.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const lifecycleRoutePath =
  "src/app/api/workspaces/[workspaceId]/chart/order-lifecycle/route.ts";

const validLifecycleInput = {
  encounterId,
  orderId,
  status: "in_progress" as const,
};

test("order lifecycle route updates selected order status via mock fallback and reads after save", async ({
  request,
}) => {
  const unauthenticated = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-lifecycle`,
    { data: validLifecycleInput }
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const initialRead = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-lifecycle?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } }
  );
  expect(initialRead.status()).toBe(200);
  const initialReadBody = await initialRead.json() as {
    ok: true;
    lifecycles: Array<{ orderId: string; status: typeof validLifecycleInput.status }>;
  };
  const currentStatus =
    initialReadBody.lifecycles.find((row) => row.orderId === orderId)?.status ??
    validLifecycleInput.status;

  const saved = await request.patch(`/api/workspaces/${workspaceId}/chart/order-lifecycle`, {
    data: { ...validLifecycleInput, status: currentStatus },
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(saved.status()).toBe(200);
  const savedBody = await saved.json() as {
    ok: true;
    lifecycle: { orderId: string; status: string; updatedByUserId?: string };
    enforcedBy: string;
  };

  expect(savedBody.enforcedBy).toBe("chart-order-lifecycle-persistence");
  expect(savedBody.lifecycle).toMatchObject({
    orderId,
    status: currentStatus,
    updatedByUserId: "user-vet",
  });

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-lifecycle?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } }
  );
  expect(readBack.status()).toBe(200);
  const readBody = await readBack.json() as {
    ok: true;
    lifecycles: Array<{ orderId: string; status: string }>;
  };
  expect(readBody.lifecycles.find((row) => row.orderId === orderId)?.status).toBe(currentStatus);
});

test("order lifecycle core rejects invalid transitions, permission gaps, and encounter scope mismatches", async () => {
  const invalidTransition = await saveChartOrderLifecycleStatus({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      encounterId,
      orderId,
      status: "completed",
    },
    gateway: createMockChartOrderLifecycleGateway(undefined, () => "2026-05-19T17:00:00.000Z"),
  });
  expect(invalidTransition).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "invalid_transition",
  });

  const frontDeskDenied = await saveChartOrderLifecycleStatus({
    actorUserId: "user-front-desk",
    workspaceId,
    input: validLifecycleInput,
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

  const crossWorkspaceDenied = await saveChartOrderLifecycleStatus({
    actorUserId: "user-vet",
    workspaceId: "other-workspace",
    input: validLifecycleInput,
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
});

test("order lifecycle Supabase gateway keeps status, actor, workspace, encounter, and order in RPC calls", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseChartOrderLifecycleGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(`${functionName}:${args.p_status ?? "read"}:${args.p_workspace_id}:${args.p_encounter_id}:${args.p_actor_user_id ?? "read"}`);
      return {
        data: [
          {
            encounterId,
            orderId: "00000000-0000-4000-8000-000000000301",
            status: "completed",
            updatedAt: "2026-05-19T17:00:00.000Z",
            updatedByUserId: "00000000-0000-4000-8000-000000000002",
          },
        ],
        error: null,
      };
    },
  });

  const result = await gateway.saveOrderLifecycleStatus({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId,
    orderId: "00000000-0000-4000-8000-000000000301",
    status: "completed",
  });

  expect(calls).toEqual([
    `clair_save_chart_order_lifecycle:completed:${workspaceId}:${encounterId}:00000000-0000-4000-8000-000000000002`,
  ]);
  expect(result).toMatchObject({
    ok: true,
    lifecycles: [{ status: "completed" }],
  });
});

test("order lifecycle route resolves demo encounter aliases before live RPC access", () => {
  const routeSource = readFileSync(lifecycleRoutePath, "utf8");

  expect(routeSource).toContain("resolveServerChartEncounterId");
  expect(routeSource).toContain("SupabaseEncounterIdBridgeClient");
  expect(routeSource).toContain("encounterId: resolvedEncounter.encounterId");
  expect(routeSource).toContain(
    "input: { ...input, encounterId: resolvedEncounter.encounterId }",
  );
});

test("order lifecycle persistence migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain("create or replace function public.clair_get_chart_order_lifecycle");
  expect(migration).toContain("create or replace function public.clair_save_chart_order_lifecycle");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migration).toContain("invalid_transition");
  expect(migration).toContain("order_events");
  expect(migration).toContain("grant execute on function public.clair_save_chart_order_lifecycle");
  expect(migration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
});

async function expectJson(response: { json(): Promise<unknown> }, expected: Record<string, unknown>) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
