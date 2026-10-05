import type { ChartOrderSetSelectionIntent } from "@/features/hospital-admin/server-order-catalog";
import type { ClinicalOrderPriority } from "@/types/emr-domain";

type ChartOrderDraftMergeRow = {
  order: { id: string };
  billingName: string;
  detailInputs: Record<string, unknown>;
  detailSchemaVersion: number;
  priority: ClinicalOrderPriority;
  quantityInput: string;
  setSelectionIntent?: ChartOrderSetSelectionIntent;
};

export function mergeChartOrderDraftRowsAfterSave<T extends ChartOrderDraftMergeRow>(
  currentRows: readonly T[],
  committedById: ReadonlyMap<string, T>,
  isAttemptedRemovalRow: (row: T) => boolean,
): T[] {
  return currentRows
    .filter((currentRow) => !isAttemptedRemovalRow(currentRow))
    .map((currentRow) => {
      const committedRow = committedById.get(currentRow.order.id);
      if (!committedRow) return currentRow;
      return {
        ...committedRow,
        billingName: currentRow.billingName,
        detailInputs: currentRow.detailInputs,
        detailSchemaVersion: currentRow.detailSchemaVersion,
        priority: currentRow.priority,
        quantityInput: currentRow.quantityInput,
        setSelectionIntent: currentRow.setSelectionIntent,
      };
    });
}
