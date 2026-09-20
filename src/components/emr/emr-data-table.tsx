"use client";

import * as React from "react";
import {
  flexRender,
  type Column,
  type Cell,
  type Header,
  type HeaderGroup,
  type Row,
  type RowData,
  type Table as TanStackTable,
} from "@tanstack/react-table";

import {
  EmrTableCellText,
  EmrTableHeaderCell,
  EmrTableSelectionCell,
  EmrTableSelectionHeaderCell,
  EmrPinnedTableViewport,
} from "@/components/emr/table-primitives";
import { EmrIconButton } from "@/components/emr/icon-button";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { getEmrPinnedColumnProps } from "@/components/emr/table-pinning";
import type {
  EmrColumnResize,
  EmrTableCellTextMode,
  EmrTableDensity,
  EmrTableHeaderInteraction,
} from "@/components/emr/table-density";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  type TableOverscrollAxes,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type EmrDataTableColumnRole = "data" | "selection" | "actions";

export type EmrDataTableActionVisibility = "always" | "contextual";

export type EmrDataTableViewportMode = "content" | "fill";

export type EmrDataTableRowState =
  | "normal"
  | "draft"
  | "confirmed"
  | "error"
  | "disabled";

export type EmrDataTableColumnMeta = {
  actionVisibility?: EmrDataTableActionVisibility;
  align?: "left" | "center" | "right";
  cellPadding?: "default" | "none";
  grow?: boolean;
  identity?: boolean;
  label?: string;
  role?: EmrDataTableColumnRole;
  textMode?: EmrTableCellTextMode;
  verticalAlign?: "middle" | "top";
  headerInteraction?: EmrTableHeaderInteraction;
  resize?: EmrColumnResize;
  resetSize?: number;
};

declare module "@tanstack/react-table" {
  // ColumnMeta is intentionally open for the shared EMR meaning contract.
  /* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
  interface ColumnMeta<
    TData extends RowData,
    TValue,
  > extends EmrDataTableColumnMeta {}
  /* eslint-enable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars */
}

export type EmrDataTableProps<TData> = {
  table: TanStackTable<TData>;
  "aria-label": string;
  viewportMode: EmrDataTableViewportMode;
  density?: EmrTableDensity;
  overscrollAxes?: TableOverscrollAxes;
  containerClassName?: string;
  className?: string;
  columnGap?: number;
  leadingInset?: number;
  initialLoading?: boolean;
  growLastColumn?: boolean;
  skeletonRowCount?: number;
  getRowProps?: (
    row: Row<TData>,
  ) => Omit<React.ComponentProps<typeof TableRow>, "children">;
  getRowState?: (row: Row<TData>) => EmrDataTableRowState;
  renderRowOverlay?: (context: {
    row: Row<TData>;
    table: TanStackTable<TData>;
  }) => React.ReactNode;
  getRowOverlayAriaLabel?: (row: Row<TData>) => string;
  rowOverlayWidth?: number | string;
  renderSelectionActionBar?: (context: {
    selectedRows: Row<TData>[];
    table: TanStackTable<TData>;
  }) => React.ReactNode;
  selectionActionBarAriaLabel?: string;
  renderAfterRow?: (row: Row<TData>) => React.ReactNode;
  renderAfterRows?: (context: {
    table: TanStackTable<TData>;
    visibleColumnCount: number;
  }) => React.ReactNode;
  footerRows?: React.ReactNode;
};

function getColumnMeta(column: {
  columnDef: { meta?: EmrDataTableColumnMeta };
}) {
  return column.columnDef.meta;
}

function getOrderedVisibleColumns<TData>(table: TanStackTable<TData>) {
  return [
    ...table.getLeftVisibleLeafColumns(),
    ...table.getCenterVisibleLeafColumns(),
    ...table.getRightVisibleLeafColumns(),
  ];
}

function getOrderedHeaderGroups<TData>(table: TanStackTable<TData>) {
  const allGroups = table.getHeaderGroups();
  const leftGroups = table.getLeftHeaderGroups();
  const centerGroups = table.getCenterHeaderGroups();
  const rightGroups = table.getRightHeaderGroups();

  return allGroups.map((group, index) => ({
    ...group,
    headers: [
      ...(leftGroups[index]?.headers ?? []),
      ...(centerGroups[index]?.headers ?? []),
      ...(rightGroups[index]?.headers ?? []),
    ],
  }));
}

function getVisibleCells<TData>(table: TanStackTable<TData>, row: Row<TData>) {
  return [
    ...row.getLeftVisibleCells(),
    ...row.getCenterVisibleCells(),
    ...row.getRightVisibleCells(),
  ];
}

function getGrowColumnId<TData>(
  columns: Column<TData, unknown>[],
  growLastColumn: boolean,
) {
  const explicitGrowColumn = columns.find(
    (column) => getColumnMeta(column)?.grow === true,
  );

  if (explicitGrowColumn) return explicitGrowColumn.id;
  if (!growLastColumn) return undefined;

  return [...columns].reverse().find((column) => {
    const meta = getColumnMeta(column);
    return (
      !column.getIsPinned() &&
      meta?.role !== "selection" &&
      meta?.role !== "actions"
    );
  })?.id;
}

function getPinnedPropsWithGap<TData>(
  table: TanStackTable<TData>,
  column: Column<TData, unknown>,
  columnGap: number,
  leadingInset = 0,
) {
  const pinnedProps = getEmrPinnedColumnProps(column);
  if (!columnGap || !pinnedProps.pinned) return pinnedProps;

  const pinnedColumns =
    pinnedProps.pinned === "left"
      ? table.getLeftVisibleLeafColumns()
      : table.getRightVisibleLeafColumns();
  const columnIndex = pinnedColumns.findIndex((item) => item.id === column.id);
  const gapOffset =
    pinnedProps.pinned === "left"
      ? columnIndex * columnGap
      : (pinnedColumns.length - columnIndex - 1) * columnGap;

  return {
    ...pinnedProps,
    pinnedOffset:
      Number(pinnedProps.pinnedOffset ?? 0) +
      gapOffset +
      (pinnedProps.pinned === "left" ? leadingInset : 0),
  };
}

function getSortLabel(label: string, direction: false | "asc" | "desc") {
  if (direction === "asc") {
    return `${label} 내림차순 정렬`;
  }

  if (direction === "desc") {
    return `${label} 정렬 해제`;
  }

  return `${label} 오름차순 정렬`;
}

function toggleColumnSorting<TData>(column: Column<TData, unknown>) {
  const direction = column.getIsSorted();

  if (!direction) {
    column.toggleSorting(false);
  } else if (direction === "asc") {
    column.toggleSorting(true);
  } else {
    column.clearSorting();
  }
}

function resizeColumnFromKeyboard<TData>(
  table: TanStackTable<TData>,
  column: Column<TData, unknown>,
  event: React.KeyboardEvent<HTMLButtonElement>,
) {
  const resetSize = getColumnMeta(column)?.resetSize;
  if (event.key === "Home" && resetSize !== undefined) {
    event.preventDefault();
    event.stopPropagation();
    table.setColumnSizing((current) => ({
      ...current,
      [column.id]: resetSize,
    }));
    return;
  }

  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

  event.preventDefault();
  event.stopPropagation();
  const delta =
    (event.shiftKey ? 24 : 8) * (event.key === "ArrowRight" ? 1 : -1);
  const minSize = column.columnDef.minSize ?? 20;
  const maxSize = column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER;
  const size = Math.min(maxSize, Math.max(minSize, column.getSize() + delta));
  table.setColumnSizing((current) => ({ ...current, [column.id]: size }));
}

function resetColumnFromResizeHandle<TData>(
  table: TanStackTable<TData>,
  column: Column<TData, unknown>,
  event: React.MouseEvent<HTMLButtonElement>,
) {
  const resetSize = getColumnMeta(column)?.resetSize;
  if (resetSize === undefined) return;

  event.preventDefault();
  event.stopPropagation();
  table.setColumnSizing((current) => ({
    ...current,
    [column.id]: resetSize,
  }));
}

function getRenderedCellContent<TData>(
  cell: Cell<TData, unknown>,
): React.ReactNode {
  const meta = getColumnMeta(cell.column);
  const content = cell.column.columnDef.cell
    ? flexRender(cell.column.columnDef.cell, cell.getContext())
    : (cell.getValue() as React.ReactNode);

  if (typeof content === "string" || typeof content === "number") {
    return (
      <EmrTableCellText
        fullText={String(content)}
        mode={meta?.textMode ?? "one-line"}
      >
        {content}
      </EmrTableCellText>
    );
  }

  return content;
}

function getRowClassName<TData>(row: Row<TData>, className?: string) {
  return cn(
    "group/emr-data-table-row cursor-default border-[var(--emr-table-data-border)] bg-[var(--emr-table-data-row-surface)]",
    row.getIsSelected() &&
      "data-[state=selected]:bg-[var(--emr-state-selected)]",
    className,
  );
}

function getSafeRowProps<TData>(
  row: Row<TData>,
  rowState: EmrDataTableRowState,
  getRowProps?: EmrDataTableProps<TData>["getRowProps"],
) {
  const customProps = getRowProps?.(row) ?? {};
  const customOnClick = customProps.onClick;
  const customDataState = (customProps as { "data-state"?: string })[
    "data-state"
  ];

  return {
    ...customProps,
    className: getRowClassName(row, customProps.className),
    "data-emr-data-table-row": "true",
    "data-emr-data-table-row-state": rowState,
    "data-state":
      customDataState ?? (row.getIsSelected() ? "selected" : undefined),
    "aria-disabled": customProps["aria-disabled"] ?? (
      rowState === "disabled" ? "true" : undefined
    ),
    onClick: customOnClick
      ? (event: React.MouseEvent<HTMLTableRowElement>) => {
          if (
            (event.target as HTMLElement).closest(
              "[data-row-interactive='true']",
            )
          ) {
            return;
          }

          customOnClick(event);
        }
      : undefined,
  };
}

function toCssLength(value: number | string) {
  return typeof value === "number" ? `${value}px` : value;
}

function EmrDataTableOverlayHeader() {
  return (
    <TableHead
      aria-hidden="true"
      className="sticky right-0 z-[16] !h-0 !w-0 !min-w-0 !max-w-0 !border-0 !p-0"
      data-emr-data-table-overlay-anchor="header"
    />
  );
}

function EmrDataTableRowOverlay({
  ariaLabel,
  children,
  onTouchOpenChange,
  touchOpen,
  width,
}: {
  ariaLabel: string;
  children: React.ReactNode;
  onTouchOpenChange: (open: boolean) => void;
  touchOpen: boolean;
  width: number | string;
}) {
  return (
    <TableCell
      className="sticky right-0 z-[15] !w-0 !min-w-0 !max-w-0 overflow-visible !border-0 !p-0"
      data-emr-data-table-overlay-anchor="row"
    >
      <div
        aria-label={ariaLabel}
        className="emr-data-table-row-overlay"
        data-emr-data-table-row-overlay="true"
        data-touch-open={touchOpen ? "true" : undefined}
        role="group"
        style={
          {
            "--emr-table-row-overlay-width": toCssLength(width),
          } as React.CSSProperties
        }
      >
        <div
          className="emr-data-table-row-overlay-actions"
          data-emr-data-table-row-overlay-actions="true"
          data-row-interactive="true"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") onTouchOpenChange(false);
          }}
        >
          {children}
        </div>
        <EmrIconButton
          aria-expanded={touchOpen}
          aria-label={touchOpen ? `${ariaLabel} 접기` : `${ariaLabel} 펼치기`}
          className="emr-data-table-row-overlay-touch-trigger size-7 border border-[var(--emr-border-default)] bg-[var(--emr-surface-floating)] shadow-[var(--clair-shadow-xs)]"
          data-emr-data-table-row-overlay-touch-trigger="true"
          data-row-interactive="true"
          onClick={(event) => {
            event.stopPropagation();
            onTouchOpenChange(!touchOpen);
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Escape") onTouchOpenChange(false);
          }}
          type="button"
        >
          <CdsFilesMoreHorizontalIcon aria-hidden="true" />
        </EmrIconButton>
      </div>
    </TableCell>
  );
}

function EmrDataTableSelectionActionBar({
  ariaLabel,
  children,
  tableRootRef,
}: {
  ariaLabel: string;
  children: React.ReactNode;
  tableRootRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [position, setPosition] = React.useState<{
    bottom: number;
    left: number;
    maxWidth: number;
  } | null>(null);

  React.useLayoutEffect(() => {
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const root = tableRootRef.current;
        if (!root) return setPosition(null);
        const rect = root.getBoundingClientRect();
        const visibleTop = Math.max(0, rect.top);
        const visibleBottom = Math.min(window.innerHeight, rect.bottom);
        const visibleLeft = Math.max(0, rect.left);
        const visibleRight = Math.min(window.innerWidth, rect.right);
        if (visibleBottom - visibleTop < 80 || visibleRight - visibleLeft < 120) {
          return setPosition(null);
        }
        setPosition({
          bottom: Math.max(16, window.innerHeight - visibleBottom + 14),
          left: (visibleLeft + visibleRight) / 2,
          maxWidth: Math.max(96, visibleRight - visibleLeft - 24),
        });
      });
    };
    const observer = new ResizeObserver(update);
    if (tableRootRef.current) observer.observe(tableRootRef.current);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [tableRootRef]);

  if (!position) return null;

  return (
    <div
      aria-label={ariaLabel}
      className="emr-data-table-selection-action-bar"
      data-emr-data-table-selection-action-bar="true"
      data-row-interactive="true"
      role="toolbar"
      style={{
        bottom: position.bottom,
        left: position.left,
        maxWidth: position.maxWidth,
      }}
    >
      {children}
    </div>
  );
}

function EmrDataTableSkeletonRows<TData>({
  columnGap,
  hasRowOverlay,
  leadingInset,
  rowCount,
  table,
}: {
  columnGap: number;
  hasRowOverlay: boolean;
  leadingInset: number;
  rowCount: number;
  table: TanStackTable<TData>;
}) {
  const columns = getOrderedVisibleColumns(table);

  return Array.from({ length: rowCount }, (_, rowIndex) => (
    <TableRow
      key={`emr-data-table-skeleton-${rowIndex}`}
      aria-hidden="true"
      className="bg-[var(--emr-table-data-row-surface)]"
      data-emr-data-table-skeleton-row="true"
    >
      {columns.map((column, columnIndex) => {
        const meta = getColumnMeta(column);
        const effectiveColumnGap =
          columnIndex === columns.length - 1 ? 0 : columnGap;
        const pinnedProps = getPinnedPropsWithGap(
          table,
          column,
          effectiveColumnGap,
          leadingInset,
        );
        const isSelection = meta?.role === "selection";
        const selectionColumnSize = column.getSize();

        return (
          <TableCell
            key={column.id}
            className={cn(
              "overflow-hidden !p-0",
              isSelection && "!p-0",
              isSelection && selectionColumnSize === 32 && "!pl-3 !pr-1",
            )}
            data-column-id={column.id}
            data-emr-column-size={column.getSize()}
            style={
              isSelection
                ? {
                    maxWidth: selectionColumnSize,
                    minWidth: selectionColumnSize,
                    width: selectionColumnSize,
                  }
                : undefined
            }
            {...pinnedProps}
          >
            <div
              className={cn(
                "emr-data-table-cell-content flex",
                isSelection ? "justify-center" : "justify-start",
                isSelection &&
                  selectionColumnSize === 32 &&
                  "!px-0 !justify-start",
                meta?.identity && "!px-0",
              )}
              data-emr-table-identity-content={
                meta?.identity ? "true" : undefined
              }
              style={
                effectiveColumnGap
                  ? { marginInlineEnd: `${effectiveColumnGap}px` }
                  : undefined
              }
            >
              <Skeleton
                className={cn(
                  "motion-reduce:animate-none",
                  isSelection ? "size-4" : "h-4",
                  !isSelection &&
                    ["w-20", "w-24", "w-28", "w-32"][columnIndex % 4],
                )}
              />
            </div>
          </TableCell>
        );
      })}
      {hasRowOverlay ? (
        <TableCell
          aria-hidden="true"
          className="!w-0 !min-w-0 !max-w-0 !border-0 !p-0"
          data-emr-data-table-overlay-anchor="skeleton"
        />
      ) : null}
    </TableRow>
  ));
}

function EmrDataTableHeader<TData>({
  columnGap,
  group,
  hasRowOverlay,
  leadingInset,
}: {
  columnGap: number;
  group: HeaderGroup<TData>;
  hasRowOverlay: boolean;
  leadingInset: number;
}) {
  return (
    <TableRow
      key={group.id}
      className="border-0 bg-[var(--emr-table-header-surface)] hover:bg-[var(--emr-table-header-surface)]"
      data-emr-data-table-header="true"
    >
      {group.headers.map((header: Header<TData, unknown>) => {
        const column = header.column;
        const visibleColumns = getOrderedVisibleColumns(header.getContext().table);
        const effectiveColumnGap =
          visibleColumns.at(-1)?.id === column.id ? 0 : columnGap;
        const meta = getColumnMeta(column);
        const role = meta?.role ?? "data";
        const pinnedProps = getPinnedPropsWithGap(
          header.getContext().table,
          column,
          effectiveColumnGap,
          leadingInset,
        );
        const isSelection = role === "selection";
        const isActions = role === "actions";
        const sortDirection = column.getIsSorted();
        const canSort = !header.isPlaceholder && column.getCanSort();
        const label = meta?.label ?? column.id;
        const interaction = header.isPlaceholder
          ? "static"
          : (meta?.headerInteraction ?? (canSort ? "sortable" : "static"));
        const resize =
          !header.isPlaceholder && column.getCanResize()
            ? (meta?.resize ?? "none")
            : "none";
        const renderedHeaderContent = header.isPlaceholder
          ? null
          : column.columnDef.header
            ? flexRender(column.columnDef.header, header.getContext())
            : label;
        // Data-column labels are part of the shared contract. Feature column
        // definitions may still supply JSX for selection/action controls, but
        // an accessor-derived string must never replace the customer-style
        // semantic label in the common header renderer.
        const headerContent = isSelection
          ? (renderedHeaderContent ?? label)
          : isActions
            ? label
            : header.isPlaceholder
              ? null
              : label;

        if (isSelection) {
          const selectionColumnSize = column.getSize();

          return (
            <EmrTableSelectionHeaderCell
              key={header.id}
              aria-label={label}
              className={cn(
                "!p-0 min-w-0 overflow-hidden [&_.emr-table-cell-content]:!p-0",
                selectionColumnSize === 20
                  ? "!pl-0.5 !pr-0.5"
                  : selectionColumnSize === 32
                    ? "!pl-3 !pr-1"
                    : "!pl-5 !pr-2",
              )}
              data-column-id={column.id}
              data-emr-column-size={column.getSize()}
              gutter={effectiveColumnGap}
              selectionWidth={selectionColumnSize}
              style={{
                maxWidth: selectionColumnSize,
                minWidth: selectionColumnSize,
                width: selectionColumnSize,
              }}
              {...pinnedProps}
            >
              {headerContent}
            </EmrTableSelectionHeaderCell>
          );
        }

        return (
          <EmrTableHeaderCell
            key={header.id}
            align={meta?.align}
            aria-label={isActions ? label : undefined}
            className={cn(
              "!p-0 min-w-0 overflow-hidden",
              isActions && "w-[52px] min-w-[52px] max-w-[52px] !pl-2 !pr-5",
              meta?.identity && "!p-0",
            )}
            data-column-id={column.id}
            data-emr-column-size={column.getSize()}
            identity={meta?.identity}
            insetPlainTextLabel={!isActions}
            interaction={interaction}
            isResizing={column.getIsResizing()}
            label={label}
            resize={resize}
            resizeLabel={`${label} 컬럼 너비 조절`}
            sortDirection={sortDirection || undefined}
            sortLabel={canSort ? getSortLabel(label, sortDirection) : undefined}
            style={{
              width: column.getSize() + effectiveColumnGap,
              minWidth: column.getSize() + effectiveColumnGap,
              maxWidth: column.getSize() + effectiveColumnGap,
            }}
            onResizeKeyDown={(event) =>
              resizeColumnFromKeyboard(header.getContext().table, column, event)
            }
            onResizeDoubleClick={(event) =>
              resetColumnFromResizeHandle(
                header.getContext().table,
                column,
                event,
              )
            }
            onResizeMouseDown={header.getResizeHandler()}
            onResizeTouchStart={header.getResizeHandler()}
            onSort={canSort ? () => toggleColumnSorting(column) : undefined}
            gutter={effectiveColumnGap}
            {...pinnedProps}
          >
            {headerContent}
          </EmrTableHeaderCell>
        );
      })}
      {hasRowOverlay ? <EmrDataTableOverlayHeader /> : null}
    </TableRow>
  );
}

function EmrDataTableBodyRow<TData>({
  columnGap,
  getRowProps,
  getRowState,
  getRowOverlayAriaLabel,
  onTouchOverlayOpenChange,
  row,
  rowOverlayWidth,
  leadingInset,
  renderRowOverlay,
  renderAfterRow,
  table,
  touchOverlayOpen,
}: {
  columnGap: number;
  getRowProps?: EmrDataTableProps<TData>["getRowProps"];
  getRowState?: EmrDataTableProps<TData>["getRowState"];
  getRowOverlayAriaLabel?: EmrDataTableProps<TData>["getRowOverlayAriaLabel"];
  onTouchOverlayOpenChange: (open: boolean) => void;
  row: Row<TData>;
  rowOverlayWidth: number | string;
  leadingInset: number;
  renderRowOverlay?: EmrDataTableProps<TData>["renderRowOverlay"];
  renderAfterRow?: EmrDataTableProps<TData>["renderAfterRow"];
  table: TanStackTable<TData>;
  touchOverlayOpen: boolean;
}) {
  const cells = getVisibleCells(table, row);
  const rowState = getRowState?.(row) ?? "normal";
  const rowOverlay = renderRowOverlay?.({ row, table });

  return (
    <React.Fragment key={row.id}>
      <TableRow {...getSafeRowProps(row, rowState, getRowProps)}>
        {cells.map((cell, cellIndex) => {
          const meta = getColumnMeta(cell.column);
          const role = meta?.role ?? "data";
          const effectiveColumnGap =
            cellIndex === cells.length - 1 ? 0 : columnGap;
          const pinnedProps = getPinnedPropsWithGap(
            table,
            cell.column,
            effectiveColumnGap,
            leadingInset,
          );
          const isSelection = role === "selection";
          const isActions = role === "actions";

          if (isSelection) {
            const selectionColumnSize = cell.column.getSize();

            return (
              <EmrTableSelectionCell
                key={cell.id}
                className={cn(
                  "!p-0 min-w-0 overflow-hidden [&_.emr-table-cell-content]:!p-0",
                  selectionColumnSize === 20
                    ? "!pl-0.5 !pr-0.5"
                    : selectionColumnSize === 32
                      ? "!pl-3 !pr-1"
                      : "!pl-5 !pr-2",
                )}
                controlVisibility="contextual"
                data-column-id={cell.column.id}
                data-emr-column-size={cell.column.getSize()}
                gutter={effectiveColumnGap}
                selectionWidth={selectionColumnSize}
                style={{
                  maxWidth: selectionColumnSize,
                  minWidth: selectionColumnSize,
                  width: selectionColumnSize,
                }}
                {...pinnedProps}
              >
                {getRenderedCellContent(cell)}
              </EmrTableSelectionCell>
            );
          }

          return (
            <TableCell
              key={cell.id}
              className={cn(
                "min-w-0 overflow-hidden !p-0",
                isActions && "overflow-visible !pl-2 !pr-5 text-right",
              )}
              data-column-id={cell.column.id}
              data-emr-column-size={cell.column.getSize()}
              data-emr-table-action-visibility={
                isActions ? (meta?.actionVisibility ?? "always") : undefined
              }
              style={{
                width: cell.column.getSize() + effectiveColumnGap,
                minWidth: cell.column.getSize() + effectiveColumnGap,
                maxWidth: cell.column.getSize() + effectiveColumnGap,
                verticalAlign: meta?.verticalAlign ?? "middle",
              }}
              {...pinnedProps}
            >
              <div
                className={cn(
                  "emr-data-table-cell-content flex min-w-0",
                  meta?.cellPadding === "none" &&
                    "emr-data-table-cell-content--no-boundary-inset",
                  meta?.identity && "!px-0",
                  meta?.cellPadding === "none" && "!px-0",
                  meta?.align === "right" && "justify-end text-right",
                  meta?.align === "center" && "justify-center text-center",
                  meta?.verticalAlign === "top" && "items-start",
                  isActions && "justify-end",
                )}
                data-emr-table-content="true"
                style={{
                  marginInlineEnd: effectiveColumnGap
                    ? `${effectiveColumnGap}px`
                    : undefined,
                  paddingInline: meta?.cellPadding === "none" ? 0 : undefined,
                }}
              >
                {getRenderedCellContent(cell)}
              </div>
            </TableCell>
          );
        })}
        {renderRowOverlay ? (
          <EmrDataTableRowOverlay
            ariaLabel={getRowOverlayAriaLabel?.(row) ?? `${row.id} 행 작업`}
            onTouchOpenChange={onTouchOverlayOpenChange}
            touchOpen={touchOverlayOpen}
            width={rowOverlayWidth}
          >
            {rowOverlay}
          </EmrDataTableRowOverlay>
        ) : null}
      </TableRow>
      {renderAfterRow?.(row)}
    </React.Fragment>
  );
}

export function EmrDataTable<TData>({
  table,
  "aria-label": ariaLabel,
  className,
  columnGap = 0,
  containerClassName,
  density = "standard",
  footerRows,
  getRowOverlayAriaLabel,
  getRowProps,
  getRowState,
  growLastColumn = true,
  leadingInset = 0,
  initialLoading = false,
  overscrollAxes = "horizontal",
  renderRowOverlay,
  renderSelectionActionBar,
  renderAfterRow,
  renderAfterRows,
  rowOverlayWidth = 166,
  selectionActionBarAriaLabel = "선택 행 작업",
  skeletonRowCount = 6,
  viewportMode,
}: EmrDataTableProps<TData>) {
  const tableRootRef = React.useRef<HTMLDivElement>(null);
  const [touchOverlayRowId, setTouchOverlayRowId] = React.useState<string | null>(
    null,
  );
  const columns = getOrderedVisibleColumns(table);
  const visibleColumnWidth = columns.reduce(
    (total, column) => total + column.getSize(),
    0,
  );
  const rows = table.getRowModel().rows;
  const selectedRows = table.getSelectedRowModel().rows;
  const hasPinnedColumns = table.getIsSomeColumnsPinned();
  const hasRowOverlay = Boolean(renderRowOverlay);
  const visibleColumnCount = columns.length + (hasRowOverlay ? 1 : 0);
  const leftPinnedColumns = table.getLeftVisibleLeafColumns();
  const leftPinnedColumnWidth =
    leadingInset +
    leftPinnedColumns.reduce((total, column) => total + column.getSize(), 0) +
    Math.max(0, leftPinnedColumns.length - 1) * columnGap +
    (leftPinnedColumns.length > 0 ? columnGap : 0);
  const rightPinnedColumnWidth =
    table.getRightVisibleLeafColumns().reduce(
      (total, column) => total + column.getSize(),
      0,
    ) +
    Math.max(0, table.getRightVisibleLeafColumns().length - 1) * columnGap;
  const growColumnId = getGrowColumnId(columns, growLastColumn);
  const headerGroups = getOrderedHeaderGroups(table);
  const activeTouchOverlayRowId = rows.some(
    (row) => row.id === touchOverlayRowId,
  )
    ? touchOverlayRowId
    : null;
  const selectionActionBar = selectedRows.length > 0
    ? renderSelectionActionBar?.({ selectedRows, table })
    : null;

  const tableContent = (
    <Table
      aria-label={ariaLabel}
      className={cn("table-fixed", className)}
      containerClassName={cn(
        "isolate min-w-0 bg-[var(--emr-table-data-row-surface)]",
        viewportMode === "fill"
          ? "min-h-0 flex-1 scroll-pt-10 overflow-auto"
          : "w-full overflow-x-auto",
        containerClassName,
      )}
      containerStyle={
        hasPinnedColumns || leadingInset
          ? {
              ...(hasPinnedColumns ? { overflow: "visible" } : {}),
              paddingInlineStart: leadingInset || undefined,
            }
          : undefined
      }
      density={density}
      layout="scroll"
      minWidth={
        visibleColumnWidth + Math.max(0, columns.length - 1) * columnGap
      }
      overscrollAxes={hasPinnedColumns ? "none" : overscrollAxes}
      pinning={hasPinnedColumns ? "columns" : "none"}
      style={
        !growLastColumn
          ? {
              width: `${visibleColumnWidth + Math.max(0, columns.length - 1) * columnGap}px`,
              maxWidth: `${visibleColumnWidth + Math.max(0, columns.length - 1) * columnGap}px`,
              tableLayout: "fixed",
            }
          : undefined
      }
    >
      <colgroup>
        {columns.map((column, columnIndex) => (
          <col
            key={column.id}
            style={
              column.id === growColumnId
                ? { minWidth: `${column.getSize()}px` }
                : {
                    width: `${column.getSize() + (columnIndex === columns.length - 1 ? 0 : columnGap)}px`,
                    minWidth: `${column.getSize() + (columnIndex === columns.length - 1 ? 0 : columnGap)}px`,
                  }
            }
          />
        ))}
        {hasRowOverlay ? <col style={{ width: 0 }} /> : null}
      </colgroup>
      <TableHeader className="sticky top-0 z-10">
        {headerGroups.map((group) => (
          <EmrDataTableHeader
            columnGap={columnGap}
            key={group.id}
            group={group}
            hasRowOverlay={hasRowOverlay}
            leadingInset={leadingInset}
          />
        ))}
      </TableHeader>
      <TableBody>
        {initialLoading ? (
          <EmrDataTableSkeletonRows
            columnGap={columnGap}
            hasRowOverlay={hasRowOverlay}
            leadingInset={leadingInset}
            rowCount={skeletonRowCount}
            table={table}
          />
        ) : (
          rows.map((row) => (
            <EmrDataTableBodyRow
              columnGap={columnGap}
              key={row.id}
              getRowOverlayAriaLabel={getRowOverlayAriaLabel}
              getRowProps={getRowProps}
              getRowState={getRowState}
              onTouchOverlayOpenChange={(open) => {
                setTouchOverlayRowId(open ? row.id : null);
              }}
              renderRowOverlay={renderRowOverlay}
              renderAfterRow={renderAfterRow}
              row={row}
              rowOverlayWidth={rowOverlayWidth}
              leadingInset={leadingInset}
              table={table}
              touchOverlayOpen={activeTouchOverlayRowId === row.id}
            />
          ))
        )}
        {renderAfterRows?.({ table, visibleColumnCount })}
      </TableBody>
      {footerRows ? <TableFooter>{footerRows}</TableFooter> : null}
    </Table>
  );

  return (
    <div
      ref={tableRootRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-col",
        viewportMode === "fill"
          ? "h-full flex-1 overflow-hidden"
          : "w-full shrink-0",
      )}
      data-emr-data-table="true"
      data-emr-data-table-has-row-overlay={hasRowOverlay ? "true" : "false"}
      data-emr-data-table-column-gap={columnGap || undefined}
      data-emr-data-table-leading-inset={leadingInset || undefined}
      data-emr-data-table-pinning={hasPinnedColumns ? "columns" : "none"}
      data-emr-data-table-viewport-mode={viewportMode}
      onKeyDown={(event) => {
        if (event.key === "Escape" && activeTouchOverlayRowId) {
          setTouchOverlayRowId(null);
        }
      }}
    >
      {hasPinnedColumns ? (
        <EmrPinnedTableViewport
          className={cn(
            "min-w-0 [&_[data-emr-pinned-table-scroll-owner=true]]:scroll-pt-10",
            viewportMode === "fill" ? "min-h-0 flex-1" : "w-full",
          )}
          leftPinnedColumnWidth={leftPinnedColumnWidth}
          overscrollAxes={overscrollAxes}
          rightPinnedColumnWidth={rightPinnedColumnWidth}
        >
          {tableContent}
        </EmrPinnedTableViewport>
      ) : (
        tableContent
      )}
      {selectionActionBar ? (
        <EmrDataTableSelectionActionBar
          ariaLabel={selectionActionBarAriaLabel}
          tableRootRef={tableRootRef}
        >
          {selectionActionBar}
        </EmrDataTableSelectionActionBar>
      ) : null}
    </div>
  );
}
