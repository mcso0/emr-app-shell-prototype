import type {
  OrderCatalogItem,
  OrderCatalogSalesUnit,
  OrderSetAmountBasis,
  OrderSetDefinition,
  OrderSetDetail,
  OrderSetSummary,
} from "@/features/hospital-admin/server-order-catalog";
import type { Species } from "@/types/emr-domain";

export type OrderSetAvailability = OrderSetSummary["availabilityStatus"];
export type OrderSetStatusFilter = "all" | OrderSetAvailability;
export type OrderSetAmountFilter = "all" | OrderSetAmountBasis;
export type OrderSetSpeciesFilter = "all" | Species;

export const defaultOrderSetAvailability: OrderSetAvailability = "inactive";

export const orderSetAvailabilityLabels: Record<OrderSetAvailability, string> = {
  active: "사용",
  paused: "일시 중지",
  inactive: "사용 안 함",
};

export const orderSetAmountBasisLabels: Record<OrderSetAmountBasis, string> = {
  included_order_sum: "구성항목 합계",
  set_fixed_price: "세트 고정가",
  range_price: "구간가",
};

export const orderSetSalesUnitLabels: Record<OrderCatalogSalesUnit, string> = {
  per_order: "오더당",
  per_each: "개당",
  per_day: "일당",
  per_frequency: "회당",
  per_ml: "mL당",
  per_kg: "kg당",
};

export const orderSetSpeciesLabels: Record<Species, string> = {
  dog: "개",
  cat: "고양이",
  rabbit: "토끼",
  ferret: "페럿",
  hamster: "햄스터",
  guinea_pig: "기니피그",
  hedgehog: "고슴도치",
  bird: "조류",
  reptile: "파충류",
  turtle: "거북",
  other: "기타",
};

export function createEmptyOrderSetDefinition(): OrderSetDefinition {
  return {
    setCategory: null,
    setName: "",
    billingName: "",
    amountBasis: "included_order_sum",
    setPriceKrw: null,
    rangeBasis: null,
    salesUnit: "per_order",
    billingReflectionEnabled: true,
    taxType: "derived",
    targetSpecies: ["dog", "cat"],
    careGuide: null,
    internalInstruction: null,
    items: [],
    priceRanges: [],
  };
}

export function definitionFromDetail(detail: OrderSetDetail): OrderSetDefinition {
  const revision = detail.currentRevision;
  if (!revision) {
    return {
      ...createEmptyOrderSetDefinition(),
      setName: detail.setName,
      billingName: detail.billingName,
      amountBasis: detail.amountBasis,
      setPriceKrw: detail.setPriceKrw,
      rangeBasis: detail.rangeBasis,
      salesUnit: detail.salesUnit,
      targetSpecies: detail.targetSpecies,
      taxType: detail.taxType,
      priceRanges: detail.rangePriceRanges.map((range) => ({
        sortOrder: range.sortOrder,
        lowerBound: range.lowerBound,
        upperBound: range.upperBound,
        priceKrw: range.priceKrw,
      })),
    };
  }

  return {
    setCategory: revision.setCategory,
    setName: revision.setName,
    billingName: revision.billingName,
    amountBasis: revision.amountBasis,
    setPriceKrw: revision.setPriceKrw,
    rangeBasis: revision.rangeBasis,
    salesUnit: revision.salesUnit,
    billingReflectionEnabled: revision.billingReflectionEnabled,
    taxType: revision.taxType,
    targetSpecies: [...revision.targetSpecies],
    careGuide: revision.careGuide,
    internalInstruction: revision.internalInstruction,
    items: revision.items.map((item) => ({
      childKind: item.childKind,
      childOrderCatalogItemId: item.childOrderCatalogItemId,
      childOrderCatalogRevision: item.childOrderCatalogRevision,
      childOrderSetId: item.childOrderSetId,
      childSetRevisionId: item.childSetRevisionId,
      sortOrder: item.sortOrder,
      defaultSelected: item.defaultSelected,
      billingReflectionDefault: item.billingReflectionDefault,
      defaultQuantity: item.defaultQuantity,
      quantitySource: item.quantitySource,
    })),
    priceRanges: revision.priceRanges.map((range) => ({
      sortOrder: range.sortOrder,
      lowerBound: range.lowerBound,
      upperBound: range.upperBound,
      priceKrw: range.priceKrw,
    })),
  };
}

export function duplicateOrderSetDefinition(detail: OrderSetDetail): OrderSetDefinition {
  const definition = definitionFromDetail(detail);
  return {
    ...definition,
    setName: `${definition.setName} 복사본`,
    billingName: definition.billingName
      ? `${definition.billingName} 복사본`
      : `${definition.setName} 복사본`,
  };
}

export function formatOrderSetSpecies(species: Species[]) {
  if (species.length === 0) return "대상 없음";
  if (species.includes("dog") && species.includes("cat") && species.length === 2) {
    return "개, 고양이";
  }
  return species.map((value) => orderSetSpeciesLabels[value]).join(", ");
}

export function formatOrderSetAmount(summary: OrderSetSummary) {
  if (summary.amountBasis === "set_fixed_price") {
    return typeof summary.setPriceKrw === "number"
      ? `${summary.setPriceKrw.toLocaleString("ko-KR")}원`
      : "금액 없음";
  }
  if (summary.amountBasis === "range_price") {
    const prices = summary.rangePriceRanges.map((range) => range.priceKrw);
    if (prices.length === 0) return "구간 없음";
    const min = Math.min(...prices).toLocaleString("ko-KR");
    const max = Math.max(...prices).toLocaleString("ko-KR");
    return min === max ? `${min}원` : `${min}~${max}원`;
  }
  return "구성 합계";
}

export function filterOrderSetSummaries({
  amountBasis,
  query,
  species,
  status,
  summaries,
}: {
  amountBasis: OrderSetAmountFilter;
  query: string;
  species: OrderSetSpeciesFilter;
  status: OrderSetStatusFilter;
  summaries: OrderSetSummary[];
}) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  return summaries.filter((summary) => {
    if (status !== "all" && summary.availabilityStatus !== status) return false;
    if (amountBasis !== "all" && summary.amountBasis !== amountBasis) return false;
    if (species !== "all" && !summary.targetSpecies.includes(species)) return false;
    if (
      normalizedQuery &&
      !summary.setName.toLocaleLowerCase("ko-KR").includes(normalizedQuery) &&
      !summary.billingName.toLocaleLowerCase("ko-KR").includes(normalizedQuery)
    ) {
      return false;
    }
    return true;
  });
}

export function resolveOrderSetItemLabel(
  item: OrderSetDefinition["items"][number],
  catalog: OrderCatalogItem[],
  sets: OrderSetSummary[],
) {
  if (item.childKind === "atomic") {
    return (
      catalog.find((candidate) => candidate.id === item.childOrderCatalogItemId)
        ?.inHospitalOrderName ?? "연결된 원자 오더"
    );
  }
  return (
    sets.find((candidate) => candidate.orderSetId === item.childOrderSetId)?.setName ??
    "연결된 Order 세트"
  );
}
