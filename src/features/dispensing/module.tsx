"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  MenuIcon,
  PrinterIcon,
} from "@/components/icons";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsNavigationChevronsLeftIcon } from "@/components/cds-icons/navigation";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrContentAsidePanel } from "@/components/emr/content-aside-panel";
import { EmrContentHistoryGroup, EmrContentHistoryItem } from "@/components/emr/content-history-list";
import { EmrOrderQueueSidePanel } from "@/components/emr/order-queue-side-panel";
import { EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
} from "@/components/emr/subpanel";
import {
  EmrInstructionHeaderStack,
  EmrInstructionHistoryToggle,
  EmrInstructionTitleBar,
} from "@/components/emr/instruction-header-stack";
import { EmrInstructionFilterTabs } from "@/components/emr/instruction-filter-tabs";
import { EmrOrderGroupSection } from "@/components/emr/order-group-section";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmrDataTable } from "@/components/emr/emr-data-table";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import {
  getOrderQueueItems,
  getOrderQueueStatuses,
  getSelectedOrderQueueItem,
} from "@/features/order-queue/data";
import { getAuthRuntimeMode } from "@/lib/supabase/config";
import {
  allOrderRows,
  currentTechnician,
  getOrderTableGroupsForQueueItem,
  historyGroups,
  patient,
  technicianUsers,
  type OrderTableGroup,
} from "@/features/dispensing/data";
import type { Order, OrderQueueItem, ShellComponentProps, TechnicianUser } from "@/types/emr";
import type { EmrTableDensity } from "@/components/emr/table-density";

type OrderGroupFilter = "all" | "oral" | "other";
type FulfillmentQueueType = "dispensing" | "treatment";
type FulfillmentWorkItemStatus =
  | "requested"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "returned";
type FulfillmentWorkItem = {
  assignedToUserId?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  encounterId: string;
  id: string;
  orderId: string;
  queueType: FulfillmentQueueType;
  sourceSnapshot?: {
    guardianName?: string;
    instruction?: string;
    orderDisplayName?: string;
    patientName?: string;
    requestingVetName?: string;
  };
  status: FulfillmentWorkItemStatus;
  updatedAt?: string;
  workspaceId: string;
};
type DispensingContentBodyProps = Pick<
  ShellComponentProps,
  "hasRightPanel" | "moduleId"
> & {
  selectedQueueItem: OrderQueueItem | null;
};

function splitHistoryItem(item: string) {
  const [category, ...rest] = item.split(" ");

  if (!rest.length || item.startsWith("[")) {
    return { title: item, category: null, description: null };
  }

  return {
    title: rest.join(" "),
    category,
    description: rest.join(" "),
  };
}

function getQueueStatusLabel(moduleId: string, item: OrderQueueItem | null) {
  if (!item) return "대기중";

  return getOrderQueueStatuses(moduleId).find((status) => status.id === item.statusId)?.label ?? item.statusId;
}

function getQueuePatientSummary(item: OrderQueueItem | null) {
  if (!item) return `${patient.name}(${patient.age}) · 코리...`;

  return `${item.patientName}(${item.patientAge ?? patient.age}) · ${item.patientBreed ?? patient.breed}`;
}

function getWorkspaceIdFromPath() {
  if (typeof window === "undefined") return "clair-demo";

  const match = window.location.pathname.match(/^\/w\/([^/]+)/);
  return match?.[1] ?? "clair-demo";
}

function isLiveAuthRuntime() {
  return getAuthRuntimeMode().authProvider === "supabase";
}

function useDispensingFulfillmentQueue() {
  const workspaceId = getWorkspaceIdFromPath();
  const [workItems, setWorkItems] = useState<FulfillmentWorkItem[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [dispensingResponse, treatmentResponse] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=dispensing`, {
          headers: { "x-clair-demo-session-user-id": "user-tech" },
        }),
        fetch(`/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=treatment`, {
          headers: { "x-clair-demo-session-user-id": "user-tech" },
        }),
      ]);
      const dispensingBody = await dispensingResponse.json() as { ok?: boolean; workItems?: FulfillmentWorkItem[] };
      const treatmentBody = await treatmentResponse.json() as { ok?: boolean; workItems?: FulfillmentWorkItem[] };
      const nextItems = [
        ...(dispensingResponse.ok && dispensingBody.ok && Array.isArray(dispensingBody.workItems)
          ? dispensingBody.workItems
          : []),
        ...(treatmentResponse.ok && treatmentBody.ok && Array.isArray(treatmentBody.workItems)
          ? treatmentBody.workItems
          : []),
      ];
      setWorkItems(nextItems);
    } catch {
      setWorkItems([]);
    }
  }, [workspaceId]);

  useEffect(() => {
    // Fetching the server queue is an external sync; rendering decides whether fixtures are allowed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const updateStatus = useCallback(async (workItemId: string, statuses: FulfillmentWorkItemStatus[]) => {
    for (const status of statuses) {
      const response = await fetch(`/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-clair-demo-session-user-id": "user-tech",
        },
        body: JSON.stringify({ status, assignedToUserId: "user-tech" }),
      });
      if (!response.ok) break;
    }
    await refresh();
  }, [refresh, workspaceId]);

  return { updateStatus, workItems };
}

function findFulfillmentForQueueItem(
  item: OrderQueueItem | null,
  workItems: FulfillmentWorkItem[]
) {
  if (!workItems.length) return undefined;
  const queueType = item?.orderTypeCategory === "treatment" ? "treatment" : "dispensing";
  const queueItems = workItems.filter((workItem) => workItem.queueType === queueType);
  if (!queueItems.length) return undefined;
  if (!item) return queueItems[0];

  return queueItems.find((workItem) => {
    if (item.id === `live-fulfillment-${workItem.id}`) return true;
    const displayName = workItem.sourceSnapshot?.orderDisplayName;
    return displayName && item.orderName.includes(displayName);
  }) ?? queueItems.find((workItem) => {
    const snapshot = workItem.sourceSnapshot;
    return snapshot?.patientName === item.patientName && snapshot?.guardianName === item.guardianName;
  });
}

function applyFulfillmentToQueueItems(
  items: OrderQueueItem[],
  workItems: FulfillmentWorkItem[]
) {
  const usedWorkItemIds = new Set<string>();

  const mappedItems = items.map((item) => {
    const workItem = workItems
      .filter((candidate) => !usedWorkItemIds.has(candidate.id))
      .find((candidate) => {
        if (item.id === `live-fulfillment-${candidate.id}`) return true;
        const displayName = candidate.sourceSnapshot?.orderDisplayName;
        return Boolean(displayName && item.orderName.includes(displayName));
      });
    if (!workItem) return item;
    usedWorkItemIds.add(workItem.id);

    return {
      ...item,
      assigneeName: getFulfillmentAssigneeName(workItem) ?? item.assigneeName,
      startedAt: workItem.status === "in_progress" ? item.startedAt ?? item.time : item.startedAt,
      statusId: mapFulfillmentToQueueStatusId(workItem.status, item.statusId),
    };
  });

  const liveOnlyItems = workItems
    .filter((workItem) => !usedWorkItemIds.has(workItem.id))
    .filter((workItem) => workItem.queueType === "dispensing" || workItem.queueType === "treatment")
    .map(createLiveQueueItem);

  return [...mappedItems, ...liveOnlyItems];
}

function createLiveQueueItem(workItem: FulfillmentWorkItem): OrderQueueItem {
  const isTreatment = workItem.queueType === "treatment";
  const timestamp = workItem.updatedAt ?? workItem.createdAt ?? new Date().toISOString();
  const time = timestamp.slice(11, 16) || "00:00";

  return {
    id: `live-fulfillment-${workItem.id}`,
    instructionId: `${isTreatment ? "TR" : "RX"}-${workItem.id.slice(0, 8).toUpperCase()}`,
    patientName: workItem.sourceSnapshot?.patientName ?? "환자 미상",
    guardianName: workItem.sourceSnapshot?.guardianName ?? "보호자 미지정",
    patientAge: "나이 미상",
    patientBreed: "품종 미상",
    patientSex: "성별 미상",
    receptionType: "외래",
    orderType: isTreatment ? "처치" : "조제",
    orderTypeCategory: workItem.queueType,
    orderName: workItem.sourceSnapshot?.orderDisplayName ?? "Live order",
    requesterName: workItem.sourceSnapshot?.requestingVetName ?? "담당 수의사",
    assigneeName: getFulfillmentAssigneeName(workItem),
    startedAt: workItem.status === "in_progress" || workItem.status === "completed" ? time : undefined,
    statusId: mapFulfillmentToQueueStatusId(workItem.status, "waiting"),
    time,
    waitMinutes: workItem.status === "requested" ? 0 : undefined,
  };
}

function getQueueItemsForRuntime(workItems: FulfillmentWorkItem[]) {
  if (isLiveAuthRuntime()) {
    return workItems
      .filter((workItem) => workItem.queueType === "dispensing" || workItem.queueType === "treatment")
      .map(createLiveQueueItem);
  }

  return applyFulfillmentToQueueItems(getOrderQueueItems("dispensing"), workItems);
}

function getFulfillmentAssigneeName(workItem: FulfillmentWorkItem) {
  if (!workItem.assignedToUserId) return undefined;
  if (workItem.assignedToUserId === "user-tech" || workItem.assignedToUserId === "user-tech-hayun") return "송하윤";
  return undefined;
}

function mapFulfillmentToQueueStatusId(status: FulfillmentWorkItemStatus, fallback: string) {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "canceled";
  if (status === "returned") return "reRequested";
  if (status === "in_progress" || status === "accepted") return "inProgress";
  if (status === "requested") return "waiting";
  return fallback;
}

export function DispensingSidePanel() {
  const { selectedQueueItemIds, setModulePanelOpen, setSelectedQueueItem } = useLayoutStore();
  const fulfillmentQueue = useDispensingFulfillmentQueue();
  const items = useMemo(
    () => getQueueItemsForRuntime(fulfillmentQueue.workItems),
    [fulfillmentQueue.workItems]
  );
  const statuses = getOrderQueueStatuses("dispensing");
  useEffect(() => {
    if (!items.length || items.some((item) => item.id === selectedQueueItemIds.dispensing)) return;
    setSelectedQueueItem("dispensing", items[0].id);
  }, [items, selectedQueueItemIds.dispensing, setSelectedQueueItem]);

  return (
    <EmrOrderQueueSidePanel
      items={items}
      statuses={statuses}
      title="조제/처치"
      selectedItemId={selectedQueueItemIds.dispensing}
      onCollapse={() => setModulePanelOpen(false)}
      onSelectItem={(itemId) => setSelectedQueueItem("dispensing", itemId)}
    />
  );
}

export function DispensingHeader({ moduleId }: ShellComponentProps) {
  const {
    selectedQueueItemIds,
  } =
    useLayoutStore();
  const fulfillmentQueue = useDispensingFulfillmentQueue();
  const items = useMemo(
    () => getQueueItemsForRuntime(fulfillmentQueue.workItems),
    [fulfillmentQueue.workItems],
  );
  const selectedQueueItem =
    items.find((item) => item.id === selectedQueueItemIds[moduleId]) ??
    getSelectedOrderQueueItem(moduleId, selectedQueueItemIds[moduleId]);

  return (
    <EmrPatientContextBar
      patientItems={[
        { label: "환자", value: selectedQueueItem?.patientName ?? patient.name },
        { label: "보호자", value: selectedQueueItem?.guardianName ?? patient.guardian },
        { label: "품종", value: selectedQueueItem?.patientBreed ?? patient.breed },
        { label: "나이", value: selectedQueueItem?.patientAge ?? patient.age },
        { label: "성별", value: selectedQueueItem?.patientSex ?? patient.sex },
      ]}
      vitalItems={[
        { label: "체중", value: selectedQueueItem?.patientWeight ?? patient.weight },
        { label: "체온", value: selectedQueueItem?.patientTemperature ?? patient.temperature },
        { label: "호흡", value: selectedQueueItem?.patientRespiration ?? patient.respiration },
        { label: "혈압", value: selectedQueueItem?.patientBloodPressure ?? patient.bloodPressure },
      ]}
      memoActions={[
        { label: "방문목적" },
        { label: "보호자메모", locked: true },
        { label: "환자메모" },
        { label: "수납메모", disabled: true },
      ]}
    />
  );
}

function getDispensingInstructionType(selectedQueueItem: OrderQueueItem | null) {
  return selectedQueueItem?.orderTypeCategory === "treatment" ? "처치" : "조제";
}

export function DispensingContentAside({ moduleId }: ShellComponentProps) {
  const selectedQueueItemIds = useLayoutStore((state) => state.selectedQueueItemIds);
  const setContentAsideOpen = useLayoutStore((state) => state.setContentAsideOpen);
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<Set<string>>(() => new Set());
  const fulfillmentQueue = useDispensingFulfillmentQueue();
  const items = useMemo(
    () => getQueueItemsForRuntime(fulfillmentQueue.workItems),
    [fulfillmentQueue.workItems],
  );
  const selectedQueueItem =
    items.find((item) => item.id === selectedQueueItemIds[moduleId]) ??
    getSelectedOrderQueueItem(moduleId, selectedQueueItemIds[moduleId]);
  const historyLabel = `${getDispensingInstructionType(selectedQueueItem)} 이력`;
  const totalHistoryCount = historyGroups.reduce((total, group) => total + group.count, 0);
  const toggleHistoryGroup = (date: string) => {
    setCollapsedHistoryGroups((current) => {
      const next = new Set(current);

      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }

      return next;
    });
  };

  return (
    <EmrContentAsidePanel id="dispensing-content-aside">
      <HistoryListHeader
        count={totalHistoryCount}
        label={historyLabel}
        onCollapse={() => setContentAsideOpen(false)}
      />
      <div className="h-px w-full shrink-0 bg-[var(--emr-line-subtle)]" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1">
          {historyGroups.map((group) => (
            <EmrContentHistoryGroup
              key={group.date}
              collapsed={collapsedHistoryGroups.has(group.date)}
              count={group.count}
              dataTestId={`history-group-${group.date}`}
              label={group.date}
              onToggle={() => toggleHistoryGroup(group.date)}
              toggleTestId={`history-group-toggle-${group.date}`}
            >
              {group.items.map((item) => (
                <HistoryItem key={item} item={item} />
              ))}
            </EmrContentHistoryGroup>
          ))}
        </div>
      </ScrollArea>
    </EmrContentAsidePanel>
  );
}

function HistoryListHeader({
  count,
  label,
  onCollapse,
}: {
  count: number;
  label: string;
  onCollapse: () => void;
}) {
  return (
    <EmrListHeader
      className="mx-0 h-6 border-y-0"
      count={count}
      label={label}
      leadingAction={
        <EmrListHeaderIconButton ariaLabel={`${label} 목록 접기`} iconSize="md" onClick={onCollapse}>
          <CdsNavigationChevronsLeftIcon className="size-4" />
        </EmrListHeaderIconButton>
      }
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
  );
}

function HistoryItem({ item }: { item: string }) {
  const { title, category, description } = splitHistoryItem(item);

  return (
    <EmrContentHistoryItem
      title={title}
      subtitle="10:30 요청"
      meta={
        <>
          {category ? <span className="truncate">{category}</span> : null}
          {description ? <span className="truncate">{description}</span> : null}
          <span className="truncate">담당 김지선</span>
        </>
      }
    />
  );
}

function cloneOrderTableGroups(queueItemId?: string): OrderTableGroup[] {
  return getOrderTableGroupsForQueueItem(queueItemId).map((group) => ({
    ...group,
    assigneeIds: [...group.assigneeIds],
    rows: group.rows.map((row) => ({
      ...row,
      diffs: row.diffs ? { ...row.diffs } : undefined,
    })),
  }));
}

function isEditableOrder(row: Order) {
  return row.status !== "완료" && row.status !== "취소" && row.workStatus !== "완료";
}

function findTechnician(technicianId: string) {
  return technicianUsers.find((technician) => technician.id === technicianId) ?? currentTechnician;
}

function assignOrder(row: Order, technician: TechnicianUser): Order {
  return {
    ...row,
    assigneeId: technician.id,
    assignee: technician.name,
    assigneeInitial: technician.initial,
  };
}

function clearOrderAssignee(row: Order): Order {
  return {
    ...row,
    assigneeId: undefined,
    assignee: "미지정",
    assigneeInitial: "미",
  };
}

function getRequestedStatus(row: Order) {
  return row.warningMessage || row.diffs ? "재요청" : "요청";
}

function getGroupAssigneeIds(rows: Order[]) {
  return Array.from(
    new Set(rows.map((row) => row.assigneeId).filter((assigneeId): assigneeId is string => Boolean(assigneeId)))
  );
}

function getAssigneeSummary(assigneeIds: string[]) {
  if (!assigneeIds.length) return "미지정";

  return assigneeIds.map((assigneeId) => findTechnician(assigneeId).name).join(" · ");
}

function completeOrders(rows: Order[], rowIds: string[]) {
  const selected = new Set(rowIds);

  return rows.map((row) =>
    selected.has(row.id)
      ? {
          ...row,
          status: "완료" as const,
          workStatus: "완료" as const,
          warningMessage: undefined,
          diffs: undefined,
        }
      : row
  );
}

function startOrderGroup(group: OrderTableGroup) {
  const rows = group.rows.map((row) => {
    if (!isEditableOrder(row)) return row;

    const assignedRow = row.assigneeId ? row : assignOrder(row, currentTechnician);

    return {
      ...assignedRow,
      status: "조제중" as const,
      workStatus: "대기" as const,
    };
  });

  return {
    ...group,
    workStatus: "진행중" as const,
    assigneeIds: getGroupAssigneeIds(rows),
    rows,
  };
}

function cancelOrderGroupAssignment(group: OrderTableGroup) {
  const rows = group.rows.map((row) => {
    if (!isEditableOrder(row)) return row;

    return clearOrderAssignee({
      ...row,
      status: getRequestedStatus(row),
      workStatus: "대기" as const,
    });
  });

  return {
    ...group,
    workStatus: "요청" as const,
    assigneeIds: [],
    rows,
  };
}

function completeOrderGroup(group: OrderTableGroup) {
  const rows = group.rows.map((row) =>
    row.status === "취소"
      ? row
      : {
          ...row,
          status: "완료" as const,
          workStatus: "완료" as const,
          warningMessage: undefined,
          diffs: undefined,
        }
  );

  return {
    ...group,
    workStatus: "완료" as const,
    assigneeIds: getGroupAssigneeIds(rows),
    rows,
  };
}

function completeInstructionGroup(group: OrderTableGroup) {
  const rows = group.rows.map((row) => ({
    ...row,
    status: "완료" as const,
    workStatus: "완료" as const,
    warningMessage: undefined,
    diffs: undefined,
  }));

  return {
    ...group,
    workStatus: "완료" as const,
    assigneeIds: getGroupAssigneeIds(rows),
    rows,
  };
}

function assignOrderInGroup(group: OrderTableGroup, rowId: string, technicianId: string) {
  const technician = findTechnician(technicianId);
  const rows = group.rows.map((row) =>
    row.id === rowId && isEditableOrder(row) ? assignOrder(row, technician) : row
  );

  return {
    ...group,
    assigneeIds: getGroupAssigneeIds(rows),
    rows,
  };
}

function GroupStatusAction({
  group,
  statusLabel,
  completeLabel,
  size = "xs",
  onStart,
  onComplete,
  onCancelAssignment,
}: {
  group: OrderTableGroup;
  statusLabel: string;
  completeLabel: string;
  size?: "xs" | "sm";
  onStart: () => void;
  onComplete: () => void;
  onCancelAssignment: () => void;
}) {
  if (group.workStatus === "완료") {
    return (
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled
        className="border-[var(--emr-status-success-border)] bg-card text-[var(--emr-status-success-text)]"
      >
        <CheckIcon data-icon="inline-start" />
        {completeLabel}
      </Button>
    );
  }

  if (group.workStatus === "진행중") {
    return (
      <div className="inline-flex items-center">
        <Button
          type="button"
          variant="outline"
          size={size}
          className="rounded-r-none border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]"
        >
          {statusLabel}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${group.title} 상태 액션`}
            className={cn(
              buttonVariants({ variant: "outline", size: size === "sm" ? "icon-sm" : "icon-xs" }),
              "-ml-px rounded-l-none border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]"
            )}
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              className="h-8 cursor-pointer"
              onClick={onComplete}
            >
              <CheckIcon className="size-3" />
              완료
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="h-8 cursor-pointer"
              onClick={onCancelAssignment}
            >
              담당취소
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <Button type="button" size={size} onClick={onStart}>
      담당하기
      <ChevronDownIcon data-icon="inline-end" />
    </Button>
  );
}

export function DispensingContent({
  hasRightPanel,
  moduleId,
}: ShellComponentProps) {
  const selectedQueueItemIds = useLayoutStore((state) => state.selectedQueueItemIds);
  const fulfillmentQueue = useDispensingFulfillmentQueue();
  const selectedQueueItem = useMemo(() => {
    const items = getQueueItemsForRuntime(fulfillmentQueue.workItems);
    return items.find((item) => item.id === selectedQueueItemIds[moduleId]) ?? getSelectedOrderQueueItem(moduleId, selectedQueueItemIds[moduleId]);
  }, [fulfillmentQueue.workItems, moduleId, selectedQueueItemIds]);

  return (
    <DispensingContentBody
      fulfillmentQueue={fulfillmentQueue}
      key={selectedQueueItem?.id ?? "default"}
      hasRightPanel={hasRightPanel}
      moduleId={moduleId}
      selectedQueueItem={selectedQueueItem}
    />
  );
}

function DispensingContentBody({
  hasRightPanel,
  fulfillmentQueue,
  moduleId,
  selectedQueueItem,
}: DispensingContentBodyProps & {
  fulfillmentQueue: ReturnType<typeof useDispensingFulfillmentQueue>;
}) {
  const {
    contentAsideOpen,
    rightPanelOpen,
    setContentAsideOpen,
    setRightPanelOpen,
  } = useLayoutStore();
  const selectedQueueItemId = selectedQueueItem?.id;
  const selectedFulfillmentWorkItem = useMemo(
    () => findFulfillmentForQueueItem(selectedQueueItem, fulfillmentQueue.workItems),
    [fulfillmentQueue.workItems, selectedQueueItem]
  );
  const [tableGroups, setTableGroups] = useState<OrderTableGroup[]>(() =>
    cloneOrderTableGroups(selectedQueueItemId)
  );
  const selectedQueueStatusLabel = getQueueStatusLabel(moduleId, selectedQueueItem);
  const [orderGroupFilter, setOrderGroupFilter] = useState<OrderGroupFilter>("all");
  const [collapsedOrderGroupIds, setCollapsedOrderGroupIds] = useState<Set<string>>(() => new Set());
  const [tableDensity, setTableDensity] = useState<EmrTableDensity>("compact");
  const primaryGroup = tableGroups[0];
  const totalOrderCount = tableGroups.reduce((total, group) => total + group.rows.length, 0);
  const regularOrderCount = tableGroups.find((group) => group.id === "oral")?.rows.length ?? 0;
  const otherOrderCount = tableGroups.find((group) => group.id === "other")?.rows.length ?? 0;
  const visibleTableGroups =
    orderGroupFilter === "all"
      ? tableGroups
      : tableGroups.filter((group) => group.id === orderGroupFilter);
  const orderGroupFilterItems = [
    {
      value: "all" as const,
      label: "전체",
      count: totalOrderCount > 0 ? totalOrderCount : undefined,
      disabled: totalOrderCount === 0,
    },
    {
      value: "oral" as const,
      label: "경구제",
      count: regularOrderCount > 0 ? regularOrderCount : undefined,
      disabled: regularOrderCount === 0,
    },
    {
      value: "other" as const,
      label: "기타",
      count: otherOrderCount > 0 ? otherOrderCount : undefined,
      disabled: otherOrderCount === 0,
    },
  ];

  const instructionType = getDispensingInstructionType(selectedQueueItem);
  const statusLabel = instructionType === "처치" ? "처치중" : "조제중";
  const completeLabel = instructionType === "처치" ? "처치완료" : "조제완료";
  const historyLabel = `${instructionType} 이력`;
  const primaryAssigneeSummary = primaryGroup ? getAssigneeSummary(primaryGroup.assigneeIds) : "미지정";
  const primaryStartStatus =
    primaryGroup?.workStatus === "진행중"
      ? statusLabel
      : primaryGroup?.workStatus === "완료"
        ? completeLabel
        : "대기중";
  const instructionRequestedAt = selectedQueueItem
    ? `2026.04.14 ${selectedQueueItem.time}`
    : "2026.04.14 10:30";
  const instructionPatientSummary = getQueuePatientSummary(selectedQueueItem);
  const instructionId = selectedQueueItem?.instructionId ?? "RX-260414-0008";
  const instructionRequester = selectedQueueItem?.requesterName ?? "이수지";
  const instructionAssignee = selectedQueueItem?.assigneeName ?? primaryAssigneeSummary;
  const instructionStartStatus = selectedQueueItem ? selectedQueueStatusLabel : primaryStartStatus;
  const instructionStartedAt = selectedQueueItem?.startedAt ?? "미시작";
  const instructionInfoItems: Array<{ label: string; value: ReactNode }> = [
    {
      label: "요청 일시",
      value: (
        <span className="flex flex-wrap items-center gap-1.5">
          <span>{instructionRequestedAt}</span>
          <EmrStatusBadge
            label={instructionStartStatus}
            marker="none"
            testId="instruction-status-label"
          />
        </span>
      ),
    },
    { label: "환자 정보", value: instructionPatientSummary },
    { label: "요청 수의사", value: instructionRequester },
    { label: `${instructionType} 담당`, value: instructionAssignee },
    { label: `${instructionType} 시작`, value: instructionStartedAt },
  ];
  const updateGroup = (
    groupId: string,
    updater: (group: OrderTableGroup) => OrderTableGroup
  ) => {
    setTableGroups((current) =>
      current.map((group) => (group.id === groupId ? updater(group) : group))
    );
  };
  const completeGroupRows = (groupId: string, rowIds: string[]) => {
    setTableGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId) return group;

        const rows = completeOrders(group.rows, rowIds);
        const activeRows = rows.filter((row) => row.status !== "취소");
        const allActiveRowsCompleted = activeRows.every((row) => row.workStatus === "완료");

        return {
          ...group,
          workStatus: allActiveRowsCompleted ? "완료" : group.workStatus,
          assigneeIds: getGroupAssigneeIds(rows),
          rows,
        };
      })
    );
  };
  const assignGroupOrder = (groupId: string, rowId: string, technicianId: string) => {
    updateGroup(groupId, (group) => assignOrderInGroup(group, rowId, technicianId));
  };
  const startGroup = (groupId: string) => {
    if (selectedFulfillmentWorkItem) {
      const transitionPath: FulfillmentWorkItemStatus[] =
        selectedFulfillmentWorkItem.status === "returned"
          ? ["requested", "accepted", "in_progress"]
          : ["accepted", "in_progress"];
      void fulfillmentQueue.updateStatus(selectedFulfillmentWorkItem.id, transitionPath);
    }
    updateGroup(groupId, startOrderGroup);
  };
  const completeGroup = (groupId: string) => {
    if (selectedFulfillmentWorkItem) {
      void fulfillmentQueue.updateStatus(selectedFulfillmentWorkItem.id, ["completed"]);
    }
    updateGroup(groupId, completeOrderGroup);
  };
  const completeInstruction = () => {
    if (selectedFulfillmentWorkItem) {
      void fulfillmentQueue.updateStatus(selectedFulfillmentWorkItem.id, ["completed"]);
    }
    setTableGroups((current) => current.map(completeInstructionGroup));
  };
  const cancelGroupAssignment = (groupId: string) => {
    if (selectedFulfillmentWorkItem) {
      void fulfillmentQueue.updateStatus(selectedFulfillmentWorkItem.id, ["returned", "requested"]);
    }
    updateGroup(groupId, cancelOrderGroupAssignment);
  };
  const toggleOrderGroup = (groupId: string) => {
    setCollapsedOrderGroupIds((current) => {
      const next = new Set(current);

      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }

      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] px-4 py-3">
      <EmrInstructionHeaderStack
        titleBar={
          <EmrInstructionTitleBar
            title={`${instructionType} 지시서`}
            icon={
              <EmrInstructionHistoryToggle
                ariaLabelPrefix={historyLabel}
                controls="dispensing-content-aside"
                expanded={contentAsideOpen}
                tooltipLabel={historyLabel}
                onClick={() => setContentAsideOpen(!contentAsideOpen)}
              />
            }
            badge={
              <Badge variant="secondary" className="emr-text-metadata h-[22px] rounded-[var(--emr-context-bar-chip-radius)] bg-[var(--emr-context-bar-chip-bg)] px-[var(--clair-spacing-8)] text-[var(--emr-context-bar-chip-label)]">
                {instructionId}
              </Badge>
            }
            actions={
              <>
              {hasRightPanel && instructionType === "처치" ? (
                <Button
                  variant="outline"
                  size="default"
                  className="bg-card"
                  aria-label={rightPanelOpen ? "우측 패널 접기" : "우측 패널 펼치기"}
                  onClick={() => setRightPanelOpen(!rightPanelOpen)}
                >
                  {rightPanelOpen ? "우측 패널 접기" : "우측 패널 펼치기"}
                </Button>
              ) : null}
              <Button variant="outline" size="default" className="bg-card">
                <DownloadIcon data-icon="inline-start" />
                PDF 다운로드
              </Button>
              <Button variant="outline" size="default" className="bg-card">
                <PrinterIcon data-icon="inline-start" />
                출력하기
              </Button>
              {primaryGroup ? (
                <GroupStatusAction
                  group={primaryGroup}
                  statusLabel={statusLabel}
                  completeLabel={completeLabel}
                  size="sm"
                  onStart={() => startGroup(primaryGroup.id)}
                  onComplete={completeInstruction}
                  onCancelAssignment={() => cancelGroupAssignment(primaryGroup.id)}
                />
              ) : null}
              </>
            }
          />
        }
        orderInfo={
          <div
            data-slot="instruction-info-card"
            className="grid min-h-[72px] grid-cols-5 rounded-[var(--emr-document-info-radius)] border border-[var(--emr-document-info-divider)] bg-card px-[var(--emr-document-info-padding-x)] py-[var(--emr-document-info-padding-y)]"
          >
            {instructionInfoItems.map(({ label, value }) => (
              <div key={label} className="border-r border-[var(--emr-document-info-divider)] px-[var(--clair-spacing-12)] first:pl-0 last:border-r-0 last:pr-0">
                <div className="emr-text-metadata font-medium text-[var(--emr-context-bar-chip-label)]">{label}</div>
                <div className="mt-[var(--clair-spacing-4)] flex min-h-6 items-center emr-text-dense font-medium text-[var(--emr-context-bar-chip-value)]">{value}</div>
              </div>
            ))}
          </div>
        }
        filters={
          <EmrInstructionFilterTabs
            aria-label="오더 그룹 필터"
            value={orderGroupFilter}
            items={orderGroupFilterItems}
            onValueChange={setOrderGroupFilter}
          />
        }
      />

      <ScrollArea data-slot="instruction-result-scroll-area" className="min-h-0 flex-1">
        <div data-slot="instruction-result-scroll-content" className="flex flex-col gap-4 pb-10 pt-4">
          {visibleTableGroups.map((group, section) => {
            const completedCount = group.rows.filter((row) => row.workStatus === "완료").length;
            const collapsed = collapsedOrderGroupIds.has(group.id);

            return (
              <EmrOrderGroupSection
                key={group.id}
                collapsed={collapsed}
                count={group.rows.length}
                label={group.label}
                title={group.title}
                meta={
                  <span className="emr-text-metadata font-medium text-muted-foreground">
                    작업 완료 {completedCount}/{group.rows.length}
                  </span>
                }
                actions={
                  <>
                    <Button variant="outline" size="xs" className="bg-card">
                      수정이력조회
                      <MenuIcon data-icon="inline-end" />
                    </Button>
                    <div className="h-[18px] w-px bg-[var(--emr-line-default)]" />
                    <Button variant="outline" size="xs" className="bg-card">
                      필터 1
                    </Button>
                    <EmrTableDensitySelector value={tableDensity} onValueChange={setTableDensity} />
                    <Button variant="outline" size="xs" className="max-w-24 bg-card">
                      <span className="truncate">{getAssigneeSummary(group.assigneeIds)}</span>
                    </Button>
                    <GroupStatusAction
                      group={group}
                      statusLabel={statusLabel}
                      completeLabel={completeLabel}
                      onStart={() => startGroup(group.id)}
                      onComplete={() => completeGroup(group.id)}
                      onCancelAssignment={() => cancelGroupAssignment(group.id)}
                    />
                  </>
                }
                onToggle={() => toggleOrderGroup(group.id)}
              >
                <EmrDataTable
                  density={tableDensity}
                  onDensityChange={setTableDensity}
                  rows={group.rows}
                  sectionId={`section-${section}`}
                  showDensitySelector={false}
                  technicians={technicianUsers}
                  onCompleteRows={(rowIds) => completeGroupRows(group.id, rowIds)}
                  onAssignOrder={(rowId, technicianId) =>
                    assignGroupOrder(group.id, rowId, technicianId)
                  }
                />
              </EmrOrderGroupSection>
            );
          })}
          {!visibleTableGroups.length ? (
            <div className="rounded-lg border border-[var(--emr-line-hairline)] bg-card p-8 text-center emr-text-dense font-medium text-muted-foreground">
              표시할 오더 그룹이 없습니다.
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function DispensingDrawerField({
  children,
  inputId,
  label,
}: {
  children: ReactNode;
  inputId: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label
        htmlFor={inputId}
        className="emr-text-metadata leading-4 text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

export function DispensingDrawer() {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const order = allOrderRows.find((row) => row.id === activeDrawer?.id) ?? allOrderRows[0];
  const drawerFields = [
    ["구분", order.category],
    ["상태", order.status],
    ["경로", order.route],
    ["빈도", order.frequency],
    ["요청 일시", order.requestedAt],
    ["요청 수의사", order.doctor],
  ];

  return (
    <div className="flex h-[calc(100%-48px)] flex-col gap-4 overflow-y-auto p-4">
      <div className="rounded-md border bg-background p-3">
        <div className="emr-text-metadata text-muted-foreground">오더명</div>
        <div className="mt-1 text-base font-semibold">{order.name}</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {drawerFields.map(([label, value], index) => {
          const inputId = `dispensing-drawer-${order.id}-field-${index}`;

          return (
            <DispensingDrawerField key={label} inputId={inputId} label={label}>
              <Input
                id={inputId}
                value={value}
                readOnly
                className="h-8 bg-card text-foreground"
              />
            </DispensingDrawerField>
          );
        })}
      </div>
      <DispensingDrawerField
        inputId={`dispensing-drawer-${order.id}-dose`}
        label="용량"
      >
        <DoseInput
          key={order.id}
          id={`dispensing-drawer-${order.id}-dose`}
          initialDose={order.dose}
        />
      </DispensingDrawerField>
      <div className="mt-auto flex justify-end gap-2 border-t pt-4">
        <Button variant="outline">변경 이력</Button>
        <Button>수정 저장</Button>
      </div>
    </div>
  );
}

function DoseInput({
  id,
  initialDose,
}: {
  id: string;
  initialDose: string;
}) {
  const [doseValue, setDoseValue] = useState(initialDose);

  return (
    <Input
      id={id}
      value={doseValue}
      onValueChange={setDoseValue}
      className="h-8 bg-card text-foreground"
    />
  );
}
