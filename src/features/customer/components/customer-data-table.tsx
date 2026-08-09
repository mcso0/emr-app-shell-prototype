"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnPinningState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useMemo, useState, type ReactNode } from "react";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrDataTable } from "@/components/emr/emr-data-table";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { EmrRowActionMenu } from "@/components/emr/row-action-menu";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import { EmrTableFilterBuilder } from "@/components/emr/table-filter-builder";
import { EmrTableFilterTrigger } from "@/components/emr/table-filter-trigger";
import {
  createInitialEmrTableFilterBuilderModel,
  filterRowsByEmrTableFilterBuilder,
  getEmrTableFilterBuilderActiveCount,
  type EmrTableFilterBuilderField,
} from "@/components/emr/table-filter-builder-model";
import {
  EmrPinnedTableWorkspace,
  EmrTableFeedbackSurface,
} from "@/components/emr/table-primitives";
import { ChevronDownIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCustomerStore } from "@/features/customer/store";
import { NewUnifiedRegistrationButton } from "@/features/reception/profile-drawer";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { EmrTableDensity } from "@/components/emr/table-density";
import { CustomerDataTableFooter } from "./customer-data-table-footer";
import { CustomerListHeader } from "./customer-list-header";
import type {
  CustomerTableColumnDef,
  CustomerTableFilterOption,
} from "./customer-table-columns";
import styles from "./customer-data-table.module.css";

export type CustomerTableReadStatus = "ready" | "denied" | "error";

type CustomerRowActionFeedback = {
  body: ReactNode;
  title: string;
};

type CustomerDataTableProps<TRow extends { id: string; searchText: string }> = {
  columns: Array<CustomerTableColumnDef<TRow>>;
  emptyActionLabel: string;
  emptyLabel: string;
  getRowLabel: (row: TRow) => string;
  isActiveRow: (row: TRow) => boolean;
  loading?: boolean;
  onOpenRow: (row: TRow) => void;
  onRetry?: () => void;
  pinnedIdentityColumnId?: string;
  readStatus?: CustomerTableReadStatus;
  rowTestId: (row: TRow) => string;
  rows: TRow[];
  title: string;
  testId: string;
};

function getCustomerTableFilterOptions<TRow>(
  column: CustomerTableColumnDef<TRow>,
  rows: TRow[],
): CustomerTableFilterOption[] {
  const options =
    typeof column.meta.filterOptions === "function"
      ? column.meta.filterOptions(rows)
      : column.meta.filterOptions;

  return options ?? [];
}

function getCustomerTableFilterFields<TRow>(
  columns: Array<CustomerTableColumnDef<TRow>>,
  rows: TRow[],
): Array<EmrTableFilterBuilderField<TRow>> {
  return columns
    .filter((column) => column.meta.filterValues)
    .map((column) => ({
      getValue: (row: TRow) => column.meta.filterValues?.(row) ?? [],
      id: column.id,
      label: column.meta.label,
      operators: [{ id: "is", label: "Is" }],
      options: getCustomerTableFilterOptions(column, rows),
      valuePlaceholder: `${column.meta.label} 선택`,
    }));
}

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
      triggerClassName="size-6 shrink-0 rounded-md border-[var(--clair-color-atomic-neutral-200)] bg-[var(--clair-color-atomic-common-100)] p-0 text-[var(--clair-color-atomic-neutral-700)] shadow-[var(--clair-shadow-xs)] hover:bg-[var(--clair-color-atomic-black-alpha-4)] [&_svg]:size-3.5"
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
              title: "차트 보기는 아직 직접 연결되지 않았습니다",
              body: `${label}의 차트 이동은 진료/차트 화면의 환자 선택 흐름에서 확인해 주세요. 여기서는 프로필 drawer와 고객 정보만 열 수 있습니다.`,
            }),
        },
        {
          key: "kakao",
          label: "카카오톡 발송",
          description: "외부 발송 미연동",
          onSelect: () =>
            onUnavailableAction({
              title: "카카오톡 발송은 아직 연결되지 않았습니다",
              body: "실제 카카오톡, 문자, 이메일 발송은 이번 MVP 범위에 포함되지 않습니다. 동의 상태와 연락처만 이 화면에서 확인해 주세요.",
            }),
        },
      ]}
      testId={`customer-row-action-${label}`}
    />
  );
}

export function CustomerDataTable<
  TRow extends { id: string; searchText: string },
>({
  columns,
  emptyActionLabel,
  emptyLabel,
  getRowLabel,
  isActiveRow,
  loading = false,
  onOpenRow,
  onRetry,
  pinnedIdentityColumnId,
  readStatus = "ready",
  rowTestId,
  rows,
  title,
  testId,
}: CustomerDataTableProps<TRow>) {
  const query = useCustomerStore((state) => state.query);
  const setQuery = useCustomerStore((state) => state.setQuery);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const [rowActionFeedback, setRowActionFeedback] =
    useState<CustomerRowActionFeedback | null>(null);
  const [density, setDensity] = useState<EmrTableDensity>("standard");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterPopoverReady, setFilterPopoverReady] = useState(false);
  const [filterAutoOpenConsumed, setFilterAutoOpenConsumed] = useState(false);
  const [registrationOpenRequestKey, setRegistrationOpenRequestKey] =
    useState(0);
  const [filterModel, setFilterModel] = useState(() =>
    createInitialEmrTableFilterBuilderModel(
      `${testId}-filter`,
      `${testId}-filter-rule-1`,
    ),
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () =>
      Object.fromEntries(
        columns.map((column) => [
          column.id,
          column.meta.defaultVisible !== false,
        ]),
      ),
  );
  const filterFields = useMemo(
    () => getCustomerTableFilterFields(columns, rows),
    [columns, rows],
  );
  const activeFilterCount = getEmrTableFilterBuilderActiveCount(
    filterModel,
    filterFields,
  );
  const filteredRows = useMemo(
    () => filterRowsByEmrTableFilterBuilder(rows, filterModel, filterFields),
    [filterFields, filterModel, rows],
  );
  const pinnedColumnId = columns.some(
    (column) => column.id === pinnedIdentityColumnId,
  )
    ? pinnedIdentityColumnId
    : undefined;

  const tableColumns = useMemo<Array<ColumnDef<TRow, unknown>>>(
    () => [
      {
        id: "select",
        enableHiding: false,
        enableSorting: false,
        meta: {
          label: `${title} 선택`,
          role: "selection",
        },
        size: 44,
        header: ({ table }) => {
          const allSelected = table.getIsAllRowsSelected();
          const someSelected = table.getIsSomeRowsSelected();

          return (
            <span
              data-row-interactive="true"
              className="inline-flex size-6 items-center justify-center"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <EmrTableCheckbox
                aria-label={`${title} 전체 선택`}
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={(checked) =>
                  table.toggleAllRowsSelected(Boolean(checked))
                }
              />
            </span>
          );
        },
        cell: ({ row }) => (
          <span
            data-row-interactive="true"
            className="inline-flex size-6 items-center justify-center"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <EmrTableCheckbox
              aria-label={`${getRowLabel(row.original)} 선택`}
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(checked)}
            />
          </span>
        ),
      },
      ...columns.map((column) => ({
        ...column,
        meta: {
          ...column.meta,
          identity: column.id === pinnedColumnId,
          role: "data" as const,
        },
      })),
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
        meta: {
          label: "행 작업",
          role: "actions",
        },
        size: 52,
        cell: ({ row }) => (
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center",
              styles.revealControl,
            )}
          >
            <CustomerRowActionMenu
              label={getRowLabel(row.original)}
              onOpen={() => onOpenRow(row.original)}
              onUnavailableAction={setRowActionFeedback}
            />
          </span>
        ),
      },
    ],
    [columns, getRowLabel, onOpenRow, pinnedColumnId, title],
  );
  const columnPinning = useMemo<ColumnPinningState>(
    () => ({
      left: pinnedColumnId ? ["select", pinnedColumnId] : [],
      right: [],
    }),
    [pinnedColumnId],
  );

  // TanStack Table intentionally owns mutable headless state methods that React
  // Compiler must not memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns: tableColumns,
    data: filteredRows,
    enableColumnPinning: Boolean(pinnedColumnId),
    enableMultiSort: false,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId: (row) => row.id,
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const normalizedQuery = String(filterValue ?? "")
        .trim()
        .toLowerCase();
      return (
        !normalizedQuery || row.original.searchText.includes(normalizedQuery)
      );
    },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: {
      columnPinning,
      columnVisibility,
      globalFilter: query,
      rowSelection,
      sorting,
    },
  });
  const visibleRows = table.getRowModel().rows;
  const selectedCount = visibleRows.filter((row) => row.getIsSelected()).length;
  const initialLoading = loading && rows.length === 0;
  const hasFilterHiddenRows =
    rows.length > 0 && !initialLoading && visibleRows.length === 0;
  const emptyStateKind = hasFilterHiddenRows ? "no-filter-results" : "no-data";
  const emptyStatePriority = hasFilterHiddenRows
    ? "local-recovery"
    : "supporting";
  const emptyStateTitle = hasFilterHiddenRows
    ? `조건에 맞는 ${title} 정보가 없습니다`
    : emptyLabel.replace(/\.$/, "");
  const emptyStateDescription = hasFilterHiddenRows
    ? "조건을 바꾸면 숨겨진 정보가 다시 보입니다."
    : "등록되면 이 표에 표시됩니다.";
  const resetFilters = () => {
    setQuery("");
    setFilterModel(
      createInitialEmrTableFilterBuilderModel(
        `${testId}-filter`,
        `${testId}-filter-rule-1`,
      ),
    );
  };

  const filterControl =
    filterFields.length > 0 ? (
      <Popover
        open={filterOpen}
        onOpenChange={(open) => {
          setFilterOpen(open);
          if (!open) {
            setFilterPopoverReady(false);
            setFilterAutoOpenConsumed(false);
          }
        }}
        onOpenChangeComplete={setFilterPopoverReady}
      >
        <PopoverTrigger
          render={
            <EmrTableFilterTrigger
              activeCount={activeFilterCount}
              aria-label={
                activeFilterCount > 0
                  ? `${title} 필터 ${activeFilterCount}개 설정`
                  : `${title} 필터 설정`
              }
            />
          }
        />
        <PopoverContent
          align="end"
          className="w-[min(640px,calc(100vw-32px))] gap-0 overflow-visible p-0"
          initialFocus={false}
        >
          <EmrTableFilterBuilder
            autoOpenFirstField={filterPopoverReady && !filterAutoOpenConsumed}
            clearAllLabel="초기화"
            description={`${title} 필터는 완성된 조건만 자동 적용되며, 그룹 안과 그룹 사이는 선택한 AND/OR로 계산됩니다.`}
            fields={filterFields}
            model={filterModel}
            title="필터"
            onClose={() => {
              setFilterOpen(false);
              setFilterPopoverReady(false);
              setFilterAutoOpenConsumed(false);
            }}
            onModelChange={(model) => {
              setFilterAutoOpenConsumed(true);
              setFilterModel(model);
            }}
          />
        </PopoverContent>
      </Popover>
    ) : null;

  const columnControl = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 min-h-8 rounded-lg bg-[var(--clair-color-atomic-common-100)] px-3 py-1.5 shadow-[var(--clair-shadow-xs)]"
            aria-label={`${title} 컬럼 표시 설정`}
          />
        }
      >
        전체 컬럼
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>표시 컬럼</DropdownMenuLabel>
          {columns.map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={columnVisibility[column.id] !== false}
              disabled={column.meta.required}
              onCheckedChange={() =>
                setColumnVisibility((current) => ({
                  ...current,
                  [column.id]: !(current[column.id] !== false),
                }))
              }
            >
              {column.meta.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <EmrPinnedTableWorkspace
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#fcfcfc]"
      data-testid={testId}
      identityTextInset={48}
      selectionColumnWidth={pinnedColumnId ? 44 : 0}
    >
      <CustomerListHeader
        title={title}
        count={rows.length}
        countLoading={initialLoading}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder={`${title} 검색`}
        tableControls={
          <>
            {filterControl}
            <EmrTableDensitySelector
              value={density}
              onValueChange={setDensity}
            />
            {columnControl}
          </>
        }
        primaryAction={
          <NewUnifiedRegistrationButton
            openRequestKey={registrationOpenRequestKey}
            onPatientReady={(patientId) =>
              setActiveDrawer({ type: "patient", id: patientId })
            }
          />
        }
      />

      {rowActionFeedback ? (
        <EmrInlineAlert
          severity="info"
          title={rowActionFeedback.title}
          className="mx-12 my-3 emr-text-metadata"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRowActionFeedback(null)}
            >
              확인
            </Button>
          }
          testId="customer-row-action-feedback"
        >
          {rowActionFeedback.body}
        </EmrInlineAlert>
      ) : null}

      {readStatus === "denied" ? (
        <EmrTableFeedbackSurface>
          <EmrEmptyState
            description="고객 조회 권한이 있는 사용자에게 문의해 주세요."
            kind="no-permission"
            priority="local-recovery"
            size="md"
            surface="table"
            testId={`${testId}-read-denied`}
            title={`${title} 정보를 볼 권한이 없습니다`}
          />
        </EmrTableFeedbackSurface>
      ) : readStatus === "error" ? (
        <EmrTableFeedbackSurface>
          <EmrEmptyState
            description="연결 상태를 확인한 뒤 다시 시도해 주세요."
            kind="read-error"
            primaryAction={
              onRetry ? (
                <Button size="sm" variant="outline" onClick={onRetry}>
                  다시 시도
                </Button>
              ) : undefined
            }
            priority="local-recovery"
            size="md"
            surface="table"
            testId={`${testId}-read-error`}
            title={`${title} 정보를 불러오지 못했습니다`}
          />
        </EmrTableFeedbackSurface>
      ) : !initialLoading && visibleRows.length === 0 ? (
        <EmrTableFeedbackSurface>
          <EmrEmptyState
            description={emptyStateDescription}
            kind={emptyStateKind}
            primaryAction={
              hasFilterHiddenRows ? (
                <Button size="sm" variant="outline" onClick={resetFilters}>
                  조건 초기화
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setRegistrationOpenRequestKey((current) => current + 1)
                  }
                >
                  {emptyActionLabel}
                </Button>
              )
            }
            priority={emptyStatePriority}
            size="md"
            surface="table"
            testId={`${testId}-empty-state`}
            title={emptyStateTitle}
          />
        </EmrTableFeedbackSurface>
      ) : (
        <>
          <EmrDataTable
            aria-label={`${title} 고객관리 테이블`}
            className="table-fixed"
            containerClassName="isolate h-full min-h-0 min-w-0 overflow-auto bg-[var(--clair-color-atomic-common-100)]"
            density={density}
            initialLoading={initialLoading}
            overscrollAxes="both"
            skeletonRowCount={6}
            table={table}
            getRowProps={(row) => {
              const active = isActiveRow(row.original);

              return {
                className: cn(
                  "group/customer-row cursor-pointer",
                  active &&
                    "bg-[var(--emr-state-selected)] hover:!bg-[var(--emr-state-selected)]",
                ),
                "data-state": active ? "selected" : undefined,
                "data-testid": rowTestId(row.original),
                onClick: () => onOpenRow(row.original),
              };
            }}
          />

          <CustomerDataTableFooter
            loading={initialLoading}
            totalCount={visibleRows.length}
          />
        </>
      )}

      {selectedCount > 0 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-20 flex justify-center">
          <div className="pointer-events-auto flex h-10 items-center gap-3 rounded-lg border bg-card px-3 shadow-lg">
            <span className="emr-text-metadata font-medium text-muted-foreground">
              선택한 {title} {selectedCount}개
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRowSelection({})}
            >
              선택 해제
            </Button>
          </div>
        </div>
      ) : null}
    </EmrPinnedTableWorkspace>
  );
}
