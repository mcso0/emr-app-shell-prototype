type ChartOrderDraftIdentityRow = {
  order: { id: string };
  catalogSearchRow?: unknown;
};

const hasChartCatalogDraftIdentity = (row: ChartOrderDraftIdentityRow) =>
  Boolean(row.catalogSearchRow) ||
  /^catalog-(?:individual|set)-/.test(row.order.id);

const chartOrderDraftUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isChartOrderDraftUuid(value: string) {
  return chartOrderDraftUuidPattern.test(value);
}

export function prepareChartOrderDraftRowsForPersistence<T extends ChartOrderDraftIdentityRow>(
  rows: T[],
  createOrderId: () => string,
): { orderIdMap: Map<string, string>; rows: T[] } {
  const orderIdMap = new Map<string, string>();
  const nextRows = rows.map((row) => {
    if (
      isChartOrderDraftUuid(row.order.id) ||
      !hasChartCatalogDraftIdentity(row)
    ) {
      return row;
    }

    const nextOrderId = createOrderId();
    orderIdMap.set(row.order.id, nextOrderId);

    return {
      ...row,
      order: {
        ...row.order,
        id: nextOrderId,
      },
    };
  });

  return { orderIdMap, rows: nextRows };
}

export function remapChartOrderIdSet(
  orderIds: Set<string>,
  orderIdMap: Map<string, string>,
) {
  if (orderIdMap.size === 0) return orderIds;

  return new Set(
    Array.from(orderIds).map((orderId) => orderIdMap.get(orderId) ?? orderId),
  );
}
