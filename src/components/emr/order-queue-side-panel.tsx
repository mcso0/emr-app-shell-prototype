"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, ClockIcon } from "@/components/icons";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  EmrDateNavigator,
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";
import type {
  OrderQueueItem,
  OrderQueueStatusDefinition,
  OrderQueueType,
} from "@/types/emr";

type OrderQueueFilter = "all" | OrderQueueType;

type EmrOrderQueueSidePanelProps = {
  items: OrderQueueItem[];
  statuses: OrderQueueStatusDefinition[];
  title: string;
  className?: string;
  dateLabel?: string;
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
  items,
  onCollapse,
  onSelectItem,
  selectedItemId,
  statuses,
  title,
  todayLabel = "오늘",
}: EmrOrderQueueSidePanelProps) {
  const [collapsedStatusIds, setCollapsedStatusIds] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<OrderQueueFilter>("all");
  const resolvedStatuses = useMemo(() => getResolvedStatuses(statuses, items), [items, statuses]);
  const visibleItems = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.orderTypeCategory === filter)),
    [filter, items]
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
            aria-label="오더 유형 필터"
            className="shrink-0"
            items={orderQueueFilterItems}
            value={filter}
            variant="tabs"
            onValueChange={setFilter}
          />
        }
      />
      <EmrDateNavigator dateLabel={dateLabel} todayLabel={todayLabel} />
      <EmrListHeader
        label="전체 오더"
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
    <section className="flex flex-col gap-1" data-testid={`order-queue-status-${status.id}`}>
      <button
        type="button"
        className="flex h-8 w-full items-center gap-3 rounded-[var(--clair-radius-atomic-6)] p-1 text-left outline-none transition-colors hover:bg-[var(--clair-color-atomic-black-alpha-8)] focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-expanded={!collapsed}
        aria-label={`${status.label} ${collapsed ? "펼치기" : "접기"}`}
        onClick={onToggle}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="h-[18px] w-[3px] shrink-0 rounded-[var(--clair-border-width-atomic-1)]"
            style={{ backgroundColor: `var(${status.colorToken})` }}
            aria-hidden="true"
          />
          <span className="flex min-w-0 items-center gap-1.5 text-[14px] font-medium leading-5 tracking-[0.196px]">
            <span className="truncate text-[var(--clair-color-atomic-gray-600)]">
              {status.label}
            </span>
            <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">
              {items.length}
            </span>
          </span>
        </div>
        <span className="flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-sm p-1">
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--clair-motion-duration-normal)] ease-[var(--clair-motion-easing-standard)]",
              collapsed && "rotate-180"
            )}
            aria-hidden="true"
          />
        </span>
      </button>
      {collapsed ? null : (
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <OrderQueueCard
              key={item.id}
              item={item}
              onSelect={() => onSelectItem?.(item.id)}
              selected={selectedItemId === item.id}
              statusLabel={getStatusLabel(item.statusId, statuses)}
            />
          ))}
        </div>
      )}
    </section>
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
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group/order-queue-card w-full rounded-[var(--clair-radius-atomic-8)] border border-[var(--clair-color-atomic-gray-200)] bg-card px-3 pb-2.5 pt-2 text-left outline-none transition-colors hover:bg-[var(--clair-color-atomic-black-alpha-4)] focus-visible:ring-3 focus-visible:ring-ring/50",
        selected &&
          "border-[var(--clair-color-atomic-sky-300)] bg-[var(--clair-color-atomic-sky-50)]"
      )}
      data-testid={`order-queue-item-${item.id}`}
      data-selected={selected ? "true" : undefined}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex min-h-6 items-center gap-1.5 overflow-hidden">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-gray-700)]">
          <span className="truncate">{item.patientName}</span>
          <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">·</span>
          <span className="truncate">{item.guardianName}</span>
          <ReceptionTypeBadge label={item.receptionType} />
        </div>
        <OrderQueueCardAction item={item} />
      </div>
      <div className="mt-0.5 flex h-[18px] min-w-0 items-center gap-1 text-[13px] font-medium leading-[18px] tracking-[0.247px] text-[var(--clair-color-atomic-gray-500)]">
        <span className="shrink-0 truncate">{item.orderType}</span>
        <span className="shrink-0 text-[var(--clair-color-atomic-gray-400)]">·</span>
        <span className="min-w-0 flex-1 truncate">{item.orderName}</span>
      </div>
      <div className="my-1.5 h-px w-full bg-[var(--clair-color-line-subtle)]" />
      <div className="flex h-5 min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <QueueMetaBadge label="요청" value={item.requesterName} />
          {item.assigneeName ? <QueueMetaBadge label="담당" value={item.assigneeName} /> : null}
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-500)]">
          <ClockIcon className="size-3.5 text-[var(--clair-color-atomic-gray-400)]" aria-hidden="true" />
          <span>{item.time}</span>
          <span>{statusLabel}</span>
        </span>
      </div>
    </div>
  );
}

function OrderQueueCardAction({ item }: { item: OrderQueueItem }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-xs"
      className="size-6 shrink-0 rounded-[var(--clair-radius-sm)] bg-card p-0 text-[var(--clair-color-label-normal)] opacity-0 transition-opacity hover:bg-[var(--clair-color-background-surface)] focus-visible:opacity-100 group-hover/order-queue-card:opacity-100 group-focus-within/order-queue-card:opacity-100 group-data-[selected=true]/order-queue-card:opacity-100 [&_svg]:size-4"
      aria-label={`${item.patientName} ${item.orderName} 더보기`}
      data-testid={`order-queue-item-action-${item.id}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <CdsFilesMoreHorizontalIcon aria-hidden="true" />
    </Button>
  );
}

function ReceptionTypeBadge({ label }: { label: string }) {
  const reservation = label === "예약";

  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 shrink-0 rounded-[var(--clair-radius-atomic-6)] border-transparent px-1.5 text-[12px] font-medium leading-4 tracking-[0.3px]",
        reservation
          ? "bg-[var(--clair-color-atomic-sky-50)] text-[var(--clair-color-atomic-blue-600)]"
          : "bg-[var(--clair-color-atomic-gray-50)] text-[var(--clair-color-atomic-gray-900)]"
      )}
    >
      {label}
    </Badge>
  );
}

function QueueMetaBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex h-5 max-w-[92px] shrink-0 items-center gap-0.5 rounded-[var(--clair-radius-atomic-4)] border border-[var(--clair-color-atomic-black-alpha-8)] bg-card px-1.5 py-0.5 text-[12px] font-medium leading-4 tracking-[0.3px]">
      <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">{label}</span>
      <span className="truncate text-[var(--clair-color-atomic-gray-700)]">{value}</span>
    </span>
  );
}
