import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

import { createMockLiveAuditAppendGateway } from "../src/features/audit/server-audit-log-persistence-core";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockOrderCatalogGateway,
  createOrderPricingSnapshot,
  createSupabaseOrderCatalogGateway,
  defaultSystemOrderPresets,
  expandOrderSetForChart,
  initializeWorkspaceOrderCatalogFromPresets,
  listOrderCatalogForAdmin,
  mutateOrderCatalogItem,
  readLabTestItemDeleteLock,
  searchOrderCatalogForChart,
  type OrderCatalogItem,
} from "../src/features/hospital-admin/server-order-catalog-core";

const auditEventMigrationPath =
  "supabase/migrations/20260527091000_order_catalog_audit_event_types.sql";
const auditEventMigration = existsSync(auditEventMigrationPath)
  ? readFileSync(auditEventMigrationPath, "utf8")
  : "";
const stagingMutationMigrationPath =
  "supabase/migrations/20260528093000_order_catalog_staging_mutation_rls.sql";
const stagingMutationMigration = existsSync(stagingMutationMigrationPath)
  ? readFileSync(stagingMutationMigrationPath, "utf8")
  : "";
const routePath =
  "src/app/api/workspaces/[workspaceId]/hospital-admin/order-catalog/route.ts";
const routeSource = existsSync(routePath) ? readFileSync(routePath, "utf8") : "";

function permissionAdapter(options: { permissionIds?: ["*"] | string[] } = {}) {
  return createMockWorkspacePermissionAdapter({
    users: [{ id: "user-admin", status: "active" }, { id: "user-vet", status: "active" }],
    memberships: [
      { id: "membership-admin", workspaceId: "clair-demo", userId: "user-admin", roles: ["hospital_admin"], status: "active" },
      { id: "membership-vet", workspaceId: "clair-demo", userId: "user-vet", roles: ["vet"], status: "active" },
    ],
    permissionPolicies: [
      { workspaceId: "clair-demo", role: "hospital_admin", permissionIds: (options.permissionIds ?? ["*"]) as never },
      { workspaceId: "clair-demo", role: "vet", permissionIds: ["service_catalog:view"] as never },
    ],
  });
}

test("workspace preset initialization is idempotent and preserves deterministic demo catalog ids", async () => {
  const now = "2026-05-25T00:00:00.000Z";
  const first = initializeWorkspaceOrderCatalogFromPresets({
    now,
    presets: defaultSystemOrderPresets,
    workspaceId: "clair-demo",
  });
  const second = initializeWorkspaceOrderCatalogFromPresets({
    existingItems: first.items,
    now,
    presets: defaultSystemOrderPresets,
    workspaceId: "clair-demo",
  });

  expect(first.createdCount).toBe(defaultSystemOrderPresets.length);
  expect(second).toMatchObject({ createdCount: 0, updatedCount: 0 });
  expect(second.items).toHaveLength(first.items.length);
  expect(second.items.map((item) => item.id)).toEqual(expect.arrayContaining(["ord-lab-cbc-baso", "ord-med-maropitant"]));
  expect(second.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: "ord-lab-cbc-baso",
        initialImportedPresetVersion: "v3",
        lastAutoMergedPresetVersion: "v3",
        customizationState: "unmodified",
        customizedFields: [],
        presetMergeStatus: "current",
      }),
    ])
  );
});

test("preset merge auto-updates unmodified rows and preserves customized rows", async () => {
  const now = "2026-05-25T00:00:00.000Z";
  const cbcPreset = defaultSystemOrderPresets.find((preset) => preset.presetId === "std-ord-lab-cbc-baso");
  expect(cbcPreset).toBeTruthy();
  const nextCbcPreset = {
    ...cbcPreset!,
    presetVersion: "v4",
    defaultBillingName: "CBC 검사 업데이트",
    defaultPriceKrw: 13000,
    pricingRule: { ...cbcPreset!.pricingRule, priceKrw: 13000 },
  };
  const seed = initializeWorkspaceOrderCatalogFromPresets({
    now,
    presets: [cbcPreset!],
    workspaceId: "clair-demo",
  });

  const unmodifiedMerge = initializeWorkspaceOrderCatalogFromPresets({
    existingItems: seed.items,
    now: "2026-05-25T01:00:00.000Z",
    presets: [nextCbcPreset],
    workspaceId: "clair-demo",
  });
  expect(unmodifiedMerge).toMatchObject({ createdCount: 0, updatedCount: 1, preservedCount: 0 });
  expect(unmodifiedMerge.items[0]).toMatchObject({
    sourcePresetVersion: "v4",
    lastAutoMergedPresetVersion: "v4",
    billingName: "CBC 검사 업데이트",
    priceKrw: 13000,
    presetMergeStatus: "current",
  });

  const customizedItems = seed.items.map((item) =>
    item.id === "ord-lab-cbc-baso"
      ? {
          ...item,
          billingName: "우리병원 CBC",
          customizationState: "customized" as const,
          customizedFields: ["billingName"],
          lastCustomizedAt: "2026-05-25T00:30:00.000Z",
          lastCustomizedByUserId: "user-admin",
        }
      : item
  );
  const customizedMerge = initializeWorkspaceOrderCatalogFromPresets({
    existingItems: customizedItems,
    now: "2026-05-25T01:00:00.000Z",
    presets: [nextCbcPreset],
    workspaceId: "clair-demo",
  });
  expect(customizedMerge).toMatchObject({ createdCount: 0, updatedCount: 1, preservedCount: 0 });
  expect(customizedMerge.items[0]).toMatchObject({
    sourcePresetVersion: "v4",
    lastAutoMergedPresetVersion: "v4",
    billingName: "우리병원 CBC",
    priceKrw: 13000,
    presetMergeStatus: "conflict",
  });
});

test("workspace dispensing creation stays pending until veterinarian approval", async () => {
  const gateway = createMockOrderCatalogGateway();
  const catalog = await gateway.listAdminCatalog({ workspaceId: "clair-demo" });
  const seed = catalog.items.find((item) => item.id === "ord-med-maropitant");
  expect(seed).toBeTruthy();
  const { updatedAt: _updatedAt, ...item } = {
    ...seed!,
    id: "client-draft-id",
    standardOrderId: "client-custom-id",
    workspaceId: "foreign-workspace",
    originType: "workspace_custom" as const,
    availabilityStatus: "active" as const,
  };
  void _updatedAt;

  const created = await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    input: { action: "create", item },
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(created).toMatchObject({
    ok: true,
    item: {
      availabilityStatus: "pending_activation",
      originType: "workspace_custom",
      workspaceDispensingReview: { status: "pending", revision: 1 },
    },
  });
  if (!created.ok) return;
  expect(created.item.id).not.toBe("client-draft-id");
  expect(created.item.workspaceId).toBe("clair-demo");

  const veterinarianCreated = await mutateOrderCatalogItem({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    input: {
      action: "create",
      item: { ...item, id: "veterinarian-client-draft" },
    },
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(veterinarianCreated).toMatchObject({
    ok: true,
    item: {
      availabilityStatus: "pending_activation",
      workspaceDispensingReview: {
        status: "pending",
        authoredByUserId: "user-vet",
      },
    },
  });

  const pendingChart = await searchOrderCatalogForChart({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(pendingChart.ok).toBe(true);
  if (pendingChart.ok) {
    expect(pendingChart.rows.map((row) => row.workspaceCatalogItemId)).not.toContain(
      created.item.id,
    );
  }

  const adminReview = await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    input: {
      action: "review",
      decision: "approve",
      itemId: created.item.id,
      expectedCatalogRevision: created.item.catalogRevision ?? 1,
    },
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(adminReview).toMatchObject({
    ok: false,
    status: 403,
    denialReason: "permission_missing",
  });

  const approved = await mutateOrderCatalogItem({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    input: {
      action: "review",
      decision: "approve",
      itemId: created.item.id,
      expectedCatalogRevision: created.item.catalogRevision ?? 1,
    },
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(approved).toMatchObject({
    ok: true,
    item: {
      availabilityStatus: "active",
      workspaceDispensingReview: { status: "approved", revision: 2 },
    },
  });

  const approvedChart = await searchOrderCatalogForChart({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(approvedChart.ok).toBe(true);
  if (approvedChart.ok) {
    expect(approvedChart.rows.map((row) => row.workspaceCatalogItemId)).toContain(
      created.item.id,
    );
  }
});

test("administrator veterinarian may author and self-approve a workspace dispensing order", async () => {
  const gateway = createMockOrderCatalogGateway();
  const catalog = await gateway.listAdminCatalog({ workspaceId: "clair-demo" });
  const seed = catalog.items.find((item) => item.id === "ord-med-maropitant");
  expect(seed).toBeTruthy();
  const { updatedAt: _updatedAt, ...item } = {
    ...seed!,
    id: "self-review-draft",
    originType: "workspace_custom" as const,
  };
  void _updatedAt;
  const permissions = createMockWorkspacePermissionAdapter({
    users: [{ id: "user-admin-vet", status: "active" }],
    memberships: [
      {
        id: "membership-admin-vet",
        workspaceId: "clair-demo",
        userId: "user-admin-vet",
        roles: ["hospital_admin", "vet"],
        status: "active",
      },
    ],
    permissionPolicies: [
      {
        workspaceId: "clair-demo",
        role: "hospital_admin",
        permissionIds: ["*"] as never,
      },
    ],
  });

  const created = await mutateOrderCatalogItem({
    actorUserId: "user-admin-vet",
    workspaceId: "clair-demo",
    input: { action: "create", item },
    gateway,
    permissionAdapter: permissions,
  });
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const approved = await mutateOrderCatalogItem({
    actorUserId: "user-admin-vet",
    workspaceId: "clair-demo",
    input: {
      action: "review",
      decision: "approve",
      itemId: created.item.id,
      expectedCatalogRevision: created.item.catalogRevision ?? 1,
    },
    gateway,
    permissionAdapter: permissions,
  });
  expect(approved).toMatchObject({
    ok: true,
    item: { availabilityStatus: "active" },
  });
});

test("admin read includes paused rows while chart search excludes paused rows and includes sets", async () => {
  const gateway = createMockOrderCatalogGateway();
  const admin = await listOrderCatalogForAdmin({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  const chart = await searchOrderCatalogForChart({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    gateway,
    permissionAdapter: permissionAdapter(),
  });

  expect(admin).toMatchObject({ ok: true, items: expect.arrayContaining([expect.objectContaining({ id: "ord-paused-example" })]) });
  expect(chart).toMatchObject({ ok: true });
  if (chart.ok) {
    expect(chart.rows.map((row) => row.sourcePresetId)).not.toContain("std-ord-paused-example");
    expect(chart.rows).toEqual(expect.arrayContaining([expect.objectContaining({ rowType: "set", sourcePresetId: "set-vomit-basic" })]));
  }
});

test("order mutations require service catalog manage permission and pause future chart selection", async () => {
  const gateway = createMockOrderCatalogGateway();
  const denied = await mutateOrderCatalogItem({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    input: { action: "pause", itemId: "ord-lab-cbc-baso", expectedCatalogRevision: 1 },
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(denied).toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });

  const paused = await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    input: { action: "pause", itemId: "ord-lab-cbc-baso", expectedCatalogRevision: 1 },
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(paused).toMatchObject({
    ok: true,
    item: expect.objectContaining({
      availabilityStatus: "paused",
      customizationState: "customized",
      customizedFields: expect.arrayContaining(["availabilityStatus"]),
      lastCustomizedByUserId: "user-admin",
    }),
  });

  const chart = await searchOrderCatalogForChart({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(chart.ok).toBe(true);
  if (chart.ok) expect(chart.rows.map((row) => row.sourcePresetId)).not.toContain("std-ord-lab-cbc-baso");
});

test("catalog update and pause reject a missing or non-positive CAS revision", async () => {
  const gateway = createMockOrderCatalogGateway();
  const missingRevision = await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    input: {
      action: "update",
      itemId: "ord-lab-cbc-baso",
      patch: { billingName: "CAS 누락" },
    } as never,
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  const zeroRevision = await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    input: { action: "pause", itemId: "ord-lab-cbc-baso", expectedCatalogRevision: 0 },
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(missingRevision).toMatchObject({ ok: false, status: 400, error: "invalid_input" });
  expect(zeroRevision).toMatchObject({ ok: false, status: 400, error: "invalid_input" });
});

test("order catalog mutations emit safe audit events with changed field metadata", async () => {
  const gateway = createMockOrderCatalogGateway(
    undefined,
    "2026-05-27T03:10:00.000Z",
  );
  const auditGateway = createMockLiveAuditAppendGateway();

  const updated = await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    auditGateway,
    auditNow: () => "2026-05-27T03:11:00.000Z",
    auditRequestId: "req-den-300",
    gateway,
    input: {
      action: "update",
      itemId: "ord-lab-cbc-baso",
      expectedCatalogRevision: 1,
      patch: {
        billingName: "CBC 감사 테스트",
        priceKrw: 13000,
      },
    },
    permissionAdapter: permissionAdapter(),
    workspaceId: "clair-demo",
  });

  expect(updated).toMatchObject({ ok: true, status: 200 });
  expect(auditGateway.events).toHaveLength(1);
  expect(auditGateway.events[0]).toMatchObject({
    actorUserId: "user-admin",
    eventType: "order_catalog.updated",
    targetType: "order_catalog_item",
    targetId: "ord-lab-cbc-baso",
    requestId: "req-den-300",
    before: expect.objectContaining({
      billingName: "CBC 검사 BASO",
      priceKrw: 12000,
    }),
    after: expect.objectContaining({
      billingName: "CBC 감사 테스트",
      priceKrw: 13000,
    }),
    metadata: {
      action: "update",
      changedFields: ["billingName", "priceKrw"],
      source: "order-catalog-admin-mutation",
    },
  });
  expect(JSON.stringify(auditGateway.events[0])).not.toMatch(
    /full[_-]?soap|raw[_-]?payload|token|secret|provider/i,
  );
});

test("order catalog route wires Supabase audit gateway for live mutations", () => {
  expect(routeSource).toContain("createSupabaseLiveAuditAppendGateway");
  expect(routeSource).toContain("loadWorkspacePermissionAdapterFromDb");
  expect(routeSource).toContain("createSupabaseWorkspacePermissionGateway");
  expect(routeSource).toContain("createSupabaseOrderCatalogGateway");
  expect(routeSource).toContain("permissionAdapter");
  expect(routeSource).toContain("auditGateway:");
  expect(routeSource).toContain("getAuditRequestId");
});

test("Supabase Order Set detail accepts the current projection id field", async () => {
  const gateway = createSupabaseOrderCatalogGateway({
    async rpc(functionName: string) {
      expect(functionName).toBe("clair_get_order_set");
      return {
        data: {
          orderSet: {
            id: "set-1",
            workspace_id: "clair-demo",
            source_set_version: "order-set-revision-1",
            current_revision_id: "11111111-1111-4111-8111-111111111111",
            availability_status: "active",
            set_name: "개 중성화 수술",
            billing_name: "개 중성화 수술",
            sales_unit: "per_order",
            target_species: ["dog"],
            amount_basis: "included_order_sum",
            set_price_krw: null,
            range_basis: null,
            tax_type: "derived",
            range_price_ranges: [],
            currentRevision: {
              id: "11111111-1111-4111-8111-111111111111",
              workspace_id: "clair-demo",
              order_set_id: "set-1",
              revision_no: 1,
              validation_status: "valid",
              validation_errors: [],
              set_name: "개 중성화 수술",
              billing_name: "개 중성화 수술",
              amount_basis: "included_order_sum",
              set_price_krw: null,
              range_basis: null,
              sales_unit: "per_order",
              billing_reflection_enabled: false,
              tax_type: "derived",
              target_species: ["dog"],
              items: [],
              priceRanges: [],
              currentEtag:
                "order-set-revision-11111111-1111-4111-8111-111111111111",
            },
          },
          history: [],
          reviews: [],
        },
        error: null,
      };
    },
  });

  await expect(
    gateway.getOrderSet({ orderSetId: "set-1", workspaceId: "clair-demo" }),
  ).resolves.toMatchObject({
    ok: true,
    detail: {
      orderSetId: "set-1",
      setName: "개 중성화 수술",
      currentRevision: {
        id: "11111111-1111-4111-8111-111111111111",
        orderSetId: "set-1",
      },
    },
  });
});

test("Supabase order catalog gateway persists create update and pause mutations", async () => {
  const rows: Record<string, unknown>[] = [];
  const calls: string[] = [];
  const gateway = createSupabaseOrderCatalogGateway({
    from(table: "order_catalog_items") {
      expect(table).toBe("order_catalog_items");
      return createOrderCatalogTableBuilder(rows) as never;
    },
    async rpc(functionName: string, args: Record<string, unknown>) {
      calls.push(`${functionName}:${args.p_workspace_id}`);
      if (functionName === "clair_list_order_catalog_admin_v2") {
        return { data: rows, error: null };
      }
      if (functionName === "clair_create_order_catalog_item") {
        const item = args.p_item as Record<string, unknown>;
        const row = toOrderCatalogDbRow(item, String(args.p_workspace_id));
        rows.push(row);
        return { data: row, error: null };
      }

      if (functionName === "clair_update_order_catalog_item") {
        const itemId = String(args.p_item_id);
        const row = rows.find((candidate) => candidate.id === itemId);
        if (!row) return { data: null, error: { message: "order_catalog_item_not_found" } };
        const patch = args.p_patch as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(patch, "sourceMasterRevision")) {
          return { data: null, error: { message: "catalog_protected_field_rejected:sourceMasterRevision" } };
        }
        Object.entries(patch).forEach(([key, value]) => {
          row[camelToSnake(key)] = value;
        });
        row.catalog_revision = Number(row.catalog_revision ?? 1) + 1;
        row.updated_at = "2026-05-27T03:10:00.000Z";
        return { data: row, error: null };
      }

      return { data: [], error: null };
    },
  });

  const created = await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    gateway,
    input: {
      action: "create",
      item: {
        workspaceId: "clair-demo",
        standardOrderId: "custom-den-302",
        sourcePresetVersion: "custom-v1",
        categoryGroup: "lab",
        categoryLabel: "임상 병리",
        standardOrderName: "DEN-302 표준 오더",
        inHospitalOrderName: "DEN-302 원내 오더",
        billingName: "DEN-302 청구명",
        aliases: [],
        availabilityStatus: "active",
        priceKrw: 12000,
        salesUnit: "per_order",
        targetSpecies: ["dog"],
        defaultDestinationModule: "lab",
        defaultTaskRequired: true,
        billingReflectionEnabled: true,
        taxIncluded: true,
        roundingRule: "as_is",
        linkedLabItemIds: [],
        linkedLabCategoryIds: [],
        pricingRule: {
          priceBasis: "fixed_order_price",
          priceKrw: 12000,
          salesUnit: "per_order",
          taxIncluded: true,
          roundingRule: "as_is",
          billingReflectionEnabled: true,
        },
      },
    },
    permissionAdapter: permissionAdapter(),
    workspaceId: "clair-demo",
  });

  expect(created).toMatchObject({
    ok: true,
    item: expect.objectContaining({
      billingName: "DEN-302 청구명",
      customizationState: "detached",
      lastCustomizedByUserId: "user-admin",
    }),
  });
  const createdId = created.ok ? created.item.id : "";

  const protectedAttempt = await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    gateway,
    input: {
      action: "update",
      itemId: createdId,
      expectedCatalogRevision: 1,
      patch: { sourceMasterRevision: 99 },
    },
    permissionAdapter: permissionAdapter(),
    workspaceId: "clair-demo",
  });
  expect(protectedAttempt).toMatchObject({
    ok: false,
    status: 400,
    error: "invalid_input",
  });

  const updated = await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    gateway,
    input: {
      action: "update",
      itemId: createdId,
      expectedCatalogRevision: 1,
      patch: { billingName: "DEN-302 청구명 수정" },
    },
    permissionAdapter: permissionAdapter(),
    workspaceId: "clair-demo",
  });
  expect(updated).toMatchObject({
    ok: true,
    item: expect.objectContaining({ billingName: "DEN-302 청구명 수정" }),
  });

  const paused = await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    gateway,
    input: { action: "pause", itemId: createdId, expectedCatalogRevision: 2 },
    permissionAdapter: permissionAdapter(),
    workspaceId: "clair-demo",
  });
  expect(paused).toMatchObject({
    ok: true,
    item: expect.objectContaining({ availabilityStatus: "paused" }),
  });

  const readback = await listOrderCatalogForAdmin({
    actorUserId: "user-admin",
    gateway,
    permissionAdapter: permissionAdapter(),
    workspaceId: "clair-demo",
  });
  expect(readback).toMatchObject({
    ok: true,
    items: [expect.objectContaining({ id: createdId, availabilityStatus: "paused" })],
  });
});

test("order set expansion preserves child order snapshots and expansion order", async () => {
  const result = await expandOrderSetForChart({
    actorUserId: "user-vet",
    workspaceId: "clair-demo",
    orderSetId: "set-vomit-basic",
    gateway: createMockOrderCatalogGateway(),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: true,
    parentSnapshot: expect.objectContaining({ sourcePresetId: "set-vomit-basic", appliedAmountBasis: "included_order_sum" }),
    rows: [
      expect.objectContaining({ setItemId: "setitem-vomit-baso", sortOrder: 10 }),
      expect.objectContaining({ setItemId: "setitem-vomit-maropitant", sortOrder: 20 }),
    ],
  });
});

test("lab test item delete lock prefers linked order before saved result usage", async () => {
  const result = await readLabTestItemDeleteLock({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    testItemId: "labitem-cbc-baso",
    gateway: createMockOrderCatalogGateway(),
    permissionAdapter: permissionAdapter(),
  });

  expect(result).toMatchObject({
    ok: true,
    lock: expect.objectContaining({
      deleteLocked: true,
      linkedOrderCount: 1,
      savedResultUsageCount: 2,
      lockReason: "linked_order",
    }),
  });
});

test("medication vaccine and pricing snapshots remain stable after admin item update", async () => {
  const gateway = createMockOrderCatalogGateway();
  const before = await listOrderCatalogForAdmin({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    gateway,
    permissionAdapter: permissionAdapter(),
  });
  expect(before.ok).toBe(true);
  const medication = before.ok ? before.items.find((item) => item.id === "ord-med-maropitant") : undefined;
  const vaccine = before.ok ? before.items.find((item) => item.id === "ord-vaccine-cat-core") : undefined;
  expect(medication?.medicationMetadata).toMatchObject({ administrationRoute: "PO", storageMethod: "room_temp" });
  expect(vaccine?.vaccineMetadata).toMatchObject({ vaccineClassification: "core", doseSequenceLabel: "1차" });

  const snapshot = createOrderPricingSnapshot(medication as OrderCatalogItem);
  await mutateOrderCatalogItem({
    actorUserId: "user-admin",
    workspaceId: "clair-demo",
    input: { action: "update", itemId: "ord-med-maropitant", expectedCatalogRevision: 1, patch: { priceKrw: 9900, pricingRule: { ...medication!.pricingRule, priceKrw: 9900 } } },
    gateway,
    permissionAdapter: permissionAdapter(),
  });

  expect(snapshot).toMatchObject({
    appliedPriceKrw: 4500,
    appliedSalesUnit: "per_each",
    appliedAmountBasis: "unit_price",
    defaultDetailInputs: {
      dose: 1,
      doseUnit: "tablet",
      frequency: "sid",
      durationDays: 3,
      totalQuantity: 3,
    },
    medicationMetadata: {
      schemaVersion: 2,
      presetStatus: "synthetic_unreviewed",
    },
  });
  expect(snapshot.defaultDetailInputs).not.toBe(
    medication?.medicationMetadata?.defaultDetailInputs,
  );
  expect(snapshot.medicationMetadata).not.toBe(medication?.medicationMetadata);
});

test("order catalog audit event migration extends allowed live audit event types", () => {
  expect(auditEventMigration).toContain("order_catalog.created");
  expect(auditEventMigration).toContain("order_catalog.updated");
  expect(auditEventMigration).toContain("order_catalog.paused");
  expect(auditEventMigration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

test("staging order catalog mutation migration enables admin write and member read", () => {
  expect(stagingMutationMigration).toContain("alter table public.order_catalog_items enable row level security");
  expect(stagingMutationMigration).toContain("order_catalog_items_workspace_admin_insert");
  expect(stagingMutationMigration).toContain("order_catalog_items_workspace_admin_update");
  expect(stagingMutationMigration).toContain("private.clair_is_workspace_admin(workspace_id)");
  expect(stagingMutationMigration).toContain("private.clair_is_active_workspace_member(workspace_id)");
  expect(stagingMutationMigration).toContain("grant select, insert, update on public.order_catalog_items to authenticated");
  expect(stagingMutationMigration).not.toMatch(
    /service[_-]?role|db_password|SUPABASE_SECRET|real patient/i,
  );
});

function createOrderCatalogTableBuilder(rows: Record<string, unknown>[]) {
  const state = {
    filters: [] as Array<[string, string]>,
    mutation: null as null | { type: "insert" | "update"; value: Record<string, unknown> },
  };

  const builder = {
    eq(column: string, value: string) {
      state.filters.push([column, value]);
      return builder;
    },
    insert(value: Record<string, unknown>) {
      state.mutation = { type: "insert", value };
      return builder;
    },
    order() {
      return builder;
    },
    select() {
      return builder;
    },
    single() {
      return Promise.resolve(runQuery(true));
    },
    update(value: Record<string, unknown>) {
      state.mutation = { type: "update", value };
      return builder;
    },
    then<TResult1, TResult2>(
      onfulfilled?: ((value: { data: Record<string, unknown>[] | Record<string, unknown> | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return Promise.resolve(runQuery(false)).then(onfulfilled, onrejected);
    },
  };

  function runQuery(single: boolean) {
    if (state.mutation?.type === "insert") {
      rows.push({ ...state.mutation.value });
    }

    if (state.mutation?.type === "update") {
      const index = rows.findIndex(matchesFilters);
      if (index >= 0) rows[index] = { ...rows[index], ...state.mutation.value };
    }

    const matches = rows.filter(matchesFilters);
    return {
      data: single ? (matches[0] ?? null) : matches,
      error: null,
    };
  }

  function matchesFilters(row: Record<string, unknown>) {
    return state.filters.every(([column, value]) => row[column] === value);
  }

  return builder;
}

function toOrderCatalogDbRow(item: Record<string, unknown>, workspaceId: string) {
  const row: Record<string, unknown> = {
    id: item.id,
    workspace_id: workspaceId,
    standard_order_id: item.standardOrderId,
    source_preset_version: item.sourcePresetVersion,
    category_group: item.categoryGroup,
    category_label: item.categoryLabel,
    t_code: item.tCode,
    t_code_label: item.tCodeLabel,
    standard_order_name: item.standardOrderName,
    in_hospital_order_name: item.inHospitalOrderName,
    billing_name: item.billingName,
    aliases: item.aliases,
    availability_status: item.availabilityStatus,
    price_krw: item.priceKrw,
    sales_unit: item.salesUnit,
    target_species: item.targetSpecies,
    default_destination_module: item.defaultDestinationModule,
    default_task_required: item.defaultTaskRequired,
    billing_reflection_enabled: item.billingReflectionEnabled,
    care_guide: item.careGuide,
    care_guide_delivery_enabled: item.careGuideDeliveryEnabled,
    internal_instruction: item.internalInstruction,
    internal_instruction_delivery_enabled: item.internalInstructionDeliveryEnabled,
    tax_included: item.taxIncluded,
    rounding_rule: item.roundingRule,
    pricing_rule: item.pricingRule,
    medication_metadata: item.medicationMetadata,
    vaccine_metadata: item.vaccineMetadata,
    customization_state: item.customizationState,
    customized_fields: ["*"],
    last_customized_at: "2026-05-27T03:10:00.000Z",
    last_customized_by_user_id: "user-admin",
    preset_merge_status: item.presetMergeStatus,
    catalog_revision: 1,
    updated_at: "2026-05-27T03:10:00.000Z",
  };
  return row;
}

function camelToSnake(value: string) {
  return value.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);
}
