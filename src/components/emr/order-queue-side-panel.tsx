"use client";

import { useCallback, useMemo, useState } from "react";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import type { EmrRowActionMenuItem } from "@/components/emr/row-action-menu";
import {
  EmrDateNavigator,
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrQueueEmptyState,
  EmrListSearchEmptyState,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import { EmrSidePanelCollapsibleGroup } from "@/components/emr/side-panel-collapsible-group";
import {
  getEmrSidePanelStatusIconState,
  getEmrSidePanelStatusTitle,
} from "@/components/emr/side-panel-status-title";
import {
  EmrTaskQueueCard,
  getTaskQueueEventKindFromStatus,
  type EmrTaskQueueCardItem,
} from "@/components/emr/task-queue-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  addDaysToIsoDate,
  formatKoreanOperatingDateLabel,
} from "@/lib/emr-domain/demo-date";
import type {
  OrderQueueItem,
  OrderQueueStatusDefinition,
} from "@/types/emr";

type OrderQueueFilterItem = {
  label: string;
  value: string;
};

type OrderQueueDetailFilter = "all" | "unassigned" | `status:${string}`;
type OrderQueueSortKey = "request" | "assignee" | "wait";
type OrderQueueActionContext = "chart" | "order";

type EmrOrderQueueSidePanelProps = {
  items: OrderQueueItem[];
  statuses: OrderQueueStatusDefinition[];
  title: string;
  className?: string;
  dateLabel?: string;
  emptyObjectLabel?: string;
  filterAriaLabel?: string;
  filterItems?: OrderQueueFilterItem[];
  getFilterValue?: (item: OrderQueueItem) => string;
  getTaskCardItem?: (item: OrderQueueItem) => EmrTaskQueueCardItem;
  listLabel?: string;
  onCollapse?: () => void;
  onDateChange?: (date: string) => void;
  onSelectItem?: (itemId: string) => void;
  selectedItemId?: string;
  selectedDate?: string;
  sourceTotalCount?: number;
  todayLabel?: string;
  todayDate?: string;
};

const orderQueueFilterItems = [
  { value: "all" as const, label: "전체" },
  { value: "dispensing" as const, label: "조제" },
  { value: "treatment" as const, label: "처치" },
];

const orderQueueSortLabels: Record<OrderQueueSortKey, string> = {
  assignee: "담당자순",
  request: "요청순",
  wait: "대기 긴 순",
};

const fallbackStatusColorToken = "--emr-status-neutral-text";

const normalizeQueueSearchText = (value: string) => value.toLocaleLowerCase("ko").trim();

function getQueueSearchTokens(query: string) {
  return normalizeQueueSearchText(query).split(/\s+/).filter(Boolean);
}

function matchesQueueSearch(searchText: string, query: string) {
  const tokens = getQueueSearchTokens(query);
  if (!tokens.length) return true;

  const normalizedSearchText = normalizeQueueSearchText(searchText);
  return tokens.every((token) => normalizedSearchText.includes(token));
}

function getOrderQueueSearchText(
  item: OrderQueueItem,
  statuses: OrderQueueStatusDefinition[]
) {
  const statusLabel = statuses.find((status) => status.id === item.statusId)?.label ?? item.statusId;

  return [
    item.patientName,
    item.guardianName,
    item.receptionType,
    item.orderType,
    item.orderTypeCategory,
    item.orderName,
    item.requesterName,
    item.assigneeName,
    item.time,
    item.statusId,
    statusLabel,
    item.waitMinutes?.toString(),
  ]
    .filter(Boolean)
    .join(" ");
}

const createFallbackStatus = (statusId: string, index: number): OrderQueueStatusDefinition => ({
  id: statusId,
  label: statusId,
  colorToken: fallbackStatusColorToken,
  sortOrder: 1000 + index,
});

function getDefaultTaskCardItem(item: OrderQueueItem): EmrTaskQueueCardItem {
  return {
    actionAriaLabel: `${item.patientName} ${item.orderName} 더보기`,
    actionTestId: `order-queue-item-action-${item.id}`,
    assigneeName: item.assigneeName,
    eventActorName: item.requesterName,
    eventKind: getTaskQueueEventKindFromStatus(item.statusId),
    eventTime: item.time,
    guardianName: item.guardianName,
    patientName: item.patientName,
    receptionType: item.receptionType,
    secondLineBadgeLabel: item.orderType,
    secondLineText: item.orderName,
    testId: `order-queue-item-${item.id}`,
  };
}

function getResolvedStatuses(
  statuses: OrderQueueStatusDefinition[],
  items: OrderQueueItem[]
) {
  const statusMap = new Map(statuses.map((status) => [status.id, status]));
  const fallbackStatuses = items
    .map((item) => item.statusId)
    .filter((statusId, index, statusIds) => !statusMap.has(statusId) && statusIds.indexOf(statusId) === index)
    .map(createFallbackStatus);

  return [...statuses, ...fallbackStatuses].sort((a, b) => a.sortOrder - b.sortOrder);
}

function matchesDetailFilter(item: OrderQueueItem, filter: OrderQueueDetailFilter) {
  if (filter === "all") return true;
  if (filter === "unassigned") return !item.assigneeName;

  return item.statusId === filter.replace("status:", "");
}

function compareOrderQueueItems(a: OrderQueueItem, b: OrderQueueItem, sortKey: OrderQueueSortKey) {
  if (sortKey === "assignee") {
    return (a.assigneeName ?? "zzzz").localeCompare(b.assigneeName ?? "zzzz", "ko");
  }

  if (sortKey === "wait") {
    return (b.waitMinutes ?? 0) - (a.waitMinutes ?? 0);
  }

  return a.time.localeCompare(b.time, "ko");
}

export function EmrOrderQueueSidePanel({
  className,
  dateLabel = "26.04.29 (수)",
  emptyObjectLabel = "대기열 업무",
  filterAriaLabel = "오더 유형 필터",
  filterItems = orderQueueFilterItems,
  getFilterValue = (item) => item.orderTypeCategory,
  getTaskCardItem = getDefaultTaskCardItem,
  items,
  listLabel = "전체 오더",
  onCollapse,
  onDateChange,
  onSelectItem,
  selectedItemId,
  selectedDate,
  sourceTotalCount,
  statuses,
  title,
  todayDate,
  todayLabel = "오늘",
}: EmrOrderQueueSidePanelProps) {
  const [collapsedStatusIds, setCollapsedStatusIds] = useState<Set<string>>(() => new Set());
  const [detailFilter, setDetailFilter] = useState<OrderQueueDetailFilter>("all");
  const [filter, setFilter] = useState<string>("all");
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<OrderQueueSortKey>("request");
  const resolvedStatuses = useMemo(() => getResolvedStatuses(statuses, items), [items, statuses]);
  const actionContext: OrderQueueActionContext = listLabel.includes("진료") ? "chart" : "order";
  const scopedItems = useMemo(
    () =>
      (filter === "all" ? items : items.filter((item) => getFilterValue(item) === filter))
        .filter((item) => matchesDetailFilter(item, detailFilter)),
    [detailFilter, filter, getFilterValue, items]
  );
  const visibleItems = useMemo(
    () =>
      scopedItems
        .filter((item) => matchesQueueSearch(getOrderQueueSearchText(item, resolvedStatuses), searchQuery))
        .sort((a, b) => compareOrderQueueItems(a, b, sortKey)),
    [resolvedStatuses, scopedItems, searchQuery, sortKey]
  );
  const effectiveSelectedItemId = selectedItemId ?? visibleItems[0]?.id;
  const isToday = Boolean(selectedDate && todayDate && selectedDate === todayDate);
  const displayDateLabel = selectedDate ? formatKoreanOperatingDateLabel(selectedDate) : dateLabel;
  const emptyStateTitle = getOrderQueueEmptyStateTitle({
    emptyObjectLabel,
    filtered: (sourceTotalCount ?? items.length) > 0,
    selectedDate,
    todayDate,
  });
  const closeSearch = useCallback(() => {
    setSearchQuery("");
    setSearchActive(false);
  }, []);
  const handleDateChange = useCallback(
    (date: string) => {
      closeSearch();
      onDateChange?.(date);
    },
    [closeSearch, onDateChange],
  );
  const groupedItems = resolvedStatuses
    .map((status) => ({
      status,
      items: visibleItems.filter((item) => item.statusId === status.id),
    }))
    .filter((group) => group.items.length > 0);
  const toggleStatus = (statusId: string) => {
    setCollapsedStatusIds((current) => {
      const next = new Set(current);

      if (next.has(statusId)) {
        next.delete(statusId);
      } else {
        next.add(statusId);
      }

      return next;
    });
  };

  return (
    <EmrSubpanel className={className}>
      <EmrSubpanelTitle
        title={<span data-testid="module-side-panel-title">{title}</span>}
        onCollapse={onCollapse}
        tabs={
          <SegmentedControl
            aria-label={filterAriaLabel}
            className="shrink-0"
            items={filterItems}
            value={filter}
            variant="tabs"
            onValueChange={setFilter}
          />
        }
      />
      <EmrDateNavigator
        dateLabel={displayDateLabel}
        nextLabel="다음 날짜"
        previousLabel="이전 날짜"
        selectedDate={selectedDate}
        todayDate={todayDate}
        todayLabel={isToday ? todayLabel : undefined}
        onDateChange={onDateChange ? handleDateChange : undefined}
        onNext={
          selectedDate && onDateChange
            ? () => handleDateChange(addDaysToIsoDate(selectedDate, 1))
            : undefined
        }
        onPrevious={
          selectedDate && onDateChange
            ? () => handleDateChange(addDaysToIsoDate(selectedDate, -1))
            : undefined
        }
      />
      <EmrListHeader
        label={listLabel}
        count={visibleItems.length}
        search={{
          active: searchActive,
          closeLabel: "대기열 검색 닫기",
          inputLabel: `${listLabel} 검색`,
          onClose: closeSearch,
          onQueryChange: setSearchQuery,
          placeholder: "환자, 보호자, 오더, 담당자 검색",
          query: searchQuery,
          resultCount: visibleItems.length,
        }}
        headerActions={
          <>
            <OrderQueueSortMenu sortKey={sortKey} onSortKeyChange={setSortKey} />
            <OrderQueueFilterMenu
              filter={detailFilter}
              statuses={resolvedStatuses}
              onFilterChange={setDetailFilter}
            />
            <EmrListHeaderIconButton
              ariaLabel="대기열 검색 열기"
              data-testid="order-queue-search-control"
              onClick={() => setSearchActive(true)}
            >
              <CdsActionsSearchIcon className="size-4" />
            </EmrListHeaderIconButton>
          </>
        }
      />
      <EmrSubpanelBody>
        {groupedItems.length > 0 ? groupedItems.map(({ items: groupItems, status }) => {
          const collapsed = collapsedStatusIds.has(status.id);

          return (
            <OrderQueueGroup
              key={status.id}
              collapsed={collapsed}
              getTaskCardItem={getTaskCardItem}
              actionContext={actionContext}
              items={groupItems}
              onSelectItem={onSelectItem}
              onToggle={() => toggleStatus(status.id)}
              selectedItemId={effectiveSelectedItemId}
              status={status}
            />
          );
        }) : searchQuery.trim() ? (
          <EmrListSearchEmptyState
            objectLabel="대기열 항목"
            query={searchQuery}
            onClear={() => setSearchQuery("")}
          />
        ) : (
          <EmrQueueEmptyState title={emptyStateTitle} />
        )}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

function getOrderQueueEmptyStateTitle({
  emptyObjectLabel,
  filtered,
  selectedDate,
  todayDate,
}: {
  emptyObjectLabel: string;
  filtered: boolean;
  selectedDate?: string;
  todayDate?: string;
}) {
  if (filtered) return `조건에 맞는 ${emptyObjectLabel}가 없습니다.`;

  const scopePrefix =
    selectedDate && todayDate && selectedDate !== todayDate
      ? "선택한 날짜의"
      : "오늘";

  return `${scopePrefix} ${emptyObjectLabel}가 없습니다.`;
}

function OrderQueueSortMenu({
  onSortKeyChange,
  sortKey,
}: {
  onSortKeyChange: (value: OrderQueueSortKey) => void;
  sortKey: OrderQueueSortKey;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <EmrListHeaderIconButton
            ariaLabel="대기열 정렬"
            data-sort-key={sortKey}
            data-testid="order-queue-sort-control"
          >
            <CdsUtilitiesSortIcon aria-hidden="true" className="size-4" />
          </EmrListHeaderIconButton>
        }
      />
      <DropdownMenuContent align="end" className="w-36">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">정렬</div>
        <DropdownMenuRadioGroup value={sortKey} onValueChange={(value) => onSortKeyChange(value as OrderQueueSortKey)}>
          {(Object.keys(orderQueueSortLabels) as OrderQueueSortKey[]).map((key) => (
            <DropdownMenuRadioItem key={key} value={key}>
              {orderQueueSortLabels[key]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OrderQueueFilterMenu({
  filter,
  onFilterChange,
  statuses,
}: {
  filter: OrderQueueDetailFilter;
  onFilterChange: (value: OrderQueueDetailFilter) => void;
  statuses: OrderQueueStatusDefinition[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <EmrListHeaderIconButton
            ariaLabel="대기열 필터"
            data-filter={filter}
            data-testid="order-queue-filter-control"
          />
        }
      >
        <CdsActionsListFilterIcon aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">필터</div>
        <DropdownMenuRadioGroup value={filter} onValueChange={(value) => onFilterChange(value as OrderQueueDetailFilter)}>
          <DropdownMenuRadioItem value="all">전체 조건</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="unassigned">담당 미정</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {statuses.map((status) => (
            <DropdownMenuRadioItem key={status.id} value={`status:${status.id}`}>
              {status.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function OrderQueueGroup({
  actionContext,
  collapsed,
  getTaskCardItem,
  items,
  onSelectItem,
  onToggle,
  selectedItemId,
  status,
}: {
  actionContext: OrderQueueActionContext;
  collapsed: boolean;
  getTaskCardItem: (item: OrderQueueItem) => EmrTaskQueueCardItem;
  items: OrderQueueItem[];
  onSelectItem?: (itemId: string) => void;
  onToggle: () => void;
  selectedItemId?: string;
  status: OrderQueueStatusDefinition;
}) {
  const groupTitle = getEmrSidePanelStatusTitle({ id: status.id, label: status.label });
  const groupIconState = getEmrSidePanelStatusIconState({
    colorToken: status.colorToken,
    id: status.id,
    label: status.label,
  });

  return (
    <EmrSidePanelCollapsibleGroup
      collapsed={collapsed}
      count={items.length}
      countBadgeColorToken={status.colorToken}
      dataTestId={`order-queue-status-${status.id}`}
      indicatorColorToken={status.colorToken}
      indicatorVisible={false}
      label={groupTitle}
      onToggle={onToggle}
      stateIconState={groupIconState}
    >
      {items.map((item) => (
        <OrderQueueCard
          key={item.id}
          actionContext={actionContext}
          item={item}
          onSelect={() => onSelectItem?.(item.id)}
          selected={selectedItemId === item.id}
          taskCardItem={getTaskCardItem(item)}
        />
      ))}
    </EmrSidePanelCollapsibleGroup>
  );
}

function OrderQueueCard({
  actionContext,
  item,
  onSelect,
  selected,
  taskCardItem,
}: {
  actionContext: OrderQueueActionContext;
  item: OrderQueueItem;
  onSelect: () => void;
  selected: boolean;
  taskCardItem: EmrTaskQueueCardItem;
}) {
  const actionItems = getOrderQueueActionItems(item, onSelect, actionContext);

  return (
    <EmrTaskQueueCard
      item={{
        ...taskCardItem,
        actionItems,
      }}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

function getOrderQueueActionItems(
  item: OrderQueueItem,
  onSelect: () => void,
  context: OrderQueueActionContext
): EmrRowActionMenuItem[] {
  const primaryLabel = context === "chart"
    ? "차트 열기"
    : item.orderTypeCategory === "treatment"
      ? "지시서 열기"
      : "오더 열기";
  const completed = item.statusId === "completed" || item.statusId === "canceled";

  return [
    {
      key: "open",
      label: primaryLabel,
      description: `${item.orderName} 선택`,
      onSelect,
      testId: `order-queue-action-open-${item.id}`,
    },
    {
      key: "assign",
      label: item.assigneeName ? "담당자 보기" : "담당하기",
      description: item.assigneeName ?? "현재 사용자 배정은 후속 액션 매트릭스에서 확정",
      disabled: completed,
      onSelect,
      testId: `order-queue-action-assign-${item.id}`,
    },
    {
      key: "patient",
      label: "환자 정보",
      description: `${item.patientName} 정보 drawer 연결 예정`,
      disabled: true,
      testId: `order-queue-action-patient-${item.id}`,
    },
    {
      key: "guardian",
      label: "보호자 정보",
      description: `${item.guardianName} 정보 drawer 연결 예정`,
      disabled: true,
      testId: `order-queue-action-guardian-${item.id}`,
    },
  ];
}
