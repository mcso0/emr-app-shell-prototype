"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { EmrPageHeader } from "@/components/emr/page-header";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import {
  EmrModuleListSidePanel,
  EmrModuleListSidePanelBadge,
  type EmrModuleListSidePanelItem,
} from "@/components/emr/module-list-side-panel";
import { EmrRowActionMenu } from "@/components/emr/row-action-menu";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import { EmrTableFilterBuilder } from "@/components/emr/table-filter-builder";
import {
  createInitialEmrTableFilterBuilderModel,
  filterRowsByEmrTableFilterBuilder,
  getEmrTableFilterBuilderActiveCount,
  type EmrTableFilterBuilderField,
} from "@/components/emr/table-filter-builder-model";
import { EmrTableCellText, EmrTableHeaderCell } from "@/components/emr/table-primitives";
import {
  CalendarCheckIcon,
  ChevronDownIcon,
  CircleCloseFillIcon,
  ContactBookIcon,
  DocumentIcon,
  MenuIcon,
  MessagesIcon,
  SendIcon,
  UserCrossIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
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
import { useMockAuthStore } from "@/features/auth/session-store";
import { useCustomerStore, type CustomerListMode } from "@/features/customer/store";
import { NewUnifiedRegistrationButton } from "@/features/reception/profile-drawer";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import type { ReceptionPatientGuardianLookupResponse } from "@/features/reception/patient-guardian-lookup";
import {
  LEGACY_SALES_DEMO_WORKSPACE_ID,
  isPreparedEmptyClinicWorkspace,
} from "@/lib/emr-domain/demo-workspaces";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type {
  EmrColumnResize,
  EmrTableCellTextMode,
  EmrTableDensity,
  EmrTableHeaderInteraction,
} from "@/components/emr/table-density";
import type { ShellComponentProps } from "@/types/emr";

const customerSideItems = [
  { value: "patient" as const, label: "동물", icon: UserIcon },
  { value: "guardian" as const, label: "보호자", icon: UsersIcon },
  { value: "deleted" as const, label: "삭제된 보호자/동물", icon: UserCrossIcon },
];

const placeholderSideItems = [
  { label: "스케줄 관리", icon: CalendarCheckIcon },
  { label: "발송 관리", icon: SendIcon },
  { label: "서류 관리", icon: DocumentIcon },
  { label: "CS내역", icon: MessagesIcon },
  { label: "진료의뢰수신", icon: ContactBookIcon },
];
const customerTableWidthClassNames = {
  guardian: "min-w-[1120px]",
  patient: "min-w-[1320px]",
} as const;
const customerTableMinWidths = {
  guardian: 1120,
  patient: 1320,
} as const;
type CustomerTableSortDirection = "asc" | "desc";
type CustomerTableSortState = {
  direction: CustomerTableSortDirection;
  key: string;
} | null;
type CustomerTableSortValue = string | number | null | undefined;
type CustomerTableFilterOption = {
  label: string;
  value: string;
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

function CustomerWorkBadge({ badge }: { badge: CustomerWorkBadge }) {
  return (
    <Badge variant="outline" className={cn("h-5 rounded-md px-1.5", badgeClassName[badge.tone])}>
      {badge.label}
    </Badge>
  );
}

type CustomerTableColumn<TRow> = {
  align?: "left" | "center" | "right";
  cell: (row: TRow) => ReactNode;
  className?: string;
  defaultVisible?: boolean;
  filterOptions?: CustomerTableFilterOption[] | ((rows: TRow[]) => CustomerTableFilterOption[]);
  filterValues?: (row: TRow) => string[];
  headerClassName?: string;
  headerInteraction?: EmrTableHeaderInteraction;
  key: string;
  label: string;
  required?: boolean;
  resize?: EmrColumnResize;
  sortValue?: (row: TRow) => CustomerTableSortValue;
  textMode?: EmrTableCellTextMode;
};

type CustomerDataTableProps<TRow extends { id: string }> = {
  columns: Array<CustomerTableColumn<TRow>>;
  countLabel: string;
  emptyLabel: string;
  getRowLabel: (row: TRow) => string;
  isActiveRow: (row: TRow) => boolean;
  minTableWidthClassName: string;
  minTableWidth: number;
  onOpenRow: (row: TRow) => void;
  rowTestId: (row: TRow) => string;
  rows: TRow[];
  title: string;
  testId: string;
};

function CustomerRowActionMenu({
  label,
  onOpen,
  onUnavailableAction,
}: {
  label: string;
  onOpen: () => void;
  onUnavailableAction: (feedback: CustomerRowActionFeedback) => void;
}) {
  return (
    <EmrRowActionMenu
      ariaLabel={`${label} 행 작업`}
      contentClassName="w-56"
      items={[
        {
          key: "open",
          label: "상세 보기",
          description: "프로필 drawer 열기",
          onSelect: onOpen,
        },
        {
          key: "chart",
          label: "차트 보러가기",
          description: "진료/차트 화면 연결 전",
          onSelect: () =>
            onUnavailableAction({
              title: "차트 보기는 아직 직접 연결되지 않았어",
              body: `${label}의 차트 이동은 진료/차트 화면의 환자 선택 흐름에서 확인해. 여기서는 프로필 drawer와 고객 정보만 열 수 있어.`,
            }),
        },
        {
          key: "kakao",
          label: "카카오톡 발송",
          description: "외부 발송 미연동",
          onSelect: () =>
            onUnavailableAction({
              title: "카카오톡 발송은 아직 연결되지 않았어",
              body: "실제 카카오톡, 문자, 이메일 발송은 이번 MVP 범위 밖이야. 동의 상태와 연락처만 이 화면에서 확인해.",
            }),
        },
      ]}
      testId={`customer-row-action-${label}`}
    />
  );
}

type CustomerRowActionFeedback = {
  body: ReactNode;
  title: string;
};

function getCustomerWorkspaceId(value?: string | string[]) {
  return typeof value === "string"
    ? value
    : (value?.[0] ?? LEGACY_SALES_DEMO_WORKSPACE_ID);
}

function compareCustomerTableValues(left: CustomerTableSortValue, right: CustomerTableSortValue) {
  const leftEmpty = left === null || left === undefined || left === "";
  const rightEmpty = right === null || right === undefined || right === "";

  if (leftEmpty && rightEmpty) return 0;
  if (leftEmpty) return 1;
  if (rightEmpty) return -1;

  if (typeof left === "number" && typeof right === "number") return left - right;

  return String(left).localeCompare(String(right), "ko-KR", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortCustomerTableRows<TRow>(
  rows: TRow[],
  columns: Array<CustomerTableColumn<TRow>>,
  sortState: CustomerTableSortState
) {
  if (!sortState) return rows;

  const column = columns.find((item) => item.key === sortState.key);
  if (!column?.sortValue) return rows;

  return rows
    .map((row, index) => ({ index, row }))
    .sort((left, right) => {
      const compared = compareCustomerTableValues(
        column.sortValue?.(left.row),
        column.sortValue?.(right.row)
      );
      if (compared === 0) return left.index - right.index;

      return sortState.direction === "asc" ? compared : -compared;
    })
    .map((entry) => entry.row);
}

function getCustomerTableFilterOptions<TRow>(column: CustomerTableColumn<TRow>, rows: TRow[]) {
  const options =
    typeof column.filterOptions === "function"
      ? column.filterOptions(rows)
      : column.filterOptions;

  return options ?? [];
}

function getCustomerTableFilterFields<TRow>(
  columns: Array<CustomerTableColumn<TRow>>,
  rows: TRow[]
): Array<EmrTableFilterBuilderField<TRow>> {
  return columns
    .filter((column) => column.filterValues)
    .map((column) => ({
      getValue: (row: TRow) => column.filterValues?.(row) ?? [],
      id: column.key,
      label: column.label,
      operators: [{ id: "is", label: "Is" }],
      options: getCustomerTableFilterOptions(column, rows),
      valuePlaceholder: `${column.label} 선택`,
    }));
}

function getUniqueCustomerFilterOptions<TRow>(
  rows: TRow[],
  getValues: (row: TRow) => string[]
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
    })
  );
}

function CustomerSortableHeader<TRow>({
  align,
  className,
  column,
  onSort,
  sortState,
}: {
  align?: "left" | "center" | "right";
  className?: string;
  column: CustomerTableColumn<TRow>;
  onSort: (key: string) => void;
  sortState: CustomerTableSortState;
}) {
  const active = sortState?.key === column.key;
  const nextAction =
    !active || !sortState
      ? `${column.label} 오름차순 정렬`
      : sortState.direction === "asc"
        ? `${column.label} 내림차순 정렬`
        : `${column.label} 정렬 해제`;
  const activeDirectionLabel =
    sortState?.direction === "asc"
      ? "오름차순"
      : sortState?.direction === "desc"
        ? "내림차순"
        : "";
  const ariaLabel = active
    ? `현재 정렬: ${column.label} ${activeDirectionLabel}. 클릭하면 ${nextAction}.`
    : `정렬 없음. 클릭하면 ${nextAction}.`;

  return (
    <EmrTableHeaderCell
      align={align}
      className={className}
      interaction={column.headerInteraction ?? "sortable"}
      resize={column.resize ?? "data-column"}
      sortDirection={active ? sortState.direction : undefined}
      sortLabel={ariaLabel}
      title={ariaLabel}
      onSort={() => onSort(column.key)}
    >
      {column.label}
    </EmrTableHeaderCell>
  );
}

function CustomerDataTable<TRow extends { id: string }>({
  columns,
  countLabel,
  emptyLabel,
  getRowLabel,
  isActiveRow,
  minTableWidthClassName,
  minTableWidth,
  onOpenRow,
  rowTestId,
  rows,
  title,
  testId,
}: CustomerDataTableProps<TRow>) {
  const [rowSelection, setRowSelection] = useState<Set<string>>(() => new Set());
  const [rowActionFeedback, setRowActionFeedback] = useState<CustomerRowActionFeedback | null>(null);
  const [density, setDensity] = useState<EmrTableDensity>("standard");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterModel, setFilterModel] = useState(() =>
    createInitialEmrTableFilterBuilderModel(
      `${testId}-filter`,
      `${testId}-filter-rule-1`
    )
  );
  const [sortState, setSortState] = useState<CustomerTableSortState>(null);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.map((column) => [column.key, column.defaultVisible !== false]))
  );
  const filterFields = useMemo(
    () => getCustomerTableFilterFields(columns, rows),
    [columns, rows]
  );
  const activeFilterCount = getEmrTableFilterBuilderActiveCount(filterModel, filterFields);
  const visibleRows = useMemo(
    () =>
      sortCustomerTableRows(
        filterRowsByEmrTableFilterBuilder(rows, filterModel, filterFields),
        columns,
        sortState
      ),
    [columns, filterFields, filterModel, rows, sortState]
  );
  const rowIds = useMemo(() => new Set(visibleRows.map((row) => row.id)), [visibleRows]);
  const visibleRowSelection = useMemo(
    () => new Set(Array.from(rowSelection).filter((id) => rowIds.has(id))),
    [rowIds, rowSelection]
  );
  const visibleColumns = columns.filter(
    (column) => column.required || columnVisibility[column.key] !== false
  );
  const selectedCount = visibleRowSelection.size;
  const allRowsSelected = visibleRows.length > 0 && visibleRows.every((row) => visibleRowSelection.has(row.id));
  const someRowsSelected = visibleRows.some((row) => visibleRowSelection.has(row.id)) && !allRowsSelected;
  const visibleCountLabel = activeFilterCount > 0 ? `${visibleRows.length}/${rows.length}` : countLabel;
  const emptyMessage =
    rows.length > 0 && visibleRows.length === 0
      ? `조건에 맞는 ${title} 정보가 없습니다.`
      : emptyLabel;

  const toggleAllRows = () => {
    setRowSelection((current) => {
      const next = new Set(Array.from(current).filter((id) => !rowIds.has(id)));

      if (visibleRows.length > 0 && visibleRows.every((row) => current.has(row.id))) {
        return next;
      }

      visibleRows.forEach((row) => next.add(row.id));
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
  const handleSort = (key: string) => {
    setSortState((current) => {
      if (current?.key !== key) return { direction: "asc", key };
      if (current.direction === "asc") return { direction: "desc", key };

      return null;
    });
  };
  const renderCell = (column: CustomerTableColumn<TRow>, row: TRow) => {
    const content = column.cell(row);

    if (typeof content !== "string" && typeof content !== "number") {
      return content;
    }

    const text = String(content);

    return (
      <EmrTableCellText mode={column.textMode ?? "one-line"} fullText={text}>
        {text}
      </EmrTableCellText>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm" data-testid={testId}>
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-[18px] font-semibold">{title}</h2>
          <Badge variant="secondary">{visibleCountLabel}</Badge>
          <span className="emr-text-metadata font-medium text-muted-foreground">
            {selectedCount} / {visibleRows.length} 선택
          </span>
        </div>
        <div className="flex items-center gap-2">
          <EmrTableDensitySelector value={density} onValueChange={setDensity} />
          {filterFields.length > 0 ? (
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant={activeFilterCount > 0 ? "secondary" : "outline"}
                    size="sm"
                    className={cn(
                      "bg-card",
                      activeFilterCount > 0 &&
                        "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)] text-[var(--emr-text-primary)]"
                    )}
                    aria-label={
                      activeFilterCount > 0
                        ? `${title} 필터 ${activeFilterCount}개 설정`
                        : `${title} 필터 설정`
                    }
                  />
                }
              >
                <CdsActionsListFilterIcon aria-hidden="true" className="size-3.5" />
                Filter{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-[min(720px,calc(100vw-32px))] gap-3 p-3"
                initialFocus={false}
              >
                <EmrTableFilterBuilder
                  clearAllLabel="초기화"
                  description={`${title} 필터는 완성된 조건만 AND로 적용됩니다.`}
                  fields={filterFields}
                  model={filterModel}
                  title="Filters"
                  onClose={() => setFilterOpen(false)}
                  onModelChange={setFilterModel}
                />
              </PopoverContent>
            </Popover>
          ) : null}
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
      </div>
      {rowActionFeedback ? (
        <EmrInlineAlert
          severity="info"
          title={rowActionFeedback.title}
          className="mx-4 my-3 emr-text-metadata"
          action={
            <Button size="sm" variant="outline" onClick={() => setRowActionFeedback(null)}>
              확인
            </Button>
          }
          testId="customer-row-action-feedback"
        >
          {rowActionFeedback.body}
        </EmrInlineAlert>
      ) : null}
      <Table
        aria-label={`${title} 고객관리 테이블`}
        density={density}
        layout="scroll"
        minWidth={minTableWidth}
        className={minTableWidthClassName}
      >
        <TableHeader className="bg-[var(--emr-surface-muted)]">
          <TableRow className="border-border hover:bg-transparent">
            <EmrTableHeaderCell
              aria-label={`${title} 선택`}
              className="w-12"
              interaction="static"
              resize="none"
            >
              <span className="sr-only">선택</span>
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
            </EmrTableHeaderCell>
            {visibleColumns.map((column) =>
              column.sortValue ? (
                <CustomerSortableHeader
                  key={column.key}
                  align={column.align}
                  className={cn("h-11 emr-text-dense", column.headerClassName)}
                  column={column}
                  sortState={sortState}
                  onSort={handleSort}
                />
              ) : (
                <EmrTableHeaderCell
                  key={column.key}
                  align={column.align}
                  className={cn("h-11 emr-text-dense", column.headerClassName)}
                  interaction={column.headerInteraction ?? "static"}
                  resize={column.resize ?? "data-column"}
                >
                  {column.label}
                </EmrTableHeaderCell>
              )
            )}
            <EmrTableHeaderCell
              aria-label={`${title} 행 작업`}
              className="w-12"
              interaction="static"
              resize="none"
            >
              <span className="sr-only">행 작업</span>
            </EmrTableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.length ? (
            visibleRows.map((row) => {
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
                      {renderCell(column, row)}
                    </TableCell>
                  ))}
                  <TableCell className="w-12">
                    <CustomerRowActionMenu
                      label={rowLabel}
                      onOpen={() => onOpenRow(row)}
                      onUnavailableAction={setRowActionFeedback}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={visibleColumns.length + 2} className="h-28 text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex h-11 items-center justify-between border-t px-4 emr-text-metadata font-medium text-muted-foreground">
        <span>
          {selectedCount} of {visibleRows.length} row(s) selected.
        </span>
        <div className="flex items-center gap-2">
          <span>
            {visibleRows.length ? `1-${visibleRows.length}` : "0"} / {visibleRows.length}
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
  const params = useParams<{ workspaceId?: string | string[] }>();
  const workspaceId = getCustomerWorkspaceId(params.workspaceId);
  const listMode = useCustomerStore((state) => state.listMode);
  const setListMode = useCustomerStore((state) => state.setListMode);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const patients = usePatientProfileStore((state) => state.patients);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(["master"]));
  const patientCount = useMemo(
    () =>
      getCustomerPatientRows({
        guardians,
        patientGuardians,
        patients,
        workspaceId,
      }).length,
    [guardians, patientGuardians, patients, workspaceId]
  );
  const guardianCount = useMemo(
    () =>
      getCustomerGuardianRows({
        guardians,
        patientGuardians,
        patients,
        workspaceId,
      }).length,
    [guardians, patientGuardians, patients, workspaceId]
  );
  const customerCounts: Record<CustomerListMode, number> = {
    deleted: 0,
    guardian: guardianCount,
    patient: patientCount,
  };
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
  const sidePanelItems: EmrModuleListSidePanelItem[] = [
    {
      type: "section",
      id: "master",
      label: "보호자/동물 관리",
      icon: <ContactBookIcon className="size-4 shrink-0" />,
      children: customerSideItems.map((item) => {
        const Icon = item.icon;

        return {
          type: "leaf" as const,
          id: item.value,
          active: listMode === item.value,
          count: <EmrModuleListSidePanelBadge>{customerCounts[item.value]}</EmrModuleListSidePanelBadge>,
          icon: <Icon className="size-4 shrink-0" />,
          label: item.label,
          onClick: () => setListMode(item.value),
          testId: `customer-side-panel-${item.value}`,
        };
      }),
    },
    ...placeholderSideItems.map((item) => {
      const Icon = item.icon;

      return {
        type: "button" as const,
        id: item.label,
        count: <EmrModuleListSidePanelBadge variant="outline">후속</EmrModuleListSidePanelBadge>,
        disabled: true,
        icon: <Icon className="size-4 shrink-0" />,
        label: item.label,
      };
    }),
  ];

  return (
    <EmrModuleListSidePanel
      title={moduleLabel}
      items={sidePanelItems}
      onCollapse={() => setModulePanelOpen(false)}
      onToggleSection={toggleSection}
      openSectionIds={openSections}
      testId="customer-side-panel"
    />
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
          <UsersIcon
            className="size-5 shrink-0 text-[var(--emr-text-tertiary)]"
            aria-hidden="true"
          />
        }
        badge={
          <Badge variant="secondary" className="h-5 rounded-md px-2 emr-text-micro text-muted-foreground">
            {activeCount}
          </Badge>
        }
        actions={
          <>
            <CustomerSearchInput value={query} onValueChange={setQuery} />
            <NewUnifiedRegistrationButton onPatientReady={(patientId) => setActiveDrawer({ type: "patient", id: patientId })} />
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
      <div className="mt-1 emr-text-dense text-muted-foreground">삭제 이력이 없습니다.</div>
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
        headerInteraction: "sortable",
        className: "whitespace-nowrap font-semibold",
        textMode: "one-line",
        sortValue: (row) => row.patientNo,
        cell: (row) => row.patientNo,
      },
      {
        key: "name",
        label: "동물명",
        required: true,
        headerInteraction: "sortable",
        className: "max-w-40 font-semibold",
        textMode: "two-line-if-long",
        sortValue: (row) => row.name,
        cell: (row) => row.name,
      },
      {
        key: "breed",
        label: "품종",
        headerInteraction: "filterable",
        className: "max-w-56",
        textMode: "one-line",
        filterOptions: (rows) => getUniqueCustomerFilterOptions(rows, (row) => [row.breed]),
        filterValues: (row) => [row.breed],
        cell: (row) => row.breed,
      },
      {
        key: "sex",
        label: "성별",
        headerInteraction: "filterable",
        className: "whitespace-nowrap",
        textMode: "one-line",
        filterOptions: (rows) => getUniqueCustomerFilterOptions(rows, (row) => [row.sex]),
        filterValues: (row) => [row.sex],
        cell: (row) => row.sex,
      },
      {
        key: "age",
        label: "나이(생년월일)",
        headerInteraction: "sortable",
        className: "whitespace-nowrap",
        textMode: "one-line",
        sortValue: (row) => row.patient.birthDate ?? row.age,
        cell: (row) => row.age,
      },
      {
        key: "workBadges",
        label: "상태",
        headerInteraction: "filterable",
        className: "min-w-48",
        textMode: "badge-wrap",
        filterOptions: (rows) =>
          getUniqueCustomerFilterOptions(rows, (row) => row.workBadges.map((badge) => badge.label)),
        filterValues: (row) => row.workBadges.map((badge) => badge.label),
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
        headerInteraction: "compound",
        className: "max-w-52",
        textMode: "two-line-if-long",
        cell: (row) => row.guardianNames,
      },
      {
        key: "phone",
        label: "전화번호",
        headerInteraction: "static",
        className: "whitespace-nowrap",
        textMode: "one-line",
        cell: (row) => row.phone,
      },
      {
        key: "messageConsent",
        label: "수신 여부",
        headerInteraction: "filterable",
        className: "whitespace-nowrap",
        textMode: "one-line",
        filterOptions: (rows) => getUniqueCustomerFilterOptions(rows, (row) => [row.messageConsent]),
        filterValues: (row) => [row.messageConsent],
        cell: (row) => row.messageConsent,
      },
      {
        key: "registeredAt",
        label: "등록일시",
        headerInteraction: "sortable",
        className: "whitespace-nowrap",
        textMode: "one-line",
        sortValue: (row) => row.patient.createdAt,
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
      minTableWidth={customerTableMinWidths.patient}
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
        headerInteraction: "sortable",
        className: "max-w-44 font-semibold",
        textMode: "two-line-if-long",
        sortValue: (row) => row.name,
        cell: (row) => row.name,
      },
      {
        key: "mobilePhone",
        label: "휴대전화",
        required: true,
        headerInteraction: "static",
        className: "whitespace-nowrap",
        textMode: "one-line",
        cell: (row) => row.mobilePhone,
      },
      {
        key: "patientSummary",
        label: "연결 동물",
        headerInteraction: "compound",
        className: "max-w-64",
        textMode: "two-line-if-long",
        cell: (row) => row.patientSummary,
      },
      {
        key: "consentSummary",
        label: "동의 상태",
        headerInteraction: "filterable",
        className: "whitespace-nowrap",
        textMode: "one-line",
        filterOptions: (rows) => getUniqueCustomerFilterOptions(rows, (row) => [row.consentSummary]),
        filterValues: (row) => [row.consentSummary],
        cell: (row) => row.consentSummary,
      },
      {
        key: "recentCs",
        label: "최근 CS",
        headerInteraction: "compound",
        className: "max-w-72",
        textMode: "two-line-if-long",
        cell: (row) => row.recentCs,
      },
      {
        key: "recentWork",
        label: "최근 발송/업무",
        headerInteraction: "compound",
        className: "max-w-64",
        textMode: "two-line-if-long",
        cell: (row) => row.recentWork,
      },
      {
        key: "registeredAt",
        label: "등록일시",
        headerInteraction: "sortable",
        className: "whitespace-nowrap",
        textMode: "one-line",
        sortValue: (row) => row.guardian.createdAt,
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
      minTableWidth={customerTableMinWidths.guardian}
      onOpenRow={(row) => setActiveDrawer({ type: "guardian", id: row.id })}
      rowTestId={(row) => `customer-guardian-row-${row.id}`}
      rows={rows}
      title="보호자"
      testId="customer-guardian-table"
    />
  );
}

export function CustomerContent() {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const workspaceId = getCustomerWorkspaceId(params.workspaceId);
  const listMode = useCustomerStore((state) => state.listMode);
  const query = useCustomerStore((state) => state.query);
  const authSession = useMockAuthStore((state) => state.session);
  const applyPatientGuardianLookupItem = usePatientProfileStore(
    (state) => state.applyPatientGuardianLookupItem,
  );
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const patients = usePatientProfileStore((state) => state.patients);
  useEffect(() => {
    if (!isPreparedEmptyClinicWorkspace(workspaceId)) return;

    let cancelled = false;

    async function loadSeededCustomerProfiles() {
      try {
        const headers = authSession?.id
          ? { "x-clair-demo-session-user-id": authSession.id }
          : undefined;
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/patient-guardian-lookup?query=`,
          {
            cache: "no-store",
            headers,
          },
        );
        const result =
          (await response.json()) as ReceptionPatientGuardianLookupResponse;

        if (cancelled || !response.ok || !result.ok) return;

        result.patients.forEach((item) => applyPatientGuardianLookupItem(item));
      } catch {
        // Keep the workspace-filtered empty state if live customer seed read fails.
      }
    }

    void loadSeededCustomerProfiles();

    return () => {
      cancelled = true;
    };
  }, [applyPatientGuardianLookupItem, authSession?.id, workspaceId]);
  const patientRows = useMemo(
    () =>
      filterCustomerRows(
        getCustomerPatientRows({ guardians, patientGuardians, patients, workspaceId }),
        query,
      ),
    [guardians, patientGuardians, patients, query, workspaceId]
  );
  const guardianRows = useMemo(
    () =>
      filterCustomerRows(
        getCustomerGuardianRows({ guardians, patientGuardians, patients, workspaceId }),
        query,
      ),
    [guardians, patientGuardians, patients, query, workspaceId]
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
