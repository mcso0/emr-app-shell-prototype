import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import { createMockInvoiceCandidateSyncGateway } from "../src/features/billing/server-invoice-candidate-sync-core";
import { resolveServerChartEncounterId } from "../src/features/chart/server-encounter-id-bridge-core";
import {
  createMockChartOrderActionGateway,
  createSupabaseChartOrderActionGateway,
  readChartOrderActions,
  saveChartOrderAction,
  type ChartOrderAppliedSnapshot,
} from "../src/features/chart/server-order-action-persistence-core";
import {
  createMockOrderCatalogGateway,
  createSupabaseOrderCatalogGateway,
  type OrderCatalogGateway,
} from "../src/features/hospital-admin/server-order-catalog-core";

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

const validConfirmInput = {
  action: "confirm" as const,
  encounterId,
  orderIds: [orderId],
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

  const saved = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-actions`,
    {
      data: validConfirmInput,
      headers: { "x-clair-demo-session-user-id": "user-vet" },
    },
  );
  expect(saved.status()).toBe(200);
  const savedBody = (await saved.json()) as {
    ok: true;
    fulfillmentWorkItems?: Array<{
      id: string;
      orderId: string;
      queueType: string;
      sourceSnapshot: { orderDisplayName: string };
      status: string;
    }>;
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
  expect(savedBody.fulfillmentWorkItems).toEqual([
    expect.objectContaining({
      id: `fulfill-${orderId}`,
      orderId,
      queueType: "dispensing",
      sourceSnapshot: expect.objectContaining({
        orderDisplayName: "Maropitant 16mg T",
      }),
    }),
  ]);

  const fulfillmentRead = await request.get(
    `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=dispensing&encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } },
  );
  expect(fulfillmentRead.status()).toBe(200);
  const fulfillmentReadBody = (await fulfillmentRead.json()) as {
    ok: true;
    workItems: Array<{ id: string; orderId: string }>;
  };
  expect(fulfillmentReadBody.workItems).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: `fulfill-${orderId}`, orderId }),
    ]),
  );

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

test("order action core creates billing candidates immediately for billing-only catalog snapshots", async () => {
  const actionGateway = createMockChartOrderActionGateway(
    undefined,
    () => "2026-05-26T14:30:00.000Z",
  );
  const invoiceCandidateGateway = createMockInvoiceCandidateSyncGateway(
    undefined,
    () => "2026-05-26T14:31:00.000Z",
  );
  const catalogOrderId = "catalog-billing-only-den-288";
  const catalogGateway: Pick<OrderCatalogGateway, "listChartSearch"> = {
    async listChartSearch() {
      return {
        ok: true as const,
        rows: [
          {
            rowType: "individual" as const,
            sourcePresetId: "std-ord-consult-den-288",
            sourcePresetVersion: "2026.05",
            displayName: "진료 상담",
            billingName: "진료 상담료",
            categoryGroup: "treatment" as const,
            targetSpecies: ["dog"] as const,
            appliedSnapshot: {
              sourcePresetId: "std-ord-consult-den-288",
              sourcePresetVersion: "2026.05",
              workspaceCatalogItemId: "ord-consult-den-288",
              appliedStandardOrderName: "일반 진료 상담",
              appliedDisplayName: "진료 상담",
              appliedBillingName: "진료 상담료",
              appliedPriceKrw: 22000,
              appliedSalesUnit: "per_order" as const,
              appliedTaxIncluded: true,
              appliedAmountBasis: "fixed_order_price" as const,
              appliedTargetSpecies: ["dog"] as const,
              appliedDestinationModule: "billing_only" as const,
              appliedTaskRequired: false,
              billingReflectionEnabled: true,
            },
          },
        ],
      };
    },
  };

  const confirmed = await saveChartOrderAction({
    actorUserId: "user-vet",
    catalogGateway,
    gateway: actionGateway,
    input: {
      action: "confirm",
      catalogSelections: [
        {
          billingDisplayName: "client tampered billing",
          orderId: catalogOrderId,
          quantity: 2,
          rowType: "individual",
          sourcePresetId: "std-ord-consult-den-288",
        },
      ],
      encounterId,
      orderIds: [catalogOrderId],
    },
    invoiceCandidateGateway,
    workspaceId,
  });

  expect(confirmed).toMatchObject({
    ok: true,
    status: 200,
  });
  expect(
    confirmed.ok ? confirmed.fulfillmentWorkItems : undefined,
  ).toBeUndefined();
  expect(confirmed.ok ? confirmed.billingCandidates : undefined).toEqual([
    expect.objectContaining({
      billingCandidateId: `billcand-${catalogOrderId}`,
      description: "진료 상담료",
      lineTotal: 44000,
      orderId: catalogOrderId,
      quantity: 2,
      syncedAt: "2026-05-26T14:31:00.000Z",
      unitPrice: 22000,
    }),
  ]);
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

test("order action core freezes active catalog snapshots at confirmation and ignores client price fields", async () => {
  const catalogGateway = createMockOrderCatalogGateway(
    undefined,
    "2026-05-26T05:30:00.000Z",
  );
  const actionGateway = createMockChartOrderActionGateway(
    undefined,
    () => "2026-05-26T05:31:00.000Z",
  );
  const catalogOrderId = "catalog-individual-std-ord-lab-cbc-baso-den-286";

  const confirmed = await saveChartOrderAction({
    actorUserId: "user-vet",
    catalogGateway,
    gateway: actionGateway,
    input: {
      action: "confirm",
      catalogSelections: [
        {
          billingDisplayName: "client tampered billing name",
          guardianName: "DEN-327 보호자",
          orderId: catalogOrderId,
          patientName: "DEN-327 차트환자",
          quantity: 2,
          rowType: "individual",
          sourcePresetId: "std-ord-lab-cbc-baso",
        },
      ],
      encounterId,
      orderIds: [catalogOrderId],
    },
    workspaceId,
  });

  expect(confirmed).toMatchObject({
    ok: true,
    status: 200,
  });
  expect(confirmed.ok ? confirmed.fulfillmentWorkItems : undefined).toEqual([
    expect.objectContaining({
      id: `fulfill-${catalogOrderId}`,
      orderId: catalogOrderId,
      queueType: "lab",
      sourceSnapshot: expect.objectContaining({
        billingReflectionEnabled: true,
        guardianName: "DEN-327 보호자",
        orderDisplayName: "[CBC 검사] #BASO",
        patientName: "DEN-327 차트환자",
        serviceItemId: "std-ord-lab-cbc-baso",
        detail: expect.objectContaining({
          billingName: "CBC 검사 BASO",
          destinationModule: "lab",
          lineTotalSnapshot: 24000,
          quantity: 2,
          standardOrderName: "[CBC 검사] #BASO",
          unitPriceSnapshot: 12000,
        }),
      }),
      status: "requested",
    }),
  ]);
  expect(confirmed.ok ? confirmed.orderActions : []).toEqual([
    expect.objectContaining({
      appliedSnapshot: expect.objectContaining({
        billingName: "CBC 검사 BASO",
        destinationModule: "lab",
        lineTotalSnapshot: 24000,
        guardianName: "DEN-327 보호자",
        patientName: "DEN-327 차트환자",
        priceKrw: 12000,
        quantity: 2,
        sourcePresetId: "std-ord-lab-cbc-baso",
        standardOrderName: "[CBC 검사] #BASO",
        workspaceCatalogItemId: "ord-lab-cbc-baso",
      }),
      confirmedByUserId: "user-vet",
      orderConfirmationStatus: "confirmed",
      orderId: catalogOrderId,
      status: "confirmed",
    }),
  ]);

  await catalogGateway.mutateOrder({
    actorUserId: "user-admin",
    mutation: {
      action: "update",
      itemId: "ord-lab-cbc-baso",
      patch: {
        billingName: "변경 후 청구명",
        inHospitalOrderName: "변경 후 원내명",
        priceKrw: 99000,
        pricingRule: {
          billingReflectionEnabled: true,
          priceBasis: "unit_price",
          priceKrw: 99000,
          roundingRule: "as_is",
          salesUnit: "per_each",
          taxIncluded: true,
        },
      },
    },
    workspaceId,
  });

  const readBack = await readChartOrderActions({
    actorUserId: "user-vet",
    encounterId,
    gateway: actionGateway,
    workspaceId,
  });

  expect(readBack).toMatchObject({ ok: true, status: 200 });
  expect(
    readBack.ok
      ? readBack.orderActions.find((row) => row.orderId === catalogOrderId)
      : undefined,
  ).toMatchObject({
    appliedSnapshot: expect.objectContaining({
      billingName: "CBC 검사 BASO",
      inHospitalOrderName: "[CBC 검사] #BASO",
      lineTotalSnapshot: 24000,
      priceKrw: 12000,
    }),
  });
});

test("confirmed catalog order exposes stable order id, state, and snapshot for fulfillment handoff", async () => {
  const actionGateway = createMockChartOrderActionGateway(
    undefined,
    () => "2026-06-14T10:00:00.000Z",
  );
  const catalogOrderId = "catalog-individual-std-ord-lab-cbc-baso-den-494";

  const confirmed = await saveChartOrderAction({
    actorUserId: "user-vet",
    catalogGateway: createMockOrderCatalogGateway(
      undefined,
      "2026-06-14T09:59:00.000Z",
    ),
    gateway: actionGateway,
    input: {
      action: "confirm",
      catalogSelections: [
        {
          billingDisplayName: "tampered client billing name",
          orderId: catalogOrderId,
          patientName: "DEN-494 Synthetic Patient",
          quantity: 3,
          rowType: "individual",
          sourcePresetId: "std-ord-lab-cbc-baso",
        },
      ],
      encounterId,
      orderIds: [catalogOrderId],
    },
    workspaceId,
  });

  expect(confirmed).toMatchObject({ ok: true, status: 200 });
  expect(confirmed.ok ? confirmed.orderActions : []).toEqual([
    expect.objectContaining({
      appliedSnapshot: expect.objectContaining({
        billingName: "CBC 검사 BASO",
        destinationModule: "lab",
        lineTotalSnapshot: 36000,
        orderType: "lab",
        patientName: "DEN-494 Synthetic Patient",
        priceKrw: 12000,
        quantity: 3,
        sourcePresetId: "std-ord-lab-cbc-baso",
        standardOrderName: "[CBC 검사] #BASO",
        taskRequired: true,
      }),
      billingCandidateStatus: "not_requested",
      confirmedAt: "2026-06-14T10:00:00.000Z",
      confirmedByUserId: "user-vet",
      encounterId,
      orderConfirmationStatus: "confirmed",
      orderId: catalogOrderId,
      status: "confirmed",
      updatedAt: "2026-06-14T10:00:00.000Z",
    }),
  ]);
  expect(confirmed.ok ? confirmed.fulfillmentWorkItems : undefined).toEqual([
    expect.objectContaining({
      encounterId,
      orderId: catalogOrderId,
      queueType: "lab",
      sourceSnapshot: expect.objectContaining({
        detail: expect.objectContaining({
          billingName: "CBC 검사 BASO",
          lineTotalSnapshot: 36000,
          quantity: 3,
          unitPriceSnapshot: 12000,
        }),
        orderDisplayName: "[CBC 검사] #BASO",
        patientName: "DEN-494 Synthetic Patient",
        serviceItemId: "std-ord-lab-cbc-baso",
      }),
      status: "requested",
    }),
  ]);
});

test("order action core rejects paused and set catalog selections before confirmation snapshot", async () => {
  const paused = await saveChartOrderAction({
    actorUserId: "user-vet",
    input: {
      action: "confirm",
      catalogSelections: [
        {
          orderId: "catalog-individual-std-ord-paused-example-den-286",
          quantity: 1,
          rowType: "individual",
          sourcePresetId: "std-ord-paused-example",
        },
      ],
      encounterId,
      orderIds: ["catalog-individual-std-ord-paused-example-den-286"],
    },
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
      catalogSelections: [
        {
          orderId: "catalog-set-set-vomit-basic-den-286",
          quantity: 1,
          rowType: "set",
          sourcePresetId: "set-vomit-basic",
        },
      ],
      encounterId,
      orderIds: ["catalog-set-set-vomit-basic-den-286"],
    },
    workspaceId,
  });
  expect(setOrder).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "unsupported_order_type",
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
        data: [
          {
            billingCandidateId: "billcand-00000000-0000-4000-8000-000000000301",
            billingCandidateStatus: "candidate_created",
            confirmedAt: null,
            confirmedByUserId: null,
            encounterId,
            orderConfirmationStatus: "draft",
            orderId: "00000000-0000-4000-8000-000000000301",
            status: "requested",
            updatedAt: "2026-05-19T16:00:00.000Z",
          },
        ],
        error: null,
      };
    },
  });

  const result = await gateway.saveOrderAction({
    action: "bill",
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId,
    catalogSnapshots: new Map<string, ChartOrderAppliedSnapshot>([
      [
        "00000000-0000-4000-8000-000000000301",
        {
          amountBasis: "fixed_order_price",
          billingName: "DEN-304 상담료",
          billingReflectionEnabled: true,
          inHospitalOrderName: "DEN-304 상담료",
          lineTotalSnapshot: 33000,
          orderType: "treatment",
          priceKrw: 33000,
          quantity: 1,
          rowType: "individual",
          salesUnit: "per_order",
          sourcePresetId: "std-den-304-billing",
          sourcePresetVersion: "den-304-v1",
          standardOrderName: "DEN-304 상담료",
          targetSpecies: ["dog"],
          taxIncluded: true,
        },
      ],
    ]),
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
        billingCandidateStatus: "candidate_created",
      },
    ],
  });
});

test("order action route wires live catalog and billing gateways for Supabase sessions", () => {
  expect(routeSource).toContain("createSupabaseOrderCatalogGateway");
  expect(routeSource).toContain("catalogGateway: client");
  expect(routeSource).toContain("createSupabaseInvoiceCandidateSyncGateway");
  expect(routeSource).toContain("invoiceCandidateGateway: client");
});

test("order catalog Supabase gateway reads workspace chart-search rows from RPC", async () => {
  const calls: string[] = [];
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
            },
          },
        ],
        error: null,
      };
    },
  });

  const result = await gateway.listChartSearch({ workspaceId });

  expect(calls).toEqual([
    `clair_list_order_catalog_chart_search:${workspaceId}`,
  ]);
  expect(result.rows).toEqual([
    expect.objectContaining({
      rowType: "individual",
      sourcePresetId: "std-ord-consult-den-299",
      appliedSnapshot: expect.objectContaining({
        appliedBillingName: "진료 상담료",
        appliedPriceKrw: 22000,
        appliedDestinationModule: "billing_only",
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
