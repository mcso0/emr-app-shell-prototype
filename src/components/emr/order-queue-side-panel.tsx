"use client";

import { useMemo, useState } from "react";
import { ClockIcon } from "@/components/icons";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  EmrDateNavigator,
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import {
  EmrSidePanelCard,
  EmrSidePanelCardAction,
  EmrSidePanelMetaBadge,
  EmrSidePanelTypeBadge,
} from "@/components/emr/side-panel-card";
import { EmrSidePanelCollapsibleGroup } from "@/components/emr/side-panel-collapsible-group";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type {
  OrderQueueItem,
  OrderQueueStatusDefinition,
} from "@/types/emr";

type OrderQueueFilterItem = {
  label: string;
  value: string;
};

type EmrOrderQueueSidePanelProps = {
  items: OrderQueueItem[];
  statuses: OrderQueueStatusDefinition[];
  title: string;
  className?: string;
  dateLabel?: string;
  filterAriaLabel?: string;
  filterItems?: OrderQueueFilterItem[];
  getFilterValue?: (item: OrderQueueItem) => string;
  listLabel?: string;
  onCollapse?: () => void;
  onSelectItem?: (itemId: string) => void;
  selectedItemId?: string;
  todayLabel?: string;
};

const orderQueueFilterItems = [
  { value: "all" as const, label: "전체" },
  { value: "dispensing" as const, label: "조제" },
  { value: "treatment" as const, label: "처치" },
];

const fallbackStatusColorToken = "--clair-color-atomic-gray-400";

const createFallbackStatus = (statusId: string, index: number): OrderQueueStatusDefinition => ({
  id: statusId,
  label: statusId,
  colorToken: fallbackStatusColorToken,
  sortOrder: 1000 + index,
});

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

function getStatusLabel(
  statusId: string,
  statuses: OrderQueueStatusDefinition[]
) {
  return statuses.find((status) => status.id === statusId)?.label ?? statusId;
}

export function EmrOrderQueueSidePanel({
  className,
  dateLabel = "26.04.29 (수)",
  filterAriaLabel = "오더 유형 필터",
  filterItems = orderQueueFilterItems,
  getFilterValue = (item) => item.orderTypeCategory,
  items,
  listLabel = "전체 오더",
  onCollapse,
  onSelectItem,
  selectedItemId,
  statuses,
  title,
  todayLabel = "오늘",
}: EmrOrderQueueSidePanelProps) {
  const [collapsedStatusIds, setCollapsedStatusIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<string>("all");
  const resolvedStatuses = useMemo(() => getResolvedStatuses(statuses, items), [items, statuses]);
  const visibleItems = useMemo(
    () => (filter === "all" ? items : items.filter((item) => getFilterValue(item) === filter)),
    [filter, getFilterValue, items]
  );
  const effectiveSelectedItemId = selectedItemId ?? visibleItems[0]?.id;
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
      <EmrDateNavigator dateLabel={dateLabel} todayLabel={todayLabel} />
      <EmrListHeader
        label={listLabel}
        count={visibleItems.length}
        headerActions={
          <>
            <EmrListHeaderIconButton ariaLabel="정렬">
              <CdsUtilitiesSortIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="필터">
              <CdsActionsListFilterIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="검색">
              <CdsActionsSearchIcon className="size-4" />
            </EmrListHeaderIconButton>
          </>
        }
      />
      <EmrSubpanelBody>
        {groupedItems.map(({ items: groupItems, status }) => {
          const collapsed = collapsedStatusIds.has(status.id);

          return (
            <OrderQueueGroup
              key={status.id}
              collapsed={collapsed}
              items={groupItems}
              onSelectItem={onSelectItem}
              onToggle={() => toggleStatus(status.id)}
              selectedItemId={effectiveSelectedItemId}
              status={status}
              statuses={resolvedStatuses}
            />
          );
        })}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

function OrderQueueGroup({
  collapsed,
  items,
  onSelectItem,
  onToggle,
  selectedItemId,
  status,
  statuses,
}: {
  collapsed: boolean;
  items: OrderQueueItem[];
  onSelectItem?: (itemId: string) => void;
  onToggle: () => void;
  selectedItemId?: string;
  status: OrderQueueStatusDefinition;
  statuses: OrderQueueStatusDefinition[];
}) {
  return (
    <EmrSidePanelCollapsibleGroup
      collapsed={collapsed}
      count={items.length}
      dataTestId={`order-queue-status-${status.id}`}
      indicatorColorToken={status.colorToken}
      label={status.label}
      onToggle={onToggle}
    >
      {items.map((item) => (
        <OrderQueueCard
          key={item.id}
          item={item}
          onSelect={() => onSelectItem?.(item.id)}
          selected={selectedItemId === item.id}
          statusLabel={getStatusLabel(item.statusId, statuses)}
        />
      ))}
    </EmrSidePanelCollapsibleGroup>
  );
}

function OrderQueueCard({
  item,
  onSelect,
  selected,
  statusLabel,
}: {
  item: OrderQueueItem;
  onSelect: () => void;
  selected: boolean;
  statusLabel: string;
}) {
  return (
    <EmrSidePanelCard
      selected={selected}
      testId={`order-queue-item-${item.id}`}
      onSelect={onSelect}
    >
      <div className="flex min-h-6 items-center gap-1.5 overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-gray-700)]">
          <span className="truncate">{item.patientName}</span>
          <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">·</span>
          <span className="truncate">{item.guardianName}</span>
          <EmrSidePanelTypeBadge label={item.receptionType} />
        </div>
        <EmrSidePanelCardAction
          ariaLabel={`${item.patientName} ${item.orderName} 더보기`}
          testId={`order-queue-item-action-${item.id}`}
        />
      </div>
      <div className="mt-0.5 flex h-[18px] min-w-0 items-center gap-1 text-[13px] font-medium leading-[18px] tracking-[0.247px] text-[var(--clair-color-atomic-gray-500)]">
        <span className="shrink-0 truncate">{item.orderType}</span>
        <span className="shrink-0 text-[var(--clair-color-atomic-gray-400)]">·</span>
        <span className="min-w-0 flex-1 truncate">{item.orderName}</span>
      </div>
      <div className="my-1.5 h-px w-full bg-[var(--clair-color-line-subtle)]" />
      <div className="flex h-5 min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <EmrSidePanelMetaBadge label="요청" value={item.requesterName} />
          {item.assigneeName ? <EmrSidePanelMetaBadge label="담당" value={item.assigneeName} /> : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-500)]">
          <ClockIcon className="size-3.5 text-[var(--clair-color-atomic-gray-400)]" aria-hidden="true" />
          <span>{item.time}</span>
          <span>{statusLabel}</span>
        </span>
      </div>
    </EmrSidePanelCard>
  );
}
