"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
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
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  EmrContentAsideHeader,
  EmrContentAsidePanel,
} from "@/components/emr/content-aside-panel";
import { EmrContentHistoryGroup, EmrContentHistoryItem } from "@/components/emr/content-history-list";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { EmrOrderQueueSidePanel } from "@/components/emr/order-queue-side-panel";
import { EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import {
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
import {
  getTaskQueueEventKindFromStatus,
  type EmrTaskQueueCardItem,
} from "@/components/emr/task-queue-card";
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
import {
  isLegacySalesDemoWorkspace,
  resolveWorkspacePathname,
} from "@/lib/emr-domain/demo-workspaces";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import { buildWorkspaceSurfaceRoute } from "@/shell/workspace-surface-route";
import {
  getOrderQueueItems,
  getOrderQueueStatuses,
  getSelectedOrderQueueItem,
} from "@/features/order-queue/data";
import { useQueueRealtimeRefresh } from "@/features/work-queue/queue-realtime-refresh";
import { useSelectedOperatingDate } from "@/features/work-queue/use-selected-operating-date";
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
import { mockStaffUsers } from "@/mocks/emr-domain";
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
  requestedByUserId?: string;
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
type FulfillmentWorkItemReadSummary = {
  date?: string;
  queueType: FulfillmentQueueType;
  statusCounts: Record<FulfillmentWorkItemStatus, number>;
  totalCount: number;
  workspaceId: string;
};
type DispensingFulfillmentQueueStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "permission_denied";
type DispensingFulfillmentQueueSnapshot = {
  sourceTotalCount?: number;
  status: DispensingFulfillmentQueueStatus;
  workItems: FulfillmentWorkItem[];
};
type DispensingContentBodyProps = Pick<
  ShellComponentProps,
  "hasRightPanel" | "moduleId"
> & {
  allowLegacyFixtureFallback: boolean;
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
  if (typeof window === "undefined") return resolveWorkspacePathname();

  return resolveWorkspacePathname(window.location.pathname);
}

function isLiveAuthRuntime() {
  return getAuthRuntimeMode().authProvider === "supabase";
}

const fulfillmentQueueCache = new Map<string, DispensingFulfillmentQueueSnapshot>();
const fulfillmentQueueListeners = new Map<
  string,
  Set<(snapshot: DispensingFulfillmentQueueSnapshot) => void>
>();

const emptyFulfillmentQueueSnapshot: DispensingFulfillmentQueueSnapshot = {
  status: "idle",
  workItems: [],
};

function getFulfillmentQueueCacheKey(workspaceId: string, selectedDate: string) {
  return `${workspaceId}:${selectedDate}:dispensing-treatment`;
}

function setCachedDispensingFulfillmentQueue(
  cacheKey: string,
  snapshot: DispensingFulfillmentQueueSnapshot,
) {
  fulfillmentQueueCache.set(cacheKey, snapshot);
  fulfillmentQueueListeners.get(cacheKey)?.forEach((listener) => listener(snapshot));
}

function getFulfillmentReadFailureStatus(result: {
  denialReason?: string;
  status?: number;
}): DispensingFulfillmentQueueStatus {
  if (result.status === 403 || result.denialReason === "permission_missing") {
    return "permission_denied";
  }

  return "error";
}

function useDispensingFulfillmentQueue(selectedDate?: string) {
  const workspaceId = getWorkspaceIdFromPath();
  const effectiveDate = selectedDate ?? "";
  const cacheKey = getFulfillmentQueueCacheKey(workspaceId, effectiveDate);
  const [queueState, setQueueState] =
    useState<DispensingFulfillmentQueueSnapshot>(
      () => fulfillmentQueueCache.get(cacheKey) ?? emptyFulfillmentQueueSnapshot,
    );
  const snapshot = fulfillmentQueueCache.get(cacheKey) ?? queueState;

  const refresh = useCallback(async () => {
    try {
      setCachedDispensingFulfillmentQueue(cacheKey, {
        sourceTotalCount: fulfillmentQueueCache.get(cacheKey)?.sourceTotalCount,
        status: "loading",
        workItems: fulfillmentQueueCache.get(cacheKey)?.workItems ?? [],
      });
      const [dispensingResponse, treatmentResponse] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=dispensing${effectiveDate ? `&date=${encodeURIComponent(effectiveDate)}` : ""}`, {
          headers: { "x-clair-demo-session-user-id": "user-tech" },
        }),
        fetch(`/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=treatment${effectiveDate ? `&date=${encodeURIComponent(effectiveDate)}` : ""}`, {
          headers: { "x-clair-demo-session-user-id": "user-tech" },
        }),
      ]);
      const dispensingBody = await dispensingResponse.json() as {
        denialReason?: string;
        ok?: boolean;
        status?: number;
        summary?: FulfillmentWorkItemReadSummary;
        workItems?: FulfillmentWorkItem[];
      };
      const treatmentBody = await treatmentResponse.json() as {
        denialReason?: string;
        ok?: boolean;
        status?: number;
        summary?: FulfillmentWorkItemReadSummary;
        workItems?: FulfillmentWorkItem[];
      };
      if (!dispensingResponse.ok || !dispensingBody.ok) {
        const previousSnapshot = fulfillmentQueueCache.get(cacheKey);

        setCachedDispensingFulfillmentQueue(cacheKey, {
          sourceTotalCount: previousSnapshot?.sourceTotalCount,
          status: getFulfillmentReadFailureStatus({
            denialReason: dispensingBody.denialReason,
            status: dispensingResponse.status,
          }),
          workItems: previousSnapshot?.workItems ?? [],
        });
        return;
      }
      if (!treatmentResponse.ok || !treatmentBody.ok) {
        const previousSnapshot = fulfillmentQueueCache.get(cacheKey);

        setCachedDispensingFulfillmentQueue(cacheKey, {
          sourceTotalCount: previousSnapshot?.sourceTotalCount,
          status: getFulfillmentReadFailureStatus({
            denialReason: treatmentBody.denialReason,
            status: treatmentResponse.status,
          }),
          workItems: previousSnapshot?.workItems ?? [],
        });
        return;
      }
      const nextItems = [
        ...(Array.isArray(dispensingBody.workItems) ? dispensingBody.workItems : []),
        ...(Array.isArray(treatmentBody.workItems) ? treatmentBody.workItems : []),
      ];
      const sourceTotalCount =
        (dispensingBody.summary?.totalCount ??
          (Array.isArray(dispensingBody.workItems) ? dispensingBody.workItems.length : 0)) +
        (treatmentBody.summary?.totalCount ??
          (Array.isArray(treatmentBody.workItems) ? treatmentBody.workItems.length : 0));
      setCachedDispensingFulfillmentQueue(cacheKey, {
        sourceTotalCount,
        status: nextItems.length ? "ready" : "empty",
        workItems: nextItems,
      });
    } catch {
      const previousSnapshot = fulfillmentQueueCache.get(cacheKey);

      setCachedDispensingFulfillmentQueue(cacheKey, {
        sourceTotalCount: previousSnapshot?.sourceTotalCount,
        status: "error",
        workItems: previousSnapshot?.workItems ?? [],
      });
    }
  }, [cacheKey, effectiveDate, workspaceId]);

  useEffect(() => {
    // Fetching the server queue is an external sync; rendering decides whether fixtures are allowed.
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const listener = (nextSnapshot: DispensingFulfillmentQueueSnapshot) =>
      setQueueState(nextSnapshot);
    const listeners = fulfillmentQueueListeners.get(cacheKey) ?? new Set();

    listeners.add(listener);
    fulfillmentQueueListeners.set(cacheKey, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) fulfillmentQueueListeners.delete(cacheKey);
    };
  }, [cacheKey]);

  const updateStatus = useCallback(async (workItemId: string, statuses: FulfillmentWorkItemStatus[]) => {
    let allTransitionsSucceeded = true;

    for (const status of statuses) {
      const response = await fetch(`/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-clair-demo-session-user-id": "user-tech",
        },
        body: JSON.stringify({ status, assignedToUserId: "user-tech" }),
      });
      if (!response.ok) {
        allTransitionsSucceeded = false;
        break;
      }
    }
    await refresh();
    return allTransitionsSucceeded;
  }, [refresh, workspaceId]);

  return {
    refresh,
    sourceTotalCount: snapshot.sourceTotalCount,
    status: snapshot.status,
    updateStatus,
    workItems: snapshot.workItems,
  };
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

function getQueueItemEncounterId(
  item: OrderQueueItem | null,
  workItems: FulfillmentWorkItem[]
) {
  if (!item) return undefined;

  return findFulfillmentForQueueItem(item, workItems)?.encounterId;
}

function findQueueItemByEncounterId(
  items: OrderQueueItem[],
  workItems: FulfillmentWorkItem[],
  encounterId: string | null,
) {
  if (!encounterId) return undefined;

  return items.find((item) => getQueueItemEncounterId(item, workItems) === encounterId);
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
    requesterName: getFulfillmentRequesterName(workItem),
    assigneeName: getFulfillmentAssigneeName(workItem),
    startedAt: workItem.status === "in_progress" || workItem.status === "completed" ? time : undefined,
    statusId: mapFulfillmentToQueueStatusId(workItem.status, "waiting"),
    time,
    waitMinutes: workItem.status === "requested" ? 0 : undefined,
  };
}

function getQueueItemsForRuntime(
  workItems: FulfillmentWorkItem[],
  options: { allowFixtureItems?: boolean } = {},
) {
  const allowFixtureItems = options.allowFixtureItems ?? true;
  if (isLiveAuthRuntime() || !allowFixtureItems) {
    return workItems
      .filter((workItem) => workItem.queueType === "dispensing" || workItem.queueType === "treatment")
      .map(createLiveQueueItem);
  }

  return applyFulfillmentToQueueItems(getOrderQueueItems("dispensing"), workItems);
}

function getQueueItemsForWorkspace(
  workspaceId: string,
  workItems: FulfillmentWorkItem[],
) {
  return getQueueItemsForRuntime(workItems, {
    allowFixtureItems: isLegacySalesDemoWorkspace(workspaceId),
  });
}

function getFulfillmentAssigneeName(workItem: FulfillmentWorkItem) {
  if (!workItem.assignedToUserId) return undefined;
  if (workItem.assignedToUserId === "user-tech" || workItem.assignedToUserId === "user-tech-hayun") return "송하윤";
  return undefined;
}

function getFulfillmentRequesterName(workItem: FulfillmentWorkItem) {
  return (
    workItem.sourceSnapshot?.requestingVetName ??
    mockStaffUsers.find((user) => user.id === workItem.requestedByUserId)?.name ??
    "요청자 미지정"
  );
}

function mapFulfillmentToQueueStatusId(status: FulfillmentWorkItemStatus, fallback: string) {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "canceled";
  if (status === "returned") return "reRequested";
  if (status === "in_progress" || status === "accepted") return "inProgress";
  if (status === "requested") return "waiting";
  return fallback;
}

function mapFulfillmentToOrderGroupWorkStatus(status: FulfillmentWorkItemStatus) {
  if (status === "completed") return "완료";
  if (status === "accepted" || status === "in_progress") return "진행중";
  return "요청";
}

function mapFulfillmentToOrderRowWorkStatus(status: FulfillmentWorkItemStatus) {
  if (status === "completed") return "완료";
  return "대기";
}

function getFulfillmentTransitionPath(
  current: FulfillmentWorkItemStatus,
  target: "in_progress" | "completed" | "requested",
): FulfillmentWorkItemStatus[] | null {
  if (target === "in_progress") {
    if (current === "requested") return ["accepted", "in_progress"];
    if (current === "accepted") return ["in_progress"];
    if (current === "returned") return ["requested", "accepted", "in_progress"];
    if (current === "in_progress") return [];
    return null;
  }

  if (target === "completed") {
    if (current === "requested") return ["accepted", "in_progress", "completed"];
    if (current === "accepted") return ["in_progress", "completed"];
    if (current === "in_progress") return ["completed"];
    if (current === "returned") return ["requested", "accepted", "in_progress", "completed"];
    if (current === "completed") return [];
    return null;
  }

  if (current === "requested") return [];
  if (current === "accepted" || current === "in_progress") return ["returned", "requested"];
  if (current === "returned") return ["requested"];
  return null;
}

function createLiveOrderTableGroups(
  selectedQueueItem: OrderQueueItem | null,
  workItem?: FulfillmentWorkItem,
): OrderTableGroup[] {
  if (!selectedQueueItem || !workItem) return [];

  const instructionType = getDispensingInstructionType(selectedQueueItem);
  const groupId = workItem.queueType === "treatment" ? "live-treatment" : "live-dispensing";
  const groupWorkStatus = mapFulfillmentToOrderGroupWorkStatus(workItem.status);
  const rowWorkStatus = mapFulfillmentToOrderRowWorkStatus(workItem.status);

  return [
    {
      id: groupId,
      label: instructionType,
      title: `${instructionType} 오더`,
      workStatus: groupWorkStatus,
      assigneeIds: workItem.assignedToUserId ? [workItem.assignedToUserId] : [],
      rows: [
        {
          id: `live-order-row-${workItem.id}`,
          category: instructionType,
          name: selectedQueueItem.orderName,
          route: workItem.queueType === "dispensing" ? "PO" : "-",
          dose: workItem.sourceSnapshot?.instruction ?? selectedQueueItem.orderName,
          frequency: "-",
          status: workItem.status === "cancelled" ? "취소" : "요청",
          requestedAt: `2026.04.14 ${selectedQueueItem.time}`,
          doctor: selectedQueueItem.requesterName,
          days: "1",
          doseTiming: "-",
          servings: "1",
          amount: "1",
          unit: "ea",
          quantity: "1",
          dosageForm: "-",
          storage: "지시 확인",
          medicationGuide: workItem.sourceSnapshot?.instruction ?? "오더 지시 확인",
          assignee: selectedQueueItem.assigneeName ?? "미지정",
          assigneeId: workItem.assignedToUserId ?? undefined,
          assigneeInitial: selectedQueueItem.assigneeName?.slice(0, 1) ?? "-",
          workStatus: rowWorkStatus,
        },
      ],
    },
  ];
}

function getDispensingTaskCardTypeLabel(item: OrderQueueItem) {
  if (item.orderTypeCategory === "treatment") return "처치";
  if (item.orderTypeCategory === "dispensing") return "조제";

  return "기타";
}

function getDispensingTaskCardItem(item: OrderQueueItem): EmrTaskQueueCardItem {
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
    secondLineBadgeLabel: getDispensingTaskCardTypeLabel(item),
    secondLineText: item.orderName,
    testId: `order-queue-item-${item.id}`,
  };
}

export function DispensingSidePanel({
  onNavigateWorkspaceSurface,
  workspaceId,
}: ShellComponentProps) {
  const searchParams = useSearchParams();
  const queryEncounterId = searchParams.get("encounterId");
  const { selectedQueueItemIds, setModulePanelOpen, setSelectedQueueItem } = useLayoutStore();
  const { selectDate, selectedDate, todayDate } =
    useSelectedOperatingDate(workspaceId);
  const fulfillmentQueue = useDispensingFulfillmentQueue(selectedDate);
  useQueueRealtimeRefresh({
    onQueueChange: fulfillmentQueue.refresh,
    scopeKey: `dispensing-treatment:${selectedDate}`,
    workspaceId,
  });
  const items = useMemo(
    () => getQueueItemsForWorkspace(workspaceId, fulfillmentQueue.workItems),
    [fulfillmentQueue.workItems, workspaceId]
  );
  const statuses = getOrderQueueStatuses("dispensing");
  useEffect(() => {
    const queryQueueItem = findQueueItemByEncounterId(items, fulfillmentQueue.workItems, queryEncounterId);

    if (queryQueueItem) {
      setSelectedQueueItem("dispensing", queryQueueItem.id);
      return;
    }

    if (queryEncounterId || !items.length || items.some((item) => item.id === selectedQueueItemIds.dispensing)) return;
    setSelectedQueueItem("dispensing", items[0].id);
  }, [
    fulfillmentQueue.workItems,
    items,
    queryEncounterId,
    selectedQueueItemIds.dispensing,
    setSelectedQueueItem,
  ]);

  function handleSelectQueueItem(itemId: string) {
    const item = items.find((candidate) => candidate.id === itemId) ?? null;
    const encounterId = getQueueItemEncounterId(item, fulfillmentQueue.workItems);

    if (encounterId && onNavigateWorkspaceSurface) {
      onNavigateWorkspaceSurface(
        buildWorkspaceSurfaceRoute({
          moduleId: "dispensing",
          params: { encounterId },
          search: searchParams,
          workspaceId,
        }),
        "dispensing",
      );
      return;
    }

    setSelectedQueueItem("dispensing", itemId);
  }

  return (
    <EmrOrderQueueSidePanel
      emptyObjectLabel="조제/처치 업무"
      getTaskCardItem={getDispensingTaskCardItem}
      items={items}
      loading={fulfillmentQueue.status === "loading"}
      loadingTitle="조제/처치 업무를 불러오는 중입니다"
      listLabel="조제/처치 업무"
      statuses={statuses}
      sourceTotalCount={fulfillmentQueue.sourceTotalCount}
      title="조제/처치"
      selectedDate={selectedDate}
      selectedItemId={selectedQueueItemIds.dispensing}
      todayDate={todayDate}
      typeFilterPlacement="list-header"
      onCollapse={() => setModulePanelOpen(false)}
      onDateChange={(date) => {
        selectDate(date);
        setSelectedQueueItem("dispensing", "");
        setSelectedQueueItem("treatment", "");
      }}
      onSelectItem={handleSelectQueueItem}
    />
  );
}

export function DispensingHeader({ moduleId, workspaceId }: ShellComponentProps) {
  const {
    selectedQueueItemIds,
  } =
    useLayoutStore();
  const fulfillmentQueue = useDispensingFulfillmentQueue();
  const allowLegacyFixtureFallback = isLegacySalesDemoWorkspace(workspaceId);
  const items = useMemo(
    () => getQueueItemsForWorkspace(workspaceId, fulfillmentQueue.workItems),
    [fulfillmentQueue.workItems, workspaceId],
  );
  const selectedQueueItem =
    items.find((item) => item.id === selectedQueueItemIds[moduleId]) ??
    (allowLegacyFixtureFallback ? getSelectedOrderQueueItem(moduleId, selectedQueueItemIds[moduleId]) : null);

  if (!selectedQueueItem && !allowLegacyFixtureFallback) return null;

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
        {
          label: "방문목적",
          summary: selectedQueueItem?.receptionType ?? "방문 목적 기록 없음",
        },
        {
          label: "보호자 메모",
          locked: true,
          unavailableReason: "보호자 프로필 메모는 고객 정보 화면에서 관리합니다.",
        },
        {
          label: "환자 메모",
          disabled: true,
          unavailableReason: "환자 상세 메모는 현재 조제/처치 큐 스냅샷에서 제공하지 않습니다.",
        },
        {
          label: "수납 메모",
          disabled: true,
          unavailableReason: "수납 메모는 수납 화면에서 관리합니다.",
        },
      ]}
    />
  );
}

function getDispensingInstructionType(selectedQueueItem: OrderQueueItem | null) {
  return selectedQueueItem?.orderTypeCategory === "treatment" ? "처치" : "조제";
}

function renderInstructionInfoCardValue(value: ReactNode) {
  if (typeof value === "string" || typeof value === "number") {
    return <span className="block min-w-0 truncate">{value}</span>;
  }

  return value;
}

export function DispensingContentAside({ moduleId, workspaceId }: ShellComponentProps) {
  const selectedQueueItemIds = useLayoutStore((state) => state.selectedQueueItemIds);
  const setContentAsideOpen = useLayoutStore((state) => state.setContentAsideOpen);
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<Set<string>>(() => new Set());
  const fulfillmentQueue = useDispensingFulfillmentQueue();
  const allowLegacyFixtureFallback = isLegacySalesDemoWorkspace(workspaceId);
  const items = useMemo(
    () => getQueueItemsForWorkspace(workspaceId, fulfillmentQueue.workItems),
    [fulfillmentQueue.workItems, workspaceId],
  );
  const selectedQueueItem =
    items.find((item) => item.id === selectedQueueItemIds[moduleId]) ??
    (allowLegacyFixtureFallback ? getSelectedOrderQueueItem(moduleId, selectedQueueItemIds[moduleId]) : null);
  const historyLabel = `${getDispensingInstructionType(selectedQueueItem)} 이력`;
  const visibleHistoryGroups = allowLegacyFixtureFallback ? historyGroups : [];
  const totalHistoryCount = visibleHistoryGroups.reduce((total, group) => total + group.count, 0);
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
          {visibleHistoryGroups.map((group) => (
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
    <EmrContentAsideHeader
      count={count}
      label={label}
      onCollapse={onCollapse}
      actions={
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

function getFulfillmentQueueTypeLabel(queueType?: FulfillmentQueueType) {
  if (queueType === "treatment") return "처치 업무 큐";
  if (queueType === "dispensing") return "조제 업무 큐";
  return "업무 큐";
}

function getFulfillmentStatusLabel(status?: FulfillmentWorkItemStatus) {
  if (status === "requested") return "요청";
  if (status === "accepted") return "접수";
  if (status === "in_progress") return "진행중";
  if (status === "completed") return "완료";
  if (status === "cancelled") return "취소";
  if (status === "returned") return "재요청";
  return "미연결";
}

function DispensingFulfillmentQueueNotice({
  onRetry,
  status,
}: {
  onRetry: () => void;
  status: DispensingFulfillmentQueueStatus;
}) {
  if (status === "ready" || status === "idle") return null;

  if (status === "permission_denied") {
    return (
      <EmrInlineAlert
        severity="error"
        title="조제/처치 업무 큐 권한이 없습니다."
        testId="dispensing-fulfillment-state"
      >
        현재 사용자 권한으로 fulfillment work item을 조회할 수 없습니다.
      </EmrInlineAlert>
    );
  }

  if (status === "error") {
    return (
      <EmrInlineAlert
        severity="warning"
        title="조제/처치 업무 큐를 불러오지 못했습니다."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="bg-card"
            data-testid="dispensing-fulfillment-retry-button"
            onClick={onRetry}
          >
            재시도
          </Button>
        }
        testId="dispensing-fulfillment-state"
      >
        기존 지시서 fallback은 유지하지만, 실제 업무 큐 상태는 다시 확인해야 합니다.
      </EmrInlineAlert>
    );
  }

  if (status === "empty") {
    return (
      <EmrInlineAlert
        severity="warning"
        title="조제/처치 업무 큐가 비어 있습니다."
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="bg-card"
            data-testid="dispensing-fulfillment-retry-button"
            onClick={onRetry}
          >
            다시 확인
          </Button>
        }
        testId="dispensing-fulfillment-state"
      >
        선택된 진료 오더가 아직 fulfillment work item으로 전달되지 않았습니다.
      </EmrInlineAlert>
    );
  }

  return (
    <EmrInlineAlert
      severity="info"
      title="조제/처치 업무 큐를 불러오는 중입니다."
      testId="dispensing-fulfillment-state"
    >
      order_fulfillment_work_items readback으로 현재 업무 상태를 확인하고 있습니다.
    </EmrInlineAlert>
  );
}

export function DispensingContent({
  hasRightPanel,
  moduleId,
  workspaceId,
}: ShellComponentProps) {
  const selectedQueueItemIds = useLayoutStore((state) => state.selectedQueueItemIds);
  const fulfillmentQueue = useDispensingFulfillmentQueue();
  const allowLegacyFixtureFallback = isLegacySalesDemoWorkspace(workspaceId);
  const selectedQueueItem = useMemo(() => {
    const items = getQueueItemsForWorkspace(workspaceId, fulfillmentQueue.workItems);
    return items.find((item) => item.id === selectedQueueItemIds[moduleId]) ??
      (allowLegacyFixtureFallback ? getSelectedOrderQueueItem(moduleId, selectedQueueItemIds[moduleId]) : null);
  }, [allowLegacyFixtureFallback, fulfillmentQueue.workItems, moduleId, selectedQueueItemIds, workspaceId]);

  return (
    <DispensingContentBody
      fulfillmentQueue={fulfillmentQueue}
      key={selectedQueueItem?.id ?? "default"}
      hasRightPanel={hasRightPanel}
      moduleId={moduleId}
      allowLegacyFixtureFallback={allowLegacyFixtureFallback}
      selectedQueueItem={selectedQueueItem}
    />
  );
}

function DispensingContentBody({
  allowLegacyFixtureFallback,
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
    allowLegacyFixtureFallback
      ? cloneOrderTableGroups(selectedQueueItemId)
      : createLiveOrderTableGroups(selectedQueueItem, selectedFulfillmentWorkItem)
  );
  const selectedQueueStatusLabel = getQueueStatusLabel(moduleId, selectedQueueItem);
  const [orderGroupFilter, setOrderGroupFilter] = useState<OrderGroupFilter>("all");
  const [collapsedOrderGroupIds, setCollapsedOrderGroupIds] = useState<Set<string>>(() => new Set());
  const [tableDensity, setTableDensity] = useState<EmrTableDensity>("compact");
  const [mutationState, setMutationState] = useState<"idle" | "saving" | "error">("idle");
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
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap">
          <span className="min-w-0 truncate">{instructionRequestedAt}</span>
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

  if (!selectedQueueItem && !allowLegacyFixtureFallback) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--emr-surface-workspace)] emr-text-dense text-muted-foreground">
        아직 조제/처치 요청이 없습니다.
      </div>
    );
  }
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
  const updateSelectedFulfillmentStatus = async (
    target: "in_progress" | "completed" | "requested",
  ) => {
    if (!selectedFulfillmentWorkItem) return true;
    const transitionPath = getFulfillmentTransitionPath(
      selectedFulfillmentWorkItem.status,
      target,
    );
    if (!transitionPath) return false;
    if (!transitionPath.length) return true;

    setMutationState("saving");
    const updated = await fulfillmentQueue.updateStatus(
      selectedFulfillmentWorkItem.id,
      transitionPath,
    );
    if (!updated) {
      setMutationState("error");
      return false;
    }

    setMutationState("idle");
    return true;
  };
  const startGroup = async (groupId: string) => {
    if (selectedFulfillmentWorkItem) {
      const updated = await updateSelectedFulfillmentStatus("in_progress");
      if (!updated) return;
    }
    updateGroup(groupId, startOrderGroup);
  };
  const completeGroup = async (groupId: string) => {
    if (selectedFulfillmentWorkItem) {
      const updated = await updateSelectedFulfillmentStatus("completed");
      if (!updated) return;
    }
    updateGroup(groupId, completeOrderGroup);
  };
  const completeInstruction = async () => {
    if (selectedFulfillmentWorkItem) {
      const updated = await updateSelectedFulfillmentStatus("completed");
      if (!updated) return;
    }
    setTableGroups((current) => current.map(completeInstructionGroup));
  };
  const cancelGroupAssignment = async (groupId: string) => {
    if (selectedFulfillmentWorkItem) {
      const updated = await updateSelectedFulfillmentStatus("requested");
      if (!updated) return;
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
          <div className="grid gap-2">
            <div
              data-slot="instruction-info-card"
              className="grid min-h-[72px] grid-cols-5 rounded-[var(--emr-document-info-radius)] border border-[var(--emr-document-info-divider)] bg-card px-[var(--emr-document-info-padding-x)] py-[var(--emr-document-info-padding-y)]"
            >
              {instructionInfoItems.map(({ label, value }) => (
                <div key={label} className="min-w-0 border-r border-[var(--emr-document-info-divider)] px-[var(--clair-spacing-12)] first:pl-0 last:border-r-0 last:pr-0">
                  <div className="truncate emr-text-metadata font-medium text-[var(--emr-context-bar-chip-label)]">{label}</div>
                  <div
                    data-slot="instruction-info-card-value"
                    className="mt-[var(--clair-spacing-4)] flex min-h-6 min-w-0 items-center overflow-hidden whitespace-nowrap emr-text-dense font-medium text-[var(--emr-context-bar-chip-value)]"
                  >
                    {renderInstructionInfoCardValue(value)}
                  </div>
                </div>
              ))}
            </div>
            {selectedFulfillmentWorkItem ? (
              <div
                data-testid="dispensing-fulfillment-readback"
                className="flex flex-wrap items-center gap-2 rounded-md border bg-[var(--emr-surface-panel)] px-3 py-2 emr-text-metadata text-muted-foreground"
              >
                <Badge variant="secondary">
                  {getFulfillmentQueueTypeLabel(selectedFulfillmentWorkItem.queueType)}
                </Badge>
                <Badge variant="outline">
                  서버 상태 {getFulfillmentStatusLabel(selectedFulfillmentWorkItem.status)}
                </Badge>
                <span>담당 {instructionAssignee}</span>
                <span>오더 {selectedFulfillmentWorkItem.orderId}</span>
              </div>
            ) : null}
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

      <div className="mt-3 grid gap-2">
        <DispensingFulfillmentQueueNotice
          status={fulfillmentQueue.status}
          onRetry={fulfillmentQueue.refresh}
        />
        {mutationState === "error" ? (
          <EmrInlineAlert
            severity="warning"
            title="업무 상태를 저장하지 못했습니다."
            action={
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="bg-card"
                onClick={fulfillmentQueue.refresh}
              >
                다시 조회
              </Button>
            }
            testId="dispensing-fulfillment-mutation-state"
          >
            화면 상태를 임의로 완료 처리하지 않고 서버 readback을 유지했습니다.
          </EmrInlineAlert>
        ) : null}
        {mutationState === "saving" ? (
          <EmrInlineAlert
            severity="info"
            title="업무 상태를 저장하는 중입니다."
            testId="dispensing-fulfillment-mutation-state"
          >
            서버에서 fulfillment work item 상태를 갱신하고 있습니다.
          </EmrInlineAlert>
        ) : null}
      </div>

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
