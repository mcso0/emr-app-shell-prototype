import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  mockEncounters,
  mockInvoiceLines,
  mockInvoices,
  mockOrders,
} from "../src/mocks/emr-domain";
import type { EmrOrder } from "../src/types/emr-domain";
import {
  createMockInvoiceCandidateSyncGateway,
  createSupabaseInvoiceCandidateSyncGateway,
  syncInvoiceCandidates,
} from "../src/features/billing/server-invoice-candidate-sync-core";

const workspaceId = "clair-demo";
const encounterId = "encounter-kong-260501";
const orderId = "order-kong-fluid";
const migrationPath =
  "supabase/migrations/20260520090000_billing_invoice_candidate_sync_rpc.sql";
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";
const den329MigrationPath =
  "supabase/migrations/20260530141423_den_329_billing_candidate_invoice_anchor.sql";
const den329Migration = existsSync(den329MigrationPath)
  ? readFileSync(den329MigrationPath, "utf8")
  : "";
const routePath =
  "src/app/api/workspaces/[workspaceId]/billing/invoice-candidates/route.ts";
const routeSource = existsSync(routePath) ? readFileSync(routePath, "utf8") : "";
const a3Migration = readFileSync(
  "supabase/migrations/20260819150622_clinical_master_phase1a3_order_authority.sql",
  "utf8",
);

const validSyncInput = {
  encounterId,
  orderIds: [orderId],
};

function buildPersistedOrder(
  id: string,
  appliedSnapshot: Record<string, unknown>,
  overrides: Partial<EmrOrder> = {},
): EmrOrder {
  const template = mockOrders.find((order) => order.id === orderId);
  if (!template) throw new Error("missing persisted-order template");
  const snapshotPrice = appliedSnapshot.priceKrw;
  return {
    ...template,
    ...overrides,
    id,
    displayName:
      typeof appliedSnapshot.displayName === "string"
        ? appliedSnapshot.displayName
        : overrides.displayName ?? template.displayName,
    appliedSnapshot: { ...appliedSnapshot, orderId: id },
    unitPriceSnapshot:
      snapshotPrice === null || typeof snapshotPrice === "number"
        ? snapshotPrice
        : template.unitPriceSnapshot,
  };
}

function createPersistedBillingGateway(
  orders: EmrOrder[],
  now: () => string,
) {
  return createMockInvoiceCandidateSyncGateway(
    {
      encounters: mockEncounters,
      invoiceLines: mockInvoiceLines,
      invoices: mockInvoices,
      orders,
    },
    now,
  );
}

test("invoice candidate route requires an actor, syncs selected orders, and guards duplicates", async ({
  request,
}) => {
  const unauthenticated = await request.patch(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates`,
    { data: validSyncInput },
  );
  expect(unauthenticated.status()).toBe(401);
  await expectJson(unauthenticated, {
    ok: false,
    denialReason: "unauthenticated",
  });

  const saved = await request.patch(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates`,
    {
      data: validSyncInput,
      headers: { "x-clair-demo-session-user-id": "user-tech" },
    },
  );
  expect(saved.status()).toBe(200);
  const savedBody = (await saved.json()) as {
    ok: true;
    candidates: Array<{
      billingCandidateId: string;
      description: string;
      invoiceId: string;
      lineTotal: number;
      orderId: string;
      quantity: number;
      unitPrice: number;
    }>;
    enforcedBy: string;
  };

  expect(savedBody.enforcedBy).toBe("billing-invoice-candidate-sync");
  expect(savedBody.candidates).toEqual([
    expect.objectContaining({
      billingCandidateId: `billcand-${orderId}`,
      description: "피하 수액 처치",
      invoiceId: "invoice-kong-260501",
      lineTotal: 18000,
      orderId,
      quantity: 1,
      unitPrice: 18000,
    }),
  ]);

  const savedAgain = await request.patch(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates`,
    {
      data: validSyncInput,
      headers: { "x-clair-demo-session-user-id": "user-tech" },
    },
  );
  expect(savedAgain.status()).toBe(200);
  const savedAgainBody = (await savedAgain.json()) as typeof savedBody;
  expect(
    savedAgainBody.candidates.filter(
      (candidate) => candidate.orderId === orderId,
    ),
  ).toHaveLength(1);

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } },
  );
  expect(readBack.status()).toBe(200);
  const readBody = (await readBack.json()) as {
    ok: true;
    candidates: Array<{ orderId: string }>;
  };
  expect(
    readBody.candidates.some((candidate) => candidate.orderId === orderId),
  ).toBe(true);
});

test("invoice candidate public route rejects an unavailable order", async ({
  request,
}) => {
  const attackerOrderId = "client-only-order-snapshot-den-298";

  const response = await request.patch(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates`,
    {
      data: {
        encounterId,
        orderIds: [attackerOrderId],
      },
      headers: { "x-clair-demo-session-user-id": "user-tech" },
    },
  );

  expect(response.status()).toBe(409);
  await expectJson(response, {
    ok: false,
    denialReason: "order_unavailable",
  });

  const readBack = await request.get(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates?encounterId=${encounterId}`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } },
  );
  expect(readBack.status()).toBe(200);
  const readBody = (await readBack.json()) as {
    ok: true;
    candidates: Array<{ orderId: string }>;
  };
  expect(
    readBody.candidates.some(
      (candidate) => candidate.orderId === attackerOrderId,
    ),
  ).toBe(false);
});

test("invoice candidate core enforces billing issue permission and encounter scope", async () => {
  const vetDenied = await syncInvoiceCandidates({
    actorUserId: "user-vet",
    workspaceId,
    input: validSyncInput,
  });
  expect(vetDenied).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });

  const crossWorkspaceDenied = await syncInvoiceCandidates({
    actorUserId: "user-tech",
    workspaceId: "other-workspace",
    input: validSyncInput,
    permissionAdapter: createMockWorkspacePermissionAdapter({
      users: [{ id: "user-tech", status: "active" }],
      memberships: [
        {
          id: "membership-tech-other",
          workspaceId: "other-workspace",
          userId: "user-tech",
          roles: ["technician"],
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

test("invoice candidate core uses server-side amount snapshots and rejects unavailable orders", async () => {
  const gateway = createMockInvoiceCandidateSyncGateway(
    undefined,
    () => "2026-05-20T09:00:00.000Z",
  );
  const result = await syncInvoiceCandidates({
    actorUserId: "user-tech",
    workspaceId,
    input: validSyncInput,
    gateway,
  });
  expect(result).toMatchObject({
    ok: true,
    status: 200,
  });
  expect(result.ok ? result.candidates : []).toEqual([
    expect.objectContaining({
      lineTotal: 18000,
      orderId,
      syncedAt: "2026-05-20T09:00:00.000Z",
    }),
  ]);

  const missingOrder = await syncInvoiceCandidates({
    actorUserId: "user-tech",
    workspaceId,
    input: {
      encounterId,
      orderIds: ["order-does-not-exist"],
    },
    gateway,
  });
  expect(missingOrder).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "order_unavailable",
  });
});

test("invoice candidate core uses catalog applied snapshots, guards duplicates, and skips non-billable rows", async () => {
  const catalogOrderId = "catalog-billing-only-den-288";
  const snapshot = {
    billingName: "진료 상담료",
    billingReflectionEnabled: true,
    destinationModule: "billing_only",
    inHospitalOrderName: "진료 상담",
    lineTotalSnapshot: 44000,
    orderId: catalogOrderId,
    priceKrw: 22000,
    quantity: 2,
    sourcePresetId: "std-ord-consult-den-288",
    standardOrderName: "일반 진료 상담",
    taskRequired: false,
  };
  const persistedSnapshot = {
    ...snapshot,
    billingCategory: "consultation",
    categoryGroup: "consultation",
    rowType: "individual",
    workspaceCatalogItemId: "persisted-catalog-consultation",
  };
  const gateway = createPersistedBillingGateway(
    [
      buildPersistedOrder(catalogOrderId, persistedSnapshot, {
        workspaceCatalogItemId: "persisted-catalog-consultation",
      }),
      buildPersistedOrder("catalog-non-billable-den-288", {
        ...persistedSnapshot,
        billingReflectionEnabled: false,
      }),
    ],
    () => "2026-05-26T14:20:00.000Z",
  );

  const first = await gateway.syncInvoiceCandidates({
    actorUserId: "user-tech",
    encounterId,
    orderIds: [catalogOrderId],
    workspaceId,
  });
  const second = await gateway.syncInvoiceCandidates({
    actorUserId: "user-tech",
    encounterId,
    orderIds: [catalogOrderId],
    workspaceId,
  });
  const readBack = await gateway.listInvoiceCandidates({
    encounterId,
    workspaceId,
  });

  expect(first).toMatchObject({
    ok: true,
    candidates: [
      {
        billingCandidateId: `billcand-${catalogOrderId}`,
        description: "진료 상담료",
        invoiceId: "invoice-kong-260501",
        lineTotal: 44000,
        orderId: catalogOrderId,
        quantity: 2,
        syncedAt: "2026-05-26T14:20:00.000Z",
        unitPrice: 22000,
      },
    ],
  });
  expect(second).toMatchObject({
    ok: true,
    candidates: [
      expect.objectContaining({
        lineTotal: 44000,
        orderId: catalogOrderId,
        unitPrice: 22000,
      }),
    ],
  });
  expect(
    readBack.ok
      ? readBack.candidates.filter(
          (candidate) => candidate.orderId === catalogOrderId,
        )
      : [],
  ).toHaveLength(1);

  const nonBillable = await gateway.syncInvoiceCandidates({
    actorUserId: "user-tech",
    encounterId,
    orderIds: ["catalog-non-billable-den-288"],
    workspaceId,
  });
  expect(nonBillable).toMatchObject({ ok: true, candidates: [] });
});

test("invoice candidate mock rejects an unavailable order without a persisted row", async () => {
  const gateway = createMockInvoiceCandidateSyncGateway(
    undefined,
    () => "2026-08-20T05:00:00.000Z",
  );
  const result = await gateway.syncInvoiceCandidates({
    actorUserId: "user-vet",
    encounterId,
    orderIds: ["caller-only-billing-order"],
    workspaceId,
  });

  expect(result).toMatchObject({
    ok: false,
    status: 409,
    denialReason: "order_unavailable",
  });
});

test("B3 billing keeps fixed/range parent-once and sum child-only parity from frozen snapshots", async () => {
  const fixedParentId = "b3-fixed-parent";
  const fixedExtraId = "b3-fixed-extra";
  const sumParentId = "b3-sum-parent";
  const sumChildId = "b3-sum-child";
  const rangeParentId = "b3-range-parent";
  const rangeExtraId = "b3-range-extra";
  const persistedOrders = [
    buildPersistedOrder(fixedParentId, {
      amountBasis: "set_fixed_price",
      billingCategory: "other",
      billingName: "Frozen fixed parent",
      billingReflectionEnabled: true,
      categoryGroup: "set",
      displayName: "Frozen fixed parent",
      lineTotalSnapshot: 0,
      priceKrw: 0,
      quantity: 1,
      rowType: "set",
    }),
    buildPersistedOrder(fixedExtraId, {
      amountBasis: "set_fixed_price",
      billingName: "Frozen fixed extra",
      billingReflectionEnabled: true,
      categoryGroup: "treatment",
      displayName: "Frozen fixed extra",
      lineTotalSnapshot: 1200,
      priceKrw: 1200,
      quantity: 1,
      rowType: "set_child",
    }),
    buildPersistedOrder(sumParentId, {
      amountBasis: "included_order_sum",
      billingName: "Frozen sum parent",
      billingReflectionEnabled: false,
      categoryGroup: "set",
      displayName: "Frozen sum parent",
      lineTotalSnapshot: null,
      priceKrw: null,
      quantity: 1,
      rowType: "set",
    }),
    buildPersistedOrder(sumChildId, {
      amountBasis: "included_order_sum",
      billingName: "Frozen sum child",
      billingReflectionEnabled: true,
      categoryGroup: "treatment",
      displayName: "Frozen sum child",
      lineTotalSnapshot: 2400,
      priceKrw: 2400,
      quantity: 1,
      rowType: "set_child",
    }),
    buildPersistedOrder(rangeParentId, {
      amountBasis: "range_price",
      billingCategory: "other",
      billingName: "Frozen range parent",
      billingReflectionEnabled: true,
      categoryGroup: "set",
      displayName: "Frozen range parent",
      lineTotalSnapshot: 5000,
      priceKrw: 5000,
      quantity: 1,
      rangeBasis: "patient_weight_kg",
      rangeInput: 5,
      roundingResultKrw: 5000,
      rowType: "set",
    }),
    buildPersistedOrder(rangeExtraId, {
      amountBasis: "range_price",
      billingName: "Frozen range extra",
      billingReflectionEnabled: true,
      categoryGroup: "treatment",
      displayName: "Frozen range extra",
      lineTotalSnapshot: 700,
      priceKrw: 700,
      quantity: 1,
      rowType: "set_child",
      roundingResultKrw: 700,
    }),
  ];
  const gateway = createPersistedBillingGateway(
    persistedOrders,
    () => "2026-08-20T05:00:00.000Z",
  );
  const fixed = await gateway.syncInvoiceCandidates({
    actorUserId: "user-vet",
    encounterId,
    orderIds: [fixedParentId, fixedExtraId],
    surface: "chart",
    workspaceId,
  });
  expect(fixed).toMatchObject({
    ok: true,
    candidates: [
      expect.objectContaining({
        orderId: fixedParentId,
        billingCategory: "other",
        lineTotal: 0,
      }),
      expect.objectContaining({ orderId: fixedExtraId, lineTotal: 1200 }),
    ],
  });

  const retry = await gateway.syncInvoiceCandidates({
    actorUserId: "user-vet",
    encounterId,
    orderIds: [fixedParentId, fixedExtraId],
    surface: "chart",
    workspaceId,
  });
  expect(retry).toMatchObject({
    ok: true,
    candidates: [
      expect.objectContaining({ orderId: fixedParentId, lineTotal: 0 }),
      expect.objectContaining({ orderId: fixedExtraId, lineTotal: 1200 }),
    ],
  });

  const sum = await gateway.syncInvoiceCandidates({
    actorUserId: "user-vet",
    encounterId,
    orderIds: [sumParentId, sumChildId],
    surface: "chart",
    workspaceId,
  });
  expect(sum).toMatchObject({
    ok: true,
    candidates: [expect.objectContaining({ orderId: "b3-sum-child", lineTotal: 2400 })],
  });

  const range = await gateway.syncInvoiceCandidates({
    actorUserId: "user-vet",
    encounterId,
    orderIds: [rangeParentId, rangeExtraId],
    surface: "chart",
    workspaceId,
  });
  expect(range).toMatchObject({
    ok: true,
    candidates: [
      expect.objectContaining({ orderId: "b3-range-parent", lineTotal: 5000 }),
      expect.objectContaining({ orderId: "b3-range-extra", lineTotal: 700 }),
    ],
  });
});

test("invoice candidate core allows re-requested orders to advance without completing task status", async () => {
  const gateway = createMockInvoiceCandidateSyncGateway();

  const returned = await syncInvoiceCandidates({
    actorUserId: "user-tech",
    gateway,
    input: {
      encounterId: "encounter-coco-260501",
      orderIds: ["order-coco-fluid"],
    },
    workspaceId,
  });

  expect(returned).toMatchObject({
    ok: true,
    status: 200,
    candidates: [
      expect.objectContaining({
        billingCandidateId: "billcand-order-coco-fluid",
        orderId: "order-coco-fluid",
      }),
    ],
  });
});

test("invoice candidate Supabase gateway keeps actor, workspace, encounter, and selected orders in RPC calls", async () => {
  const calls: string[] = [];
  const gateway = createSupabaseInvoiceCandidateSyncGateway({
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(
        `${functionName}:${args.p_workspace_id}:${args.p_encounter_id}:${args.p_actor_user_id ?? "read"}`,
      );
      return {
        data: [
          {
            billingCandidateId: "billcand-00000000-0000-4000-8000-000000000301",
            description: "피하 수액 처치",
            invoiceId: "00000000-0000-4000-8000-000000000401",
            lineTotal: 18000,
            orderId: "00000000-0000-4000-8000-000000000301",
            quantity: 1,
            syncedAt: "2026-05-20T09:00:00.000Z",
            unitPrice: 18000,
          },
        ],
        error: null,
      };
    },
  });

  const result = await gateway.syncInvoiceCandidates({
    actorUserId: "00000000-0000-4000-8000-000000000002",
    workspaceId,
    encounterId,
    orderIds: ["00000000-0000-4000-8000-000000000301"],
  });

  expect(calls).toEqual([
    `clair_sync_billing_invoice_candidates:${workspaceId}:${encounterId}:00000000-0000-4000-8000-000000000002`,
  ]);
  expect(result).toMatchObject({
    ok: true,
    candidates: [{ lineTotal: 18000 }],
  });
});

for (const surface of ["direct", "chart", "fulfillment"] as const) {
  test(`invoice candidate ${surface} sync preserves current-assignee denial as 403`, async () => {
    const calls: string[] = [];
    const gateway = createSupabaseInvoiceCandidateSyncGateway({
      async rpc(functionName: string) {
        calls.push(functionName);
        return { data: null, error: { message: "current_assignee_required" } };
      },
    });
    const result = await syncInvoiceCandidates({
      actorUserId: "user-admin",
      workspaceId,
      input: { ...validSyncInput, surface },
      gateway,
    });
    expect(result).toEqual({ ok: false, status: 403, denialReason: "permission_missing" });
    expect(calls).toEqual([surface === "direct"
      ? "clair_sync_billing_invoice_candidates"
      : `clair_sync_billing_invoice_candidates_from_${surface}`]);
  });
}

test("invoice candidate unexpected database failures remain 500", async () => {
  const gateway = createSupabaseInvoiceCandidateSyncGateway({
    async rpc() {
      return { data: null, error: { message: "connection failure" } };
    },
  });
  expect(await syncInvoiceCandidates({
    actorUserId: "user-tech", workspaceId, input: validSyncInput, gateway,
  })).toEqual({ ok: false, status: 500, error: "db_write_failed" });
});

test("invoice candidate route resolves staging demo encounter aliases before Supabase RPCs", () => {
  expect(routeSource).toContain("resolveServerChartEncounterId");
  expect(routeSource).toContain("SupabaseEncounterIdBridgeClient");
  expect(routeSource).toContain(
    "encounterId: resolvedEncounter.encounterId",
  );
  expect(routeSource).toContain('surface: "direct"');
});

test("invoice candidate sync migration defines local-first RPC boundary without secrets", () => {
  expect(migration).toContain(
    "create or replace function public.clair_list_billing_invoice_candidates",
  );
  expect(migration).toContain(
    "create or replace function public.clair_sync_billing_invoice_candidates",
  );
  expect(migration).toContain(
    "private.clair_is_active_workspace_member(p_workspace_id)",
  );
  expect(migration).toContain("order_confirmation_status");
  expect(migration).toContain("billing_candidate_status");
  expect(migration).toContain("billing_candidate_id");
  expect(migration).toContain("invoice_lines");
  expect(migration).toContain(
    "grant execute on function public.clair_sync_billing_invoice_candidates",
  );
  expect(migration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("A3 billing wrappers keep surface permissions, frozen anchors, and category snapshots private", () => {
  expect(a3Migration).toContain("private.clair_assert_billing_surface_permission");
  expect(a3Migration).toContain("private.clair_sync_billing_invoice_candidates_internal");
  expect(a3Migration).toContain("clair_sync_billing_invoice_candidates_from_chart");
  expect(a3Migration).toContain("clair_sync_billing_invoice_candidates_from_fulfillment");
  expect(a3Migration).toContain("billing:issue");
  expect(a3Migration).toContain("lab:complete");
  expect(a3Migration).toContain("imaging:complete");
  expect(a3Migration).toContain("dispensing:complete");
  expect(a3Migration).toContain("billingCategory', il.source_order_snapshot->>'billingCategory'");
  expect(a3Migration).toContain("invoice_anchor_conflict");
  expect(a3Migration).toContain("pg_advisory_xact_lock");
  expect(a3Migration).toContain("for update");
  expect(a3Migration).toContain("status in ('issued','paid')");
  expect(a3Migration).toContain("on conflict (workspace_id, order_id)");
});

test("DEN-329 billing candidate sync migration lazily creates invoice anchor after order validation", () => {
  expect(den329Migration).toContain(
    "create or replace function public.clair_sync_billing_invoice_candidates",
  );
  expect(den329Migration).toContain("select count(*)");
  expect(den329Migration).toContain("v_matched_count <> v_selected_count");
  expect(den329Migration).toContain("raise exception 'order_unavailable'");
  expect(den329Migration).toContain("insert into public.invoices");
  expect(den329Migration.indexOf("v_matched_count <> v_selected_count")).toBeLessThan(
    den329Migration.indexOf("insert into public.invoices"),
  );
  expect(den329Migration).toContain("invoice_no");
  expect(den329Migration).toContain("'INV-' || to_char(v_now, 'YYMMDD')");
  expect(den329Migration).toContain("insert into public.invoice_lines");
  expect(den329Migration).toContain(
    "grant execute on function public.clair_sync_billing_invoice_candidates",
  );
  expect(den329Migration).not.toMatch(
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
