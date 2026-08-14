import type { Column } from "@tanstack/react-table"

import type { TablePinnedCellOptions } from "@/components/ui/table"

export function getEmrPinnedColumnProps<TRow>(
  column: Column<TRow, unknown>
): TablePinnedCellOptions {
  const pinned = column.getIsPinned()

  if (!pinned) return {}

  return {
    pinned,
    pinnedEdge:
      pinned === "left"
        ? column.getIsLastColumn("left")
        : column.getIsFirstColumn("right"),
    pinnedOffset:
      pinned === "left"
        ? column.getStart("left")
        : column.getAfter("right"),
  }
}
