"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { Order, OrderDiffField, TechnicianUser } from "@/types/emr";

type EmrDataTableProps = {
  rows: Order[];
  sectionId: string;
  technicians: TechnicianUser[];
  onCompleteRows: (rowIds: string[]) => void;
  onAssignOrder: (rowId: string, technicianId: string) => void;
};

type ColumnMeta = {
  align?: "left" | "center" | "right";
};

const numericDiffFields = new Set<OrderDiffField>([
  "days",
  "servings",
  "amount",
  "quantity",
]);

function isSelectableOrder(order: Order) {
  return order.status !== "완료" && order.status !== "취소" && order.workStatus !== "완료";
}

function getCellAlign(column: ColumnDef<Order>) {
  return (column.meta as ColumnMeta | undefined)?.align ?? "left";
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
        <span className="truncate text-[var(--clair-color-label-alternative)]">
          {diff.previous}
        </span>
        <span className="text-[var(--clair-color-label-assistive)]">-&gt;</span>
        <span className="truncate text-[var(--clair-color-atomic-orange-600)]">
          {diff.current}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "block min-w-0 truncate",
        align === "right" && "text-right",
        isCanceled && "text-[var(--clair-color-label-alternative)] line-through"
      )}
    >
      {value}
    </span>
  );
}

function AssigneeAvatar({ order }: { order: Order }) {
  const assigned = Boolean(order.assigneeId);

  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full text-[9px] font-medium",
        assigned
          ? "bg-[var(--clair-color-atomic-gray-200)] text-[var(--clair-color-atomic-gray-900)]"
          : "border border-dashed border-[var(--clair-color-line-normal)] bg-card text-[var(--clair-color-label-assistive)]"
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
  const selectRef = useRef<HTMLSelectElement>(null);
  const handleAssigneeChange = useCallback((technicianId: string) => {
    if (technicianId) {
      onAssign(technicianId);
    }
  }, [onAssign]);

  useEffect(() => {
    const select = selectRef.current;
    if (!select) return undefined;

    const handleNativeChange = () => handleAssigneeChange(select.value);

    select.addEventListener("change", handleNativeChange, true);
    return () => select.removeEventListener("change", handleNativeChange, true);
  }, [handleAssigneeChange]);

  if (disabled) {
    return <AssigneeAvatar order={order} />;
  }

  return (
    <select
      ref={selectRef}
      data-row-interactive="true"
      aria-label={`${order.name} 담당 변경`}
      value={order.assigneeId ?? ""}
      className="h-7 max-w-24 rounded-md border border-transparent bg-transparent px-1 text-center text-[12px] font-medium text-[var(--clair-color-label-normal)] outline-none hover:bg-selection focus:border-ring focus:bg-card focus:ring-3 focus:ring-ring/50"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onInput={(event) => {
        event.stopPropagation();
        handleAssigneeChange(event.currentTarget.value);
      }}
      onChange={(event) => {
        event.stopPropagation();
        handleAssigneeChange(event.currentTarget.value);
      }}
    >
      <option value="">미지정</option>
      {technicians.map((technician) => (
        <option key={technician.id} value={technician.id}>
          {technician.name}
        </option>
      ))}
    </select>
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
        "h-6 gap-1 rounded-md bg-card px-2 text-[12px]",
        completed &&
          "border-[var(--clair-color-atomic-sky-100)] text-[var(--clair-color-primary-normal)]"
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
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Checkbox
        aria-label={`${row.original.name} 선택`}
        checked={row.getIsSelected()}
        disabled={!canSelect}
        className={cn(
          "transition-opacity",
          canSelect
            ? "opacity-0 group-hover/order-row:opacity-100 group-focus-within/order-row:opacity-100 group-data-[state=selected]/order-row:opacity-100"
            : "pointer-events-none opacity-0"
        )}
        onClick={(event) => {
          event.stopPropagation();
          toggleSelected();
        }}
        onKeyDown={(event) => {
          event.stopPropagation();

          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            toggleSelected();
          }
        }}
      />
    </span>
  );
}

export function EmrDataTable({
  rows,
  sectionId,
  technicians,
  onCompleteRows,
  onAssignOrder,
}: EmrDataTableProps) {
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
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
        header: ({ table }) => (
          <span
            data-row-interactive="true"
            className="inline-flex size-6 items-center justify-center"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Checkbox
              aria-label="전체 선택"
              checked={table.getIsAllPageRowsSelected()}
              indeterminate={table.getIsSomePageRowsSelected()}
              onClick={(event) => {
                event.stopPropagation();
                table.toggleAllPageRowsSelected(!table.getIsAllPageRowsSelected());
              }}
              onKeyDown={(event) => {
                event.stopPropagation();

                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  table.toggleAllPageRowsSelected(!table.getIsAllPageRowsSelected());
                }
              }}
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
        cell: ({ row }) => (
          <div
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              row.original.status === "취소" &&
                "text-[var(--clair-color-label-alternative)] line-through"
            )}
          >
            <ChevronDownIcon className="size-3 shrink-0 text-[var(--clair-color-label-assistive)]" />
            <span className="truncate font-medium">{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "상태",
        size: 80,
        minSize: 76,
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
        meta: { align: "right" },
        cell: ({ row }) => (
          <OrderValue field="days" order={row.original} value={row.original.days} align="right" />
        ),
      },
      {
        accessorKey: "doseTiming",
        header: "복용",
        size: 72,
        minSize: 64,
        cell: ({ row }) => (
          <OrderValue field="doseTiming" order={row.original} value={row.original.doseTiming} />
        ),
      },
      {
        accessorKey: "servings",
        header: "회분",
        size: 96,
        minSize: 72,
        meta: { align: "right" },
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
        meta: { align: "right" },
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
        cell: ({ row }) => (
          <OrderValue field="unit" order={row.original} value={row.original.unit} />
        ),
      },
      {
        accessorKey: "quantity",
        header: "수량",
        size: 100,
        minSize: 72,
        meta: { align: "right" },
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
        cell: ({ row }) => (
          <OrderValue field="dosageForm" order={row.original} value={row.original.dosageForm} />
        ),
      },
      {
        accessorKey: "storage",
        header: "보관",
        size: 100,
        minSize: 76,
        cell: ({ row }) => (
          <OrderValue field="storage" order={row.original} value={row.original.storage} />
        ),
      },
      {
        accessorKey: "medicationGuide",
        header: "복약지도",
        size: 100,
        minSize: 84,
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
        meta: { align: "center" },
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

  return (
    <div className="relative">
      <Table
        className="table-fixed text-[14px] leading-5 tracking-[0.014em]"
        style={{ width: table.getTotalSize() }}
      >
        <TableHeader className="bg-[var(--clair-color-atomic-neutral-50)]">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="border-border hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const align = getCellAlign(header.column.columnDef);

                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "relative h-10 select-none bg-[var(--clair-color-atomic-neutral-50)] px-1 py-1 text-[14px] font-medium text-[var(--clair-color-label-alternative)]",
                      align === "right" && "text-right",
                      align === "center" && "text-center"
                    )}
                    style={{ width: header.getSize() }}
                  >
                    <div
                      className={cn(
                        "flex h-6 min-w-0 items-center px-1",
                        align === "right" && "justify-end",
                        align === "center" && "justify-center"
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </div>
                    {header.column.getCanResize() ? (
                      <button
                        data-row-interactive="true"
                        type="button"
                        aria-label={`${header.column.id} 컬럼 너비 조절`}
                        className={cn(
                          "absolute right-[-4px] top-2 z-10 h-6 w-2 cursor-col-resize touch-none rounded-sm before:absolute before:left-1 before:top-1 before:h-4 before:w-px before:bg-[var(--clair-color-atomic-gray-200)] hover:bg-selection focus-visible:ring-3 focus-visible:ring-ring/50",
                          header.column.getIsResizing() && "bg-selection"
                        )}
                        onClick={(event) => event.stopPropagation()}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                      />
                    ) : null}
                  </TableHead>
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
                className="group/order-row h-11 cursor-pointer border-border bg-card text-[var(--clair-color-label-normal)] hover:!bg-[var(--clair-color-fill-alternative)] data-[state=selected]:!bg-[var(--clair-color-fill-normal)]"
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

                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "h-11 px-1 py-2 font-medium",
                        cell.column.id === "assignee" ? "overflow-visible" : "overflow-hidden",
                        align === "right" && "text-right",
                        align === "center" && "text-center"
                      )}
                      style={{ width: cell.column.getSize() }}
                    >
                      <div
                        className={cn(
                          "flex h-6 min-w-0 items-center px-1",
                          align === "right" && "justify-end",
                          align === "center" && "justify-center"
                        )}
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
                  className="h-8 border-border bg-[var(--clair-color-atomic-orange-50)] hover:bg-[var(--clair-color-atomic-orange-50)]"
                >
                  <TableCell colSpan={row.getVisibleCells().length} className="px-8 py-1">
                    <div className="flex h-6 items-center gap-2 text-[14px] font-medium text-[var(--clair-color-atomic-orange-700)]">
                      <WarningIcon className="size-4" />
                      {row.original.warningMessage}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      {selectedRows.length ? (
        <div className="pointer-events-none sticky bottom-3 z-20 mt-3 flex justify-center">
          <div className="pointer-events-auto flex h-10 items-center gap-3 rounded-lg border border-[var(--clair-color-line-normal)] bg-card px-3 shadow-lg">
            <span className="text-[12px] font-medium text-[var(--clair-color-label-alternative)]">
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
