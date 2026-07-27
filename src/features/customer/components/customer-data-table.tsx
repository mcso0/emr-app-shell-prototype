"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useMemo, useState, type ReactNode } from "react";
import { CdsActionsListFilterIcon } from "@/components/cds-icons/actions-and-controls";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
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
import {
  EmrTableHeaderCell,
  EmrTableSelectionCell,
  EmrTableSelectionHeaderCell,
} from "@/components/emr/table-primitives";
import { ChevronDownIcon } from "@/components/icons";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCustomerStore } from "@/features/customer/store";
import { NewUnifiedRegistrationButton } from "@/features/reception/profile-drawer";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { EmrTableDensity } from "@/components/emr/table-density";
import { CustomerDataTableColumnHeader } from "./customer-data-table-column-header";
import { CustomerDataTableFooter } from "./customer-data-table-footer";
import { CustomerListHeader } from "./customer-list-header";
import { CustomerTableCellContent } from "./customer-table-cell-content";
import type {
  CustomerTableColumnDef,
  CustomerTableColumnMeta,
  CustomerTableFilterOption,
} from "./customer-table-columns";
import styles from "./customer-data-table.module.css";

export type CustomerTableReadStatus = "ready" | "error";

type CustomerRowActionFeedback = {
  body: ReactNode;
  title: string;
};

type CustomerDataTableProps<TRow extends { id: string; searchText: string }> = {
  columns: Array<CustomerTableColumnDef<TRow>>;
  emptyLabel: string;
  getRowLabel: (row: TRow) => string;
  isActiveRow: (row: TRow) => boolean;
  loading?: boolean;
  minTableWidth: number;
  onOpenRow: (row: TRow) => void;
  readStatus?: CustomerTableReadStatus;
  rowTestId: (row: TRow) => string;
  rows: TRow[];
  title: string;
  testId: string;
};

function getColumnMeta<TRow>(
  column: ColumnDef<TRow, unknown>,
): CustomerTableColumnMeta<TRow> | undefined {
  return column.meta as CustomerTableColumnMeta<TRow> | undefined;
}

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

function getSortAriaLabel(
  label: string,
  sortDirection: false | "asc" | "desc",
) {
  const nextAction =
    sortDirection === "asc"
      ? `${label} 내림차순 정렬`
      : sortDirection === "desc"
        ? `${label} 정렬 해제`
        : `${label} 오름차순 정렬`;

  if (!sortDirection) return `정렬 없음. 클릭하면 ${nextAction}.`;

  const current = sortDirection === "asc" ? "오름차순" : "내림차순";
  return `현재 정렬: ${label} ${current}. 클릭하면 ${nextAction}.`;
}

function getAriaSort(sortDirection: false | "asc" | "desc") {
  if (sortDirection === "asc") return "ascending" as const;
  if (sortDirection === "desc") return "descending" as const;
  return undefined;
}

function getCustomerSkeletonWidth(index: number) {
  const widths = [
    "w-24",
    "w-32",
    "w-20",
    "w-16",
    "w-28",
    "w-36",
    "w-24",
    "w-28",
  ];

  return widths[index % widths.length];
}

function CustomerTableSkeletonRows({
  colSpan,
  density,
  rowCount,
  testId,
  visibleColumnCount,
}: {
  colSpan: number;
  density: EmrTableDensity;
  rowCount: number;
  testId: string;
  visibleColumnCount: number;
}) {
  const rowHeightClassName =
    density === "compact"
      ? "!h-[35px]"
      : density === "comfortable"
        ? "!h-[51px]"
        : "!h-[39px]";
  const contentHeightClassName =
    density === "compact"
      ? "!min-h-[35px]"
      : density === "comfortable"
        ? "!min-h-[51px]"
        : "!min-h-[39px]";

  return (
    <>
      {Array.from({ length: rowCount }, (_, rowIndex) => (
        <TableRow
          key={`${testId}-${rowIndex}`}
          className={cn(
            rowHeightClassName,
            "bg-[var(--clair-color-atomic-common-100)] hover:!bg-[var(--clair-color-atomic-common-100)]",
          )}
          data-testid={testId}
        >
          <EmrTableSelectionCell
            className={cn(
              rowHeightClassName,
              "w-11 !p-0 !pl-5 !pr-2",
            )}
          >
            <Skeleton className="size-4 rounded-[var(--clair-radius-atomic-4)] bg-[var(--emr-surface-muted)]" />
          </EmrTableSelectionCell>
          {Array.from(
            { length: visibleColumnCount },
            (_, columnIndex) => (
              <TableCell
                key={`${testId}-${rowIndex}-${columnIndex}`}
                className={cn(rowHeightClassName, "!p-0")}
              >
                <div
                  className={cn(
                    contentHeightClassName,
                    "flex items-center px-2.5",
                  )}
                >
                  <Skeleton
                    className={cn(
                      "h-4 max-w-full rounded-[var(--emr-radius-control)] bg-[var(--emr-surface-muted)]",
                      getCustomerSkeletonWidth(columnIndex),
                    )}
                  />
                </div>
              </TableCell>
            ),
          )}
          <TableCell
            className={cn(
              rowHeightClassName,
              "w-[52px] !p-0 !pl-2 !pr-5",
            )}
          >
            <Skeleton className="ml-auto size-6 rounded-[var(--emr-radius-control)] bg-[var(--emr-surface-muted)]" />
          </TableCell>
        </TableRow>
      ))}
      <TableRow className="sr-only">
        <TableCell colSpan={colSpan}>고객 정보를 불러오는 중입니다.</TableCell>
      </TableRow>
    </>
  );
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
  emptyLabel,
  getRowLabel,
  isActiveRow,
  loading = false,
  minTableWidth,
  onOpenRow,
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
  const [filterModel, setFilterModel] = useState(() =>
    createInitialEmrTableFilterBuilderModel(
      `${testId}-filter`,
      `${testId}-filter-rule-1`,
    ),
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() =>
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
    () =>
      filterRowsByEmrTableFilterBuilder(
        rows,
        filterModel,
        filterFields,
      ),
    [filterFields, filterModel, rows],
  );

  const tableColumns = useMemo<Array<ColumnDef<TRow, unknown>>>(
    () => [
      {
        id: "select",
        enableHiding: false,
        enableSorting: false,
        size: 44,
        header: ({ table }) => {
          const visibleRows = table.getRowModel().rows;
          const allSelected =
            visibleRows.length > 0 &&
            visibleRows.every((row) => row.getIsSelected());
          const someSelected =
            visibleRows.some((row) => row.getIsSelected()) && !allSelected;

          const toggleVisibleRows = () => {
            const nextSelected = !allSelected;
            visibleRows.forEach((row) => row.toggleSelected(nextSelected));
          };

          return (
            <span
              data-row-interactive="true"
              className={cn(
                "inline-flex size-6 items-center justify-center",
                styles.revealControl,
              )}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <EmrTableCheckbox
                aria-label={`${title} 전체 선택`}
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={toggleVisibleRows}
              />
            </span>
          );
        },
        cell: ({ row }) => (
          <span
            data-row-interactive="true"
            className={cn(
              "inline-flex size-6 items-center justify-center",
              styles.revealControl,
            )}
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
      ...columns,
      {
        id: "actions",
        enableHiding: false,
        enableSorting: false,
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
    [columns, getRowLabel, onOpenRow, title],
  );

  // TanStack Table intentionally owns mutable headless state methods that React
  // Compiler must not memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns: tableColumns,
    data: filteredRows,
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
  const emptyStateKind = hasFilterHiddenRows
    ? "no-filter-results"
    : "no-data";
  const emptyStatePriority = hasFilterHiddenRows
    ? "local-recovery"
    : "supporting";
  const emptyStateTitle = hasFilterHiddenRows
    ? `조건에 맞는 ${title} 정보가 없습니다`
    : emptyLabel.replace(/\.$/, "");
  const emptyStateDescription = hasFilterHiddenRows
    ? "조건을 바꾸면 숨겨진 정보가 다시 보입니다."
    : "등록되면 이 표에 표시됩니다.";
  const dataColumnCount = table
    .getVisibleLeafColumns()
    .filter((column) => column.id !== "select" && column.id !== "actions")
    .length;
  const headerHeightClassName =
    density === "comfortable" ? "!h-11" : "!h-9";
  const rowHeightClassName =
    density === "compact"
      ? "!h-[35px]"
      : density === "comfortable"
        ? "!h-[51px]"
        : "!h-[39px]";
  const contentHeightClassName =
    density === "compact"
      ? "!min-h-[35px]"
      : density === "comfortable"
        ? "!min-h-[51px]"
        : "!min-h-[39px]";

  const filterControl =
    filterFields.length > 0 ? (
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant={activeFilterCount > 0 ? "secondary" : "outline"}
              size="sm"
              className={cn(
                "h-8 min-h-8 rounded-lg bg-[var(--clair-color-atomic-common-100)] px-3 py-1.5 shadow-[var(--clair-shadow-xs)]",
                activeFilterCount > 0 &&
                  "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)] text-[var(--emr-text-primary)]",
              )}
              aria-label={
                activeFilterCount > 0
                  ? `${title} 필터 ${activeFilterCount}개 설정`
                  : `${title} 필터 설정`
              }
            />
          }
        >
          <CdsActionsListFilterIcon aria-hidden="true" />
          필터{activeFilterCount > 0 ? ` ${activeFilterCount}` : ""}
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
    ) : null;

  const columnControl = (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className:
            "h-8 min-h-8 rounded-lg bg-[var(--clair-color-atomic-common-100)] px-3 py-1.5 shadow-[var(--clair-shadow-xs)]",
        })}
        aria-label={`${title} 컬럼 표시 설정`}
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
    <div
      className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#fcfcfc]"
      data-testid={testId}
    >
      <div
        aria-hidden="true"
        className="h-14 shrink-0"
        data-emr-content-top-slot="true"
      />
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

      <Table
        aria-label={`${title} 고객관리 테이블`}
        containerClassName="min-h-0 min-w-0 flex-1 overflow-auto bg-[var(--clair-color-atomic-common-100)]"
        density={density}
        layout="scroll"
        minWidth={minTableWidth}
        className="table-fixed"
      >
        <colgroup>
          {table.getVisibleLeafColumns().map((column) => {
            const width =
              column.id === "select"
                ? "44px"
                : column.id === "actions"
                  ? "52px"
                  : `calc((100% - 96px) / ${Math.max(dataColumnCount, 1)})`;
            return <col key={column.id} style={{ width }} />;
          })}
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-[#fafafa]">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              data-customer-table-header="true"
              className={cn(
                headerHeightClassName,
                "group/customer-header border-0 bg-[#fafafa] hover:bg-[#fafafa]",
              )}
            >
              {headerGroup.headers.map((header) => {
                if (header.column.id === "select") {
                  return (
                    <EmrTableSelectionHeaderCell
                      key={header.id}
                      aria-label={`${title} 선택`}
                      className={cn(
                        headerHeightClassName,
                        "w-11 !p-0 !pl-5 !pr-2 [&_.emr-table-cell-content]:!p-0",
                        density === "comfortable"
                          ? "[&_.emr-table-cell-content]:!h-11"
                          : "[&_.emr-table-cell-content]:!h-9",
                      )}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </EmrTableSelectionHeaderCell>
                  );
                }

                if (header.column.id === "actions") {
                  return (
                    <EmrTableHeaderCell
                      key={header.id}
                      aria-label={`${title} 행 작업`}
                      className={cn(
                        headerHeightClassName,
                        "w-[52px] !p-0 !pl-2 !pr-5 [&_.emr-table-cell-content]:!p-0",
                        density === "comfortable"
                          ? "[&_.emr-table-cell-content]:!h-11"
                          : "[&_.emr-table-cell-content]:!h-9",
                      )}
                      interaction="static"
                      resize="none"
                    >
                      <span className="sr-only">행 작업</span>
                    </EmrTableHeaderCell>
                  );
                }

                const meta = getColumnMeta(header.column.columnDef);
                const sortDirection = header.column.getIsSorted();
                const label = meta?.label ?? header.column.id;
                const canSort = header.column.getCanSort();

                return (
                  <EmrTableHeaderCell
                    key={header.id}
                    aria-sort={getAriaSort(sortDirection)}
                    className={cn(
                      headerHeightClassName,
                      "!p-0 text-left [&_.emr-table-cell-content]:!p-0",
                      density === "comfortable"
                        ? "[&_.emr-table-cell-content]:!h-11"
                        : "[&_.emr-table-cell-content]:!h-9",
                      meta?.headerClassName,
                    )}
                    interaction="static"
                    resize="none"
                  >
                    <CustomerDataTableColumnHeader
                      label={label}
                      canSort={canSort}
                      sortDirection={sortDirection}
                      ariaLabel={
                        canSort
                          ? getSortAriaLabel(label, sortDirection)
                          : `${label} 정렬은 현재 지원하지 않습니다`
                      }
                      onToggleSort={() => {
                        if (!sortDirection) {
                          header.column.toggleSorting(false);
                        } else if (sortDirection === "asc") {
                          header.column.toggleSorting(true);
                        } else {
                          header.column.clearSorting();
                        }
                      }}
                    />
                  </EmrTableHeaderCell>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {initialLoading ? (
            <CustomerTableSkeletonRows
              colSpan={dataColumnCount + 2}
              density={density}
              rowCount={6}
              testId={`${testId}-skeleton-row`}
              visibleColumnCount={dataColumnCount}
            />
          ) : visibleRows.length ? (
            visibleRows.map((row) => {
              const active = isActiveRow(row.original);
              const selected = row.getIsSelected();

              return (
                <TableRow
                  key={row.id}
                  data-customer-table-row="true"
                  data-testid={rowTestId(row.original)}
                  data-state={selected || active ? "selected" : undefined}
                  className={cn(
                    rowHeightClassName,
                    "group/customer-row cursor-pointer border-[var(--clair-color-atomic-neutral-200)] bg-[var(--clair-color-atomic-common-100)] text-foreground hover:!bg-[var(--clair-color-atomic-black-alpha-4)]",
                    active &&
                      "bg-[var(--emr-state-selected)] hover:!bg-[var(--emr-state-selected)]",
                  )}
                  onClick={() => onOpenRow(row.original)}
                >
                  {row.getVisibleCells().map((cell) => {
                    if (cell.column.id === "select") {
                      return (
                        <EmrTableSelectionCell
                          key={cell.id}
                          className={cn(
                            rowHeightClassName,
                            "w-11 !p-0 !pl-5 !pr-2 [&_.emr-table-cell-content]:!p-0",
                            density === "compact"
                              ? "[&_.emr-table-cell-content]:!min-h-[35px]"
                              : density === "comfortable"
                                ? "[&_.emr-table-cell-content]:!min-h-[51px]"
                                : "[&_.emr-table-cell-content]:!min-h-[39px]",
                          )}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </EmrTableSelectionCell>
                      );
                    }

                    if (cell.column.id === "actions") {
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            rowHeightClassName,
                            "w-[52px] !p-0 !pl-2 !pr-5",
                          )}
                        >
                          <div
                            className={cn(
                              contentHeightClassName,
                              "flex items-center justify-end",
                            )}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </div>
                        </TableCell>
                      );
                    }

                    const meta = getColumnMeta(cell.column.columnDef);
                    const content = cell.column.columnDef.cell
                      ? flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )
                      : (cell.getValue() as ReactNode);

                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(rowHeightClassName, "!p-0")}
                      >
                        <CustomerTableCellContent
                          align={meta?.align}
                          className={cn(
                            contentHeightClassName,
                            meta?.className,
                          )}
                          rich={meta?.cellKind === "rich"}
                          textMode={meta?.textMode}
                        >
                          {content}
                        </CustomerTableCellContent>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          ) : readStatus === "error" ? (
            <TableRow className="h-full hover:bg-transparent">
              <TableCell
                colSpan={dataColumnCount + 2}
                className="h-full min-h-36"
              >
                <div className="flex justify-center px-4 py-6">
                  <EmrInlineAlert
                    severity="warning"
                    title={`${title} 정보를 불러오지 못했습니다`}
                    className="max-w-[360px] emr-text-metadata"
                    testId={`${testId}-read-error`}
                  >
                    잠시 후 다시 진입하면 최신 고객 정보를 다시 확인할 수 있습니다.
                  </EmrInlineAlert>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            <TableRow className="h-full hover:bg-transparent">
              <TableCell
                colSpan={dataColumnCount + 2}
                className="h-full min-h-36"
              >
                <div className="flex justify-center px-4 py-6">
                  <EmrEmptyState
                    kind={emptyStateKind}
                    priority={emptyStatePriority}
                    surface="table"
                    size="md"
                    title={emptyStateTitle}
                    description={emptyStateDescription}
                  />
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <CustomerDataTableFooter
        loading={initialLoading}
        totalCount={visibleRows.length}
      />

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
    </div>
  );
}
