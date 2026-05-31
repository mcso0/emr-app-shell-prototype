import { expect, test, type APIRequestContext } from "@playwright/test";

const workspaceId = "clair-demo";
const encounterId = "encounter-kong-260501";

test("DEN-290 order platform replay preserves catalog, fulfillment, and billing flow", async ({
  request,
}) => {
  const suffix = Date.now().toString(36);
  const clientSessionId = `den-290-${suffix}`;
  const adminHeaders = {
    "x-clair-demo-client-session-id": clientSessionId,
    "x-clair-demo-session-user-id": "user-admin",
  };
  const vetHeaders = {
    "x-clair-demo-client-session-id": clientSessionId,
    "x-clair-demo-session-user-id": "user-vet",
  };
  const billingOnlyCatalogId = `ord-den-290-billing-${suffix}`;
  const pausedCatalogId = `ord-den-290-paused-${suffix}`;

  const adminRead = await request.get(
    `/api/workspaces/${workspaceId}/hospital-admin/order-catalog`,
    { headers: adminHeaders },
  );
  expect(adminRead.status()).toBe(200);
  await expectJson(adminRead, {
    ok: true,
    items: expect.arrayContaining([
      expect.objectContaining({ id: "ord-lab-cbc-baso" }),
    ]),
  });

  await createCatalogItem(request, adminHeaders, {
    id: billingOnlyCatalogId,
    standardOrderId: `std-den-290-billing-${suffix}`,
    standardOrderName: "DEN-290 상담료",
    inHospitalOrderName: "DEN-290 상담료",
    billingName: "DEN-290 상담료 청구",
    defaultDestinationModule: "billing_only",
    defaultTaskRequired: false,
    priceKrw: 33000,
  });
  await createCatalogItem(request, adminHeaders, {
    id: pausedCatalogId,
    standardOrderId: `std-den-290-paused-${suffix}`,
    standardOrderName: "DEN-290 사용중지 대상",
    inHospitalOrderName: "DEN-290 사용중지 대상",
    billingName: "DEN-290 사용중지 대상",
    defaultDestinationModule: "lab",
    defaultTaskRequired: true,
    priceKrw: 11000,
  });

  const updated = await request.patch(
    `/api/workspaces/${workspaceId}/hospital-admin/order-catalog`,
    {
      data: {
        action: "update",
        itemId: billingOnlyCatalogId,
        patch: {
          billingName: "DEN-290 상담료 청구 수정",
          priceKrw: 35000,
          pricingRule: {
            priceBasis: "fixed_order_price",
            priceKrw: 35000,
            salesUnit: "per_order",
            taxIncluded: true,
            roundingRule: "as_is",
            billingReflectionEnabled: true,
          },
        },
      },
      headers: adminHeaders,
    },
  );
  expect(updated.status()).toBe(200);
  await expectJson(updated, {
    ok: true,
    item: expect.objectContaining({
      billingName: "DEN-290 상담료 청구 수정",
      priceKrw: 35000,
    }),
  });

  const paused = await request.patch(
    `/api/workspaces/${workspaceId}/hospital-admin/order-catalog`,
    {
      data: { action: "pause", itemId: pausedCatalogId },
      headers: adminHeaders,
    },
  );
  expect(paused.status()).toBe(200);
  await expectJson(paused, {
    ok: true,
    item: expect.objectContaining({ availabilityStatus: "paused" }),
  });

  const chartSearch = await request.get(
    `/api/workspaces/${workspaceId}/hospital-admin/order-catalog?mode=chart-search`,
    { headers: vetHeaders },
  );
  expect(chartSearch.status()).toBe(200);
  const chartSearchBody = (await chartSearch.json()) as {
    ok: true;
    rows: Array<{ sourcePresetId: string }>;
  };
  expect(chartSearchBody.rows.map((row) => row.sourcePresetId)).toEqual(
    expect.arrayContaining([
      "std-ord-lab-cbc-baso",
      `std-den-290-billing-${suffix}`,
    ]),
  );
  expect(chartSearchBody.rows.map((row) => row.sourcePresetId)).not.toContain(
    `std-den-290-paused-${suffix}`,
  );

  const labOrderId = `catalog-individual-std-ord-lab-cbc-baso-den-290-${suffix}`;
  const billingOrderId = `catalog-individual-std-den-290-billing-${suffix}`;
  const confirmed = await request.patch(
    `/api/workspaces/${workspaceId}/chart/order-actions`,
    {
      data: {
        action: "confirm",
        catalogSelections: [
          {
            orderId: labOrderId,
            quantity: 2,
            rowType: "individual",
            sourcePresetId: "std-ord-lab-cbc-baso",
          },
          {
            orderId: billingOrderId,
            quantity: 1,
            rowType: "individual",
            sourcePresetId: `std-den-290-billing-${suffix}`,
          },
        ],
        encounterId,
        orderIds: [labOrderId, billingOrderId],
      },
      headers: vetHeaders,
    },
  );
  expect(confirmed.status()).toBe(200);
  const confirmedBody = (await confirmed.json()) as {
    ok: true;
    billingCandidates?: Array<{ description: string; lineTotal: number; orderId: string }>;
    fulfillmentWorkItems?: Array<{ orderId: string; queueType: string }>;
    orderActions: Array<{
      appliedSnapshot?: { billingName: string; lineTotalSnapshot: number; priceKrw: number };
      orderId: string;
    }>;
  };
  expect(confirmedBody.fulfillmentWorkItems).toEqual([
    expect.objectContaining({ orderId: labOrderId, queueType: "lab" }),
  ]);
  expect(confirmedBody.billingCandidates).toEqual([
    expect.objectContaining({
      description: "DEN-290 상담료 청구 수정",
      lineTotal: 35000,
      orderId: billingOrderId,
    }),
  ]);

  const changedAfterConfirmation = await request.patch(
    `/api/workspaces/${workspaceId}/hospital-admin/order-catalog`,
    {
      data: {
        action: "update",
        itemId: "ord-lab-cbc-baso",
        patch: {
          billingName: "DEN-290 변경 후 CBC",
          priceKrw: 99000,
          pricingRule: {
            priceBasis: "unit_price",
            priceKrw: 99000,
            salesUnit: "per_each",
            taxIncluded: true,
            roundingRule: "as_is",
            billingReflectionEnabled: true,
          },
        },
      },
      headers: adminHeaders,
    },
  );
  expect(changedAfterConfirmation.status()).toBe(200);

  const orderActionRead = await request.get(
    `/api/workspaces/${workspaceId}/chart/order-actions?encounterId=${encounterId}`,
    { headers: vetHeaders },
  );
  const orderActionBody = (await orderActionRead.json()) as {
    ok: true;
    orderActions: Array<{
      appliedSnapshot?: { billingName: string; lineTotalSnapshot: number; priceKrw: number };
      orderId: string;
    }>;
  };
  expect(
    orderActionBody.orderActions.find((row) => row.orderId === labOrderId),
  ).toMatchObject({
    appliedSnapshot: {
      billingName: "CBC 검사 BASO",
      lineTotalSnapshot: 24000,
      priceKrw: 12000,
    },
  });

  const billingRead = await request.get(
    `/api/workspaces/${workspaceId}/billing/invoice-candidates?encounterId=${encounterId}`,
    { headers: vetHeaders },
  );
  expect(billingRead.status()).toBe(200);
  await expectJson(billingRead, {
    ok: true,
    candidates: expect.arrayContaining([
      expect.objectContaining({
        description: "DEN-290 상담료 청구 수정",
        lineTotal: 35000,
        orderId: billingOrderId,
      }),
    ]),
  });
});

async function createCatalogItem(
  request: APIRequestContext,
  headers: Record<string, string>,
  item: {
    defaultDestinationModule: "billing_only" | "lab";
    defaultTaskRequired: boolean;
    billingName: string;
    id: string;
    inHospitalOrderName: string;
    priceKrw: number;
    standardOrderId: string;
    standardOrderName: string;
  },
) {
  const response = await request.post(
    `/api/workspaces/${workspaceId}/hospital-admin/order-catalog`,
    {
      data: {
        action: "create",
        item: {
          ...item,
          workspaceId,
          sourcePresetVersion: "den-290-v1",
          initialImportedPresetVersion: "den-290-v1",
          customizationState: "detached",
          customizedFields: ["*"],
          presetMergeStatus: "detached",
          categoryGroup: "treatment",
          categoryLabel: "DEN-290",
          aliases: [],
          availabilityStatus: "active",
          salesUnit: "per_order",
          targetSpecies: ["dog", "cat", "other"],
          billingReflectionEnabled: true,
          taxIncluded: true,
          roundingRule: "as_is",
          linkedLabItemIds: [],
          linkedLabCategoryIds: [],
          pricingRule: {
            priceBasis: "fixed_order_price",
            priceKrw: item.priceKrw,
            salesUnit: "per_order",
            taxIncluded: true,
            roundingRule: "as_is",
            billingReflectionEnabled: true,
          },
        },
      },
      headers,
    },
  );
  expect(response.status()).toBe(200);
  await expectJson(response, {
    ok: true,
    item: expect.objectContaining({ id: item.id }),
  });
}

async function expectJson(
  response: { json(): Promise<unknown> },
  expected: Record<string, unknown>,
) {
  expect(await response.json()).toMatchObject(expected);
}
