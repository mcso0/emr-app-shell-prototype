"use client";

import { useMemo, useState } from "react";
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
  getTaskCardItem?: (item: OrderQueueItem) => EmrTaskQueueCardItem;
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

const fallbackStatusColorToken = "--emr-status-neutral-text";

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

export function EmrOrderQueueSidePanel({
  className,
  dateLabel = "26.04.29 (수)",
  filterAriaLabel = "오더 유형 필터",
  filterItems = orderQueueFilterItems,
  getFilterValue = (item) => item.orderTypeCategory,
  getTaskCardItem = getDefaultTaskCardItem,
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
              getTaskCardItem={getTaskCardItem}
              items={groupItems}
              onSelectItem={onSelectItem}
              onToggle={() => toggleStatus(status.id)}
              selectedItemId={effectiveSelectedItemId}
              status={status}
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
  getTaskCardItem,
}: {
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
          onSelect={() => onSelectItem?.(item.id)}
          selected={selectedItemId === item.id}
          taskCardItem={getTaskCardItem(item)}
        />
      ))}
    </EmrSidePanelCollapsibleGroup>
  );
}

function OrderQueueCard({
  onSelect,
  selected,
  taskCardItem,
}: {
  onSelect: () => void;
  selected: boolean;
  taskCardItem: EmrTaskQueueCardItem;
}) {
  return (
    <EmrTaskQueueCard
      item={taskCardItem}
      selected={selected}
      onSelect={onSelect}
    />
  );
}
