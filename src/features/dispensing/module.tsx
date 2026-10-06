"use client";

import { useModuleSidePanel, useModuleSidePanelSearchParams } from "@/components/emr/module-side-panel-context";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckIcon,
  ChevronDownIcon,
  MenuIcon,
} from "@/components/icons";
import {
  CdsActionsRefreshCcwIcon,
} from "@/components/cds-icons/actions-and-controls";
import { EmrEmptyState, EmrContentLoadingState } from "@/components/emr/empty-state";
import { EmrCopyLinkButton } from "@/components/emr/copy-link-button";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
import { EmrOrderQueueSidePanel } from "@/components/emr/order-queue-side-panel";
import { EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import {
  EmrInstructionHeaderStack,
  EmrInstructionHistoryToggle,
  EmrInstructionOutputMenu,
  EmrInstructionTitleBar,
} from "@/components/emr/instruction-header-stack";
import { EmrInstructionFilterTabs } from "@/components/emr/instruction-filter-tabs";
import { EmrOrderGroupSection } from "@/components/emr/order-group-section";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import {
  getTaskQueueEventKindFromStatus,
  type EmrTaskQueueCardItem,
} from "@/components/emr/task-queue-card";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupDivider,
  ButtonGroupIconButton,
  ButtonGroupPrimaryButton,
} from "@/components/ui/button-group";
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
import { OrderWorkTable } from "@/features/dispensing/components/order-work-table";
import {
  type FulfillmentTransitionOptions,
} from "@/features/fulfillment/components/work-lifecycle-action";
import { FulfillmentExecutionActions } from "@/features/fulfillment/components/execution-result-dialog";
import {
  getFulfillmentOrderDisplayName,
  getPatientHistoryStatus,
  PatientHistoryAside,
  usePatientFulfillmentHistory,
  type PatientHistoryEntry,
} from "@/features/fulfillment/patient-history-aside";
import { loadFulfillmentEligibleAssigneesRoute } from "@/features/fulfillment/client-eligible-assignees";
import type {
  FulfillmentWorkItemAction,
  FulfillmentWorkItemStatus,
} from "@/features/fulfillment/server-fulfillment-work-item-core";
import {
  isLegacySalesDemoWorkspace,
  resolveWorkspacePathname,
} from "@/lib/emr-domain/demo-workspaces";
import {
  formatOperatingShortTime,
  getOperatingDateFromIso,
} from "@/lib/emr-domain/demo-date";
import {
  WorkspaceDocumentToolbar,
  WorkspaceDocumentWidthToggle,
  useWorkspaceDocumentLayout,
} from "@/shell/workspace-document-layout";
import { useLayoutStore } from "@/stores/layout-store";
import { buildWorkspaceSurfaceRoute } from "@/shell/workspace-surface-route";
import {
  getOrderQueueItems,
  getOrderQueueStatuses,
  getSelectedOrderQueueItem,
} from "@/features/order-queue/data";
import { useQueueRealtimeRefresh } from "@/features/work-queue/queue-realtime-refresh";
import { usePatientLatestVitalItems } from "@/features/patient-vitals/use-patient-latest-vitals";
import { useContextVitalEditor } from "@/features/patient-vitals/use-context-vital-editor";
import { usePatientContextProfileInteractions } from "@/features/customer/use-patient-context-profile-interactions";
import { useSelectedOperatingDate } from "@/features/work-queue/use-selected-operating-date";
import { getAuthRuntimeMode } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";
import {
  allOrderRows,
  currentTechnician,
  getOrderTableGroupsForQueueItem,
  patient,
  technicianUsers,
  type OrderTableGroup,
} from "@/features/dispensing/data";
import { mockStaffUsers } from "@/mocks/emr-domain";
import type {
  Order,
  OrderQueueItem,
  ShellComponentProps,
  TechnicianUser,
  WorkspaceSlotAvailabilityProviderProps,
} from "@/types/emr";
import type { UniversalOrderTaskStatus } from "@/types/emr-domain";
import type { EmrTableDensity } from "@/components/emr/table-density";

type OrderGroupFilter = "all" | "oral" | "other";
type FulfillmentQueueType = "dispensing" | "treatment";
type FulfillmentTransitionCommand =
  | FulfillmentWorkItemAction
  | ({ action: FulfillmentWorkItemAction } & FulfillmentTransitionOptions);
type FulfillmentWorkItem = {
  assignedToUserId?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  encounterId: string;
  originChartId?: string | null;
  originChartCreatedAt?: string | null;
  guardianName?: string | null;
  id: string;
  orderId: string;
  patientId?: string | null;
  patientName?: string | null;
  priority?: string;
  queueType: FulfillmentQueueType;
  requestedByUserId?: string;
  requesterName?: string | null;
  requestCycle: number;
  rowRevision: number;
  sourceSnapshot?: {
    actualDispenseQuantity?: number;
    actualDispenseUnit?: string;
    billingName?: string;
    calculationOutputs?: Record<string, unknown>;
    displayName?: string;
    dispensingAuthoritySnapshot?: Record<string, unknown>;
    dispensingLineage?: {
      clinicalUseAllowed: boolean;
      serviceReviewOnly?: true;
      dispensingProfileSnapshot: Record<string, unknown>;
      sourceClinicalReviewId: string | null;
      sourceMedicationProductId: string;
      sourceMedicationProductRevision: number;
    };
    guardianName?: string;
    detailInputs?: Record<string, unknown>;
    detailSchemaVersion?: number;
    effectiveDisplayName?: string;
    inHospitalOrderName?: string;
    instruction?: string;
    orderDisplayName?: string;
    patientName?: string;
    requestingVetName?: string;
    quantity?: number;
    salesUnit?: string;
    appliedSalesUnit?: string;
    standardOrderName?: string;
    totalRequiredDispenseQuantity?: number;
  };
  status: FulfillmentWorkItemStatus;
  taskAttemptNo?: number | null;
  taskId?: string | null;
  taskStatus?: UniversalOrderTaskStatus | null;
  updatedAt?: string;
  workspaceId: string;
};

type ReviewedMedicationFacts = {
  dosageForm?: string;
  productName?: string;
  routes: string[];
  species: string[];
  strength?: string;
};
type DispensingQuantityFacts = {
  billingQuantity?: number;
  billingUnit?: string;
  prescribedTotal?: number;
};
type DispensingPrescriptionFacts = {
  days?: number;
  dose?: string;
  frequency?: string;
  medicationGuide?: string;
  servings?: number;
  storage?: string;
  timing?: string;
  totalQuantityUnit?: string;
};
type FulfillmentWorkItemReadSummary = {
  date?: string;
  queueType: FulfillmentQueueType;
  statusCounts: Record<FulfillmentWorkItemStatus, number>;
  totalCount: number;
  workspaceId: string;
};
type DispensingFulfillmentQueueStatus =
  "idle" | "loading" | "ready" | "empty" | "error" | "permission_denied";
type DispensingFulfillmentQueueSnapshot = {
  sourceTotalCount?: number;
  status: DispensingFulfillmentQueueStatus;
  workItems: FulfillmentWorkItem[];
};
type DispensingContentBodyProps = Pick<
  ShellComponentProps,
  "hasRightPanel" | "moduleId" | "workspaceId"
> & {
  allowLegacyFixtureFallback: boolean;
  queueItemCount: number;
  selectedDate: string;
  selectedQueueItem: OrderQueueItem | null;
};

export function DispensingSlotAvailabilityProvider({
  children,
  moduleId,
}: WorkspaceSlotAvailabilityProviderProps) {
  const selectedQueueItemId = useSelectedDispensingQueueItemId(moduleId);

  return children({ hasContentAside: Boolean(selectedQueueItemId) });
}

function useSelectedDispensingQueueItemId(moduleId: string) {
  const searchParams = useSearchParams();
  const selectedQueueItemId = useLayoutStore(
    (state) => state.selectedQueueItemIds[moduleId],
  );
  const queryQueueItemId = searchParams.get("queueItemId");
  const queryWorkItemId = searchParams.get("workItemId");
  return queryQueueItemId ?? (queryWorkItemId ? `live-fulfillment-${queryWorkItemId}` : selectedQueueItemId);
}

function getQueueStatusLabel(moduleId: string, item: OrderQueueItem | null) {
  if (!item) return "대기중";

  return (
    getOrderQueueStatuses(moduleId).find(
      (status) => status.id === item.statusId,
    )?.label ?? item.statusId
  );
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

const fulfillmentQueueCache = new Map<
  string,
  DispensingFulfillmentQueueSnapshot
>();
const dispensingQueueRequestIds = new Map<string, number>();
const fulfillmentQueueListeners = new Map<
  string,
  Set<(snapshot: DispensingFulfillmentQueueSnapshot) => void>
>();

const emptyFulfillmentQueueSnapshot: DispensingFulfillmentQueueSnapshot = {
  status: "idle",
  workItems: [],
};

function getFulfillmentQueueCacheKey(
  workspaceId: string,
  selectedDate: string,
) {
  return `${workspaceId}:${selectedDate}:dispensing-treatment`;
}

function setCachedDispensingFulfillmentQueue(
  cacheKey: string,
  snapshot: DispensingFulfillmentQueueSnapshot,
) {
  fulfillmentQueueCache.set(cacheKey, snapshot);
  fulfillmentQueueListeners
    .get(cacheKey)
    ?.forEach((listener) => listener(snapshot));
}

function getFulfillmentReadFailureStatus(result: {
  denialReason?: string;
  status?: number;
}): DispensingFulfillmentQueueStatus {
  if (result.status === 401 || result.status === 403 || result.denialReason === "unauthenticated" || result.denialReason === "permission_missing") {
    return "permission_denied";
  }

  return "error";
}

function useDispensingFulfillmentQueue(selectedDate?: string) {
  const panelPresentation = useModuleSidePanel();
  const enabled = panelPresentation?.visible !== false;
  const [mutationError, setMutationError] = useState<string | null>(null);
  const workspaceId = getWorkspaceIdFromPath();
  const effectiveDate = selectedDate ?? "";
  const cacheKey = getFulfillmentQueueCacheKey(workspaceId, effectiveDate);
  const requestSeq = useRef(0);
  const [queueState, setQueueState] = useState<{ cacheKey: string; snapshot: DispensingFulfillmentQueueSnapshot }>(() => ({ cacheKey, snapshot: { ...emptyFulfillmentQueueSnapshot, status: "loading" } }));
  const snapshot = queueState.cacheKey === cacheKey ? queueState.snapshot : { ...emptyFulfillmentQueueSnapshot, status: "loading" as const };

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    const requestId = (dispensingQueueRequestIds.get(cacheKey) ?? 0) + 1;
    dispensingQueueRequestIds.set(cacheKey, requestId);
    const apply = (next: DispensingFulfillmentQueueSnapshot) => {
      if (dispensingQueueRequestIds.get(cacheKey) !== requestId) return;
      setCachedDispensingFulfillmentQueue(cacheKey, next);
      if (seq === requestSeq.current) setQueueState({ cacheKey, snapshot: next });
    };
    try {
      const [dispensingResult, treatmentResult] = await Promise.allSettled([
        fetch(
          `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=dispensing${effectiveDate ? `&date=${encodeURIComponent(effectiveDate)}` : ""}`,
          {
            headers: { "x-clair-demo-session-user-id": "user-tech" },
          },
        ),
        fetch(
          `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=treatment${effectiveDate ? `&date=${encodeURIComponent(effectiveDate)}` : ""}`,
          {
            headers: { "x-clair-demo-session-user-id": "user-tech" },
          },
        ),
      ]);
      const dispensingResponse = dispensingResult.status === "fulfilled" ? dispensingResult.value : undefined;
      const treatmentResponse = treatmentResult.status === "fulfilled" ? treatmentResult.value : undefined;
      // HTTP denial must win over network or non-JSON failures from the other queue.
      if ([dispensingResponse, treatmentResponse].some(response => response?.status === 401 || response?.status === 403)) {
        apply({ sourceTotalCount: 0, status: "permission_denied", workItems: [] });
        return;
      }
      if (!dispensingResponse || !treatmentResponse) throw new Error("queue_read_failed");
      const dispensingBody = ((await dispensingResponse.json().catch(() => null)) ?? {}) as {
        denialReason?: string;
        ok?: boolean;
        status?: number;
        summary?: FulfillmentWorkItemReadSummary;
        workItems?: FulfillmentWorkItem[];
      };
      const treatmentBody = ((await treatmentResponse.json().catch(() => null)) ?? {}) as {
        denialReason?: string;
        ok?: boolean;
        status?: number;
        summary?: FulfillmentWorkItemReadSummary;
        workItems?: FulfillmentWorkItem[];
      };
      const denied = [
        { status: dispensingResponse.status, denialReason: dispensingBody.denialReason },
        { status: treatmentResponse.status, denialReason: treatmentBody.denialReason },
      ].some(result => getFulfillmentReadFailureStatus(result) === "permission_denied");
      if (denied) {
        apply({ sourceTotalCount: 0, status: "permission_denied", workItems: [] });
        return;
      }
      if (!dispensingResponse.ok || !dispensingBody.ok || !treatmentResponse.ok || !treatmentBody.ok) {
        const previousSnapshot = fulfillmentQueueCache.get(cacheKey);
        apply({
          sourceTotalCount: previousSnapshot?.sourceTotalCount,
          status: "error",
          workItems: previousSnapshot?.workItems ?? [],
        });
        return;
      }
      const nextItems = [
        ...(Array.isArray(dispensingBody.workItems)
          ? dispensingBody.workItems
          : []),
        ...(Array.isArray(treatmentBody.workItems)
          ? treatmentBody.workItems
          : []),
      ];
      const sourceTotalCount =
        (dispensingBody.summary?.totalCount ??
          (Array.isArray(dispensingBody.workItems)
            ? dispensingBody.workItems.length
            : 0)) +
        (treatmentBody.summary?.totalCount ??
          (Array.isArray(treatmentBody.workItems)
            ? treatmentBody.workItems.length
            : 0));
      apply({
        sourceTotalCount,
        status: nextItems.length ? "ready" : "empty",
        workItems: nextItems,
      });
    } catch {
      const previousSnapshot = fulfillmentQueueCache.get(cacheKey);

      apply({
        sourceTotalCount: previousSnapshot?.sourceTotalCount,
        status: "error",
        workItems: previousSnapshot?.workItems ?? [],
      });
    }
  }, [cacheKey, effectiveDate, workspaceId]);

  const refresh = useCallback(() => {
    setQueueState(current => ({ cacheKey, snapshot: { ...(current.cacheKey === cacheKey ? current.snapshot : emptyFulfillmentQueueSnapshot), status: "loading" } }));
    return load();
  }, [cacheKey, load]);

  useEffect(() => {
    // Fetching the server queue is an external sync; rendering decides whether fixtures are allowed.
    if (!enabled) return;
    void load();
    return () => { requestSeq.current += 1; };
  }, [enabled, load]);

  useEffect(() => {
    const listener = (nextSnapshot: DispensingFulfillmentQueueSnapshot) =>
      setQueueState({ cacheKey, snapshot: nextSnapshot });
    const listeners = fulfillmentQueueListeners.get(cacheKey) ?? new Set();

    listeners.add(listener);
    fulfillmentQueueListeners.set(cacheKey, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) fulfillmentQueueListeners.delete(cacheKey);
    };
  }, [cacheKey]);

  const updateStatus = useCallback(
    async (workItemId: string, transitions: FulfillmentTransitionCommand[]) => {
      setMutationError(null);
      let allTransitionsSucceeded = true;
      let expectedRevision = snapshot.workItems.find(
        (item) => item.id === workItemId,
      )?.rowRevision;
      if (!expectedRevision) return false;

      for (const transition of transitions) {
        const command =
          typeof transition === "string" ? { action: transition } : transition;
        const response = await fetch(
          `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}`,
          {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
              "x-clair-demo-session-user-id": "user-tech",
            },
            body: JSON.stringify({
              ...command,
              commandId: crypto.randomUUID(),
              expectedRevision,
            }),
          },
        );
        if (!response.ok) {
          const failure = await response.json().catch(() => null) as { denialReason?: string } | null;
          if (failure?.denialReason === "treatment_medication_link_required") setMutationError("수행 전에 처치 계획을 수정해 약품 오더를 연결해 주세요.");
          if (failure?.denialReason === "treatment_medication_link_invalid") setMutationError("연결 약품 오더가 취소되었거나 확정되지 않았습니다. 같은 진료의 약품 오더를 확인해 주세요.");
          allTransitionsSucceeded = false;
          break;
        }
        const body = (await response.json()) as {
          workItems?: FulfillmentWorkItem[];
        };
        expectedRevision =
          body.workItems?.find((item) => item.id === workItemId)?.rowRevision ??
          expectedRevision + 1;
      }
      await refresh();
      return allTransitionsSucceeded;
    },
    [refresh, snapshot.workItems, workspaceId],
  );

  return {
    refresh,
    sourceTotalCount: snapshot.sourceTotalCount,
    mutationError,
    status: snapshot.status,
    updateStatus,
    workItems: snapshot.workItems,
  };
}

function findFulfillmentForQueueItem(
  item: OrderQueueItem | null,
  workItems: FulfillmentWorkItem[],
) {
  if (!workItems.length) return undefined;
  const queueType =
    item?.orderTypeCategory === "treatment" ? "treatment" : "dispensing";
  const queueItems = workItems.filter(
    (workItem) => workItem.queueType === queueType,
  );
  if (!queueItems.length) return undefined;
  if (!item) return queueItems[0];

  const liveItemPrefix = "live-fulfillment-";
  if (item.id.startsWith(liveItemPrefix)) {
    const workItemId = item.id.slice(liveItemPrefix.length);
    return queueItems.find((workItem) => workItem.id === workItemId);
  }

  return (
    queueItems.find((workItem) => {
      const displayName = getFulfillmentDisplayName(workItem);
      return displayName && item.orderName.includes(displayName);
    }) ??
    queueItems.find((workItem) => {
      const snapshot = workItem.sourceSnapshot;
      return (
        snapshot?.patientName === item.patientName &&
        snapshot?.guardianName === item.guardianName
      );
    })
  );
}

function getQueueItemEncounterId(
  item: OrderQueueItem | null,
  workItems: FulfillmentWorkItem[],
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

  return items.find(
    (item) => getQueueItemEncounterId(item, workItems) === encounterId,
  );
}

function applyFulfillmentToQueueItems(
  items: OrderQueueItem[],
  workItems: FulfillmentWorkItem[],
) {
  const usedWorkItemIds = new Set<string>();

  const mappedItems = items.map((item) => {
    const workItem = workItems
      .filter((candidate) => !usedWorkItemIds.has(candidate.id))
      .find((candidate) => {
        if (item.id === `live-fulfillment-${candidate.id}`) return true;
        const displayName = getFulfillmentDisplayName(candidate);
        return Boolean(displayName && item.orderName.includes(displayName));
      });
    if (!workItem) return item;
    usedWorkItemIds.add(workItem.id);

    return {
      ...item,
      assigneeName: getFulfillmentAssigneeName(workItem) ?? item.assigneeName,
      startedAt:
        workItem.status === "in_progress"
          ? (item.startedAt ?? item.time)
          : item.startedAt,
      statusId: mapFulfillmentToQueueStatusId(workItem.status, item.statusId),
    };
  });

  const liveOnlyItems = workItems
    .filter((workItem) => !usedWorkItemIds.has(workItem.id))
    .filter(
      (workItem) =>
        workItem.queueType === "dispensing" ||
        workItem.queueType === "treatment",
    )
    .map(createLiveQueueItem);

  return [...mappedItems, ...liveOnlyItems];
}

function createLiveQueueItem(workItem: FulfillmentWorkItem): OrderQueueItem {
  const isTreatment = workItem.queueType === "treatment";
  const timestamp =
    workItem.updatedAt ?? workItem.createdAt ?? new Date().toISOString();
  const time = formatOperatingShortTime(timestamp);

  return {
    patientQueue: { assignedToUserId: workItem.assignedToUserId, patientId: workItem.patientId, workspaceId: workItem.workspaceId, status: workItem.status, priority: workItem.priority, requestedAt: workItem.createdAt, originChartId: workItem.originChartId, originChartCreatedAt: workItem.originChartCreatedAt },
    id: `live-fulfillment-${workItem.id}`,
    instructionId: `${isTreatment ? "TR" : "RX"}-${workItem.id.slice(0, 8).toUpperCase()}`,
    patientName:
      workItem.patientName ?? workItem.sourceSnapshot?.patientName ?? "환자 미상",
    guardianName:
      workItem.guardianName ??
      workItem.sourceSnapshot?.guardianName ??
      "보호자 미지정",
    patientAge: "나이 미상",
    patientBreed: "품종 미상",
    patientSex: "성별 미상",
    receptionType: "외래",
    orderType: isTreatment ? "처치" : "조제",
    orderTypeCategory: workItem.queueType,
    orderName: getFulfillmentDisplayName(workItem) ?? "Live order",
    requesterName: getFulfillmentRequesterName(workItem),
    assigneeName: getFulfillmentAssigneeName(workItem),
    startedAt:
      workItem.status === "in_progress" || workItem.status === "completed"
        ? time
        : undefined,
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
      .filter(
        (workItem) =>
          workItem.queueType === "dispensing" ||
          workItem.queueType === "treatment",
      )
      .map(createLiveQueueItem);
  }

  return applyFulfillmentToQueueItems(
    getOrderQueueItems("dispensing"),
    workItems,
  );
}

function getQueueItemsForWorkspace(
  workspaceId: string,
  workItems: FulfillmentWorkItem[],
) {
  return getQueueItemsForRuntime(workItems, {
    allowFixtureItems: isLegacySalesDemoWorkspace(workspaceId),
  });
}

function getFulfillmentAssigneeName(workItem: { assignedToUserId?: string | null }) {
  if (!workItem.assignedToUserId) return undefined;
  if (
    workItem.assignedToUserId === "user-tech" ||
    workItem.assignedToUserId === "user-tech-hayun"
  )
    return "송하윤";
  return undefined;
}

function getFulfillmentRequesterName(workItem: FulfillmentWorkItem) {
  return (
    workItem.requesterName ??
    workItem.sourceSnapshot?.requestingVetName ??
    mockStaffUsers.find((user) => user.id === workItem.requestedByUserId)
      ?.name ??
    "요청자 미지정"
  );
}

function mapFulfillmentToQueueStatusId(
  status: FulfillmentWorkItemStatus,
  fallback: string,
) {
  if (status === "completed") return "completed";
  if (status === "cancelled") return "canceled";
  if (status === "returned") return "reRequested";
  if (status === "in_progress" || status === "paused") return "inProgress";
  if (status === "requested") return "waiting";
  return fallback;
}

function mapFulfillmentToOrderGroupWorkStatus(
  status: FulfillmentWorkItemStatus,
) {
  if (status === "completed") return "완료";
  if (status === "in_progress") return "진행중";
  if (status === "paused") return "일시중지";
  return "요청";
}

function mapFulfillmentToOrderRowWorkStatus(status: FulfillmentWorkItemStatus) {
  if (status === "completed") return "완료";
  return "대기";
}

function getFulfillmentTransitionPath(
  current: FulfillmentWorkItemStatus,
  target: "in_progress" | "completed" | "requested",
): FulfillmentWorkItemAction[] | null {
  if (target === "in_progress") {
    if (current === "requested") return ["start"];
    if (current === "paused") return ["resume"];
    if (current === "in_progress") return [];
    return null;
  }

  if (target === "completed") {
    if (current === "requested")
      return ["start", "complete"];
    if (current === "in_progress") return ["complete"];
    if (current === "paused") return ["resume", "complete"];
    if (current === "completed") return [];
    return null;
  }

  if (current === "requested") return ["unassign"];
  return null;
}

function createLiveOrderTableGroups(
  selectedQueueItem: OrderQueueItem | null,
  workItem?: FulfillmentWorkItem,
): OrderTableGroup[] {
  if (!selectedQueueItem || !workItem) return [];

  const instructionType = getDispensingInstructionType(selectedQueueItem);
  const groupId =
    workItem.queueType === "treatment" ? "live-treatment" : "live-dispensing";
  const groupWorkStatus = mapFulfillmentToOrderGroupWorkStatus(workItem.status);
  const rowWorkStatus = mapFulfillmentToOrderRowWorkStatus(workItem.status);
  const medicationFacts = getReviewedMedicationFacts(workItem);
  const quantityFacts = getDispensingQuantityFacts(workItem);
  const prescriptionFacts = getDispensingPrescriptionFacts(workItem);
  const requestedDate =
    getOperatingDateFromIso(
      workItem.createdAt ?? workItem.updatedAt ?? new Date().toISOString(),
    )?.replaceAll("-", ".") ?? "날짜 미상";

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
          name:
            getFulfillmentDisplayName(workItem) ?? selectedQueueItem.orderName,
          route:
            workItem.queueType === "dispensing"
              ? (medicationFacts?.routes.join(", ") ?? "-")
              : "-",
          dose: prescriptionFacts?.dose ??
            workItem.sourceSnapshot?.instruction ?? selectedQueueItem.orderName,
          frequency: prescriptionFacts?.frequency ?? "-",
          status: workItem.status === "cancelled" ? "취소" : "요청",
          requestedAt: `${requestedDate} ${selectedQueueItem.time}`,
          doctor: selectedQueueItem.requesterName,
          days: prescriptionFacts?.days !== undefined
            ? String(prescriptionFacts.days)
            : "-",
          doseTiming: prescriptionFacts?.timing ?? "-",
          servings: prescriptionFacts?.servings !== undefined
            ? String(prescriptionFacts.servings)
            : "-",
          amount:
            quantityFacts?.billingQuantity !== undefined
              ? String(quantityFacts.billingQuantity)
              : "-",
          unit:
            prescriptionFacts?.totalQuantityUnit ??
            quantityFacts?.billingUnit ??
            "-",
          quantity:
            quantityFacts?.prescribedTotal !== undefined
              ? String(quantityFacts.prescribedTotal)
              : "-",
          dosageForm: medicationFacts?.dosageForm ?? "-",
          storage: prescriptionFacts?.storage ?? "지시 확인",
          medicationGuide: prescriptionFacts?.medicationGuide ??
            workItem.sourceSnapshot?.instruction ?? "오더 지시 확인",
          assignee: selectedQueueItem.assigneeName ?? "미지정",
          assigneeId: workItem.assignedToUserId ?? undefined,
          assigneeInitial: selectedQueueItem.assigneeName?.slice(0, 1) ?? "-",
          workStatus: rowWorkStatus,
        },
      ],
    },
  ];
}

function getReviewedMedicationFacts(
  workItem?: FulfillmentWorkItem,
): ReviewedMedicationFacts | undefined {
  if (workItem?.queueType !== "dispensing") return undefined;
  const lineage = workItem?.sourceSnapshot?.dispensingLineage;
  if (
    !lineage ||
    (!lineage.clinicalUseAllowed && !lineage.serviceReviewOnly) ||
    (!lineage.sourceClinicalReviewId && !lineage.serviceReviewOnly)
  ) {
    return undefined;
  }
  const snapshot = lineage.dispensingProfileSnapshot;
  const productName = readNonEmptyString(
    snapshot.koreanDraftName,
    snapshot.englishProductName,
  );
  const dosageForm = readNonEmptyString(snapshot.dosageForm);
  const routes = readStringArray(snapshot.routes);
  const species = readStringArray(snapshot.targetSpecies);
  const strength = formatStrengthSnapshot(snapshot.strengthSnapshot);

  return { dosageForm, productName, routes, species, strength };
}

function getDispensingQuantityFacts(
  workItem?: FulfillmentWorkItem,
): DispensingQuantityFacts | undefined {
  if (workItem?.queueType !== "dispensing") return undefined;
  const snapshot = workItem.sourceSnapshot;
  const detailInputs = snapshot?.detailInputs;
  const calculationOutputs = snapshot?.calculationOutputs;
  const dispensingAuthority = snapshot?.dispensingAuthoritySnapshot;
  const prescribedTotal = readNonNegativeNumber(detailInputs?.totalQuantity);
  const confirmedDispenseQuantity = readNonNegativeNumber(
    snapshot?.actualDispenseQuantity,
    calculationOutputs?.actualDispenseQuantity,
    calculationOutputs?.plannedPracticalTotalQuantity,
    snapshot?.totalRequiredDispenseQuantity,
    calculationOutputs?.totalRequiredDispenseQuantity,
  );
  const billingQuantity = readNonNegativeNumber(
    dispensingAuthority?.priceBasis === "per_product_unit"
      ? confirmedDispenseQuantity
      : undefined,
    snapshot?.quantity,
  );
  const billingUnit = readNonEmptyString(
    dispensingAuthority?.billingUnit,
    snapshot?.actualDispenseUnit,
    calculationOutputs?.actualDispenseUnit,
    calculationOutputs?.dispenseUnit,
    snapshot?.salesUnit,
    snapshot?.appliedSalesUnit,
  );

  if (
    prescribedTotal === undefined &&
    billingQuantity === undefined &&
    !billingUnit
  ) {
    return undefined;
  }

  return { billingQuantity, billingUnit, prescribedTotal };
}

function getDispensingPrescriptionFacts(
  workItem?: FulfillmentWorkItem,
): DispensingPrescriptionFacts | undefined {
  if (workItem?.queueType !== "dispensing") return undefined;
  const detailInputs = workItem.sourceSnapshot?.detailInputs;
  if (!detailInputs) return undefined;
  const doseAmount = readNonNegativeNumber(detailInputs.dose);
  const doseUnit = readNonEmptyString(detailInputs.doseUnit);
  const days = readNonNegativeNumber(detailInputs.durationDays);
  const frequencyCode = readNonEmptyString(detailInputs.frequency);
  const timingCode = readNonEmptyString(detailInputs.medicationInstruction);
  const storageCode = readNonEmptyString(detailInputs.storageMethod);
  const totalQuantityUnit = readNonEmptyString(detailInputs.totalQuantityUnit);
  const frequencyLabels: Record<string, string> = {
    once: "1회",
    sid: "하루 1회",
    bid: "하루 2회",
    tid: "하루 3회",
    qid: "하루 4회",
    prn: "필요 시",
    custom: "직접 지시",
  };
  const frequencyCounts: Record<string, number> = {
    once: 1,
    sid: 1,
    bid: 2,
    tid: 3,
    qid: 4,
  };
  const timingLabels: Record<string, string> = {
    before_meal: "식전",
    after_meal: "식후",
    with_meal: "식사와 함께",
    any_time: "시간 무관",
  };
  const storageLabels: Record<string, string> = {
    room_temp: "실온",
    room_temp_light_protected: "실온·차광",
    refrigerated: "냉장",
    refrigerated_light_protected: "냉장·차광",
  };
  return {
    days,
    dose:
      doseAmount !== undefined && doseUnit
        ? `${doseAmount} ${doseUnit}`
        : undefined,
    frequency: frequencyCode
      ? (frequencyLabels[frequencyCode] ?? frequencyCode)
      : undefined,
    medicationGuide: readNonEmptyString(detailInputs.guardianNote),
    servings: frequencyCode ? frequencyCounts[frequencyCode] : undefined,
    storage: storageCode
      ? (storageLabels[storageCode] ?? storageCode)
      : undefined,
    timing: timingCode ? (timingLabels[timingCode] ?? timingCode) : undefined,
    totalQuantityUnit,
  };
}

function readNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item.trim()),
      )
    : [];
}

function readNonNegativeNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return undefined;
}

function getFulfillmentDisplayName(workItem?: FulfillmentWorkItem) {
  return getFulfillmentOrderDisplayName(workItem?.sourceSnapshot);
}

function formatStrengthSnapshot(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const strengths = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const numeratorValue = row.numeratorValue;
    const numeratorUnit = readNonEmptyString(row.numeratorUnit);
    if (typeof numeratorValue !== "number" || !numeratorUnit) return [];
    const denominatorValue = row.denominatorValue;
    const denominatorUnit = readNonEmptyString(row.denominatorUnit);
    return [
      `${numeratorValue} ${numeratorUnit}${
        denominatorUnit
          ? `/${typeof denominatorValue === "number" ? denominatorValue : 1} ${denominatorUnit}`
          : ""
      }`,
    ];
  });
  return strengths.length ? strengths.join(" · ") : undefined;
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
  const panelPresentation = useModuleSidePanel();
  const passivePanel = Boolean(panelPresentation && (!panelPresentation.isCurrentModule || !panelPresentation.visible));
  const searchParams = useModuleSidePanelSearchParams();
  const queryEncounterId = searchParams.get("encounterId");
  const queryWorkItemId = searchParams.get("workItemId");
  const queryQueueItemId = searchParams.get("queueItemId");
  const { selectedQueueItemIds, setModulePanelOpen, setSelectedQueueItem } =
    useLayoutStore();
  const { selectDate, selectedDate, todayDate } =
    useSelectedOperatingDate(workspaceId, searchParams.get("date"));
  const fulfillmentQueue = useDispensingFulfillmentQueue(selectedDate);
  useQueueRealtimeRefresh({
    enabled: panelPresentation?.visible !== false,
    onQueueChange: fulfillmentQueue.refresh,
    scopeKey: `dispensing-treatment:${selectedDate}`,
    workspaceId,
  });
  const items = useMemo(
    () => getQueueItemsForWorkspace(workspaceId, fulfillmentQueue.workItems),
    [fulfillmentQueue.workItems, workspaceId],
  );
  const statuses = getOrderQueueStatuses("dispensing");
  useEffect(() => {
    if (passivePanel) return;
    const queryQueueItem =
      (queryQueueItemId ? items.find((item) => item.id === queryQueueItemId) : undefined) ??
      (queryWorkItemId ? items.find((item) => item.id === `live-fulfillment-${queryWorkItemId}`) : undefined) ??
      findQueueItemByEncounterId(items, fulfillmentQueue.workItems, queryEncounterId);

    if (queryQueueItem) {
      setSelectedQueueItem("dispensing", queryQueueItem.id);
      return;
    }

    if (queryEncounterId || queryWorkItemId || queryQueueItemId) {
      setSelectedQueueItem("dispensing", "");
      return;
    }
    if (!selectedQueueItemIds.dispensing) return;
    if (items.some((item) => item.id === selectedQueueItemIds.dispensing))
      return;
    setSelectedQueueItem("dispensing", "");
  }, [passivePanel, fulfillmentQueue.workItems,
    items,
    queryEncounterId,
    queryWorkItemId,
    queryQueueItemId,
    selectedQueueItemIds.dispensing,
    setSelectedQueueItem,
  ]);

  function handleSelectQueueItem(itemId: string) {
    const item = items.find((candidate) => candidate.id === itemId) ?? null;
    const workItem = findFulfillmentForQueueItem(
      item,
      fulfillmentQueue.workItems,
    );

    if (onNavigateWorkspaceSurface) {
      onNavigateWorkspaceSurface(
        buildWorkspaceSurfaceRoute({
          moduleId: "dispensing",
          params: {
            date: selectedDate,
            encounterId: workItem?.encounterId,
            workItemId: workItem?.id,
            queueItemId: itemId,
          },
          removeParams: ["imagingStudyId", "invoiceId", "labResultId"],
          search: searchParams,
          workspaceId,
        }),
        "dispensing",
      );
      return;
    }

    setSelectedQueueItem("dispensing", itemId);
  }
  function handleSelectDate(date: string) {
    selectDate(date);
    setSelectedQueueItem("dispensing", "");
    setSelectedQueueItem("treatment", "");
    if (!onNavigateWorkspaceSurface) return;
    onNavigateWorkspaceSurface(
      buildWorkspaceSurfaceRoute({
        moduleId: "dispensing",
        params: { date },
        removeParams: [
          "encounterId",
          "imagingStudyId",
          "invoiceId",
          "labResultId",
          "patientId",
          "workItemId",
          "queueItemId",
        ],
        search: searchParams,
        workspaceId,
      }),
      "dispensing",
    );
  }

  return (
    <EmrOrderQueueSidePanel
      emptyObjectLabel="조제/처치 업무"
      getTaskCardItem={getDispensingTaskCardItem}
      patientGrouping={{ workspaceId, readable: fulfillmentQueue.status !== "permission_denied", ready: fulfillmentQueue.status === "ready" || fulfillmentQueue.status === "empty" }}
      items={items}
      loading={fulfillmentQueue.status === "loading"}
      loadingTitle="조제/처치 업무를 불러오는 중입니다"
      listLabel="조제/처치 업무"
      statuses={statuses}
      sourceTotalCount={fulfillmentQueue.sourceTotalCount}
      title="조제/처치"
      selectedDate={selectedDate}
      selectedItemId={queryQueueItemId ?? selectedQueueItemIds.dispensing}
      todayDate={todayDate}
      typeFilterPlacement="list-header"
      onCollapse={() => setModulePanelOpen(false)}
      onDateChange={handleSelectDate}
      onSelectItem={handleSelectQueueItem}
    />
  );
}

export function DispensingHeader({
  moduleId,
  workspaceId,
}: ShellComponentProps) {
  const searchParams = useSearchParams();
  const selectedQueueItemId = useSelectedDispensingQueueItemId(moduleId);
  const { selectedDate } = useSelectedOperatingDate(workspaceId, searchParams.get("date"));
  const fulfillmentQueue = useDispensingFulfillmentQueue(selectedDate);
  const allowLegacyFixtureFallback = isLegacySalesDemoWorkspace(workspaceId);
  const items = useMemo(
    () => getQueueItemsForWorkspace(workspaceId, fulfillmentQueue.workItems),
    [fulfillmentQueue.workItems, workspaceId],
  );
  const selectedQueueItem =
    items.find((item) => item.id === selectedQueueItemId) ??
    (allowLegacyFixtureFallback
      ? getSelectedOrderQueueItem(moduleId, selectedQueueItemId)
      : null);
  const selectedWorkItem = findFulfillmentForQueueItem(
    selectedQueueItem,
    fulfillmentQueue.workItems,
  );
  const selectedEncounterId = selectedWorkItem?.encounterId;
  const profileInteractions = usePatientContextProfileInteractions({
    patientId: selectedWorkItem?.patientId,
    workspaceId,
  });
  const latestVitals = usePatientLatestVitalItems({
    encounterId: selectedEncounterId,
    fallbackItems: allowLegacyFixtureFallback
      ? [
          {
            label: "체중",
            value: selectedQueueItem?.patientWeight ?? patient.weight,
          },
          {
            label: "체온",
            value: selectedQueueItem?.patientTemperature ?? patient.temperature,
          },
          {
            label: "호흡",
            value: selectedQueueItem?.patientRespiration ?? patient.respiration,
          },
          {
            label: "혈압",
            value:
              selectedQueueItem?.patientBloodPressure ?? patient.bloodPressure,
          },
        ]
      : undefined,
    workspaceId,
  });
  const { vitalAction, vitalDialog } = useContextVitalEditor({
    encounterId: selectedEncounterId,
    encounterIsActive: Boolean(
      selectedWorkItem &&
        selectedWorkItem.status !== "completed" &&
        selectedWorkItem.status !== "cancelled",
    ),
    latestVitals,
    workspaceId,
  });

  if (!selectedQueueItem) {
    return <EmrMainContentHeader aria-hidden="true" heightMode="fixed" />;
  }

  return (
    <>
    <EmrMainContentHeader heightMode="fixed">
      <EmrPatientContextBar
        key={selectedEncounterId ?? selectedQueueItem.id}
        guardianInteraction={profileInteractions.guardianInteraction}
        guardianItems={[
          {
            label: "보호자",
            value: selectedQueueItem?.guardianName ?? patient.guardian,
          },
        ]}
        patientInteraction={profileInteractions.patientInteraction}
        patientItems={[
          {
            label: "환자",
            value: selectedQueueItem?.patientName ?? patient.name,
          },
          {
            label: "품종",
            value: selectedQueueItem?.patientBreed ?? patient.breed,
          },
          {
            label: "나이",
            value: selectedQueueItem?.patientAge ?? patient.age,
          },
          {
            label: "성별",
            value: selectedQueueItem?.patientSex ?? patient.sex,
          },
        ]}
        vitalAction={vitalAction}
        vitalItems={latestVitals.items}
        memoActions={[
          {
            label: "방문목적",
            summary: selectedQueueItem?.receptionType ?? "방문 목적 기록 없음",
          },
          {
            label: "보호자메모",
            locked: true,
            unavailableReason:
              "보호자 프로필 메모는 고객 정보 화면에서 관리합니다.",
          },
          {
            label: "환자메모",
            disabled: true,
            unavailableReason:
              "환자 상세 메모는 현재 조제/처치 큐 스냅샷에서 제공하지 않습니다.",
          },
          {
            label: "수납메모",
            disabled: true,
            unavailableReason: "수납 메모는 수납 화면에서 관리합니다.",
          },
        ]}
      />
    </EmrMainContentHeader>
    {vitalDialog}
    </>
  );
}

function getDispensingInstructionType(
  selectedQueueItem: OrderQueueItem | null,
) {
  return selectedQueueItem?.orderTypeCategory === "treatment" ? "처치" : "조제";
}

function renderInstructionInfoCardValue(value: ReactNode) {
  if (typeof value === "string" || typeof value === "number") {
    return <span className="block min-w-0 truncate">{value}</span>;
  }

  return value;
}

export function DispensingContentAside({
  moduleId,
  onNavigateWorkspaceSurface,
  workspaceId,
}: ShellComponentProps) {
  const searchParams = useSearchParams();
  const selectedQueueItemId = useSelectedDispensingQueueItemId(moduleId);
  const setContentAsideOpen = useLayoutStore((state) => state.setContentAsideOpen);
  const setSelectedQueueItem = useLayoutStore((state) => state.setSelectedQueueItem);
  const { selectedDate } = useSelectedOperatingDate(workspaceId, searchParams.get("date"));
  const fulfillmentQueue = useDispensingFulfillmentQueue(selectedDate);
  const allowLegacyFixtureFallback = isLegacySalesDemoWorkspace(workspaceId);
  const items = useMemo(
    () => getQueueItemsForWorkspace(workspaceId, fulfillmentQueue.workItems),
    [fulfillmentQueue.workItems, workspaceId],
  );
  const selectedQueueItem =
    items.find((item) => item.id === selectedQueueItemId) ??
    (allowLegacyFixtureFallback
      ? getSelectedOrderQueueItem(moduleId, selectedQueueItemId)
      : null);
  const selectedWorkItem = findFulfillmentForQueueItem(
    selectedQueueItem,
    fulfillmentQueue.workItems,
  );
  const history = usePatientFulfillmentHistory(
    workspaceId,
    selectedWorkItem?.patientId ?? undefined,
    ["dispensing", "treatment"],
  );

  if (!selectedQueueItem) return null;

  const historyItems = history.workItems.filter(
    (item): item is typeof item & { queueType: FulfillmentQueueType } =>
      item.queueType === "dispensing" || item.queueType === "treatment",
  );
  const byTask = new Map<string, typeof historyItems>();
  for (const item of historyItems) {
    const key = item.taskId
      ? `${item.queueType}:${item.taskId}:${item.taskAttemptNo ?? item.requestCycle}:${item.status}:${item.assignedToUserId ?? ""}`
      : item.id;
    byTask.set(key, [...(byTask.get(key) ?? []), item]);
  }
  const entries: PatientHistoryEntry[] = allowLegacyFixtureFallback && !selectedWorkItem
    ? /^\d{2}:\d{2}$/.test(selectedQueueItem.time)
      ? [{
          id: selectedQueueItem.id,
          category: selectedQueueItem.orderTypeCategory === "treatment" ? "treatment" : "dispensing",
          title: selectedQueueItem.orderName,
          timestamp: `${selectedDate}T${selectedQueueItem.time}:00+09:00`,
          status: getQueueStatusLabel(moduleId, selectedQueueItem),
          assignee: selectedQueueItem.assigneeName,
        }]
      : []
    : [...byTask.values()].map((taskItems) => {
        const first = taskItems[0];
        const orderNames = taskItems.map((item) => getFulfillmentDisplayName(item) ?? "오더명 없음");
        const date = getOperatingDateFromIso(first.createdAt) ?? selectedDate;
        const targetModule = first.queueType === "treatment" ? "treatment" : "dispensing";
        return {
          id: first.id,
          category: first.queueType,
          title: orderNames[0],
          orderNames,
          timestamp: first.createdAt,
          status: getPatientHistoryStatus(first.status),
          assignee: first.assignedToUserId
            ? history.assigneeNames[first.assignedToUserId] ?? getFulfillmentAssigneeName(first) ?? "확인 불가"
            : undefined,
          selected: taskItems.some((item) => item.id === selectedWorkItem?.id),
          onSelect: () => {
            if (onNavigateWorkspaceSurface) {
              onNavigateWorkspaceSurface(
                buildWorkspaceSurfaceRoute({
                  moduleId: targetModule,
                  params: { date, encounterId: first.encounterId, workItemId: first.id },
                  removeParams: ["imagingStudyId", "invoiceId", "labResultId"],
                  search: searchParams,
                  workspaceId,
                }),
                targetModule,
              );
            } else if (date === selectedDate) {
              setSelectedQueueItem(targetModule, `live-fulfillment-${first.id}`);
            }
          },
        };
      });

  return <PatientHistoryAside
    id="dispensing-content-aside"
    label="조제/처치 이력"
    entries={entries}
    key={`${workspaceId}:${selectedWorkItem?.patientId ?? selectedQueueItem.id}`}
    kind="fulfillment"
    showCategories
    status={allowLegacyFixtureFallback && !selectedWorkItem ? "ready" : history.status}
    onCollapse={() => setContentAsideOpen(false)}
  />;
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
  return (
    row.status !== "완료" && row.status !== "취소" && row.workStatus !== "완료"
  );
}

function findTechnician(technicianId: string) {
  return (
    technicianUsers.find((technician) => technician.id === technicianId) ??
    currentTechnician
  );
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
    new Set(
      rows
        .map((row) => row.assigneeId)
        .filter((assigneeId): assigneeId is string => Boolean(assigneeId)),
    ),
  );
}

function getAssigneeSummary(assigneeIds: string[]) {
  if (!assigneeIds.length) return "미지정";

  return assigneeIds
    .map((assigneeId) => findTechnician(assigneeId).name)
    .join(" · ");
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
      : row,
  );
}

function startOrderGroup(group: OrderTableGroup) {
  const rows = group.rows.map((row) => {
    if (!isEditableOrder(row)) return row;

    const assignedRow = row.assigneeId
      ? row
      : assignOrder(row, currentTechnician);

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
        },
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

function assignOrderInGroup(
  group: OrderTableGroup,
  rowId: string,
  technicianId: string,
) {
  const technician = findTechnician(technicianId);
  const rows = group.rows.map((row) =>
    row.id === rowId && isEditableOrder(row)
      ? assignOrder(row, technician)
      : row,
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
      <ButtonGroup aria-label={`${group.title} 상태 액션`}>
        <ButtonGroupPrimaryButton
          type="button"
          variant="outline"
          size={size}
          className="border-r-transparent border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]"
        >
          {statusLabel}
        </ButtonGroupPrimaryButton>
        <ButtonGroupDivider className="bg-[var(--emr-status-info-border)]" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <ButtonGroupIconButton
                aria-label={`${group.title} 상태 액션 열기`}
                variant="outline"
                size={size}
                className="border-l-transparent border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]"
              />
            }
          >
            <ChevronDownIcon className={size === "sm" ? "size-3" : undefined} />
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
      </ButtonGroup>
    );
  }

  return (
    <Button type="button" size={size} onClick={onStart}>
      담당하기
      <ChevronDownIcon data-icon="inline-end" />
    </Button>
  );
}

function DispensingFulfillmentQueueNotice({
  onRetry,
  status,
}: {
  onRetry: () => void;
  status: DispensingFulfillmentQueueStatus;
}) {
  if (status === "ready" || status === "idle" || status === "empty" || status === "loading") return null;

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
        기존 지시서 fallback은 유지하지만, 실제 업무 큐 상태는 다시 확인해야
        합니다.
      </EmrInlineAlert>
    );
  }

  return null;
}

export function DispensingContent({
  onNavigateWorkspaceSurface,
  hasRightPanel,
  moduleId,
  workspaceId,
}: ShellComponentProps) {
  const searchParams = useSearchParams();
  const selectedQueueItemId = useSelectedDispensingQueueItemId(moduleId);
  const { selectedDate } = useSelectedOperatingDate(workspaceId, searchParams.get("date"));
  const fulfillmentQueue = useDispensingFulfillmentQueue(selectedDate);
  const allowLegacyFixtureFallback = isLegacySalesDemoWorkspace(workspaceId);
  const currentWorkspaceQueueItems = useMemo(
    () => getQueueItemsForWorkspace(workspaceId, fulfillmentQueue.workItems),
    [fulfillmentQueue.workItems, workspaceId],
  );
  const selectedQueueItem = useMemo(() => {
    return (
      currentWorkspaceQueueItems.find(
        (item) => item.id === selectedQueueItemId,
      ) ??
      (allowLegacyFixtureFallback
        ? getSelectedOrderQueueItem(moduleId, selectedQueueItemId)
        : null)
    );
  }, [
    allowLegacyFixtureFallback,
    currentWorkspaceQueueItems,
    moduleId,
    selectedQueueItemId,
  ]);

  return (
    <DispensingContentBody
      fulfillmentQueue={fulfillmentQueue}
      onOpenChart={onNavigateWorkspaceSurface ? encounterId => onNavigateWorkspaceSurface(
        buildWorkspaceSurfaceRoute({ moduleId: "treatment", params: { encounterId }, workspaceId }), "treatment",
      ) : undefined}
      key={selectedQueueItem?.id ?? "default"}
      hasRightPanel={hasRightPanel}
      moduleId={moduleId}
      workspaceId={workspaceId}
      selectedDate={selectedDate}
      allowLegacyFixtureFallback={allowLegacyFixtureFallback}
      queueItemCount={currentWorkspaceQueueItems.length}
      selectedQueueItem={selectedQueueItem}
    />
  );
}

function DispensingContentBody({
  onOpenChart,
  allowLegacyFixtureFallback,
  hasRightPanel,
  fulfillmentQueue,
  moduleId,
  workspaceId,
  selectedDate,
  queueItemCount,
  selectedQueueItem,
}: DispensingContentBodyProps & {
  onOpenChart?: (encounterId: string) => void;
  fulfillmentQueue: ReturnType<typeof useDispensingFulfillmentQueue>;
}) {
  const documentLayout = useWorkspaceDocumentLayout();
  const {
    contentAsideOpen,
    rightPanelOpen,
    setContentAsideOpen,
    setRightPanelOpen,
  } = useLayoutStore();
  const selectedQueueItemId = selectedQueueItem?.id;
  const selectedFulfillmentWorkItem = useMemo(
    () =>
      findFulfillmentForQueueItem(
        selectedQueueItem,
        fulfillmentQueue.workItems,
      ),
    [fulfillmentQueue.workItems, selectedQueueItem],
  );
  const medicationLinkPending = selectedFulfillmentWorkItem?.queueType === "treatment"
    && selectedFulfillmentWorkItem.sourceSnapshot?.detailSchemaVersion === 3
    && selectedFulfillmentWorkItem.sourceSnapshot.detailInputs?.administrationPolicy === "separate_medication_order"
    && !selectedFulfillmentWorkItem.sourceSnapshot.detailInputs.linkedMedicationOrderId
    && selectedFulfillmentWorkItem.status === "requested";
  const initialTableGroups = useMemo(() =>
    selectedFulfillmentWorkItem
      ? createLiveOrderTableGroups(
          selectedQueueItem,
          selectedFulfillmentWorkItem,
        )
      : allowLegacyFixtureFallback
        ? cloneOrderTableGroups(selectedQueueItemId)
        : createLiveOrderTableGroups(
            selectedQueueItem,
            selectedFulfillmentWorkItem,
          ),
    [
      allowLegacyFixtureFallback,
      selectedFulfillmentWorkItem,
      selectedQueueItem,
      selectedQueueItemId,
    ],
  );
  const tableGroupsSource = selectedFulfillmentWorkItem
    ? `${selectedFulfillmentWorkItem.id}:${selectedFulfillmentWorkItem.rowRevision}`
    : `fixture:${selectedQueueItemId ?? "none"}`;
  const [tableGroupsState, setTableGroupsState] = useState<{
    groups: OrderTableGroup[];
    source: string;
  }>(() => ({ groups: initialTableGroups, source: tableGroupsSource }));
  const tableGroups =
    tableGroupsState.source === tableGroupsSource
      ? tableGroupsState.groups
      : initialTableGroups;
  const setTableGroups = useCallback(
    (updater: SetStateAction<OrderTableGroup[]>) => {
      setTableGroupsState((current) => {
        const currentGroups =
          current.source === tableGroupsSource
            ? current.groups
            : initialTableGroups;
        const groups =
          typeof updater === "function" ? updater(currentGroups) : updater;

        return { groups, source: tableGroupsSource };
      });
    },
    [initialTableGroups, tableGroupsSource],
  );
  const selectedQueueStatusLabel = getQueueStatusLabel(
    moduleId,
    selectedQueueItem,
  );
  const [orderGroupFilter, setOrderGroupFilter] =
    useState<OrderGroupFilter>("all");
  const [collapsedOrderGroupIds, setCollapsedOrderGroupIds] = useState<
    Set<string>
  >(() => new Set());
  const [tableDensity, setTableDensity] = useState<EmrTableDensity>("compact");
  const [mutationState, setMutationState] = useState<
    "idle" | "saving" | "error"
  >("idle");
  const primaryGroup = tableGroups[0];
  const totalOrderCount = tableGroups.reduce(
    (total, group) => total + group.rows.length,
    0,
  );
  const regularOrderCount =
    tableGroups.find((group) => group.id === "oral")?.rows.length ?? 0;
  const otherOrderCount =
    tableGroups.find((group) => group.id === "other")?.rows.length ?? 0;
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
  const primaryAssigneeSummary = primaryGroup
    ? getAssigneeSummary(primaryGroup.assigneeIds)
    : "미지정";
  const primaryStartStatus =
    primaryGroup?.workStatus === "진행중"
      ? statusLabel
      : primaryGroup?.workStatus === "완료"
        ? completeLabel
        : "대기중";
  const instructionRequestedAt =
    primaryGroup?.rows[0]?.requestedAt ?? "2026.04.14 10:30";
  const instructionPatientSummary = getQueuePatientSummary(selectedQueueItem);
  const instructionRequester = selectedQueueItem?.requesterName ?? "이수지";
  const instructionAssignee =
    selectedQueueItem?.assigneeName ?? primaryAssigneeSummary;
  const instructionStartStatus = selectedQueueItem
    ? selectedQueueStatusLabel
    : primaryStartStatus;
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
    updater: (group: OrderTableGroup) => OrderTableGroup,
  ) => {
    setTableGroups((current) =>
      current.map((group) => (group.id === groupId ? updater(group) : group)),
    );
  };

  if (fulfillmentQueue.status === "loading" && !selectedQueueItem) {
    return <EmrContentLoadingState testId="dispensing-content-loading-state" title="조제/처치 업무를 불러오는 중입니다" />;
  }

  if (!selectedQueueItem && (fulfillmentQueue.status === "error" || fulfillmentQueue.status === "permission_denied")) {
    return <div className="flex h-full min-h-0 flex-col px-4 py-3"><DispensingFulfillmentQueueNotice status={fulfillmentQueue.status} onRetry={fulfillmentQueue.refresh} /></div>;
  }

  if (!selectedQueueItem) {
    const sourceQueueItemCount =
      fulfillmentQueue.sourceTotalCount ?? queueItemCount;
    const hasQueueItems = sourceQueueItemCount > 0;

    return (
      <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] px-4 py-3">
        <DispensingFulfillmentQueueNotice
          status={fulfillmentQueue.status}
          onRetry={fulfillmentQueue.refresh}
        />
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <EmrEmptyState
            kind={hasQueueItems ? "no-scope-result" : "upstream-pending"}
            priority="supporting"
            size="xl"
            surface="content"
            description={
              hasQueueItems
                ? "대기열에서 조제/처치 업무를 선택하면 상세가 표시됩니다."
                : "오늘 표시할 조제/처치 업무가 없습니다."
            }
            primaryAction={
              hasQueueItems ? undefined : (
                <Button
                  size="default"
                  variant="outline"
                  roundness="round"
                  className="border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] shadow-[var(--clair-shadow-xs)]"
                  disabled={fulfillmentQueue.status === "loading"}
                  onClick={() => void fulfillmentQueue.refresh()}
                >
                  <CdsActionsRefreshCcwIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />
                  새로고침
                </Button>
              )
            }
            testId="dispensing-content-empty-state"
            title={
              hasQueueItems
                ? "조제/처치 대기열에서 항목을 선택해 주세요"
                : "조제/처치 업무가 없습니다"
            }
          />
        </div>
      </div>
    );
  }
  const completeGroupRows = (groupId: string, rowIds: string[]) => {
    setTableGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId) return group;

        const rows = completeOrders(group.rows, rowIds);
        const activeRows = rows.filter((row) => row.status !== "취소");
        const allActiveRowsCompleted = activeRows.every(
          (row) => row.workStatus === "완료",
        );

        return {
          ...group,
          workStatus: allActiveRowsCompleted ? "완료" : group.workStatus,
          assigneeIds: getGroupAssigneeIds(rows),
          rows,
        };
      }),
    );
  };
  const assignGroupOrder = (
    groupId: string,
    rowId: string,
    technicianId: string,
  ) => {
    updateGroup(groupId, (group) =>
      assignOrderInGroup(group, rowId, technicianId),
    );
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
  const transitionSelectedFulfillment = async (
    action: FulfillmentWorkItemAction,
    options?: FulfillmentTransitionOptions,
  ) => {
    if (!selectedFulfillmentWorkItem) return false;
    setMutationState("saving");
    const updated = await fulfillmentQueue.updateStatus(
      selectedFulfillmentWorkItem.id,
      [{ action, ...options }],
    );
    setMutationState(updated ? "idle" : "error");
    return updated;
  };
  const loadSelectedEligibleAssignees = () =>
    selectedFulfillmentWorkItem
      ? loadFulfillmentEligibleAssigneesRoute({
          workItemId: selectedFulfillmentWorkItem.id,
          workspaceId: selectedFulfillmentWorkItem.workspaceId,
        })
      : Promise.resolve([]);
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

  const titleBar = (
    <EmrInstructionTitleBar
            className={documentLayout ? "min-h-9 flex-wrap gap-2" : "px-4"}
            title={`${instructionType} 지시서`}
            icon={
              <EmrInstructionHistoryToggle
                ariaLabelPrefix={historyLabel}
                controls={documentLayout?.historyControlsId ?? "dispensing-content-aside"}
                expanded={documentLayout?.historyVisible ?? contentAsideOpen}
                tooltipLabel={historyLabel}
                onClick={documentLayout?.toggleHistory ?? (() => setContentAsideOpen(!contentAsideOpen))}
              />
            }
            badge={
              <EmrCopyLinkButton
                ariaLabel={`${instructionType} 지시서 링크 복사`}
                date={selectedDate}
                moduleId="dispensing"
                params={{
                  encounterId: selectedFulfillmentWorkItem?.encounterId,
                  workItemId: selectedFulfillmentWorkItem?.id,
                  queueItemId: selectedQueueItem.id,
                }}
                workspaceId={workspaceId}
              />
            }
            actions={
              <>
                <WorkspaceDocumentWidthToggle />
                {hasRightPanel && instructionType === "처치" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-card"
                    aria-label={
                      rightPanelOpen ? "우측 패널 접기" : "우측 패널 펼치기"
                    }
                    onClick={() => setRightPanelOpen(!rightPanelOpen)}
                  >
                    {rightPanelOpen ? "우측 패널 접기" : "우측 패널 펼치기"}
                  </Button>
                ) : null}
                {selectedFulfillmentWorkItem ? (
                  <FulfillmentExecutionActions
                    workspaceId={selectedFulfillmentWorkItem.workspaceId}
                    workItemId={selectedFulfillmentWorkItem.id}
                    onSaved={fulfillmentQueue.refresh}
                    activityLabel={instructionType}
                    assignedToUserId={
                      selectedFulfillmentWorkItem.assignedToUserId
                    }
                    busy={mutationState === "saving"}
                    completeLabel={completeLabel}
                    loadEligibleAssignees={loadSelectedEligibleAssignees}
                    onTransition={transitionSelectedFulfillment}
                    size="sm"
                    startPhase={
                      selectedFulfillmentWorkItem.queueType === "treatment"
                        ? "treatment"
                        : "dispensing"
                    }
                    status={selectedFulfillmentWorkItem.status}
                  />
                ) : primaryGroup ? (
                  <GroupStatusAction
                    group={primaryGroup}
                    statusLabel={statusLabel}
                    completeLabel={completeLabel}
                    size="sm"
                    onStart={() => startGroup(primaryGroup.id)}
                    onComplete={completeInstruction}
                    onCancelAssignment={() =>
                      cancelGroupAssignment(primaryGroup.id)
                    }
                  />
                ) : null}
                <EmrInstructionOutputMenu />
              </>
            }
          />
  );

  return (
    <div data-slot="dispensing-content" className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] pb-2">
      {documentLayout ? <WorkspaceDocumentToolbar>{titleBar}</WorkspaceDocumentToolbar> : null}
      <EmrInstructionHeaderStack
        chartAligned={!documentLayout}
        titleBar={documentLayout ? null : titleBar}
        orderInfo={
          <div className="grid gap-2">
            <div
              data-slot="instruction-info-card"
              className="grid min-h-[72px] grid-cols-5 rounded-[var(--emr-document-info-radius)] border border-[var(--emr-document-info-divider)] bg-card px-[var(--emr-document-info-padding-x)] py-[var(--emr-document-info-padding-y)]"
            >
              {instructionInfoItems.map(({ label, value }) => (
                <div
                  key={label}
                  className="min-w-0 border-r border-[var(--emr-document-info-divider)] px-[var(--clair-spacing-12)] first:pl-0 last:border-r-0 last:pr-0"
                >
                  <div className="truncate emr-text-metadata font-medium text-[var(--emr-context-bar-chip-label)]">
                    {label}
                  </div>
                  <div
                    data-slot="instruction-info-card-value"
                    className="mt-[var(--clair-spacing-4)] flex min-h-6 min-w-0 items-center overflow-hidden whitespace-nowrap emr-text-dense font-medium text-[var(--emr-context-bar-chip-value)]"
                  >
                    {renderInstructionInfoCardValue(value)}
                  </div>
                </div>
              ))}
            </div>
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

      <div className={cn("mt-3 grid gap-2", !documentLayout && "px-4")}>
        {medicationLinkPending && selectedFulfillmentWorkItem ? <EmrInlineAlert severity="warning" title="수행 전 약품 오더 연결이 필요합니다."
          action={onOpenChart ? <Button size="sm" variant="outline" onClick={() => onOpenChart(selectedFulfillmentWorkItem.encounterId)}>차트에서 약품 오더 연결</Button> : undefined}>
          차트에서 ‘{getFulfillmentDisplayName(selectedFulfillmentWorkItem) ?? "처치"}’의 오더 정정을 열어 같은 진료의 약품 오더를 연결해 주세요. 약품 오더가 없다면 먼저 추가하고 확정해 주세요.
        </EmrInlineAlert> : null}
        <DispensingFulfillmentQueueNotice
          status={fulfillmentQueue.status}
          onRetry={fulfillmentQueue.refresh}
        />
        {mutationState === "error" ? (
          <EmrInlineAlert
            severity="warning"
            title={fulfillmentQueue.mutationError ?? "업무 상태를 저장하지 못했습니다."}
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

      <ScrollArea
        data-slot="instruction-result-scroll-area"
        className="min-h-0 flex-1"
      >
        <div
          data-slot="instruction-result-scroll-content"
          className={cn("flex flex-col gap-4 pb-10 pt-4", !documentLayout && "px-4")}
        >
          {visibleTableGroups.map((group, section) => {
            const completedCount = group.rows.filter(
              (row) => row.workStatus === "완료",
            ).length;
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
                    <div className="h-[18px] w-px bg-[var(--emr-border-subtle)]" />
                    <Button variant="outline" size="xs" className="bg-card">
                      필터 1
                    </Button>
                    <EmrTableDensitySelector
                      value={tableDensity}
                      onValueChange={setTableDensity}
                    />
                    <Button
                      variant="outline"
                      size="xs"
                      className="max-w-24 bg-card"
                    >
                      <span className="truncate">
                        {getAssigneeSummary(group.assigneeIds)}
                      </span>
                    </Button>
                    {!selectedFulfillmentWorkItem ? (
                      <GroupStatusAction
                        group={group}
                        statusLabel={statusLabel}
                        completeLabel={completeLabel}
                        onStart={() => startGroup(group.id)}
                        onComplete={() => completeGroup(group.id)}
                        onCancelAssignment={() =>
                          cancelGroupAssignment(group.id)
                        }
                      />
                    ) : null}
                  </>
                }
                onToggle={() => toggleOrderGroup(group.id)}
              >
                <OrderWorkTable
                  completionDisabled={Boolean(selectedFulfillmentWorkItem)}
                  density={tableDensity}
                  onDensityChange={setTableDensity}
                  rows={group.rows}
                  sectionId={`section-${section}`}
                  showDensitySelector={false}
                  technicians={technicianUsers}
                  onCompleteRows={(rowIds) =>
                    completeGroupRows(group.id, rowIds)
                  }
                  onAssignOrder={(rowId, technicianId) =>
                    assignGroupOrder(group.id, rowId, technicianId)
                  }
                />
              </EmrOrderGroupSection>
            );
          })}
          {!visibleTableGroups.length ? (
            <div className="rounded-lg border border-[var(--emr-border-subtle)] bg-card p-8 text-center emr-text-dense font-medium text-muted-foreground">
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
  const order =
    allOrderRows.find((row) => row.id === activeDrawer?.id) ?? allOrderRows[0];
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
        <Button variant="outline" size="default">
          변경 이력
        </Button>
        <Button size="default">수정 저장</Button>
      </div>
    </div>
  );
}

function DoseInput({ id, initialDose }: { id: string; initialDose: string }) {
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
