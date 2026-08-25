import { expect, test } from "@playwright/test";

import {
  createEmptyOrderSetDefinition,
  defaultOrderSetAvailability,
  definitionFromDetail,
  duplicateOrderSetDefinition,
  filterOrderSetSummaries,
  formatOrderSetAmount,
  formatOrderSetSpecies,
} from "../src/features/hospital-admin/order-set-management";
import type {
  OrderSetDetail,
  OrderSetSummary,
} from "../src/features/hospital-admin/server-order-catalog-core";

function summary(overrides: Partial<OrderSetSummary> = {}): OrderSetSummary {
  return {
    orderSetId: "set-1",
    currentRevisionId: "11111111-1111-4111-8111-111111111111",
    currentRevisionNo: 2,
    availabilityStatus: "active",
    currentEtag: "order-set-revision-11111111-1111-4111-8111-111111111111",
    needsCompositionReview: false,
    setName: "노령견 건강검진",
    billingName: "노령견 건강검진",
    salesUnit: "per_order",
    targetSpecies: ["dog"],
    amountBasis: "included_order_sum",
    setPriceKrw: null,
    rangeBasis: null,
    taxType: "derived",
    rangePriceRanges: [],
    pendingReviewCount: 0,
    ...overrides,
  };
}

test("new Order Set starts inactive with included-order pricing and may remain empty", () => {
  const definition = createEmptyOrderSetDefinition();

  expect(definition).toMatchObject({
    amountBasis: "included_order_sum",
    items: [],
    priceRanges: [],
    setPriceKrw: null,
    targetSpecies: ["dog", "cat"],
  });
  expect(defaultOrderSetAvailability).toBe("inactive");
});

test("default active filtering hides inactive sets while all restores them", () => {
  const rows = [
    summary(),
    summary({ orderSetId: "set-2", setName: "격리 세트", availabilityStatus: "inactive" }),
  ];

  expect(filterOrderSetSummaries({
    summaries: rows,
    query: "",
    status: "active",
    amountBasis: "all",
    species: "all",
  })).toEqual([rows[0]]);
  expect(filterOrderSetSummaries({
    summaries: rows,
    query: "",
    status: "all",
    amountBasis: "all",
    species: "all",
  })).toHaveLength(2);
});

test("Order Set filters combine query, price basis, and species", () => {
  const rows = [
    summary(),
    summary({
      orderSetId: "set-2",
      setName: "고양이 치과",
      billingName: "치과 패키지",
      amountBasis: "range_price",
      rangeBasis: "patient_weight_kg",
      targetSpecies: ["cat"],
      rangePriceRanges: [{ id: "range-1", sortOrder: 0, lowerBound: 0, upperBound: null, priceKrw: 180000 }],
    }),
  ];

  expect(filterOrderSetSummaries({
    summaries: rows,
    query: "패키지",
    status: "all",
    amountBasis: "range_price",
    species: "cat",
  })).toEqual([rows[1]]);
});

test("duplicate copies the current immutable definition and receives a copy name", () => {
  const detail: OrderSetDetail = {
    ...summary(),
    workspaceId: "clair-demo",
    sourceSetVersion: "order-set-revision-2",
    currentRevision: {
      id: "11111111-1111-4111-8111-111111111111",
      workspaceId: "clair-demo",
      orderSetId: "set-1",
      revisionNo: 2,
      validationStatus: "valid",
      validationErrors: [],
      setCategory: "건강검진",
      setName: "노령견 건강검진",
      billingName: "노령견 건강검진",
      amountBasis: "included_order_sum",
      setPriceKrw: null,
      rangeBasis: null,
      salesUnit: "per_order",
      billingReflectionEnabled: true,
      taxType: "derived",
      targetSpecies: ["dog"],
      careGuide: "검사 전 안내",
      internalInstruction: "8시간 금식 확인",
      createdByUserId: "user-admin",
      createdAt: "2026-08-25T00:00:00.000Z",
      currentEtag: "order-set-revision-11111111-1111-4111-8111-111111111111",
      items: [{
        id: "item-1",
        childKind: "atomic",
        childOrderCatalogItemId: "order-1",
        childOrderCatalogRevision: 3,
        childOrderSetId: null,
        childSetRevisionId: null,
        sortOrder: 0,
        defaultSelected: true,
        billingReflectionDefault: true,
        defaultQuantity: 1,
        quantitySource: "fixed_one",
      }],
      priceRanges: [],
    },
  };

  const source = definitionFromDetail(detail);
  const duplicate = duplicateOrderSetDefinition(detail);
  expect(source.items).toHaveLength(1);
  expect(duplicate).toMatchObject({
    setName: "노령견 건강검진 복사본",
    billingName: "노령견 건강검진 복사본",
    items: source.items,
  });
});

test("amount and target labels cover fixed, range, and dog-cat summaries", () => {
  expect(formatOrderSetAmount(summary({ amountBasis: "set_fixed_price", setPriceKrw: 125000 }))).toBe("125,000원");
  expect(formatOrderSetAmount(summary({
    amountBasis: "range_price",
    rangeBasis: "patient_weight_kg",
    rangePriceRanges: [
      { id: "range-1", sortOrder: 0, lowerBound: 0, upperBound: 5, priceKrw: 120000 },
      { id: "range-2", sortOrder: 1, lowerBound: 5, upperBound: null, priceKrw: 180000 },
    ],
  }))).toBe("120,000~180,000원");
  expect(formatOrderSetSpecies(["dog", "cat"])).toBe("개, 고양이");
});
