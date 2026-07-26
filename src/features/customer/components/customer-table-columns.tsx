"use client";

import type { ColumnDef, SortingFn } from "@tanstack/react-table";
import type {
  EmrColumnResize,
  EmrTableCellTextMode,
  EmrTableHeaderInteraction,
} from "@/components/emr/table-density";
import { Badge } from "@/components/ui/badge";
import type {
  CustomerGuardianRow,
  CustomerPatientRow,
  CustomerWorkBadge,
} from "@/features/customer/data";
import { cn } from "@/lib/utils";

export type CustomerTableFilterOption = {
  label: string;
  value: string;
};

export type CustomerTableColumnMeta<TRow> = {
  align?: "left" | "center" | "right";
  cellKind?: "text" | "rich";
  className?: string;
  defaultVisible?: boolean;
  filterOptions?:
    | CustomerTableFilterOption[]
    | ((rows: TRow[]) => CustomerTableFilterOption[]);
  filterValues?: (row: TRow) => string[];
  headerClassName?: string;
  headerInteraction?: EmrTableHeaderInteraction;
  label: string;
  required?: boolean;
  resize?: EmrColumnResize;
  textMode?: EmrTableCellTextMode;
};

export type CustomerTableColumnDef<TRow> = ColumnDef<TRow, unknown> & {
  id: string;
  meta: CustomerTableColumnMeta<TRow>;
};

const badgeClassName: Record<CustomerWorkBadge["tone"], string> = {
  blue:
    "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  gray:
    "border-[var(--emr-status-neutral-border)] bg-[var(--emr-status-neutral-bg)] text-[var(--emr-status-neutral-text)]",
  green:
    "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
  orange:
    "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
  purple:
    "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
};

function CustomerWorkBadgeView({ badge }: { badge: CustomerWorkBadge }) {
  return (
    <Badge
      variant="outline"
      className={cn("h-5 rounded-md px-1.5", badgeClassName[badge.tone])}
    >
      {badge.label}
    </Badge>
  );
}

function getUniqueCustomerFilterOptions<TRow>(
  rows: TRow[],
  getValues: (row: TRow) => string[],
): CustomerTableFilterOption[] {
  const options = new Map<string, CustomerTableFilterOption>();

  rows.forEach((row) => {
    getValues(row).forEach((value) => {
      if (value && !options.has(value)) {
        options.set(value, { label: value, value });
      }
    });
  });

  return Array.from(options.values()).sort((left, right) =>
    left.label.localeCompare(right.label, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    }),
  );
}

function createCustomerLocaleSortingFn<TRow>(): SortingFn<TRow> {
  return (left, right, columnId) =>
    String(left.getValue(columnId) ?? "").localeCompare(
      String(right.getValue(columnId) ?? ""),
      "ko-KR",
      {
        numeric: true,
        sensitivity: "base",
      },
    );
}

export function createCustomerPatientColumns(): Array<
  CustomerTableColumnDef<CustomerPatientRow>
> {
  const sortingFn = createCustomerLocaleSortingFn<CustomerPatientRow>();

  return [
    {
      id: "patientNo",
      accessorFn: (row) => row.patientNo,
      enableSorting: true,
      sortingFn,
      sortUndefined: "last",
      meta: {
        label: "환자코드",
        required: true,
        headerInteraction: "sortable",
        className: "font-semibold",
        textMode: "one-line",
      },
    },
    {
      id: "name",
      accessorFn: (row) => row.name,
      enableSorting: true,
      sortingFn,
      sortUndefined: "last",
      meta: {
        label: "동물명",
        required: true,
        headerInteraction: "sortable",
        className: "font-semibold",
        textMode: "two-line-if-long",
      },
    },
    {
      id: "breed",
      accessorFn: (row) => row.breed,
      enableSorting: false,
      meta: {
        label: "품종",
        headerInteraction: "filterable",
        textMode: "one-line",
        filterOptions: (rows) =>
          getUniqueCustomerFilterOptions(rows, (row) => [row.breed]),
        filterValues: (row) => [row.breed],
      },
    },
    {
      id: "sex",
      accessorFn: (row) => row.sex,
      enableSorting: false,
      meta: {
        label: "성별",
        headerInteraction: "filterable",
        textMode: "one-line",
        filterOptions: (rows) =>
          getUniqueCustomerFilterOptions(rows, (row) => [row.sex]),
        filterValues: (row) => [row.sex],
      },
    },
    {
      id: "age",
      accessorFn: (row) => row.patient.birthDate ?? row.age,
      enableSorting: true,
      sortingFn,
      sortUndefined: "last",
      cell: ({ row }) => row.original.age,
      meta: {
        label: "나이(생년월일)",
        headerInteraction: "sortable",
        textMode: "one-line",
      },
    },
    {
      id: "workBadges",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-wrap gap-1">
          {row.original.workBadges.map((badge) => (
            <CustomerWorkBadgeView
              key={`${row.original.id}-${badge.label}`}
              badge={badge}
            />
          ))}
        </div>
      ),
      meta: {
        cellKind: "rich",
        label: "상태",
        headerInteraction: "filterable",
        textMode: "badge-wrap",
        filterOptions: (rows) =>
          getUniqueCustomerFilterOptions(rows, (row) =>
            row.workBadges.map((badge) => badge.label),
          ),
        filterValues: (row) =>
          row.workBadges.map((badge) => badge.label),
      },
    },
    {
      id: "guardianNames",
      accessorFn: (row) => row.guardianNames,
      enableSorting: false,
      meta: {
        label: "보호자명",
        headerInteraction: "compound",
        textMode: "two-line-if-long",
      },
    },
    {
      id: "phone",
      accessorFn: (row) => row.phone,
      enableSorting: false,
      meta: {
        label: "전화번호",
        headerInteraction: "static",
        textMode: "one-line",
      },
    },
    {
      id: "messageConsent",
      accessorFn: (row) => row.messageConsent,
      enableSorting: false,
      meta: {
        label: "수신 여부",
        headerInteraction: "filterable",
        textMode: "one-line",
        filterOptions: (rows) =>
          getUniqueCustomerFilterOptions(rows, (row) => [
            row.messageConsent,
          ]),
        filterValues: (row) => [row.messageConsent],
      },
    },
    {
      id: "registeredAt",
      accessorFn: (row) => row.patient.createdAt,
      enableSorting: true,
      sortingFn,
      sortUndefined: "last",
      cell: ({ row }) => row.original.registeredAt,
      meta: {
        label: "등록일시",
        headerInteraction: "sortable",
        textMode: "one-line",
      },
    },
  ];
}

export function createCustomerGuardianColumns(): Array<
  CustomerTableColumnDef<CustomerGuardianRow>
> {
  const sortingFn = createCustomerLocaleSortingFn<CustomerGuardianRow>();

  return [
    {
      id: "name",
      accessorFn: (row) => row.name,
      enableSorting: true,
      sortingFn,
      sortUndefined: "last",
      meta: {
        label: "보호자명",
        required: true,
        headerInteraction: "sortable",
        className: "font-semibold",
        textMode: "two-line-if-long",
      },
    },
    {
      id: "mobilePhone",
      accessorFn: (row) => row.mobilePhone,
      enableSorting: false,
      meta: {
        label: "휴대전화",
        required: true,
        headerInteraction: "static",
        textMode: "one-line",
      },
    },
    {
      id: "patientSummary",
      accessorFn: (row) => row.patientSummary,
      enableSorting: false,
      meta: {
        label: "연결 동물",
        headerInteraction: "compound",
        textMode: "two-line-if-long",
      },
    },
    {
      id: "consentSummary",
      accessorFn: (row) => row.consentSummary,
      enableSorting: false,
      meta: {
        label: "동의 상태",
        headerInteraction: "filterable",
        textMode: "one-line",
        filterOptions: (rows) =>
          getUniqueCustomerFilterOptions(rows, (row) => [
            row.consentSummary,
          ]),
        filterValues: (row) => [row.consentSummary],
      },
    },
    {
      id: "recentCs",
      accessorFn: (row) => row.recentCs,
      enableSorting: false,
      meta: {
        label: "최근 CS",
        headerInteraction: "compound",
        textMode: "two-line-if-long",
      },
    },
    {
      id: "recentWork",
      accessorFn: (row) => row.recentWork,
      enableSorting: false,
      meta: {
        label: "최근 발송/업무",
        headerInteraction: "compound",
        textMode: "two-line-if-long",
      },
    },
    {
      id: "registeredAt",
      accessorFn: (row) => row.guardian.createdAt,
      enableSorting: true,
      sortingFn,
      sortUndefined: "last",
      cell: ({ row }) => row.original.registeredAt,
      meta: {
        label: "등록일시",
        headerInteraction: "sortable",
        textMode: "one-line",
      },
    },
  ];
}
