"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Check, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useLayoutStore } from "@/stores/layout-store";
import type { Order } from "@/types/emr";
import { cn } from "@/lib/utils";

const statusTone: Record<Order["status"], string> = {
  대기: "border-border bg-card text-muted-foreground",
  검토:
    "border-[var(--clair-color-atomic-orange-200)] bg-[var(--clair-color-status-warning-background)] text-[var(--clair-color-status-warning-foreground)]",
  조제중:
    "border-[var(--clair-color-atomic-sky-100)] bg-[var(--clair-color-atomic-sky-50)] text-[var(--clair-color-primary-normal)]",
  완료: "border-border bg-card text-foreground",
};

const columns: ColumnDef<Order>[] = [
  {
    id: "select",
    header: () => <Checkbox aria-label="전체 선택" />,
    cell: () => <Checkbox aria-label="행 선택" />,
  },
  {
    accessorKey: "category",
    header: "상태",
    cell: ({ row }) => (
      <Badge
        className={cn("h-5 rounded px-1.5 text-[11px] font-medium", statusTone[row.original.status])}
        variant="outline"
      >
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "name",
    header: "오더명",
    cell: () => (
      <div className="flex min-w-[260px] items-center gap-2">
        <ChevronRight className="size-3 text-muted-foreground" />
        <span className="truncate font-medium text-foreground">
          Amoxicillin 500(mg) C head 1mg
        </span>
      </div>
    ),
  },
  {
    accessorKey: "route",
    header: "일수",
    cell: () => "888",
  },
  {
    accessorKey: "dose",
    header: "복용",
    cell: ({ row }) => row.original.frequency.replace("T 9:00 AM", "sid"),
  },
  {
    accessorKey: "frequency",
    header: "회분",
    cell: () => "88",
  },
  {
    id: "amount",
    header: "용량",
    cell: () => "88888.8",
  },
  {
    accessorKey: "requestedAt",
    header: "단위",
    cell: () => "mmlg",
  },
  {
    accessorKey: "doctor",
    header: "작업여부",
    cell: ({ row }) => (
      <span
        className={cn(
          "inline-flex h-5 items-center gap-1 rounded border px-2 text-[11px] font-medium",
          row.original.status === "조제중"
            ? "border-[var(--clair-color-atomic-sky-100)] text-[var(--clair-color-primary-normal)]"
            : "border-border text-foreground"
        )}
      >
        <Check className="size-3" />
        완료
      </span>
    ),
  },
];

export function EmrDataTable({
  rows,
  sectionId,
}: {
  rows: Order[];
  sectionId: string;
}) {
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table className="min-w-[1040px] text-[12px]">
      <TableHeader className="sticky top-0 z-10 bg-background">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="border-border">
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className="h-8 px-3 text-[12px] font-medium text-muted-foreground"
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            data-testid={`order-row-${sectionId}-${row.original.id}`}
            className="h-8 cursor-pointer border-border bg-card text-[var(--clair-color-label-normal)] hover:bg-selection"
            onClick={() => setActiveDrawer({ type: "order", id: row.original.id })}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id} className="px-3 py-1.5">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
