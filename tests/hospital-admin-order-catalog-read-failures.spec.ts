import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createMockWorkspacePermissionAdapter } from "../src/features/auth/permission-resolver";
import {
  createMockOrderCatalogGateway,
  createSupabaseOrderCatalogGateway,
  expandOrderSetForChart,
  listOrderCatalogForAdmin,
  mutateOrderCatalogItem,
  mutateWorkspaceLabTestItem,
  readLabTestItemDeleteLock,
  searchOrderCatalogForChart,
  type OrderCatalogGateway,
} from "../src/features/hospital-admin/server-order-catalog-core";

const workspaceId = "clair-demo";
const actorUserId = "user-admin";
const permissionAdapter = createMockWorkspacePermissionAdapter({
  users: [{ id: actorUserId, status: "active" }],
  memberships: [
    {
      id: "membership-admin",
      workspaceId,
      userId: actorUserId,
      roles: ["hospital_admin"],
      status: "active",
    },
  ],
  permissionPolicies: [
    { workspaceId, role: "hospital_admin", permissionIds: ["*"] },
  ],
});

const readModes = [
  {
    method: "listAdminCatalog",
    rpc: "clair_list_order_catalog_admin_v2",
    key: "items",
  },
  {
    method: "listChartSearch",
    rpc: "clair_list_order_catalog_chart_search_v2",
    key: "rows",
  },
] as const;

for (const mode of readModes) {
  for (const failure of [
    {
      input: { message: "authentication_required" },
      status: 401,
      error: "catalog_auth_required",
    },
    {
      input: { code: "PGRST301", message: "expired token" },
      status: 401,
      error: "catalog_auth_required",
    },
    {
      input: { message: "permission_missing" },
      status: 403,
      error: "catalog_permission_denied",
    },
    {
      input: { code: "42501", message: "insufficient privilege" },
      status: 403,
      error: "catalog_permission_denied",
    },
    {
      input: { message: "catalog_revision_conflict" },
      status: 409,
      error: "catalog_revision_conflict",
    },
    {
      input: { code: "PGRST202", message: "function unavailable" },
      status: 503,
      error: "catalog_read_failed",
    },
    {
      input: { message: "private diagnostic must not escape" },
      status: 503,
      error: "catalog_read_failed",
    },
  ]) {
    test(`${mode.method}: ${failure.input.code ?? failure.input.message} fails without a secondary catalog read`, async () => {
      const calls: string[] = [];
      const gateway = createSupabaseOrderCatalogGateway({
        async rpc(name, args) {
          calls.push(name);
          expect(args).toEqual({ p_workspace_id: workspaceId });
          return { data: [], error: failure.input };
        },
        from() {
          calls.push("FORBIDDEN_TABLE_READ");
          throw new Error("must not read table");
        },
      });
      expect(await gateway[mode.method]({ workspaceId })).toEqual({
        ok: false,
        status: failure.status,
        error: failure.error,
      });
      expect(calls).toEqual([mode.rpc]);
    });
  }

  test(`${mode.method}: rejected transport stays a typed failure`, async () => {
    const gateway = createSupabaseOrderCatalogGateway({
      async rpc() {
        throw new Error("network failed");
      },
    });
    expect(await gateway[mode.method]({ workspaceId })).toEqual({
      ok: false,
      status: 503,
      error: "catalog_read_failed",
    });
  });

  for (const [label, data] of Object.entries({
    null: null,
    object: {},
    scalar: "[]",
    invalidRow: [{}],
    mixedRows: [null, {}],
  })) {
    test(`${mode.method}: malformed ${label} is not an empty success`, async () => {
      const gateway = createSupabaseOrderCatalogGateway({
        async rpc() {
          return { data, error: null };
        },
      });
      expect(await gateway[mode.method]({ workspaceId })).toEqual({
        ok: false,
        status: 500,
        error: "catalog_response_invalid",
      });
    });
  }

  test(`${mode.method}: genuine empty success remains empty success`, async () => {
    const gateway = createSupabaseOrderCatalogGateway({
      async rpc() {
        return { data: [], error: null };
      },
    });
    expect(await gateway[mode.method]({ workspaceId })).toEqual({
      ok: true,
      [mode.key]: [],
    });
  });
}

function persistedRow() {
  return {
    id: "order-cbc",
    workspace_id: workspaceId,
    standard_order_id: "master-cbc",
    source_preset_version: "v1",
    category_group: "lab",
    category_label: "임상병리",
    standard_order_name: "CBC",
    in_hospital_order_name: "CBC",
    billing_name: "CBC",
    availability_status: "active",
    price_krw: 0,
    sales_unit: "per_order",
    default_destination_module: "lab",
    default_task_required: true,
    billing_reflection_enabled: true,
    tax_included: false,
    rounding_rule: "none",
    updated_at: "2026-09-06T00:00:00.000Z",
    default_detail_inputs: { specimenType: "whole_blood" },
  };
}

test("Admin rejects a foreign-workspace response and any corrupt member of a valid list", async () => {
  for (const data of [
    [{ ...persistedRow(), workspace_id: "foreign-workspace" }],
    [persistedRow(), {}],
  ]) {
    const gateway = createSupabaseOrderCatalogGateway({
      async rpc() {
        return { data, error: null };
      },
    });
    expect(await gateway.listAdminCatalog({ workspaceId })).toEqual({
      ok: false,
      status: 500,
      error: "catalog_response_invalid",
    });
  }
});

test("Admin preserves valid persisted zero amounts and details", async () => {
  const gateway = createSupabaseOrderCatalogGateway({
    async rpc() {
      return { data: [persistedRow()], error: null };
    },
  });
  const result = await gateway.listAdminCatalog({ workspaceId });
  expect(result).toMatchObject({
    ok: true,
    items: [
      {
        id: "order-cbc",
        workspaceId,
        priceKrw: 0,
        defaultDetailInputs: { specimenType: "whole_blood" },
      },
    ],
  });
});

test("chart preserves a valid individual but rejects the entire mixed-validity list", async () => {
  const fixture = await createMockOrderCatalogGateway().listChartSearch({
    workspaceId,
  });
  if (!fixture.ok) throw new Error(fixture.error);
  const row = fixture.rows.find(
    (candidate) => candidate.rowType === "individual",
  );
  expect(row).toBeTruthy();
  for (const invalid of [false, true]) {
    const gateway = createSupabaseOrderCatalogGateway({
      async rpc() {
        return { data: invalid ? [row, {}] : [row], error: null };
      },
    });
    const result = await gateway.listChartSearch({ workspaceId });
    expect(result.ok).toBe(!invalid);
    if (result.ok)
      expect(result.rows[0]).toMatchObject({
        workspaceCatalogItemId: row!.workspaceCatalogItemId,
      });
    else
      expect(result).toEqual({
        ok: false,
        status: 500,
        error: "catalog_response_invalid",
      });
  }
});

test("chart rejects missing or contradictory catalog and preset identities", async () => {
  const fixture = await createMockOrderCatalogGateway().listChartSearch({
    workspaceId,
  });
  if (!fixture.ok) throw new Error(fixture.error);
  const row = fixture.rows.find(
    (candidate) => candidate.rowType === "individual",
  )!;
  for (const invalidRow of [
    {
      ...row,
      workspaceCatalogItemId: undefined,
      appliedSnapshot: {
        ...row.appliedSnapshot,
        workspaceCatalogItemId: undefined,
      },
    },
    { ...row, workspaceCatalogItemId: "another-order" },
    { ...row, workspaceCatalogItemId: "   " },
    { ...row, sourcePresetId: "another-preset" },
    { ...row, sourcePresetVersion: "another-version" },
  ]) {
    const gateway = createSupabaseOrderCatalogGateway({
      async rpc() {
        return { data: [invalidRow], error: null };
      },
    });
    expect(await gateway.listChartSearch({ workspaceId })).toEqual({
      ok: false,
      status: 500,
      error: "catalog_response_invalid",
    });
  }
});

test("chart SQL-shaped snapshot carries same-row lineage without top-level mock fields", async () => {
  const fixture = await createMockOrderCatalogGateway().listChartSearch({ workspaceId });
  if (!fixture.ok) throw Error(fixture.error);
  const row = fixture.rows.find(row => row.rowType === "individual")!;
  const snapshot = { ...row.appliedSnapshot, workspaceId, sourceMasterRecordId: "master-synthetic", sourceMasterRevision: 2, workspaceCatalogRevision: 4 };
  const gateway = createSupabaseOrderCatalogGateway({ async rpc() { return { error: null, data: [{
    row_type: "individual", source_preset_id: row.sourcePresetId, source_preset_version: row.sourcePresetVersion,
    display_name: row.displayName, billing_name: row.billingName, category_group: row.categoryGroup,
    target_species: row.targetSpecies, applied_snapshot: snapshot,
  }] }; } });
  const result = await gateway.listChartSearch({ workspaceId });
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.error);
  expect(result.rows[0]).toMatchObject({ workspaceCatalogItemId: row.workspaceCatalogItemId,
    sourceMasterRecordId: "master-synthetic", sourceMasterRevision: 2, workspaceCatalogRevision: 4 });
});

test("chart rejects duplicate identities, malformed category/species and inconsistent saved lineage", async () => {
  const fixture = await createMockOrderCatalogGateway().listChartSearch({ workspaceId });
  if (!fixture.ok) throw Error(fixture.error);
  const row = fixture.rows.find(row => row.rowType === "individual")!;
  for (const data of [
    [row, row],
    [{ ...row, categoryGroup: "unknown" }],
    [{ ...row, targetSpecies: ["dog", "invalid"] }],
    [{ ...row, targetSpecies: ["dog", "dog"] }],
    [{ ...row, targetSpecies: "dog" }],
    [{ ...row, targetSpecies: [], appliedSnapshot: { ...row.appliedSnapshot, appliedTargetSpecies: ["dog"] } }],
    [{ ...row, appliedSnapshot: { ...row.appliedSnapshot, workspaceId: "foreign-workspace" } }],
    [{ ...row, sourceMasterRevision: 2, appliedSnapshot: { ...row.appliedSnapshot, sourceMasterRevision: 3 } }],
    [{ ...row, workspaceCatalogRevision: 0 }],
  ]) {
    const gateway = createSupabaseOrderCatalogGateway({ async rpc() { return { data, error: null }; } });
    expect(await gateway.listChartSearch({ workspaceId })).toEqual({ ok: false, status: 500, error: "catalog_response_invalid" });
  }
});

test("read handlers propagate failures and authorize before calling a gateway", async () => {
  let reads = 0;
  const gateway = createSupabaseOrderCatalogGateway({
    async rpc() {
      reads++;
      return { data: null, error: { message: "unavailable" } };
    },
  });
  for (const handler of [
    listOrderCatalogForAdmin,
    searchOrderCatalogForChart,
  ]) {
    expect(
      await handler({ actorUserId, workspaceId, permissionAdapter, gateway }),
    ).toMatchObject({ ok: false, status: 503, error: "catalog_read_failed" });
    const before = reads;
    expect(
      await handler({
        actorUserId: null,
        workspaceId,
        permissionAdapter,
        gateway,
      }),
    ).toMatchObject({ ok: false, status: 401 });
    expect(
      await handler({
        actorUserId,
        workspaceId: "foreign-workspace",
        permissionAdapter,
        gateway,
      }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(reads).toBe(before);
  }
});

test("request handlers never construct a fixture gateway or permission adapter implicitly", async () => {
  const base = { actorUserId, workspaceId };
  const calls = [
    listOrderCatalogForAdmin(base),
    searchOrderCatalogForChart(base),
    mutateOrderCatalogItem({
      ...base,
      input: {
        action: "pause",
        itemId: "order-cbc",
        expectedCatalogRevision: 1,
      },
    }),
    mutateWorkspaceLabTestItem({
      ...base,
      input: { action: "customize", itemId: "test-cbc", patch: {} },
    }),
    expandOrderSetForChart({ ...base, orderSetId: "set-cbc" }),
    readLabTestItemDeleteLock({ ...base, testItemId: "test-cbc" }),
    listOrderCatalogForAdmin({
      ...base,
      gateway: createMockOrderCatalogGateway(),
    }),
    searchOrderCatalogForChart({ ...base, permissionAdapter }),
  ];
  for (const call of calls)
    expect(await call).toEqual({
      ok: false,
      status: 503,
      error: "catalog_gateway_required",
    });
});

test("failed before-image read prevents mutation", async () => {
  let writes = 0;
  const gateway: OrderCatalogGateway = {
    ...createMockOrderCatalogGateway(),
    async listAdminCatalog() {
      return { ok: false, status: 503, error: "catalog_read_failed" };
    },
    async mutateOrder() {
      writes++;
      throw new Error("must not mutate without before image");
    },
  };
  const result = await mutateOrderCatalogItem({
    actorUserId,
    workspaceId,
    permissionAdapter,
    gateway,
    input: { action: "pause", itemId: "order-cbc", expectedCatalogRevision: 1 },
  });
  expect(result).toEqual({
    ok: false,
    status: 503,
    error: "catalog_read_failed",
  });
  expect(writes).toBe(0);
});

test("Admin rejects malformed identities and non-finite amounts", async () => {
  for (const patch of [{ id: 123 }, { id: "   " }, { billing_name: {} }, { price_krw: NaN }, { price_krw: Infinity }]) {
    const gateway = createSupabaseOrderCatalogGateway({ async rpc() { return { data: [{ ...persistedRow(), ...patch }], error: null }; } });
    expect(await gateway.listAdminCatalog({ workspaceId })).toEqual({ ok: false, status: 500, error: "catalog_response_invalid" });
  }
});

test("chart permissions alone cannot silently resolve catalog denial as an empty list", async () => {
  const chartOnlyAdapter = createMockWorkspacePermissionAdapter({
    users: [{ id: actorUserId, status: "active" }],
    memberships: [{ id: "membership-chart", workspaceId, userId: actorUserId, roles: ["vet"], status: "active" }],
    permissionPolicies: [{ workspaceId, role: "vet", permissionIds: ["chart:view", "chart:update"] }],
  });
  let reads = 0;
  const gateway = createSupabaseOrderCatalogGateway({ async rpc() { reads++; return { data: [], error: null }; } });
  expect(await searchOrderCatalogForChart({ actorUserId, workspaceId, gateway, permissionAdapter: chartOnlyAdapter })).toMatchObject({ ok: false, status: 403, denialReason: "permission_missing" });
  expect(reads).toBe(0);
});

test("product catalog route denies demo authority; chart draft save propagates read failure before writing", () => {
  const route = readFileSync(
    "src/app/api/workspaces/[workspaceId]/hospital-admin/order-catalog/route.ts",
    "utf8",
  );
  expect(route).not.toContain("getDemoOrderCatalogGateway");
  expect(route).not.toContain("demoClientSessionIdHeader");
  expect(route).toContain('identity.source !== "supabase_session"');
  expect(route).toContain('error: "catalog_auth_required"');
  expect(route).toContain("status: result.status");
  const chart = readFileSync(
    "src/app/api/workspaces/[workspaceId]/chart/order-drafts/route.ts",
    "utf8",
  );
  expect(chart).toContain("if (!catalogResult.ok) return catalogResult;");
  expect(chart).toContain("searchOrderCatalogForChart({");
  expect(chart).not.toContain(".listChartSearch({ workspaceId })");
  expect(
    chart.indexOf("if (!runtimeResult.ok) return runtimeResult;"),
  ).toBeLessThan(chart.indexOf("return saveChartOrderDraft({"));
});
