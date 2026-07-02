"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type Row,
  type RowSelectionState,
} from "@tanstack/react-table";
import { CheckIcon, ChevronDownIcon, WarningIcon } from "@/components/icons";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmrTableCellText,
  EmrTableHeaderCell,
  EmrTableSelectionCell,
  EmrTableSelectionHeaderCell,
} from "@/components/emr/table-primitives";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { Order, OrderDiffField, TechnicianUser } from "@/types/emr";
import type {
  EmrColumnResize,
  EmrTableCellTextMode,
  EmrTableDensity,
  EmrTableHeaderInteraction,
} from "@/components/emr/table-density";

type EmrDataTableProps = {
  density?: EmrTableDensity;
  onDensityChange?: (density: EmrTableDensity) => void;
  rows: Order[];
  sectionId: string;
  showDensitySelector?: boolean;
  technicians: TechnicianUser[];
  onCompleteRows: (rowIds: string[]) => void;
  onAssignOrder: (rowId: string, technicianId: string) => void;
};

type ColumnMeta = {
  align?: "left" | "center" | "right";
  headerInteraction?: EmrTableHeaderInteraction;
  resize?: EmrColumnResize;
  textMode?: EmrTableCellTextMode;
};

const numericDiffFields = new Set<OrderDiffField>([
  "days",
  "servings",
  "amount",
  "quantity",
]);
const unassignedTechnicianValue = "unassigned-technician";

function isSelectableOrder(order: Order) {
  return order.status !== "완료" && order.status !== "취소" && order.workStatus !== "완료";
}

function getCellAlign(column: ColumnDef<Order>) {
  return (column.meta as ColumnMeta | undefined)?.align ?? "left";
}

function getHeaderInteraction(column: ColumnDef<Order>) {
  return (column.meta as ColumnMeta | undefined)?.headerInteraction ?? "static";
}

function getColumnResize(column: ColumnDef<Order>) {
  return (column.meta as ColumnMeta | undefined)?.resize ?? "data-column";
}

function getCellTextMode(column: ColumnDef<Order>) {
  return (column.meta as ColumnMeta | undefined)?.textMode ?? "one-line";
}

function OrderValue({
  field,
  order,
  value,
  align = "left",
}: {
  field: OrderDiffField;
  order: Order;
  value: string;
  align?: "left" | "right";
}) {
  const diff = order.diffs?.[field];
  const isCanceled = order.status === "취소";

  if (diff) {
    return (
      <span
        className={cn(
          "flex min-w-0 items-center gap-1",
          align === "right" && "justify-end",
          numericDiffFields.has(field) && "font-medium"
        )}
      >
        <EmrTableCellText as="span" mode="one-line" className="text-muted-foreground">
          {diff.previous}
        </EmrTableCellText>
        <span className="text-[var(--emr-text-tertiary)]">-&gt;</span>
        <EmrTableCellText as="span" mode="one-line" className="text-[var(--emr-status-warning-text)]">
          {diff.current}
        </EmrTableCellText>
      </span>
    );
  }

  return (
    <EmrTableCellText
      as="span"
      mode="one-line"
      className={cn(
        align === "right" && "text-right",
        isCanceled && "text-muted-foreground line-through"
      )}
    >
      {value}
    </EmrTableCellText>
  );
}

function AssigneeAvatar({ order }: { order: Order }) {
  const assigned = Boolean(order.assigneeId);

  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full text-[9px] font-medium",
        assigned
          ? "bg-[var(--emr-status-neutral-border)] text-[var(--emr-text-primary)]"
          : "border border-dashed border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] text-[var(--emr-text-tertiary)]"
      )}
      title={order.assignee}
    >
      {order.assigneeInitial}
    </span>
  );
}

function AssigneeCell({
  order,
  technicians,
  onAssign,
}: {
  order: Order;
  technicians: TechnicianUser[];
  onAssign: (technicianId: string) => void;
}) {
  const disabled = order.status === "완료" || order.status === "취소" || order.workStatus === "완료";
  const assigneeName = order.assigneeId
    ? technicians.find((technician) => technician.id === order.assigneeId)?.name ?? order.assignee
    : "미지정";
  const handleAssigneeChange = useCallback((technicianId: string) => {
    if (technicianId) {
      onAssign(technicianId);
    }
  }, [onAssign]);

  if (disabled) {
    return <AssigneeAvatar order={order} />;
  }

  return (
    <Select
      value={order.assigneeId ?? unassignedTechnicianValue}
      onValueChange={(technicianId) => {
        if (technicianId && technicianId !== unassignedTechnicianValue) {
          handleAssigneeChange(technicianId);
        }
      }}
    >
      <SelectTrigger
        data-row-interactive="true"
        aria-label={`${order.name} 담당 변경`}
        size="sm"
        className="emr-text-status h-7 max-w-24 border-transparent bg-transparent px-1 text-center font-medium text-[var(--emr-text-secondary)] shadow-none hover:bg-[var(--emr-surface-muted)] data-[popup-open]:bg-[var(--emr-surface-muted)]"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <span className="min-w-0 flex-1 truncate text-left">{assigneeName}</span>
      </SelectTrigger>
      <SelectContent
        align="center"
        className="min-w-28"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <SelectItem value={unassignedTechnicianValue}>미지정</SelectItem>
        {technicians.map((technician) => (
          <SelectItem key={technician.id} value={technician.id}>
            {technician.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function WorkStatusButton({
  order,
  onComplete,
}: {
  order: Order;
  onComplete: () => void;
}) {
  const completed = order.workStatus === "완료";

  return (
    <Button
      data-row-interactive="true"
      type="button"
      variant="outline"
      size="xs"
      className={cn(
        "emr-text-status h-6 gap-1 rounded-md bg-[var(--emr-surface-panel)] px-2",
        completed &&
          "border-[var(--emr-status-success-border)] text-[var(--emr-status-success-text)]"
      )}
      disabled={completed || order.status === "취소"}
      onClick={(event) => {
        event.stopPropagation();
        onComplete();
      }}
    >
      <CheckIcon data-icon="inline-start" />
      완료
    </Button>
  );
}

function RowCheckbox({ row }: { row: Row<Order> }) {
  const canSelect = row.getCanSelect();
  const toggleSelected = () => {
    if (!canSelect) return;

    row.toggleSelected(!row.getIsSelected());
  };

  return (
    <span
      data-row-interactive="true"
      className="inline-flex size-6 items-center justify-center"
      onClick={(event) => {
        event.stopPropagation();
        toggleSelected();
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();

        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          toggleSelected();
        }
      }}
    >
      <EmrTableCheckbox
        aria-label={`${row.original.name} 선택`}
        checked={row.getIsSelected()}
        disabled={!canSelect}
      />
    </span>
  );
}

export function EmrDataTable({
  density: densityProp,
  onDensityChange,
  rows,
  sectionId,
  showDensitySelector = true,
  technicians,
  onCompleteRows,
  onAssignOrder,
}: EmrDataTableProps) {
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [internalDensity, setInternalDensity] = useState<EmrTableDensity>("compact");
  const density = densityProp ?? internalDensity;
  const setDensity = onDensityChange ?? setInternalDensity;
  const completeRows = useCallback((rowIds: string[]) => {
    onCompleteRows(rowIds);
    setRowSelection({});
  }, [onCompleteRows]);
  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      {
        id: "select",
        size: 32,
        minSize: 32,
        maxSize: 32,
        enableResizing: false,
        meta: { resize: "none", headerInteraction: "static" },
        header: ({ table }) => (
          <span
            data-row-interactive="true"
            className="inline-flex size-6 items-center justify-center"
            onClick={(event) => {
              event.stopPropagation();
              table.toggleAllPageRowsSelected(!table.getIsAllPageRowsSelected());
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();

              if (event.key === " " || event.key === "Enter") {
                event.preventDefault();
                table.toggleAllPageRowsSelected(!table.getIsAllPageRowsSelected());
              }
            }}
          >
            <EmrTableCheckbox
              aria-label="전체 선택"
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected()}
            />
          </span>
        ),
        cell: ({ row }) => <RowCheckbox row={row} />,
      },
      {
        accessorKey: "name",
        header: "오더명",
        size: 360,
        minSize: 220,
        meta: {
          headerInteraction: "sortable-filterable",
          resize: "data-column",
          textMode: "two-line-if-long",
        },
        cell: ({ row }) => (
          <div
            className={cn(
              "flex min-w-0 items-start gap-1.5",
              row.original.status === "취소" &&
                "text-muted-foreground line-through"
            )}
          >
            <ChevronDownIcon className="mt-0.5 size-3 shrink-0 text-[var(--emr-text-tertiary)]" />
            <EmrTableCellText mode="two-line-if-long" fullText={row.original.name} className="font-medium">
              {row.original.name}
            </EmrTableCellText>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "상태",
        size: 80,
        minSize: 76,
        meta: { headerInteraction: "filterable", resize: "data-column" },
        cell: ({ row }) => (
          <EmrStatusBadge
            label={row.original.status}
            testId={`order-status-badge-${row.original.id}`}
          />
        ),
      },
      {
        accessorKey: "days",
        header: "일수",
        size: 80,
        minSize: 64,
        meta: { align: "right", headerInteraction: "sortable", resize: "data-column" },
        cell: ({ row }) => (
          <OrderValue field="days" order={row.original} value={row.original.days} align="right" />
        ),
      },
      {
        accessorKey: "doseTiming",
        header: "복용",
        size: 72,
        minSize: 64,
        meta: { headerInteraction: "static", resize: "data-column" },
        cell: ({ row }) => (
          <OrderValue field="doseTiming" order={row.original} value={row.original.doseTiming} />
        ),
      },
      {
        accessorKey: "servings",
        header: "회분",
        size: 96,
        minSize: 72,
        meta: { align: "right", headerInteraction: "sortable", resize: "data-column" },
        cell: ({ row }) => (
          <OrderValue
            field="servings"
            order={row.original}
            value={row.original.servings}
            align="right"
          />
        ),
      },
      {
        accessorKey: "amount",
        header: "용량",
        size: 128,
        minSize: 88,
        meta: { align: "right", headerInteraction: "sortable", resize: "data-column" },
        cell: ({ row }) => (
          <OrderValue
            field="amount"
            order={row.original}
            value={row.original.amount}
            align="right"
          />
        ),
      },
      {
        accessorKey: "unit",
        header: "단위",
        size: 56,
        minSize: 52,
        meta: { headerInteraction: "static", resize: "data-column" },
        cell: ({ row }) => (
          <OrderValue field="unit" order={row.original} value={row.original.unit} />
        ),
      },
      {
        accessorKey: "quantity",
        header: "수량",
        size: 100,
        minSize: 72,
        meta: { align: "right", headerInteraction: "sortable", resize: "data-column" },
        cell: ({ row }) => (
          <OrderValue
            field="quantity"
            order={row.original}
            value={row.original.quantity}
            align="right"
          />
        ),
      },
      {
        accessorKey: "dosageForm",
        header: "제형",
        size: 56,
        minSize: 52,
        meta: { headerInteraction: "static", resize: "data-column" },
        cell: ({ row }) => (
          <OrderValue field="dosageForm" order={row.original} value={row.original.dosageForm} />
        ),
      },
      {
        accessorKey: "storage",
        header: "보관",
        size: 100,
        minSize: 76,
        meta: { headerInteraction: "static", resize: "data-column" },
        cell: ({ row }) => (
          <OrderValue field="storage" order={row.original} value={row.original.storage} />
        ),
      },
      {
        accessorKey: "medicationGuide",
        header: "복약지도",
        size: 100,
        minSize: 84,
        meta: {
          headerInteraction: "static",
          resize: "data-column",
          textMode: "two-line-if-long",
        },
        cell: ({ row }) => (
          <OrderValue
            field="medicationGuide"
            order={row.original}
            value={row.original.medicationGuide}
          />
        ),
      },
      {
        accessorKey: "assignee",
        header: "담당",
        size: 72,
        minSize: 64,
        enableResizing: false,
        meta: { align: "center", headerInteraction: "static", resize: "none" },
        cell: ({ row }) => (
          <AssigneeCell
            order={row.original}
            technicians={technicians}
            onAssign={(technicianId) => onAssignOrder(row.original.id, technicianId)}
          />
        ),
      },
      {
        accessorKey: "workStatus",
        header: "작업여부",
        size: 100,
        minSize: 88,
        enableResizing: false,
        meta: { headerInteraction: "static", resize: "none" },
        cell: ({ row }) => (
          <WorkStatusButton
            order={row.original}
            onComplete={() => completeRows([row.original.id])}
          />
        ),
      },
    ],
    [completeRows, onAssignOrder, technicians]
  );
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: (row) => isSelectableOrder(row.original),
    enableMultiRowSelection: true,
    columnResizeMode: "onChange",
    state: {
      rowSelection,
      columnSizing,
    },
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
  });
  const selectedRows = table.getSelectedRowModel().rows;
  const tableWidth = table.getTotalSize();

  return (
    <div className="relative">
      {showDensitySelector ? (
        <div className="mb-2 flex justify-end">
          <EmrTableDensitySelector value={density} onValueChange={setDensity} />
        </div>
      ) : null}
      <Table
        density={density}
        layout="scroll"
        minWidth={tableWidth}
        className="table-fixed"
      >
        <TableHeader className="bg-[var(--emr-surface-muted)]">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-[var(--emr-line-hairline)] hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const align = getCellAlign(header.column.columnDef);
                const headerInteraction = getHeaderInteraction(header.column.columnDef);
                const columnResize = header.column.getCanResize()
                  ? getColumnResize(header.column.columnDef)
                  : "none";

                if (header.column.id === "select") {
                  return (
                    <EmrTableSelectionHeaderCell
                      key={header.id}
                      align={align}
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </EmrTableSelectionHeaderCell>
                  );
                }

                return (
                  <EmrTableHeaderCell
                    key={header.id}
                    align={align}
                    interaction={header.isPlaceholder ? "static" : headerInteraction}
                    isResizing={header.column.getIsResizing()}
                    resize={header.isPlaceholder ? "none" : columnResize}
                    resizeLabel={`${header.column.id} 컬럼 너비 조절`}
                    style={{ width: header.getSize() }}
                    onResizeMouseDown={header.getResizeHandler()}
                    onResizeTouchStart={header.getResizeHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </EmrTableHeaderCell>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <Fragment key={row.id}>
              <TableRow
                data-state={row.getIsSelected() ? "selected" : undefined}
                data-testid={`order-row-${sectionId}-${row.original.id}`}
                className="group/order-row cursor-pointer border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] text-[var(--emr-text-secondary)] hover:!bg-[var(--emr-state-hover)] data-[state=selected]:!bg-[var(--emr-state-selected)]"
                onClick={(event) => {
                  const target = event.target as HTMLElement;

                  if (target.closest("[data-row-interactive='true']")) {
                    return;
                  }

                  setActiveDrawer({ type: "order", id: row.original.id });
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const align = getCellAlign(cell.column.columnDef);
                  const textMode = getCellTextMode(cell.column.columnDef);

                  if (cell.column.id === "select") {
                    return (
                      <EmrTableSelectionCell
                        key={cell.id}
                        className="emr-table-body-cell overflow-hidden font-medium"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </EmrTableSelectionCell>
                    );
                  }

                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "emr-table-body-cell font-medium",
                        cell.column.id === "assignee" ? "overflow-visible" : "overflow-hidden",
                        align === "right" && "text-right",
                        align === "center" && "text-center"
                      )}
                      style={{ width: cell.column.getSize() }}
                    >
                      <div
                        className={cn(
                          "emr-table-cell-content flex min-w-0 items-center",
                          textMode !== "one-line" && "items-start",
                          align === "right" && "justify-end",
                          align === "center" && "justify-center"
                        )}
                        data-emr-cell-content={textMode !== "one-line" ? "auto" : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
              {row.original.warningMessage ? (
                <TableRow
                  key={`${row.id}-warning`}
                  className="h-8 border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] hover:bg-[var(--emr-status-warning-bg)]"
                >
                  <TableCell colSpan={row.getVisibleCells().length} className="emr-table-warning-cell">
                    <div
                      className="emr-text-body flex min-h-6 items-start gap-2 font-medium text-[var(--emr-status-warning-text)]"
                      data-emr-cell-content="auto"
                    >
                      <WarningIcon className="mt-0.5 size-4 shrink-0" />
                      <EmrTableCellText mode="two-line-if-long" fullText={row.original.warningMessage}>
                        {row.original.warningMessage}
                      </EmrTableCellText>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          ))}
          {table.getRowModel().rows.length === 0 ? (
            <TableRow className="border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] hover:bg-[var(--emr-surface-panel)]">
              <TableCell
                colSpan={table.getVisibleFlatColumns().length}
                className="emr-text-dense h-24 text-center font-medium text-muted-foreground"
              >
                표시할 오더가 없습니다.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      {selectedRows.length ? (
        <div className="pointer-events-none sticky bottom-3 z-20 mt-3 flex justify-center">
          <div className="pointer-events-auto flex h-10 items-center gap-3 rounded-lg border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 shadow-lg">
            <span className="emr-text-status font-medium text-muted-foreground">
              선택한 오더 {selectedRows.length}개
            </span>
            <Button
              type="button"
              size="sm"
              className="h-7"
              onClick={(event) => {
                event.stopPropagation();
                completeRows(selectedRows.map((row) => row.original.id));
              }}
            >
              <CheckIcon data-icon="inline-start" />
              선택 오더 완료
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
