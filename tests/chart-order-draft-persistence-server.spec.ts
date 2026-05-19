import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockChartOrderDraftGateway,
  createSupabaseChartOrderDraftGateway,
  saveChartOrderDraft,
} from "../src/features/chart/server-order-draft-persistence-core";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const migrationPath = "supabase/migrations/20260519210000_chart_order_draft_persistence_rpc.sql";
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

const validOrderDraftInput = {
  encounterId,
  orders: [
    {
      orderId: "order-coco-maropitant",
      billingDisplayName: "Maropitant 16mg T",
      quantity: 1,
    },
    {
      orderId: "order-coco-cbc",
      billingDisplayName: "CBC 검사 DEN-72 저장",
      quantity: 1,
    },
    {
      orderId: "order-coco-fluid",
      billingDisplayName: "피하 수액 처치",
      quantity: 1,
    },
    {
      orderId: "order-coco-thorax",
      billingDisplayName: "흉부 방사선 3cut",
      quantity: 1,
    },
  ],
};

test("order draft route requires an actor, saves via mock fallback, and reads after save", async ({
  request,
}) => {
  const unauthenticated = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-drafts`,
    { data: validOrderDraftInput }
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, { ok: false, denialReason: "unauthenticated" });

  const saved = await request.patch(`/api/workspaces/${workspaceId}/chart/order-drafts`, {
    data: validOrderDraftInput,
    headers: { "x-clair-demo-session-user-id": "user-vet" },
  });
  expect(saved.status()).toBe(200);
  const savedBody = await saved.json() as {
    ok: true;
    orderDrafts: Array<{
      billingDisplayName: string;
      encounterId: string;
      lineTotalSnapshot: number;
      orderId: string;
      quantity: number;
      unitPriceSnapshot: number;
    }>;
    enforcedBy: string;
  };

  expect(savedBody.enforcedBy).toBe("chart-order-draft-persistence");
  expect(savedBody.orderDrafts).toEqual(expect.arrayContaining([
    expect.objectContaining({
      billingDisplayName: "CBC 검사 DEN-72 저장",
      encounterId,
      lineTotalSnapshot: 35000,
      orderId: "order-coco-cbc",
      quantity: 1,
      unitPriceSnapshot: 35000,
    }),
    expect.objectContaining({
      billingDisplayName: "피하 수액 처치",
      encounterId,
      lineTotalSnapshot: 18000,
      orderId: "order-coco-fluid",
      quantity: 1,
      unitPriceSnapshot: 18000,
    }),
  ]));

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-drafts?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } }
  );
  expect(readBack.status()).toBe(200);
  const readBody = await readBack.json() as {
    ok: true;
    orderDrafts: Array<{ billingDisplayName: string; orderId: string }>;
  };
  expect(readBody.orderDrafts.map((row) => row.orderId)).toEqual([
    "order-coco-maropitant",
    "order-coco-cbc",
    "order-coco-fluid",
    "order-coco-thorax",
  ]);
  expect(readBody.orderDrafts.find((row) => row.orderId === "order-coco-cbc")?.billingDisplayName).toBe("CBC 검사 DEN-72 저장");
});

test("order draft core rejects invalid quantity and enforces permission plus encounter scope", async () => {
  const invalidQuantity = await saveChartOrderDraft({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      encounterId,
      orders: [{ orderId: "order-coco-cbc", billingDisplayName: "CBC", quantity: 0 }],
    },
  });
  expect(invalidQuantity).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: { orders: "오더 수량을 확인해 주세요." },
  });

  const frontDeskDenied = await saveChartOrderDraft({
    actorUserId: "user-front-desk",
    workspaceId,
    input: validOrderDraftInput,
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

  const crossWorkspaceDenied = await saveChartOrderDraft({
    actorUserId: "user-vet",
    workspaceId: "other-workspace",
    input: validOrderDraftInput,
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

  const allowedVet = await saveChartOrderDraft({
    actorUserId: "user-vet",
    workspaceId,
    input: validOrderDraftInput,
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
    gateway: createMockChartOrderDraftGateway(undefined, () => "2026-05-19T15:00:00.000Z"),
  });
  expect(allowedVet).toMatchObject({
    ok: true,
    status: 200,
  });
  expect(allowedVet.ok ? allowedVet.orderDrafts : []).toEqual(expect.arrayContaining([
      expect.objectContaining({
        billingDisplayName: "CBC 검사 DEN-72 저장",
        lineTotalSnapshot: 35000,
        orderId: "order-coco-cbc",
        updatedAt: "2026-05-19T15:00:00.000Z",
      }),
      expect.objectContaining({
        billingDisplayName: "피하 수액 처치",
        lineTotalSnapshot: 18000,
        orderId: "order-coco-fluid",
        updatedAt: "2026-05-19T15:00:00.000Z",
      }),
    ]));
});

test("order draft Supabase gateway keeps workspace, encounter, actor, and server amount fields in RPC calls", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseChartOrderDraftGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(`${functionName}:${args.p_workspace_id}:${args.p_encounter_id}:${args.p_actor_user_id ?? "read"}`);
      return {
        data: [
          {
            orderId: "00000000-0000-4000-8000-000000000101",
            encounterId,
            billingDisplayName: "CBC 검사 DEN-72 저장",
            quantity: 2,
            unitPriceSnapshot: 45000,
            lineTotalSnapshot: 90000,
            updatedAt: "2026-05-19T15:00:00.000Z",
          },
        ],
        error: null,
      };
    },
  });

  const result = await gateway.saveOrderDraft({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId,
    orders: [
      {
        orderId: "00000000-0000-4000-8000-000000000101",
        billingDisplayName: "CBC 검사 DEN-72 저장",
        quantity: 2,
      },
    ],
  });

  expect(calls).toEqual([
    `clair_save_chart_order_draft:${workspaceId}:${encounterId}:00000000-0000-4000-8000-000000000002`,
  ]);
  expect(result).toMatchObject({
    ok: true,
    orderDrafts: [{ lineTotalSnapshot: 90000, orderId: "00000000-0000-4000-8000-000000000101" }],
  });
});

test("order draft persistence migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain("create or replace function public.clair_get_chart_order_draft");
  expect(migration).toContain("create or replace function public.clair_save_chart_order_draft");
  expect(migration).toContain("private.clair_is_active_workspace_member(p_workspace_id)");
  expect(migration).toContain("from public.encounters e");
  expect(migration).toContain("from public.orders o");
  expect(migration).toContain("billing_display_name");
  expect(migration).toContain("quantity");
  expect(migration).toContain("line_total_snapshot");
  expect(migration).toContain("grant execute on function public.clair_save_chart_order_draft");
  expect(migration).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
});

test("order draft route stays server-owned and secret-free", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/order-drafts/route.ts",
    "utf8"
  );
  const serverSource = readFileSync(
    "src/features/chart/server-order-draft-persistence.ts",
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
