"use client";

import type { ColumnDef, SortingFn } from "@tanstack/react-table";
import { CdsActionsCheckCircleIcon } from "@/components/cds-icons/actions-and-controls";
import {
  EmrTableCellText,
  EmrTableIdentityCellContent,
} from "@/components/emr/table-primitives";
import type {
  EmrColumnResize,
  EmrTableCellTextMode,
  EmrTableHeaderInteraction,
} from "@/components/emr/table-density";
import { CircleCloseFillIcon } from "@/components/icons";
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
  blue: "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  gray: "border-[var(--emr-status-neutral-border)] bg-[var(--emr-status-neutral-bg)] text-[var(--emr-status-neutral-text)]",
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
      id: "name",
      accessorFn: (row) => row.name,
      enableSorting: true,
      sortingFn,
      sortUndefined: "last",
      minSize: 160,
      size: 184,
      maxSize: 220,
      cell: ({ row }) => (
        <EmrTableIdentityCellContent>
          <EmrTableCellText
            as="span"
            className="flex-1 font-semibold"
            fullText={row.original.name}
            mode="one-line"
          >
            {row.original.name}
          </EmrTableCellText>
        </EmrTableIdentityCellContent>
      ),
      meta: {
        cellKind: "rich",
        label: "동물명",
        required: true,
        headerInteraction: "sortable",
        className: "font-semibold",
        textMode: "one-line",
      },
    },
    {
      id: "patientNo",
      accessorFn: (row) => row.patientNo,
      enableSorting: true,
      sortingFn,
      sortUndefined: "last",
      minSize: 136,
      size: 136,
      maxSize: 136,
      cell: ({ row }) => (
        <code className="inline-flex max-w-full truncate rounded-[var(--clair-radius-atomic-6)] bg-[var(--emr-surface-muted)] px-1.5 py-0.5 emr-text-metadata font-medium text-[var(--emr-text-secondary)]">
          {row.original.patientNo}
        </code>
      ),
      meta: {
        cellKind: "rich",
        label: "환자코드",
        required: true,
        headerInteraction: "sortable",
        className: "font-semibold",
        textMode: "one-line",
      },
    },
    {
      id: "breed",
      accessorFn: (row) => row.breed,
      enableSorting: false,
      minSize: 140,
      size: 168,
      maxSize: 220,
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
      minSize: 144,
      size: 160,
      maxSize: 180,
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
      minSize: 132,
      size: 148,
      maxSize: 168,
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
      minSize: 180,
      size: 200,
      maxSize: 220,
      cell: ({ row }) => (
        <div
          className="flex min-w-0 flex-nowrap gap-1 overflow-hidden"
          data-customer-status-layout="one-line"
        >
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
        textMode: "one-line",
        filterOptions: (rows) =>
          getUniqueCustomerFilterOptions(rows, (row) =>
            row.workBadges.map((badge) => badge.label),
          ),
        filterValues: (row) => row.workBadges.map((badge) => badge.label),
      },
    },
    {
      id: "guardianNames",
      accessorFn: (row) => row.guardianNames,
      enableSorting: false,
      minSize: 120,
      size: 132,
      maxSize: 176,
      meta: {
        label: "보호자명",
        headerInteraction: "compound",
        textMode: "one-line",
      },
    },
    {
      id: "phone",
      accessorFn: (row) => row.phone,
      enableSorting: false,
      minSize: 136,
      size: 148,
      maxSize: 168,
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
      minSize: 96,
      size: 108,
      maxSize: 120,
      cell: ({ row }) => {
        const consented = row.original.messageConsent === "동의";

        return (
          <Badge
            variant="outline"
            className={cn(
              "h-6 max-w-full gap-1 rounded-[var(--clair-radius-atomic-6)] px-1.5",
              consented
                ? "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]"
                : "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
            )}
          >
            {consented ? (
              <CdsActionsCheckCircleIcon
                aria-hidden="true"
                className="size-3.5"
              />
            ) : (
              <CircleCloseFillIcon aria-hidden="true" className="size-3.5" />
            )}
            <span className="truncate">{row.original.messageConsent}</span>
          </Badge>
        );
      },
      meta: {
        cellKind: "rich",
        label: "수신 여부",
        headerInteraction: "filterable",
        textMode: "one-line",
        filterOptions: (rows) =>
          getUniqueCustomerFilterOptions(rows, (row) => [row.messageConsent]),
        filterValues: (row) => [row.messageConsent],
      },
    },
    {
      id: "registeredAt",
      accessorFn: (row) => row.patient.createdAt,
      enableSorting: true,
      sortingFn,
      sortUndefined: "last",
      minSize: 128,
      size: 140,
      maxSize: 160,
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
      cell: ({ row }) => (
        <EmrTableIdentityCellContent>
          <EmrTableCellText
            as="span"
            className="flex-1 font-semibold"
            fullText={row.original.name}
            mode="two-line-if-long"
          >
            {row.original.name}
          </EmrTableCellText>
        </EmrTableIdentityCellContent>
      ),
      meta: {
        cellKind: "rich",
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
          getUniqueCustomerFilterOptions(rows, (row) => [row.consentSummary]),
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
