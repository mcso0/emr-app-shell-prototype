import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { resolveServerChartEncounterId } from "../src/features/chart/server-encounter-id-bridge-core";
import {
  createMockChartOrderActionGateway,
  createSupabaseChartOrderActionGateway,
  saveChartOrderAction,
} from "../src/features/chart/server-order-action-persistence-core";
import {
  createSupabaseOrderCatalogGateway,
} from "../src/features/hospital-admin/server-order-catalog-core";
import { mockEncounters, mockOrders } from "../src/mocks/emr-domain";
import type { Encounter } from "../src/types/emr-domain";

const workspaceId = "clair-demo";
const encounterId = "encounter-kong-260501";
const orderId = "order-kong-maropitant";
const migrationPath =
  "supabase/migrations/20260519220000_chart_order_action_persistence_rpc.sql";
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";
const catalogGatewayMigrationPath =
  "supabase/migrations/20260527090000_order_catalog_chart_search_rpc.sql";
const catalogGatewayMigration = existsSync(catalogGatewayMigrationPath)
  ? readFileSync(catalogGatewayMigrationPath, "utf8")
  : "";
const routePath =
  "src/app/api/workspaces/[workspaceId]/chart/order-actions/route.ts";
const routeSource = existsSync(routePath) ? readFileSync(routePath, "utf8") : "";
const encounterIdBridgeMigrationPath =
  "supabase/migrations/20260529090000_den_307_chart_encounter_id_bridge.sql";
const encounterIdBridgeMigration = existsSync(encounterIdBridgeMigrationPath)
  ? readFileSync(encounterIdBridgeMigrationPath, "utf8")
  : "";
const stagingEncounterIdBridgeMigrationPath =
  "supabase/migrations/20260529090800_den_307_staging_demo_encounter_bridge_candidates.sql";
const stagingEncounterIdBridgeMigration = existsSync(stagingEncounterIdBridgeMigrationPath)
  ? readFileSync(stagingEncounterIdBridgeMigrationPath, "utf8")
  : "";
const a3Migration = readFileSync(
  "supabase/migrations/20260819150622_clinical_master_phase1a3_order_authority.sql",
  "utf8",
);

const validConfirmInput = {
  action: "confirm" as const,
  encounterId,
  expectedEtag: `"${"a".repeat(64)}"`,
  idempotencyKey: "chart-confirm-test-request-0001",
  orderIds: [orderId],
};

const waitingEncounter: Encounter = {
  id: "encounter-order-action-waiting-lock",
  workspaceId,
  patientId: "patient-order-action-waiting-lock",
  guardianId: "guardian-order-action-waiting-lock",
  encounterNo: "E-ORDER-ACTION-LOCK",
  status: "waiting",
  checkedInAt: "2026-06-25T14:15:00+09:00",
  createdAt: "2026-06-25T14:15:00+09:00",
  updatedAt: "2026-06-25T14:15:00+09:00",
};

test("order action route confirms selected orders via mock fallback and reads after save", async ({
  request,
}) => {
  const unauthenticated = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-actions`,
    { data: validConfirmInput },
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, {
    ok: false,
    denialReason: "unauthenticated",
  });

  const current = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-actions?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } },
  );
  expect(current.status()).toBe(200);
  const currentBody = (await current.json()) as { ok: true; etag: string };

  const saved = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-actions`,
    {
      data: { ...validConfirmInput, expectedEtag: currentBody.etag },
      headers: {
        "If-Match": currentBody.etag,
        "x-clair-demo-session-user-id": "user-vet",
      },
    },
  );
  expect(saved.status()).toBe(200);
  const savedBody = (await saved.json()) as {
    ok: true;
    confirmationCommandId?: string;
    queueProjectionIds?: string[];
    tasks?: Array<Record<string, unknown>>;
    orderActions: Array<{
      billingCandidateStatus: string;
      confirmedAt?: string;
      confirmedByUserId?: string;
      orderConfirmationStatus: string;
      orderId: string;
      status: string;
    }>;
    enforcedBy: string;
  };

  expect(savedBody.enforcedBy).toBe("chart-order-action-persistence");
  expect(savedBody.orderActions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        billingCandidateStatus: "not_requested",
        confirmedByUserId: "user-vet",
        orderConfirmationStatus: "confirmed",
        orderId,
        status: "confirmed",
      }),
    ]),
  );
  expect(savedBody.orderActions[0]?.confirmedAt).toBeTruthy();
  expect(savedBody.confirmationCommandId).toBe(
    validConfirmInput.idempotencyKey,
  );
  expect(savedBody.queueProjectionIds).toEqual([]);
  expect(savedBody.tasks).toEqual([]);

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-actions?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-vet" } },
  );
  expect(readBack.status()).toBe(200);
  const readBody = (await readBack.json()) as {
    ok: true;
    orderActions: Array<{ orderConfirmationStatus: string; orderId: string }>;
  };
  expect(
    readBody.orderActions.find((row) => row.orderId === orderId)
      ?.orderConfirmationStatus,
  ).toBe("confirmed");
});

test("order action core submits billing candidates separately from confirmation", async () => {
  const gateway = createMockChartOrderActionGateway(
    undefined,
    () => "2026-05-19T16:00:00.000Z",
  );
  const result = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      action: "bill",
      encounterId,
      orderIds: [orderId],
    },
    gateway,
  });

  expect(result).toMatchObject({
    ok: true,
    status: 200,
  });
  expect(result.ok ? result.orderActions : []).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        billingCandidateId: `billcand-${orderId}`,
        billingCandidateStatus: "candidate_created",
        orderConfirmationStatus: "draft",
        orderId,
        updatedAt: "2026-05-19T16:00:00.000Z",
      }),
    ]),
  );
  expect(result.ok ? result.billingCandidates : undefined).toEqual([
    expect.objectContaining({
      billingCandidateId: `billcand-${orderId}`,
      orderId,
    }),
  ]);
  expect(result.ok ? result.fulfillmentWorkItems : undefined).toBeUndefined();
});

test("mock order action keeps nonbillable set children out of candidate lifecycle", async () => {
  const template = mockOrders.find((order) => order.id === orderId);
  if (!template) throw new Error("missing chart order template");
  const nonBillableSetChildId = "b3-nonbillable-set-child-action";
  const nonBillableSetChild = {
    ...template,
    id: nonBillableSetChildId,
    appliedSnapshot: {
      ...(template.appliedSnapshot ?? {}),
      billingReflectionEnabled: false,
      lineTotalSnapshot: 0,
      orderId: nonBillableSetChildId,
      priceKrw: 0,
      rowType: "set_child",
    },
  };
  let billingCallCount = 0;
  const result = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      action: "bill",
      encounterId,
      orderIds: [nonBillableSetChildId],
    },
    gateway: createMockChartOrderActionGateway({
      encounters: mockEncounters,
      orders: [...mockOrders, nonBillableSetChild],
    }),
    invoiceCandidateGateway: {
      async syncInvoiceCandidates() {
        billingCallCount += 1;
        return { ok: true, candidates: [] };
      },
    },
  });
  expect(result).toMatchObject({ ok: true, status: 200 });
  expect(result.ok ? result.orderActions : []).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        billingCandidateStatus: "not_requested",
        orderId: nonBillableSetChildId,
      }),
    ]),
  );
  expect(billingCallCount).toBe(0);
});

test("order action downstream billing receives persisted order IDs", async () => {
  const gateway = createMockChartOrderActionGateway(
    undefined,
    () => "2026-05-19T16:00:00.000Z",
  );
  const billingInputs: Array<Record<string, unknown>> = [];
  const result = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      action: "bill",
      encounterId,
      orderIds: [orderId],
    },
    gateway,
    invoiceCandidateGateway: {
      async syncInvoiceCandidates(input) {
        billingInputs.push(input as unknown as Record<string, unknown>);
        return { ok: true, candidates: [] };
      },
    },
  });

  expect(result).toMatchObject({ ok: true, status: 200 });
  expect(billingInputs).toEqual([
    expect.objectContaining({
      encounterId,
      orderIds: [orderId],
      surface: "chart",
      workspaceId,
    }),
  ]);
});

test("order action core blocks chart mutation before consultation starts", async () => {
  const blocked = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      action: "bill",
      encounterId: waitingEncounter.id,
      orderIds: ["order-waiting-lock"],
    },
    gateway: createMockChartOrderActionGateway({
      encounters: [{ ...waitingEncounter }],
      orders: [],
    }),
  });

  expect(blocked).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "stale_status",
  });
});

test("order action core rejects client catalog snapshot authority", async () => {
  const result = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      action: "confirm",
      catalogSelections: [
        {
          billingDisplayName: "client tampered billing",
          orderId: "catalog-billing-only-den-288",
          quantity: 2,
          rowType: "individual",
          sourcePresetId: "std-ord-consult-den-288",
        },
      ],
      encounterId,
      orderIds: ["catalog-billing-only-den-288"],
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: { orderIds: "저장된 오더 초안을 사용해 주세요." },
  });
});

test("order action route bridge resolves demo encounter IDs before confirmation", async () => {
  const resolvedEncounterId = "00000000-0000-4000-8000-000000002603";
  const resolved = await resolveServerChartEncounterId({
    client: {
      async rpc(functionName, args) {
        expect(functionName).toBe("clair_resolve_encounter_id");
        expect(args).toEqual({
          p_workspace_id: workspaceId,
          p_encounter_id: encounterId,
        });
        return { data: resolvedEncounterId, error: null };
      },
    },
    encounterId,
    workspaceId,
  });

  expect(resolved).toEqual({ ok: true, encounterId: resolvedEncounterId });
  expect(routeSource).toContain("resolveServerChartEncounterId");
  expect(routeSource).toContain(
    "input: { ...input, encounterId: resolvedEncounter.encounterId }",
  );
  expect(encounterIdBridgeMigration).toContain("encounter-kong-260501");
  expect(stagingEncounterIdBridgeMigration).toContain("E-DEN194-0001");
  expect(`${encounterIdBridgeMigration}\n${stagingEncounterIdBridgeMigration}`).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("order action confirmation does not accept mutable catalog snapshot input", async () => {
  const result = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      action: "confirm",
      catalogSelections: [
        {
          billingDisplayName: "client tampered billing name",
          guardianName: "DEN-327 보호자",
          orderId: "catalog-individual-std-ord-lab-cbc-baso-den-286",
          patientName: "DEN-327 차트환자",
          quantity: 2,
          rowType: "individual",
          sourcePresetId: "std-ord-lab-cbc-baso",
        },
      ],
      encounterId,
      orderIds: ["catalog-individual-std-ord-lab-cbc-baso-den-286"],
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: { orderIds: "저장된 오더 초안을 사용해 주세요." },
  });
});

test("confirmed order handoff requires a persisted server-owned row", async () => {
  const result = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId,
    input: {
      action: "confirm",
      catalogSelections: [
        {
          billingDisplayName: "tampered client billing name",
          orderId: "catalog-individual-std-ord-lab-cbc-baso-den-494",
          patientName: "DEN-494 Synthetic Patient",
          quantity: 3,
          rowType: "individual",
          sourcePresetId: "std-ord-lab-cbc-baso",
        },
      ],
      encounterId,
      orderIds: ["catalog-individual-std-ord-lab-cbc-baso-den-494"],
    },
  });

  expect(result).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: { orderIds: "저장된 오더 초안을 사용해 주세요." },
  });
});

test("order action core rejects unavailable IDs and legacy set selections", async () => {
  const gateway = createMockChartOrderActionGateway();
  const current = await gateway.readOrderActions({ encounterId, workspaceId });
  if (!current.ok) throw new Error("missing mock chart action state");
  const paused = await saveChartOrderAction({
    actorUserId: "user-vet",
    input: {
      ...validConfirmInput,
      encounterId,
      expectedEtag: current.etag,
      orderIds: ["catalog-individual-std-ord-paused-example-den-286"],
    },
    gateway,
    workspaceId,
  });
  expect(paused).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "order_unavailable",
  });

  const setOrder = await saveChartOrderAction({
    actorUserId: "user-vet",
    input: {
      action: "confirm",
      catalogSelections: [{ rowType: "set" }],
      encounterId,
      orderIds: ["catalog-set-set-vomit-basic-den-286"],
    },
    workspaceId,
  });
  expect(setOrder).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: { orderIds: "저장된 오더 초안을 사용해 주세요." },
  });
});

test("order action core rejects missing order ids, permission gaps, and encounter scope mismatches", async () => {
  const invalid = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId,
    input: { action: "confirm", encounterId, orderIds: [] },
  });
  expect(invalid).toMatchObject({
    ok: false,
    status: 400,
    fieldErrors: { orderIds: "오더를 선택해 주세요." },
  });

  const frontDeskDenied = await saveChartOrderAction({
    actorUserId: "user-front-desk",
    workspaceId,
    input: validConfirmInput,
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

  const crossWorkspaceDenied = await saveChartOrderAction({
    actorUserId: "user-vet",
    workspaceId: "other-workspace",
    input: validConfirmInput,
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

test("order action Supabase gateway keeps action, actor, workspace, encounter, and selected orders in RPC calls", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseChartOrderActionGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(
        `${functionName}:${args.p_action ?? "read"}:${args.p_workspace_id}:${args.p_encounter_id}:${args.p_actor_user_id ?? "read"}`,
      );
      return {
        data: {
          action: "bill",
          etag: `"${"a".repeat(64)}"`,
          rows: [
            {
              appliedPriceSnapshot: {
                amountBasis: "fixed_order_price",
                billedAs: "atomic_child",
                priceKrw: 33000,
              },
              appliedSnapshot: {
                billingName: "DEN-304 상담료",
                lineTotalSnapshot: 33000,
                sourcePresetId: "std-den-304-billing",
                priceKrw: 33000,
                quantity: 1,
                rowType: "individual",
                billingReflectionEnabled: true,
              },
              billingReflectionEnabled: true,
              calculationInputs: {},
              calculationOutputs: {},
              encounterId,
              lineTotalSnapshot: 33000,
              orderId: "00000000-0000-4000-8000-000000000301",
              orderConfirmationStatus: "draft",
              orderType: "treatment",
              parentOrderId: null,
              quantity: 1,
              quantitySource: "manual",
              rowType: "individual",
              snapshotHash: "b".repeat(64),
              snapshotSchemaVersion: 1,
              sourceSetId: null,
              sourceSetRevisionId: null,
              sourceSetRevisionItemId: null,
              sourceSetRevisionNo: null,
              sourceSetVersion: null,
              status: "requested",
              unitPriceSnapshot: 33000,
              updatedAt: "2026-05-19T16:00:00.000Z",
            },
          ],
          stored: false,
        },
        error: null,
      };
    },
  });

  const result = await gateway.saveOrderAction({
    action: "bill",
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId,
    expectedEtag: `"${"c".repeat(64)}"`,
    orderIds: ["00000000-0000-4000-8000-000000000301"],
  });

  expect(calls).toEqual([
    `clair_save_chart_order_action:bill:${workspaceId}:${encounterId}:00000000-0000-4000-8000-000000000002`,
  ]);
  expect(result).toMatchObject({
    ok: true,
    orderActions: [
      {
        appliedSnapshot: {
          billingName: "DEN-304 상담료",
          lineTotalSnapshot: 33000,
          sourcePresetId: "std-den-304-billing",
        },
        billingCandidateStatus: "not_requested",
      },
    ],
  });
});

test("order action Supabase gateway sends confirmation through one idempotent atomic RPC", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> = [];
  const etag = `"${"d".repeat(64)}"`;
  const actorUserId = "00000000-0000-4000-8000-000000000002";
  const persistedEncounterId = "00000000-0000-4000-8000-000000000003";
  const persistedOrderId = "00000000-0000-4000-8000-000000000301";
  const idempotencyKey = "chart-confirm-atomic-gateway-0001";
  const gateway = createSupabaseChartOrderActionGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push({ functionName, args });
      return {
        data: {
          commandId: "00000000-0000-4000-8000-000000000401",
          etag,
          confirmedRows: [],
          billingCandidates: [
            {
              billingCandidateId: `billcand-${persistedOrderId}`,
              billingName: "원자적 확정 검사",
              orderId: persistedOrderId,
              taskId: "00000000-0000-4000-8000-000000000501",
              status: "candidate_created",
              quantity: 2,
              unitPrice: 15000,
              amount: 30000,
              currency: "KRW",
              createdAt: "2026-08-25T12:00:00.000Z",
            },
          ],
          queueProjectionIds: [
            "00000000-0000-4000-8000-000000000601",
          ],
          tasks: [
            {
              taskId: "00000000-0000-4000-8000-000000000501",
              orderId: persistedOrderId,
              taskRole: "execution",
              status: "pending",
            },
          ],
        },
        error: null,
      };
    },
  });

  const result = await gateway.saveOrderAction({
    action: "confirm",
    actorUserId,
    workspaceId,
    encounterId: persistedEncounterId,
    expectedEtag: etag,
    idempotencyKey,
    orderIds: [persistedOrderId],
  });

  expect(calls).toEqual([
    {
      functionName: "clair_confirm_chart_order_candidates",
      args: {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: persistedEncounterId,
        p_selected_root_order_ids: [persistedOrderId],
        p_expected_draft_etag: etag,
        p_idempotency_key: idempotencyKey,
      },
    },
  ]);
  expect(result).toMatchObject({
    ok: true,
    serverAtomic: true,
    confirmationCommandId: "00000000-0000-4000-8000-000000000401",
    queueProjectionIds: ["00000000-0000-4000-8000-000000000601"],
    billingCandidates: [
      {
        billingCandidateId: `billcand-${persistedOrderId}`,
        description: "원자적 확정 검사",
        lineTotal: 30000,
        orderId: persistedOrderId,
        quantity: 2,
        unitPrice: 15000,
      },
    ],
  });
});

test("order action route wires only server-owned action, billing, and fulfillment gateways", () => {
  expect(routeSource).toContain("createSupabaseChartOrderActionGateway");
  expect(routeSource).not.toContain("createSupabaseOrderCatalogGateway");
  expect(routeSource).not.toContain("catalogGateway: client");
  expect(routeSource).toContain("createSupabaseInvoiceCandidateSyncGateway");
  expect(routeSource).toContain("invoiceCandidateGateway: client");
  expect(routeSource).toContain("createSupabaseFulfillmentWorkItemGateway");
  expect(routeSource).toContain("fulfillmentGateway: client");
});

test("order catalog Supabase gateway reads workspace chart-search rows from RPC", async () => {
  const calls: string[] = [];
  const defaultDetailInputs = {
    doseBasis: "patient",
    dose: 1,
    doseUnit: "spray",
    route: "topical",
    frequency: "bid",
    durationDays: 10,
    totalQuantity: 20,
    totalQuantityUnit: "spray",
    medicationInstruction: "any_time",
    storageMethod: "room_temp",
    compoundNote: "도포 부위와 분사 횟수를 확인한다.",
    guardianNote: "지정 부위에 하루 2회 적용한다.",
  };
  const gateway = createSupabaseOrderCatalogGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(`${functionName}:${args.p_workspace_id}`);
      return {
        data: [
          {
            row_type: "individual",
            source_preset_id: "std-ord-consult-den-299",
            source_preset_version: "2026.05",
            display_name: "진료 상담",
            billing_name: "진료 상담료",
            category_group: "treatment",
            target_species: ["dog"],
            applied_snapshot: {
              sourcePresetId: "std-ord-consult-den-299",
              sourcePresetVersion: "2026.05",
              workspaceCatalogItemId: "ord-consult-den-299",
              appliedStandardOrderName: "일반 진료 상담",
              appliedDisplayName: "진료 상담",
              appliedBillingName: "진료 상담료",
              appliedPriceKrw: 22000,
              appliedSalesUnit: "per_order",
              appliedTaxIncluded: true,
              appliedAmountBasis: "fixed_order_price",
              appliedTargetSpecies: ["dog"],
              appliedDestinationModule: "billing_only",
              appliedTaskRequired: false,
              billingReflectionEnabled: true,
              defaultDetailInputs,
              medicationMetadata: {
                schemaVersion: 2,
                presetOrigin: "clair_master",
                presetStatus: "synthetic_unreviewed",
                defaultDetailInputs,
              },
            },
          },
        ],
        error: null,
      };
    },
  });

  const result = await gateway.listChartSearch({ workspaceId });

  expect(calls).toEqual([
    `clair_list_order_catalog_chart_search_v2:${workspaceId}`,
  ]);
  expect(result.rows).toEqual([
    expect.objectContaining({
      rowType: "individual",
      sourcePresetId: "std-ord-consult-den-299",
      appliedSnapshot: expect.objectContaining({
        appliedBillingName: "진료 상담료",
        appliedPriceKrw: 22000,
        appliedDestinationModule: "billing_only",
        defaultDetailInputs,
        medicationMetadata: expect.objectContaining({
          presetOrigin: "clair_master",
          defaultDetailInputs,
        }),
      }),
    }),
  ]);
});

test("order action persistence migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain(
    "create or replace function public.clair_get_chart_order_actions",
  );
  expect(migration).toContain(
    "create or replace function public.clair_save_chart_order_action",
  );
  expect(migration).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(migration).toContain("order_confirmation_status");
  expect(migration).toContain("billing_candidate_status");
  expect(migration).toContain("confirmed_by_user_id");
  expect(migration).toContain("confirmed_at");
  expect(migration).toContain("order_events");
  expect(migration).toContain(
    "grant execute on function public.clair_save_chart_order_action",
  );
  expect(migration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("A3 order confirmation freezes catalog snapshots and preserves direct lineage on retry", () => {
  expect(a3Migration).toContain("create or replace function public.clair_save_chart_order_action");
  expect(a3Migration).toContain("private.clair_build_catalog_order_snapshot");
  expect(a3Migration).toContain("if v_order.workspace_catalog_item_id is not null then");
  expect(a3Migration).toContain("order_confirmation_status = 'confirmed'");
  expect(a3Migration).toContain("applied_snapshot = v_snapshot");
  expect(a3Migration).toContain("service_item_id = null");
});

test("order catalog chart search migration defines workspace-scoped live gateway RPC", () => {
  expect(catalogGatewayMigration).toContain(
    "create or replace function public.clair_list_order_catalog_chart_search",
  );
  expect(catalogGatewayMigration).toContain("where item.workspace_id = p_workspace_id");
  expect(catalogGatewayMigration).toContain("workspaceCatalogItemId");
  expect(catalogGatewayMigration).toContain("appliedBillingName");
  expect(catalogGatewayMigration).toContain(
    "grant execute on function public.clair_list_order_catalog_chart_search",
  );
  expect(catalogGatewayMigration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

async function expectJson(
  response: { json(): Promise<unknown> },
  expected: Record<string, unknown>,
) {
  const body = await response.json();
  expect(body).toMatchObject(expected);
}
