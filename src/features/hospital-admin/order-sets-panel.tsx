"use client";

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CdsActionsCopyIcon } from "@/components/cds-icons/actions-and-controls";
import { EmrDataTable } from "@/components/emr/emr-data-table";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
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
import { EmrTableFilterTrigger } from "@/components/emr/table-filter-trigger";
import {
  EmrPinnedTableWorkspace,
  EmrTableCellText,
  EmrTableFeedbackSurface,
  EmrTableIdentityCellContent,
} from "@/components/emr/table-primitives";
import { EmrTableWorkspaceHeader } from "@/components/emr/table-workspace-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { ChevronDownIcon, SlidersIcon } from "@/components/icons";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import type { AuthSession } from "@/features/auth/auth-client";
import { OrderSetDrawer, type OrderSetDrawerTarget } from "@/features/hospital-admin/order-set-drawer";
import {
  duplicateOrderSetDefinition,
  filterOrderSetSummaries,
  formatOrderSetAmount,
  formatOrderSetSpecies,
  orderSetAmountBasisLabels,
  orderSetAvailabilityLabels,
  orderSetSpeciesLabels,
  type OrderSetAmountFilter,
  type OrderSetSpeciesFilter,
  type OrderSetStatusFilter,
} from "@/features/hospital-admin/order-set-management";
import type {
  OrderCatalogItem,
  OrderSetDetail,
  OrderSetSummary,
} from "@/features/hospital-admin/server-order-catalog";
import type { EmrTableDensity } from "@/components/emr/table-density";
import { cn } from "@/lib/utils";

const selectionColumnWidth = 44;
const identityColumnWidth = 250;

type ReadStatus = "loading" | "ready" | "denied" | "error";

export function OrderSetsPanel({
  session,
  workspaceId,
}: {
  session: AuthSession | null;
  workspaceId: string;
}) {
  const [summaries, setSummaries] = useState<OrderSetSummary[]>([]);
  const [catalog, setCatalog] = useState<OrderCatalogItem[]>([]);
  const [readStatus, setReadStatus] = useState<ReadStatus>("loading");
  const [retryKey, setRetryKey] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderSetStatusFilter>("active");
  const [amountFilter, setAmountFilter] = useState<OrderSetAmountFilter>("all");
  const [speciesFilter, setSpeciesFilter] = useState<OrderSetSpeciesFilter>("all");
  const [density, setDensity] = useState<EmrTableDensity>("standard");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [focusedOrderSetId, setFocusedOrderSetId] = useState<string | null>(null);
  const [drawerTarget, setDrawerTarget] = useState<OrderSetDrawerTarget | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterReady, setFilterReady] = useState(false);
  const [filterAutoOpenConsumed, setFilterAutoOpenConsumed] = useState(false);
  const [filterModel, setFilterModel] = useState(() =>
    createInitialEmrTableFilterBuilderModel("order-set-filter"),
  );

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setReadStatus("loading");
    try {
      const headers = getDemoActorHeaders(session);
      const [setsResponse, catalogResponse] = await Promise.all([
        fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-sets`, { headers, signal }),
        fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-catalog`, { headers, signal }),
      ]);
      const setsBody = (await setsResponse.json()) as { summaries?: OrderSetSummary[] };
      const catalogBody = (await catalogResponse.json()) as { items?: OrderCatalogItem[] };
      if (setsResponse.status === 401 || setsResponse.status === 403) {
        setReadStatus("denied");
        return;
      }
      if (!setsResponse.ok || !Array.isArray(setsBody.summaries)) throw new Error("order_set_read_failed");
      setSummaries(setsBody.summaries);
      setCatalog(catalogResponse.ok && Array.isArray(catalogBody.items) ? catalogBody.items : []);
      setReadStatus("ready");
    } catch (error: unknown) {
      if ((error as { name?: string }).name !== "AbortError") setReadStatus("error");
    }
  }, [session, workspaceId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, retryKey]);

  const filterFields = useMemo<Array<EmrTableFilterBuilderField<OrderSetSummary>>>(
    () => [
      { id: "setName", label: "Order 세트명", getValue: (summary) => summary.setName, valueKind: "text", valuePlaceholder: "세트명 입력" },
      { id: "billingName", label: "청구서명", getValue: (summary) => summary.billingName, valueKind: "text", valuePlaceholder: "청구서명 입력" },
      {
        id: "review",
        label: "검토 상태",
        getValue: (summary) => summary.needsCompositionReview || summary.pendingReviewCount > 0 ? "required" : "clear",
        options: [{ value: "required", label: "검토 필요" }, { value: "clear", label: "검토 없음" }],
      },
    ],
    [],
  );

  const baseRows = useMemo(
    () => filterOrderSetSummaries({ summaries, query, status: statusFilter, amountBasis: amountFilter, species: speciesFilter }),
    [amountFilter, query, speciesFilter, statusFilter, summaries],
  );
  const visibleRows = useMemo(
    () => filterRowsByEmrTableFilterBuilder(baseRows, filterModel, filterFields),
    [baseRows, filterFields, filterModel],
  );
  const activeFilterCount = getEmrTableFilterBuilderActiveCount(filterModel, filterFields);
  const selectedIds = useMemo(() => Object.keys(rowSelection).filter((id) => rowSelection[id]), [rowSelection]);

  const openCreate = () => {
    setFocusedOrderSetId(null);
    setDrawerTarget({ kind: "create" });
    setDrawerOpen(true);
  };

  const openEdit = useCallback((summary: OrderSetSummary) => {
    setFocusedOrderSetId(summary.orderSetId);
    setDrawerTarget({ kind: "edit", orderSetId: summary.orderSetId });
    setDrawerOpen(true);
  }, []);

  const openDuplicate = useCallback(async (summary: OrderSetSummary) => {
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-sets/${encodeURIComponent(summary.orderSetId)}`,
        { headers: getDemoActorHeaders(session) },
      );
      const body = (await response.json()) as { orderSet?: OrderSetDetail };
      if (!response.ok || !body.orderSet) throw new Error("order_set_duplicate_read_failed");
      setStatusFilter("all");
      setRowSelection({});
      setFocusedOrderSetId(null);
      setDrawerTarget({ kind: "create", initialDefinition: duplicateOrderSetDefinition(body.orderSet) });
      setDrawerOpen(true);
    } catch {
      toast.error("복제할 revision을 불러오지 못했습니다.");
    }
  }, [session, workspaceId]);

  const columns = useMemo<Array<ColumnDef<OrderSetSummary, unknown>>>(
    () => [
      {
        id: "select",
        enableHiding: false,
        enableSorting: false,
        size: selectionColumnWidth,
        meta: { label: "Order 세트 선택", role: "selection" },
        header: ({ table }) => (
          <span data-row-interactive="true" className="inline-flex size-6 items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <EmrTableCheckbox aria-label="보이는 Order 세트 전체 선택" checked={table.getIsAllRowsSelected()} indeterminate={table.getIsSomeRowsSelected()} onCheckedChange={(checked) => table.toggleAllRowsSelected(Boolean(checked))} />
          </span>
        ),
        cell: ({ row }) => (
          <span data-row-interactive="true" className="inline-flex size-6 items-center justify-center" onClick={(event) => event.stopPropagation()}>
            <EmrTableCheckbox aria-label={`${row.original.setName} 선택`} checked={row.getIsSelected()} onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))} />
          </span>
        ),
      },
      {
        accessorKey: "setName",
        id: "setName",
        size: identityColumnWidth,
        enableSorting: true,
        meta: { identity: true, label: "Order 세트명", resize: "data-column", role: "data", textMode: "one-line" },
        cell: ({ row }) => <EmrTableIdentityCellContent><EmrTableCellText fullText={row.original.setName}>{row.original.setName}</EmrTableCellText></EmrTableIdentityCellContent>,
      },
      { accessorKey: "billingName", id: "billingName", size: 190, enableSorting: true, meta: { label: "청구서명", resize: "data-column", role: "data", textMode: "one-line" } },
      {
        accessorKey: "availabilityStatus",
        id: "availabilityStatus",
        size: 100,
        enableSorting: true,
        meta: { label: "사용 여부", resize: "data-column", role: "data", textMode: "one-line" },
        cell: ({ row }) => <EmrTableCellText className={cn("font-semibold", row.original.availabilityStatus === "active" ? "text-[var(--emr-status-success-text)]" : "text-muted-foreground")}>{orderSetAvailabilityLabels[row.original.availabilityStatus]}</EmrTableCellText>,
      },
      {
        accessorKey: "amountBasis",
        id: "amountBasis",
        size: 132,
        enableSorting: true,
        meta: { label: "가격 방식", resize: "data-column", role: "data", textMode: "one-line" },
        cell: ({ row }) => orderSetAmountBasisLabels[row.original.amountBasis],
      },
      {
        id: "amount",
        accessorFn: formatOrderSetAmount,
        size: 120,
        enableSorting: false,
        meta: { align: "right", label: "표시 금액", resize: "data-column", role: "data", textMode: "one-line" },
        cell: ({ row }) => <EmrTableCellText className="font-semibold">{formatOrderSetAmount(row.original)}</EmrTableCellText>,
      },
      { id: "targetSpecies", accessorFn: (summary) => formatOrderSetSpecies(summary.targetSpecies), size: 150, enableSorting: false, meta: { grow: true, label: "대상", resize: "data-column", role: "data", textMode: "one-line" } },
      { accessorKey: "currentRevisionNo", id: "currentRevisionNo", size: 112, enableSorting: true, meta: { align: "right", label: "현재 revision", resize: "data-column", role: "data", textMode: "one-line" }, cell: ({ row }) => row.original.currentRevisionNo ?? "없음" },
      {
        id: "review",
        size: 126,
        enableSorting: false,
        meta: { label: "검토", resize: "data-column", role: "data", textMode: "one-line" },
        cell: ({ row }) => row.original.needsCompositionReview || row.original.pendingReviewCount > 0 ? <Badge variant="outline">구성 검토 필요</Badge> : "-",
      },
      {
        id: "actions",
        size: 52,
        enableHiding: false,
        enableResizing: false,
        enableSorting: false,
        meta: { actionVisibility: "contextual", align: "right", label: "", role: "actions" },
        cell: ({ row }) => <EmrRowActionMenu ariaLabel={`${row.original.setName} Order 세트 행 작업`} items={[
          { key: "detail", label: "상세 보기", description: "현재 revision 편집", onSelect: () => openEdit(row.original) },
          { key: "duplicate", label: "복제", description: "비활성 복사본 만들기", onSelect: () => void openDuplicate(row.original) },
        ]} testId={`order-set-action-${row.original.orderSetId}`} />,
      },
    ],
    [openDuplicate, openEdit],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: visibleRows,
    enableColumnPinning: true,
    enableMultiSort: false,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.orderSetId,
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    state: { columnPinning: { left: ["select", "setName"], right: [] }, columnVisibility, rowSelection, sorting },
  });

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setAmountFilter("all");
    setSpeciesFilter("all");
    setFilterModel(createInitialEmrTableFilterBuilderModel("order-set-filter"));
  };

  const handleSaved = async (orderSetId: string) => {
    setStatusFilter("all");
    setFocusedOrderSetId(orderSetId);
    setDrawerTarget({ kind: "edit", orderSetId });
    await loadData();
  };

  const hasFilters = Boolean(query.trim()) || statusFilter !== "all" || amountFilter !== "all" || speciesFilter !== "all" || activeFilterCount > 0;

  return (
    <>
      <EmrPinnedTableWorkspace className="flex h-full min-h-0 flex-col bg-[#fcfcfc]" data-testid="order-set-management" identityTextInset={48} selectionColumnWidth={selectionColumnWidth}>
        <EmrMainContentHeader aria-hidden="true" heightMode="adaptive" />
        <EmrTableWorkspaceHeader
          count={visibleRows.length}
          countLoading={readStatus === "loading"}
          countSkeletonTestId="order-set-header-count-skeleton"
          onSearchChange={setQuery}
          primaryAction={<Button size="sm" onClick={openCreate}>+ Order 세트</Button>}
          searchAriaLabel="Order 세트 검색"
          searchClearAriaLabel="Order 세트 검색어 초기화"
          searchPlaceholder="Order 세트 검색"
          searchValue={query}
          tableControls={<>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderSetStatusFilter)}>
              <SelectTrigger aria-label="Order 세트 사용 여부 필터" size="sm" className="w-[112px] bg-card">{statusFilter === "all" ? "사용 전체" : orderSetAvailabilityLabels[statusFilter]}</SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="all">사용 전체</SelectItem>{Object.entries(orderSetAvailabilityLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <Select value={amountFilter} onValueChange={(value) => setAmountFilter(value as OrderSetAmountFilter)}>
              <SelectTrigger aria-label="Order 세트 가격 방식 필터" size="sm" className="w-[132px] bg-card">{amountFilter === "all" ? "가격 전체" : orderSetAmountBasisLabels[amountFilter]}</SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="all">가격 전체</SelectItem>{Object.entries(orderSetAmountBasisLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <Select value={speciesFilter} onValueChange={(value) => setSpeciesFilter(value as OrderSetSpeciesFilter)}>
              <SelectTrigger aria-label="Order 세트 대상 동물 필터" size="sm" className="w-[112px] bg-card">{speciesFilter === "all" ? "대상 전체" : orderSetSpeciesLabels[speciesFilter]}</SelectTrigger>
              <SelectContent><SelectGroup><SelectItem value="all">대상 전체</SelectItem>{Object.entries(orderSetSpeciesLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
            <EmrTableDensitySelector value={density} onValueChange={setDensity} />
            <Popover open={filterOpen} onOpenChange={(open) => { setFilterOpen(open); if (!open) { setFilterReady(false); setFilterAutoOpenConsumed(false); } }} onOpenChangeComplete={setFilterReady}>
              <PopoverTrigger render={<EmrTableFilterTrigger activeCount={activeFilterCount} aria-label={activeFilterCount > 0 ? `Order 세트 필터 ${activeFilterCount}개 설정` : "Order 세트 필터 설정"} />} />
              <PopoverContent align="end" className="w-[min(640px,calc(100vw-32px))] gap-0 overflow-visible p-0" initialFocus={false}>
                <EmrTableFilterBuilder autoOpenFirstField={filterReady && !filterAutoOpenConsumed} clearAllLabel="초기화" description="Order 세트명, 청구서명, 검토 상태를 조합해 찾을 수 있습니다." fields={filterFields} model={filterModel} title="필터" onClose={() => setFilterOpen(false)} onModelChange={(model) => { setFilterAutoOpenConsumed(true); setFilterModel(model); }} />
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" className="h-8 min-h-8 rounded-lg bg-card px-3" aria-label="Order 세트 컬럼 표시 설정" />}>
                <SlidersIcon data-icon="inline-start" />컬럼<ChevronDownIcon data-icon="inline-end" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48"><DropdownMenuGroup><DropdownMenuLabel>표시 컬럼</DropdownMenuLabel>{table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => <DropdownMenuCheckboxItem key={column.id} checked={column.getIsVisible()} onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}>{column.columnDef.meta?.label ?? column.id}</DropdownMenuCheckboxItem>)}</DropdownMenuGroup></DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" disabled={selectedIds.length !== 1} onClick={() => { const summary = summaries.find((item) => item.orderSetId === selectedIds[0]); if (summary) void openDuplicate(summary); }}><CdsActionsCopyIcon data-icon="inline-start" />복제</Button>
          </>}
          testId="order-set-page-header"
          title="Order 세트"
        />

        {readStatus === "denied" ? (
          <EmrTableFeedbackSurface><EmrEmptyState kind="no-permission" priority="local-recovery" size="md" surface="table" title="Order 세트를 볼 권한이 없습니다" description="병원관리 Order 조회 권한이 있는 사용자에게 문의해 주세요." /></EmrTableFeedbackSurface>
        ) : readStatus === "error" ? (
          <EmrTableFeedbackSurface><EmrEmptyState kind="read-error" priority="local-recovery" size="md" surface="table" title="Order 세트를 불러오지 못했습니다" description="연결 상태를 확인한 뒤 다시 시도해 주세요." primaryAction={<Button size="sm" variant="outline" onClick={() => setRetryKey((current) => current + 1)}>다시 시도</Button>} /></EmrTableFeedbackSurface>
        ) : readStatus === "ready" && visibleRows.length === 0 ? (
          <EmrTableFeedbackSurface><EmrEmptyState
            kind={hasFilters ? "no-filter-results" : "no-data"}
            priority={hasFilters ? "local-recovery" : "primary-decision"}
            size="md"
            surface="table"
            title={hasFilters ? "조건에 맞는 Order 세트가 없습니다" : "등록된 Order 세트가 없습니다"}
            description={statusFilter === "active" && summaries.length > 0 ? "현재 사용 중인 세트가 없습니다. 전체 필터에서 기존 세트를 확인할 수 있습니다." : hasFilters ? "검색어나 필터를 바꾸면 Order 세트가 다시 표시됩니다." : "새 Order 세트를 만들어 진료 흐름을 구성해 주세요."}
            primaryAction={hasFilters ? <Button size="sm" variant="outline" onClick={resetFilters}>전체 보기</Button> : <Button size="sm" onClick={openCreate}>+ Order 세트</Button>}
          /></EmrTableFeedbackSurface>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden" data-testid="order-set-table">
            <EmrDataTable aria-label="병원관리 Order 세트 테이블" className="table-fixed" containerClassName="h-full min-h-0 overflow-auto" density={density} initialLoading={readStatus === "loading"} overscrollAxes="both" skeletonRowCount={6} table={table} getRowProps={(row) => ({
              "aria-current": focusedOrderSetId === row.original.orderSetId ? "true" : undefined,
              className: "cursor-pointer bg-card",
              "data-detail-active": focusedOrderSetId === row.original.orderSetId ? "true" : undefined,
              "data-state": focusedOrderSetId === row.original.orderSetId ? "selected" : undefined,
              "data-testid": `order-set-row-${row.original.orderSetId}`,
              onClick: () => openEdit(row.original),
            })} />
          </div>
        )}

        {readStatus === "ready" && selectedIds.length > 0 ? <div className="pointer-events-none sticky bottom-3 z-20 mt-[-52px] flex justify-center"><div className="pointer-events-auto flex h-10 items-center gap-3 rounded-lg border bg-card px-3 shadow-lg"><span className="text-xs font-medium text-muted-foreground">선택한 Order 세트 {selectedIds.length}개</span><Button size="sm" variant="outline" disabled={selectedIds.length !== 1} onClick={() => { const summary = summaries.find((item) => item.orderSetId === selectedIds[0]); if (summary) void openDuplicate(summary); }}>선택 복제</Button><Button size="sm" variant="ghost" onClick={() => setRowSelection({})}>선택 해제</Button></div></div> : null}
      </EmrPinnedTableWorkspace>

      <OrderSetDrawer catalog={catalog} open={drawerOpen} session={session} summaries={summaries} target={drawerTarget} workspaceId={workspaceId} onOpenChange={(open) => { setDrawerOpen(open); if (!open) setFocusedOrderSetId(null); }} onSaved={handleSaved} />
    </>
  );
}
