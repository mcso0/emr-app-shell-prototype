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
  TableHeader,
  TableRow,
  type TableOverscrollAxes,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type EmrDataTableColumnRole = "data" | "selection" | "actions";

export type EmrDataTableColumnMeta = {
  align?: "left" | "center" | "right";
  grow?: boolean;
  identity?: boolean;
  label?: string;
  role?: EmrDataTableColumnRole;
  textMode?: EmrTableCellTextMode;
  verticalAlign?: "middle" | "top";
  headerInteraction?: EmrTableHeaderInteraction;
  resize?: EmrColumnResize;
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
  density?: EmrTableDensity;
  overscrollAxes?: TableOverscrollAxes;
  containerClassName?: string;
  className?: string;
  initialLoading?: boolean;
  skeletonRowCount?: number;
  getRowProps?: (
    row: Row<TData>,
  ) => Omit<React.ComponentProps<typeof TableRow>, "children">;
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

function getGrowColumnId<TData>(columns: Column<TData, unknown>[]) {
  const explicitGrowColumn = columns.find(
    (column) => getColumnMeta(column)?.grow === true,
  );

  if (explicitGrowColumn) return explicitGrowColumn.id;

  return [...columns].reverse().find((column) => {
    const meta = getColumnMeta(column);
    return (
      !column.getIsPinned() &&
      meta?.role !== "selection" &&
      meta?.role !== "actions"
    );
  })?.id;
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
      "data-[state=selected]:bg-[var(--emr-surface-selected)]",
    className,
  );
}

function getSafeRowProps<TData>(
  row: Row<TData>,
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
    "data-state":
      customDataState ?? (row.getIsSelected() ? "selected" : undefined),
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

function EmrDataTableSkeletonRows<TData>({
  rowCount,
  table,
}: {
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
        const pinnedProps = getEmrPinnedColumnProps(column);
        const isSelection = meta?.role === "selection";
        const selectionColumnSize = column.getSize();

        return (
          <TableCell
            key={column.id}
            className={cn(
              "overflow-hidden !p-0",
              isSelection && "!p-0",
              isSelection && selectionColumnSize === 28 && "!pl-3 !pr-0",
            )}
            data-column-id={column.id}
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
                  selectionColumnSize === 28 &&
                  "!px-0 !justify-start",
                meta?.identity && "!px-0",
              )}
              data-emr-table-identity-content={
                meta?.identity ? "true" : undefined
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
    </TableRow>
  ));
}

function EmrDataTableHeader<TData>({ group }: { group: HeaderGroup<TData> }) {
  return (
    <TableRow
      key={group.id}
      className="border-0 bg-[var(--emr-table-header-surface)] hover:bg-[var(--emr-table-header-surface)]"
      data-emr-data-table-header="true"
    >
      {group.headers.map((header: Header<TData, unknown>) => {
        const column = header.column;
        const meta = getColumnMeta(column);
        const role = meta?.role ?? "data";
        const pinnedProps = getEmrPinnedColumnProps(column);
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
                "!p-0 [&_.emr-table-cell-content]:!p-0",
                selectionColumnSize === 28 ? "!pl-3 !pr-0" : "!pl-5 !pr-2",
              )}
              data-column-id={column.id}
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
              "!p-0",
              isActions && "w-[52px] min-w-[52px] max-w-[52px] !pl-2 !pr-5",
              meta?.identity && "!p-0",
            )}
            data-column-id={column.id}
            identity={meta?.identity}
            interaction={interaction}
            isResizing={column.getIsResizing()}
            label={label}
            resize={resize}
            resizeLabel={`${label} 컬럼 너비 조절`}
            sortDirection={sortDirection || undefined}
            sortLabel={canSort ? getSortLabel(label, sortDirection) : undefined}
            onResizeMouseDown={header.getResizeHandler()}
            onResizeTouchStart={header.getResizeHandler()}
            onSort={canSort ? () => toggleColumnSorting(column) : undefined}
            {...pinnedProps}
          >
            {headerContent}
          </EmrTableHeaderCell>
        );
      })}
    </TableRow>
  );
}

function EmrDataTableBodyRow<TData>({
  getRowProps,
  row,
  renderAfterRow,
  table,
}: {
  getRowProps?: EmrDataTableProps<TData>["getRowProps"];
  row: Row<TData>;
  renderAfterRow?: EmrDataTableProps<TData>["renderAfterRow"];
  table: TanStackTable<TData>;
}) {
  const cells = getVisibleCells(table, row);

  return (
    <React.Fragment key={row.id}>
      <TableRow {...getSafeRowProps(row, getRowProps)}>
        {cells.map((cell) => {
          const meta = getColumnMeta(cell.column);
          const role = meta?.role ?? "data";
          const pinnedProps = getEmrPinnedColumnProps(cell.column);
          const isSelection = role === "selection";
          const isActions = role === "actions";

          if (isSelection) {
            const selectionColumnSize = cell.column.getSize();

            return (
              <EmrTableSelectionCell
                key={cell.id}
                className={cn(
                  "!p-0 [&_.emr-table-cell-content]:!p-0",
                  selectionColumnSize === 28 ? "!pl-3 !pr-0" : "!pl-5 !pr-2",
                )}
                controlVisibility="contextual"
                data-column-id={cell.column.id}
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
                "overflow-hidden !p-0",
                isActions && "overflow-visible !pl-2 !pr-5 text-right",
              )}
              data-column-id={cell.column.id}
              style={{
                verticalAlign: meta?.verticalAlign ?? "middle",
              }}
              {...pinnedProps}
            >
              <div
                className={cn(
                  "emr-data-table-cell-content flex min-w-0",
                  meta?.identity && "!px-0",
                  meta?.align === "right" && "justify-end text-right",
                  meta?.align === "center" && "justify-center text-center",
                  meta?.verticalAlign === "top" && "items-start",
                  isActions && "justify-end",
                )}
                data-emr-table-content="true"
              >
                {getRenderedCellContent(cell)}
              </div>
            </TableCell>
          );
        })}
      </TableRow>
      {renderAfterRow?.(row)}
    </React.Fragment>
  );
}

export function EmrDataTable<TData>({
  table,
  "aria-label": ariaLabel,
  className,
  containerClassName,
  density = "standard",
  footerRows,
  getRowProps,
  initialLoading = false,
  overscrollAxes = "horizontal",
  renderAfterRow,
  renderAfterRows,
  skeletonRowCount = 6,
}: EmrDataTableProps<TData>) {
  const columns = getOrderedVisibleColumns(table);
  const rows = table.getRowModel().rows;
  const hasPinnedColumns = table.getIsSomeColumnsPinned();
  const visibleColumnCount = columns.length;
  const leftPinnedColumnWidth = table.getLeftTotalSize();
  const rightPinnedColumnWidth = table.getRightTotalSize();
  const growColumnId = getGrowColumnId(columns);
  const headerGroups = getOrderedHeaderGroups(table);

  const tableContent = (
    <Table
      aria-label={ariaLabel}
      className={cn("table-fixed", className)}
      containerClassName={cn(
        "isolate min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--emr-table-data-row-surface)]",
        containerClassName,
      )}
      density={density}
      layout="scroll"
      minWidth={table.getTotalSize()}
      overscrollAxes={overscrollAxes}
      pinning={hasPinnedColumns ? "columns" : "none"}
    >
      <colgroup>
        {columns.map((column) => (
          <col
            key={column.id}
            style={
              column.id === growColumnId
                ? { minWidth: `${column.getSize()}px` }
                : { width: `${column.getSize()}px` }
            }
          />
        ))}
      </colgroup>
      <TableHeader className="sticky top-0 z-10">
        {headerGroups.map((group) => (
          <EmrDataTableHeader key={group.id} group={group} />
        ))}
      </TableHeader>
      <TableBody>
        {initialLoading ? (
          <EmrDataTableSkeletonRows rowCount={skeletonRowCount} table={table} />
        ) : (
          rows.map((row) => (
            <EmrDataTableBodyRow
              key={row.id}
              getRowProps={getRowProps}
              renderAfterRow={renderAfterRow}
              row={row}
              table={table}
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
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      data-emr-data-table="true"
      data-emr-data-table-pinning={hasPinnedColumns ? "columns" : "none"}
    >
      {hasPinnedColumns ? (
        <EmrPinnedTableViewport
          className="min-h-0 min-w-0 flex-1"
          leftPinnedColumnWidth={leftPinnedColumnWidth}
          rightPinnedColumnWidth={rightPinnedColumnWidth}
        >
          {tableContent}
        </EmrPinnedTableViewport>
      ) : (
        tableContent
      )}
    </div>
  );
}
