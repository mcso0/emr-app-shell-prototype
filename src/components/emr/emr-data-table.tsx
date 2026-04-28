"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
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
  대기: "bg-slate-100 text-slate-700",
  검토: "bg-amber-50 text-amber-700",
  조제중: "bg-blue-50 text-blue-700",
  완료: "bg-emerald-50 text-emerald-700",
};

const columns: ColumnDef<Order>[] = [
  {
    id: "select",
    header: () => <Checkbox aria-label="전체 선택" />,
    cell: () => <Checkbox aria-label="행 선택" />,
  },
  {
    accessorKey: "category",
    header: "구분",
  },
  {
    accessorKey: "name",
    header: "오더명",
    cell: ({ row }) => (
      <div className="flex min-w-[220px] items-center gap-2">
        <ChevronRight className="size-3 text-muted-foreground" />
        <span className="font-medium">{row.original.name}</span>
      </div>
    ),
  },
  {
    accessorKey: "route",
    header: "경로",
  },
  {
    accessorKey: "dose",
    header: "용량",
  },
  {
    accessorKey: "frequency",
    header: "빈도",
  },
  {
    accessorKey: "status",
    header: "상태",
    cell: ({ row }) => (
      <Badge className={cn("border-0", statusTone[row.original.status])} variant="secondary">
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "requestedAt",
    header: "요청 일시",
  },
  {
    accessorKey: "doctor",
    header: "요청 수의사",
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
    <Table className="min-w-[1040px] text-[13px]">
      <TableHeader className="sticky top-0 z-10 bg-[#f8fafc]">
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className="h-9 border-r text-[12px] text-[#60708a]">
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
            className="h-11 cursor-pointer bg-white hover:bg-[#eff7ff]"
            onClick={() => setActiveDrawer({ type: "order", id: row.original.id })}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id} className="border-r px-3 py-2">
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
