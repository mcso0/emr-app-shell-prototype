import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { resolveServerChartEncounterId } from "../src/features/chart/server-encounter-id-bridge-core";
import {
  createMockChartOrderDraftGateway,
  createSupabaseChartOrderDraftGateway,
  saveChartOrderDraft,
} from "../src/features/chart/server-order-draft-persistence-core";

const workspaceId = "clair-demo";
const encounterId = "encounter-coco-260501";
const migrationPath =
  "supabase/migrations/20260519210000_chart_order_draft_persistence_rpc.sql";
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";
const catalogDraftMigrationPath =
  "supabase/migrations/20260528012632_chart_catalog_draft_order_insert.sql";
const catalogDraftMigration = existsSync(catalogDraftMigrationPath)
  ? readFileSync(catalogDraftMigrationPath, "utf8")
  : "";
const draftOrderIdBoundaryMigrationPath =
  "supabase/migrations/20260528075852_den_306_chart_draft_order_id_boundary.sql";
const draftOrderIdBoundaryMigration = existsSync(
  draftOrderIdBoundaryMigrationPath,
)
  ? readFileSync(draftOrderIdBoundaryMigrationPath, "utf8")
  : "";
const encounterIdBridgeMigrationPath =
  "supabase/migrations/20260529090000_den_307_chart_encounter_id_bridge.sql";
const encounterIdBridgeMigration = existsSync(encounterIdBridgeMigrationPath)
  ? readFileSync(encounterIdBridgeMigrationPath, "utf8")
  : "";
const stagingEncounterIdBridgeMigrationPath =
  "supabase/migrations/20260529090800_den_307_staging_demo_encounter_bridge_candidates.sql";
const stagingEncounterIdBridgeMigration = existsSync(
  stagingEncounterIdBridgeMigrationPath,
)
  ? readFileSync(stagingEncounterIdBridgeMigrationPath, "utf8")
  : "";

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
    { data: validOrderDraftInput },
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, {
    ok: false,
    denialReason: "unauthenticated",
  });

  const saved = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-drafts`,
    {
      data: validOrderDraftInput,
      headers: { "x-clair-demo-session-user-id": "user-vet" },
    },
  );
  expect(saved.status()).toBe(200);
  const savedBody = (await saved.json()) as {
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
  expect(savedBody.orderDrafts).toEqual(
    expect.arrayContaining([
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
    ]),
  );

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-drafts?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } },
  );
  expect(readBack.status()).toBe(200);
  const readBody = (await readBack.json()) as {
    ok: true;
    orderDrafts: Array<{ billingDisplayName: string; orderId: string }>;
  };
  expect(readBody.orderDrafts.map((row) => row.orderId)).toEqual([
    "order-coco-maropitant",
    "order-coco-cbc",
    "order-coco-fluid",
    "order-coco-thorax",
  ]);
  expect(
    readBody.orderDrafts.find((row) => row.orderId === "order-coco-cbc")
      ?.billingDisplayName,
  ).toBe("CBC 검사 DEN-72 저장");
});

test("order draft core rejects invalid quantity and enforces permission plus encounter scope", async () => {
  const invalidQuantity = await saveChartOrderDraft({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      encounterId,
      orders: [
        { orderId: "order-coco-cbc", billingDisplayName: "CBC", quantity: 0 },
      ],
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
    gateway: createMockChartOrderDraftGateway(
      undefined,
      () => "2026-05-19T15:00:00.000Z",
    ),
  });
  expect(allowedVet).toMatchObject({
    ok: true,
    status: 200,
  });
  expect(allowedVet.ok ? allowedVet.orderDrafts : []).toEqual(
    expect.arrayContaining([
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
    ]),
  );
});

test("order draft Supabase gateway keeps workspace, encounter, actor, and server amount fields in RPC calls", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseChartOrderDraftGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(
        `${functionName}:${args.p_workspace_id}:${args.p_encounter_id}:${args.p_actor_user_id ?? "read"}`,
      );
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
        appliedSnapshot: {
          appliedBillingName: "CBC 검사 DEN-304",
          appliedDisplayName: "CBC 검사 DEN-304",
          appliedPriceKrw: 45000,
          appliedSalesUnit: "per_order",
          sourcePresetId: "std-den-304-cbc",
          sourcePresetVersion: "den-304-v1",
        },
        billingDisplayName: "CBC 검사 DEN-72 저장",
        categoryGroup: "lab",
        displayName: "CBC 검사 DEN-304",
        quantity: 2,
        rowType: "individual",
        sourcePresetId: "std-den-304-cbc",
        sourcePresetVersion: "den-304-v1",
        unitPriceSnapshot: 45000,
      },
    ],
  });

  expect(calls).toEqual([
    `clair_save_chart_order_draft:${workspaceId}:${encounterId}:00000000-0000-4000-8000-000000000002`,
  ]);
  expect(result).toMatchObject({
    ok: true,
    orderDrafts: [
      {
        lineTotalSnapshot: 90000,
        orderId: "00000000-0000-4000-8000-000000000101",
      },
    ],
  });
  expect(catalogDraftMigration).toContain("insert into public.orders");
  expect(catalogDraftMigration).toContain("source_order_id");
  expect(catalogDraftMigration).toContain("applied_snapshot");
  expect(catalogDraftMigration).toContain("'workspace_catalog'");
});

test("order draft route bridge resolves demo encounter IDs before Supabase RPC calls", async () => {
  const calls: string[] = [];
  const resolvedEncounterId = "00000000-0000-4000-8000-000000002601";
  const resolved = await resolveServerChartEncounterId({
    client: {
      async rpc(functionName, args) {
        calls.push(
          `${functionName}:${args.p_workspace_id}:${args.p_encounter_id}`,
        );
        return { data: resolvedEncounterId, error: null };
      },
    },
    encounterId,
    workspaceId,
  });

  expect(resolved).toEqual({ ok: true, encounterId: resolvedEncounterId });
  expect(calls).toEqual([
    `clair_resolve_encounter_id:${workspaceId}:${encounterId}`,
  ]);

  const uuidPassthrough = await resolveServerChartEncounterId({
    client: {
      async rpc() {
        throw new Error(
          "uuid encounters should not need bridge RPC resolution",
        );
      },
    },
    encounterId: resolvedEncounterId,
    workspaceId,
  });
  expect(uuidPassthrough).toEqual({
    ok: true,
    encounterId: resolvedEncounterId,
  });
});

test("order draft route bridge tries staging synthetic candidates for every chart fixture encounter", async () => {
  const calls: string[] = [];
  const resolvedEncounterId = "19426000-0000-4000-8000-000000000004";
  const resolved = await resolveServerChartEncounterId({
    client: {
      async rpc(functionName, args) {
        calls.push(`${functionName}:${args.p_encounter_id}`);
        if (args.p_encounter_id === "E-DEN194-0004") {
          return { data: resolvedEncounterId, error: null };
        }
        return { data: null, error: { message: "encounter_unavailable" } };
      },
    },
    encounterId: "encounter-haru-260430",
    workspaceId,
  });

  expect(resolved).toEqual({ ok: true, encounterId: resolvedEncounterId });
  expect(calls).toEqual([
    "clair_resolve_encounter_id:encounter-haru-260430",
    "clair_resolve_encounter_id:E-260430-0005",
    "clair_resolve_encounter_id:E-DEN194-0004",
  ]);
});

test("order draft ID boundary migration avoids casting catalog source IDs as order UUIDs", () => {
  expect(draftOrderIdBoundaryMigration).toContain("private.clair_safe_uuid");
  expect(draftOrderIdBoundaryMigration).toContain("gen_random_uuid()");
  expect(draftOrderIdBoundaryMigration).toContain("source_order_id");
  expect(draftOrderIdBoundaryMigration).toContain("sourcePresetId");
  expect(draftOrderIdBoundaryMigration).not.toContain(
    "nullif(row_data.value->>'orderId', '')::uuid",
  );
  expect(draftOrderIdBoundaryMigration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("DEN-307 encounter bridge migration resolves demo IDs without exposing secrets", () => {
  expect(encounterIdBridgeMigration).toContain("clair_resolve_encounter_id");
  expect(encounterIdBridgeMigration).toContain(
    "private.clair_demo_encounter_no",
  );
  expect(encounterIdBridgeMigration).toContain("encounter-kong-260501");
  expect(encounterIdBridgeMigration).toContain("E-260501-0003");
  expect(stagingEncounterIdBridgeMigration).toContain(
    "private.clair_demo_encounter_no_candidates",
  );
  expect(stagingEncounterIdBridgeMigration).toContain("E-DEN194-0001");
  expect(stagingEncounterIdBridgeMigration).toContain("E-DEN194-0005");
  expect(encounterIdBridgeMigration).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(
    `${encounterIdBridgeMigration}\n${stagingEncounterIdBridgeMigration}`,
  ).not.toMatch(/service[_-]?role|db_password|SUPABASE_SECRET|real patient/i);
});

test("order draft persistence migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain(
    "create or replace function public.clair_get_chart_order_draft",
  );
  expect(migration).toContain(
    "create or replace function public.clair_save_chart_order_draft",
  );
  expect(migration).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(migration).toContain("from public.encounters e");
  expect(migration).toContain("from public.orders o");
  expect(migration).toContain("billing_display_name");
  expect(migration).toContain("quantity");
  expect(migration).toContain("line_total_snapshot");
  expect(migration).toContain(
    "grant execute on function public.clair_save_chart_order_draft",
  );
  expect(migration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("order draft route stays server-owned and secret-free", () => {
  const routeSource = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/order-drafts/route.ts",
    "utf8",
  );
  const serverSource = readFileSync(
    "src/features/chart/server-order-draft-persistence.ts",
    "utf8",
  );

  expect(routeSource).toContain("readServerSession");
  expect(routeSource).toContain("resolveRoleUpdateActorIdentity");
  expect(routeSource).toContain("resolveServerChartEncounterId");
  expect(routeSource).toContain("enforceWorkspaceMutationRateLimit");
  expect(serverSource).toContain('import "server-only"');
  expect(`${routeSource}\n${serverSource}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET/i,
  );
});

async function expectJson(
  response: { json(): Promise<unknown> },
  expected: Record<string, unknown>,
) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
