import type { ChartOrderRuntimeRow } from "./server-order-draft-persistence-core";

// Reconcile only rows returned by the command. The caller owns read failures,
// state updates, ETags and retry timing.
export function reconcileChartOrderConfirmationRows({
  commandRows,
  readbackRows,
  confirmedRootOrderIds,
  encounterId,
  workspaceId,
}: {
  commandRows: readonly ChartOrderRuntimeRow[];
  readbackRows: readonly ChartOrderRuntimeRow[];
  confirmedRootOrderIds: readonly string[];
  encounterId: string;
  workspaceId: string;
}): ChartOrderRuntimeRow[] {
  const freshById = new Map(
    readbackRows
      .filter((row) =>
        row.workspaceId === workspaceId &&
        row.encounterId === encounterId &&
        (row.orderConfirmationStatus === "confirmed" ||
          row.orderConfirmationStatus === "billed") &&
        (confirmedRootOrderIds.includes(row.orderId) ||
          Boolean(row.parentOrderId && confirmedRootOrderIds.includes(row.parentOrderId))),
      )
      .map((row) => [row.orderId, row]),
  );
  return commandRows.map((row) => freshById.get(row.orderId) ?? row);
}
