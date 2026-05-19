"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsFilesCalendarIcon,
  CdsFilesDocumentAltFillIcon,
  CdsFilesFileTextIcon,
  CdsFilesMoreVerticalIcon,
} from "@/components/cds-icons/files-and-layout";
import {
  CdsPeopleUserIcon,
  CdsPeopleUsersIcon,
  CdsPeopleUserXIcon,
} from "@/components/cds-icons/people-and-places";
import { EmrPageHeader } from "@/components/emr/page-header";
import { EmrSubpanelTitle } from "@/components/emr/subpanel";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import {
  EmrTextSideNavButton,
  EmrTextSideNavSection,
} from "@/components/emr/text-side-panel";
import { ChevronDownIcon, CircleCloseFillIcon, MenuIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  filterCustomerRows,
  getCustomerGuardianRows,
  getCustomerPatientRows,
  type CustomerGuardianRow,
  type CustomerPatientRow,
  type CustomerWorkBadge,
} from "@/features/customer/data";
import { useCustomerStore, type CustomerListMode } from "@/features/customer/store";
import { NewUnifiedRegistrationButton } from "@/features/reception/profile-drawer";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";

const customerSideItems = [
  { value: "patient" as const, label: "동물", icon: CdsPeopleUserIcon },
  { value: "guardian" as const, label: "보호자", icon: CdsPeopleUsersIcon },
  { value: "deleted" as const, label: "삭제된 보호자/동물", icon: CdsPeopleUserXIcon },
];

const placeholderSideItems = [
  { label: "스케줄 관리", icon: CdsFilesCalendarIcon, children: ["예약 일정", "방문 일정", "취소 일정"] },
  { label: "발송 관리", icon: CdsFilesFileTextIcon, children: ["발송 목록", "템플릿", "예약 발송"] },
  { label: "서류 관리", icon: CdsFilesDocumentAltFillIcon, children: ["동의서", "증명서", "업로드"] },
  { label: "CS내역", icon: CdsPeopleUsersIcon, children: ["전체 CS", "미처리", "완료"] },
  { label: "진료의뢰수신", icon: CdsFilesFileTextIcon, children: ["수신 목록", "처리중", "완료"] },
];
const customerSidePanelWidthClassName = "min-w-[280px] max-w-[280px]";
const customerTableWidthClassNames = {
  guardian: "min-w-[1120px]",
  patient: "min-w-[1320px]",
} as const;

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

function CustomerWorkBadge({ badge }: { badge: CustomerWorkBadge }) {
  return (
    <Badge variant="outline" className={cn("h-5 rounded-md px-1.5", badgeClassName[badge.tone])}>
      {badge.label}
    </Badge>
  );
}

type CustomerTableColumn<TRow> = {
  cell: (row: TRow) => ReactNode;
  className?: string;
  defaultVisible?: boolean;
  headerClassName?: string;
  key: string;
  label: string;
  required?: boolean;
};

type CustomerDataTableProps<TRow extends { id: string }> = {
  columns: Array<CustomerTableColumn<TRow>>;
  countLabel: string;
  emptyLabel: string;
  getRowLabel: (row: TRow) => string;
  isActiveRow: (row: TRow) => boolean;
  minTableWidthClassName: string;
  onOpenRow: (row: TRow) => void;
  rowTestId: (row: TRow) => string;
  rows: TRow[];
  title: string;
  testId: string;
};

function CustomerRowActionMenu({
  label,
  onOpen,
}: {
  label: string;
  onOpen: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label} 행 작업`}
        className={buttonVariants({
          variant: "ghost",
          size: "icon-sm",
          className: "text-muted-foreground",
        })}
        onClick={(event) => event.stopPropagation()}
      >
        <CdsFilesMoreVerticalIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          className="h-8 cursor-pointer"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          상세 보기
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="h-8 cursor-pointer">차트 보러가기</DropdownMenuItem>
        <DropdownMenuItem className="h-8 cursor-pointer">카카오톡 발송</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CustomerDataTable<TRow extends { id: string }>({
  columns,
  countLabel,
  emptyLabel,
  getRowLabel,
  isActiveRow,
  minTableWidthClassName,
  onOpenRow,
  rowTestId,
  rows,
  title,
  testId,
}: CustomerDataTableProps<TRow>) {
  const [rowSelection, setRowSelection] = useState<Set<string>>(() => new Set());
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.map((column) => [column.key, column.defaultVisible !== false]))
  );
  const rowIds = useMemo(() => new Set(rows.map((row) => row.id)), [rows]);
  const visibleRowSelection = useMemo(
    () => new Set(Array.from(rowSelection).filter((id) => rowIds.has(id))),
    [rowIds, rowSelection]
  );
  const visibleColumns = columns.filter(
    (column) => column.required || columnVisibility[column.key] !== false
  );
  const selectedCount = visibleRowSelection.size;
  const allRowsSelected = rows.length > 0 && rows.every((row) => visibleRowSelection.has(row.id));
  const someRowsSelected = rows.some((row) => visibleRowSelection.has(row.id)) && !allRowsSelected;

  const toggleAllRows = () => {
    setRowSelection((current) => {
      const next = new Set(Array.from(current).filter((id) => !rowIds.has(id)));

      if (rows.length > 0 && rows.every((row) => current.has(row.id))) {
        return next;
      }

      rows.forEach((row) => next.add(row.id));
      return next;
    });
  };

  const toggleRow = (rowId: string) => {
    setRowSelection((current) => {
      const next = new Set(current);

      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }

      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm" data-testid={testId}>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-[18px] font-semibold">{title}</h2>
          <Badge variant="secondary">{countLabel}</Badge>
          <span className="text-[12px] font-medium text-muted-foreground">
            {selectedCount} / {rows.length} 선택
          </span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className: "bg-card",
            })}
          >
            <MenuIcon data-icon="inline-start" />
            컬럼
            <ChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>표시 컬럼</DropdownMenuLabel>
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={columnVisibility[column.key] !== false}
                  disabled={column.required}
                  onCheckedChange={() =>
                    setColumnVisibility((current) => ({
                      ...current,
                      [column.key]: !(current[column.key] !== false),
                    }))
                  }
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Table className={cn("text-[14px]", minTableWidthClassName)}>
        <TableHeader className="bg-[var(--emr-surface-muted)]">
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-12 bg-[var(--emr-surface-muted)]">
              <span
                data-row-interactive="true"
                className="inline-flex size-6 items-center justify-center"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleAllRows();
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();

                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    toggleAllRows();
                  }
                }}
              >
                <EmrTableCheckbox
                  aria-label={`${title} 전체 선택`}
                  checked={allRowsSelected}
                  indeterminate={someRowsSelected}
                />
              </span>
            </TableHead>
            {visibleColumns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  "h-11 bg-[var(--emr-surface-muted)] text-[13px] font-medium text-muted-foreground",
                  column.headerClassName
                )}
              >
                {column.label}
              </TableHead>
            ))}
            <TableHead className="w-12 bg-[var(--emr-surface-muted)]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => {
              const active = isActiveRow(row);
              const selected = visibleRowSelection.has(row.id);
              const rowLabel = getRowLabel(row);

              return (
                <TableRow
                  key={row.id}
                  data-testid={rowTestId(row)}
                  data-state={selected || active ? "selected" : undefined}
                  className={cn(
                    "h-12 cursor-pointer border-border bg-card text-foreground hover:bg-[var(--emr-state-hover)]",
                    active && "bg-[var(--emr-state-selected)] hover:bg-[var(--emr-state-selected)]"
                  )}
                  onClick={() => onOpenRow(row)}
                >
                  <TableCell className="w-12">
                    <span
                      data-row-interactive="true"
                      className="inline-flex size-6 items-center justify-center"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleRow(row.id);
                      }}
                      onKeyDown={(event) => {
                        event.stopPropagation();

                        if (event.key === " " || event.key === "Enter") {
                          event.preventDefault();
                          toggleRow(row.id);
                        }
                      }}
                    >
                      <EmrTableCheckbox
                        aria-label={`${rowLabel} 선택`}
                        checked={selected}
                      />
                    </span>
                  </TableCell>
                  {visibleColumns.map((column) => (
                    <TableCell key={column.key} className={cn("h-12", column.className)}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                  <TableCell className="w-12">
                    <CustomerRowActionMenu label={rowLabel} onOpen={() => onOpenRow(row)} />
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={visibleColumns.length + 2} className="h-28 text-center text-muted-foreground">
                {emptyLabel}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex h-11 items-center justify-between border-t px-4 text-[12px] font-medium text-muted-foreground">
        <span>
          {selectedCount} of {rows.length} row(s) selected.
        </span>
        <div className="flex items-center gap-2">
          <span>
            {rows.length ? `1-${rows.length}` : "0"} / {rows.length}
          </span>
          <Button type="button" variant="outline" size="sm" className="h-7 bg-card" disabled>
            이전
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 bg-card" disabled>
            다음
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CustomerSidePanel({ moduleLabel }: ShellComponentProps) {
  const listMode = useCustomerStore((state) => state.listMode);
  const setListMode = useCustomerStore((state) => state.setListMode);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(["master"]));
  const toggleSection = (sectionId: string) => {
    setOpenSections((current) => {
      const next = new Set(current);

      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }

      return next;
    });
  };

  return (
    <aside
      className={cn(
        "group/emr-subpanel flex h-full min-h-0 w-full flex-col bg-[var(--emr-surface-sidepanel)]",
        customerSidePanelWidthClassName
      )}
      data-testid="customer-side-panel"
    >
      <EmrSubpanelTitle
        title={<span data-testid="module-side-panel-title">{moduleLabel}</span>}
        onCollapse={() => setModulePanelOpen(false)}
      />
      <ScrollArea className="min-h-0 flex-1 px-3 pb-4">
        <div className="grid gap-1 pt-1">
          <EmrTextSideNavSection
            title="보호자/동물 관리"
            icon={<CdsPeopleUsersIcon className="size-4 shrink-0" />}
            open={openSections.has("master")}
            onToggle={() => toggleSection("master")}
          >
          <div className="ml-4 border-l py-1 pl-3">
            {customerSideItems.map((item) => {
              const Icon = item.icon;

              return (
                <EmrTextSideNavButton
                  key={item.value}
                  active={listMode === item.value}
                  icon={<Icon className="size-4 shrink-0" />}
                  onClick={() => setListMode(item.value)}
                >
                  {item.label}
                </EmrTextSideNavButton>
              );
            })}
          </div>
          </EmrTextSideNavSection>
          {placeholderSideItems.map((item) => {
            const Icon = item.icon;
            const sectionId = item.label;
            const open = openSections.has(sectionId);

            return (
              <EmrTextSideNavSection
                key={item.label}
                title={item.label}
                icon={<Icon className="size-4 shrink-0" />}
                open={open}
                onToggle={() => toggleSection(sectionId)}
              >
                <div className="ml-4 border-l py-1 pl-3">
                  {item.children.map((child) => (
                    <EmrTextSideNavButton
                      key={`${item.label}-${child}`}
                      disabled
                    >
                      {child}
                    </EmrTextSideNavButton>
                  ))}
                </div>
              </EmrTextSideNavSection>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}

function CustomerSearchInput({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="relative w-[320px] max-w-full min-w-0">
      <CdsActionsSearchIcon
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        aria-label="고객관리 검색"
        placeholder="동물명, 보호자명, 전화번호, 환자코드 검색"
        value={value}
        className={cn("h-9 pl-8", value ? "pr-8" : "pr-3")}
        onValueChange={onValueChange}
      />
      {value ? (
        <button
          type="button"
          className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-[var(--emr-text-secondary)] focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="고객관리 검색어 초기화"
          onClick={() => onValueChange("")}
        >
          <CircleCloseFillIcon className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function CustomerToolbar({
  listMode,
  patientCount,
  guardianCount,
}: {
  guardianCount: number;
  listMode: CustomerListMode;
  patientCount: number;
}) {
  const query = useCustomerStore((state) => state.query);
  const setQuery = useCustomerStore((state) => state.setQuery);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const activeCount = listMode === "patient" ? patientCount : listMode === "guardian" ? guardianCount : 0;
  const activeLabel =
    listMode === "patient" ? "동물" : listMode === "guardian" ? "보호자" : "삭제된 보호자/동물";

  return (
    <div className="shrink-0 border-b bg-card px-4 py-3" data-testid="customer-page-header">
      <EmrPageHeader
        title={activeLabel}
        className="h-auto flex-wrap gap-y-3"
        actionsClassName="ml-auto flex-wrap justify-end"
        icon={
          <CdsPeopleUsersIcon
            className="size-5 shrink-0 text-[var(--emr-text-tertiary)]"
            aria-hidden="true"
          />
        }
        badge={
          <Badge variant="secondary" className="h-5 rounded-md px-2 text-[11px] text-muted-foreground">
            {activeCount}
          </Badge>
        }
        actions={
          <>
            <CustomerSearchInput value={query} onValueChange={setQuery} />
            <NewUnifiedRegistrationButton onPatientReady={(patientId) => setActiveDrawer({ type: "patient", id: patientId })} />
            <Button type="button" variant="outline" size="sm" className="bg-card">
              <CdsActionsListFilterIcon className="size-4" />
              상세 검색
            </Button>
          </>
        }
      />
      <span className="sr-only">
        {listMode === "patient" ? `동물 ${patientCount}` : `보호자 ${guardianCount}`}
      </span>
    </div>
  );
}

function EmptyDeletedState() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-md border border-dashed bg-card text-center">
      <div className="text-[15px] font-semibold">삭제된 보호자/동물이 없습니다.</div>
      <div className="mt-1 text-[13px] text-muted-foreground">삭제 이력이 없습니다.</div>
    </div>
  );
}

function PatientTable({ rows }: { rows: CustomerPatientRow[] }) {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const columns = useMemo<Array<CustomerTableColumn<CustomerPatientRow>>>(
    () => [
      {
        key: "patientNo",
        label: "환자코드",
        required: true,
        className: "whitespace-nowrap font-semibold",
        cell: (row) => row.patientNo,
      },
      {
        key: "name",
        label: "동물명",
        required: true,
        className: "max-w-40 truncate font-semibold",
        cell: (row) => row.name,
      },
      {
        key: "breed",
        label: "품종",
        className: "max-w-56 truncate",
        cell: (row) => row.breed,
      },
      {
        key: "sex",
        label: "성별",
        cell: (row) => row.sex,
      },
      {
        key: "age",
        label: "나이(생년월일)",
        cell: (row) => row.age,
      },
      {
        key: "workBadges",
        label: "상태",
        className: "min-w-48",
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.workBadges.map((badge) => (
              <CustomerWorkBadge key={`${row.id}-${badge.label}`} badge={badge} />
            ))}
          </div>
        ),
      },
      {
        key: "guardianNames",
        label: "보호자명",
        className: "max-w-52 truncate",
        cell: (row) => row.guardianNames,
      },
      {
        key: "phone",
        label: "전화번호",
        className: "whitespace-nowrap",
        cell: (row) => row.phone,
      },
      {
        key: "messageConsent",
        label: "수신 여부",
        className: "whitespace-nowrap",
        cell: (row) => row.messageConsent,
      },
      {
        key: "registeredAt",
        label: "등록일시",
        className: "whitespace-nowrap",
        cell: (row) => row.registeredAt,
      },
    ],
    []
  );

  return (
    <CustomerDataTable
      columns={columns}
      countLabel={`${rows.length}`}
      emptyLabel="동물 정보가 없습니다."
      getRowLabel={(row) => row.name}
      isActiveRow={(row) =>
        activeDrawer?.id === row.id &&
        (activeDrawer.type === "patient" || activeDrawer.type === "reception-patient")
      }
      minTableWidthClassName={customerTableWidthClassNames.patient}
      onOpenRow={(row) => setActiveDrawer({ type: "patient", id: row.id })}
      rowTestId={(row) => `customer-patient-row-${row.id}`}
      rows={rows}
      title="동물"
      testId="customer-patient-table"
    />
  );
}

function GuardianTable({ rows }: { rows: CustomerGuardianRow[] }) {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const columns = useMemo<Array<CustomerTableColumn<CustomerGuardianRow>>>(
    () => [
      {
        key: "name",
        label: "보호자명",
        required: true,
        className: "max-w-44 truncate font-semibold",
        cell: (row) => row.name,
      },
      {
        key: "mobilePhone",
        label: "휴대전화",
        required: true,
        className: "whitespace-nowrap",
        cell: (row) => row.mobilePhone,
      },
      {
        key: "patientSummary",
        label: "연결 동물",
        className: "max-w-64 truncate",
        cell: (row) => row.patientSummary,
      },
      {
        key: "consentSummary",
        label: "동의 상태",
        className: "whitespace-nowrap",
        cell: (row) => row.consentSummary,
      },
      {
        key: "recentCs",
        label: "최근 CS",
        className: "max-w-72 truncate",
        cell: (row) => row.recentCs,
      },
      {
        key: "recentWork",
        label: "최근 발송/업무",
        className: "max-w-64 truncate",
        cell: (row) => row.recentWork,
      },
      {
        key: "registeredAt",
        label: "등록일시",
        className: "whitespace-nowrap",
        cell: (row) => row.registeredAt,
      },
    ],
    []
  );

  return (
    <CustomerDataTable
      columns={columns}
      countLabel={`${rows.length}`}
      emptyLabel="보호자 정보가 없습니다."
      getRowLabel={(row) => row.name}
      isActiveRow={(row) =>
        activeDrawer?.id === row.id &&
        (activeDrawer.type === "guardian" || activeDrawer.type === "reception-guardian")
      }
      minTableWidthClassName={customerTableWidthClassNames.guardian}
      onOpenRow={(row) => setActiveDrawer({ type: "guardian", id: row.id })}
      rowTestId={(row) => `customer-guardian-row-${row.id}`}
      rows={rows}
      title="보호자"
      testId="customer-guardian-table"
    />
  );
}

export function CustomerContent() {
  const listMode = useCustomerStore((state) => state.listMode);
  const query = useCustomerStore((state) => state.query);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const patients = usePatientProfileStore((state) => state.patients);
  const patientRows = useMemo(
    () => filterCustomerRows(getCustomerPatientRows({ guardians, patientGuardians, patients }), query),
    [guardians, patientGuardians, patients, query]
  );
  const guardianRows = useMemo(
    () => filterCustomerRows(getCustomerGuardianRows({ guardians, patientGuardians, patients }), query),
    [guardians, patientGuardians, patients, query]
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)]" data-testid="customer-workspace">
      <CustomerToolbar
        listMode={listMode}
        patientCount={patientRows.length}
        guardianCount={guardianRows.length}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          {listMode === "patient" ? <PatientTable rows={patientRows} /> : null}
          {listMode === "guardian" ? <GuardianTable rows={guardianRows} /> : null}
          {listMode === "deleted" ? <EmptyDeletedState /> : null}
        </div>
      </ScrollArea>
    </div>
  );
}
