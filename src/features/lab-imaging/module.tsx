"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CdsActionsListFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsFilesFileIcon,
  CdsFilesImageIcon,
} from "@/components/cds-icons/files-and-layout";
import {
  CdsNavigationChevronsLeftIcon,
  CdsNavigationChevronsRightIcon,
} from "@/components/cds-icons/navigation";
import {
  CdsUtilitiesHistoryIcon,
  CdsUtilitiesSortIcon,
} from "@/components/cds-icons/utilities-and-misc";
import {
  ChevronDownIcon,
  DownloadIcon,
  PrinterIcon,
} from "@/components/icons";
import {
  EmrInstructionHeaderStack,
  EmrInstructionHistoryToggle,
  EmrInstructionTitleBar,
} from "@/components/emr/instruction-header-stack";
import { EmrInstructionFilterTabs } from "@/components/emr/instruction-filter-tabs";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrContentAsidePanel } from "@/components/emr/content-aside-panel";
import { EmrContentHistoryGroup, EmrContentHistoryItem } from "@/components/emr/content-history-list";
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
import { EmrOrderGroupSection } from "@/components/emr/order-group-section";
import { EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import {
  EMR_SIDE_PANEL_COLLAPSE_EASE,
  EMR_SIDE_PANEL_COLLAPSE_EXIT_EASE,
  EmrSidePanelCollapsibleGroup,
} from "@/components/emr/side-panel-collapsible-group";
import {
  EmrTaskQueueCard,
  getTaskQueueEventKindFromStatus,
  joinTaskQueueSummary,
  type EmrTaskQueueCardItem,
} from "@/components/emr/task-queue-card";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getImagingDetail,
  getImagingWorkItems,
  getLabDetail,
  getLabWorkItems,
  getStaffName,
  type ImagingDetail,
  type ImagingWorkItem,
  type LabDetail,
  type LabWorkItem,
} from "@/features/lab-imaging/data";
import { LabImagingStatusAction } from "@/features/lab-imaging/components/status-action";
import { useLabImagingStore } from "@/features/lab-imaging/store";
import { useSelectedOperatingDate } from "@/features/work-queue/use-selected-operating-date";
import { getChartEncounter } from "@/features/chart/data";
import { readChartLiveEncounterHandoff } from "@/features/chart/live-encounter-handoff";
import type { EmrTableDensity } from "@/components/emr/table-density";
import {
  getPatientDisplayAge,
  getPatientSexLabel,
  getSpeciesLabel,
} from "@/features/reception/data";
import { getAuthRuntimeMode } from "@/lib/supabase/config";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
import {
  isLegacySalesDemoWorkspace,
  resolveWorkspacePathname,
} from "@/lib/emr-domain/demo-workspaces";
import {
  addDaysToIsoDate,
  formatKoreanOperatingDateLabel,
} from "@/lib/emr-domain/demo-date";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import { buildWorkspaceSurfaceRoute } from "@/shell/workspace-surface-route";
import type { ShellComponentProps } from "@/types/emr";
import type {
  EmrAttachment,
  EmrOrder,
  Encounter,
  EquipmentReceipt,
  Guardian,
  ImagingStudyStatus,
  ImagingStudy,
  LabResult,
  Patient,
} from "@/types/emr-domain";

const formatShortDateTime = (dateTime?: string) =>
  dateTime ? dateTime.slice(2, 16).replace("T", " ").replaceAll("-", ".") : "-";

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "-";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

const getReceptionTypeLabel = (encounter: Encounter) => encounter.appointmentId ? "예약" : "외래";

const getTaskQueueClockTime = (dateTime?: string) => formatShortDateTime(dateTime).slice(9).trim() || "-";
const getOrderRequesterName = (order?: EmrOrder) => getStaffName(order?.requestedByUserId) ?? "이수지";
const getOrderEventTime = (order?: EmrOrder, fallbackDateTime?: string) =>
  getTaskQueueClockTime(order?.requestedAt ?? fallbackDateTime);

function getLabTaskQueueCardItem({
  actionTestId,
  item,
  testId,
}: {
  actionTestId: string;
  item: LabWorkItem;
  testId: string;
}): EmrTaskQueueCardItem {
  const orderLabel = item.order?.displayName ?? item.result.resultName;

  return {
    actionAriaLabel: `${item.patient.name} ${orderLabel} 더보기`,
    actionTestId,
    assigneeName: item.technicianName,
    eventActorName: getOrderRequesterName(item.order),
    eventKind: getTaskQueueEventKindFromStatus(item.order?.status),
    eventTime: getOrderEventTime(item.order, item.result.receivedAt ?? item.result.collectedAt),
    guardianName: item.primaryGuardian?.name ?? "보호자 미지정",
    patientName: item.patient.name,
    receptionType: getReceptionTypeLabel(item.encounter),
    secondLineBadgeLabel: item.result.resultName,
    secondLineText: orderLabel,
    testId,
  };
}

function getLabGroupTaskQueueCardItem(group: LabChartGroup): EmrTaskQueueCardItem {
  const latestItem = group.items[0];
  const categorySummary = joinTaskQueueSummary(
    group.items.map((item) => item.result.resultName),
    "검사"
  );
  const orderSummary = joinTaskQueueSummary(
    group.items.map((item) => item.order?.displayName ?? item.result.resultName),
    "검사 오더"
  );

  return {
    actionAriaLabel: `${group.patient.name} 임상병리검사 차트 더보기`,
    actionTestId: `lab-chart-item-action-${group.encounter.id}`,
    assigneeName: latestItem?.technicianName,
    eventActorName: getOrderRequesterName(latestItem?.order),
    eventKind: getTaskQueueEventKindFromStatus(latestItem?.order?.status),
    eventTime: getOrderEventTime(latestItem?.order, latestItem?.result.receivedAt ?? latestItem?.result.collectedAt),
    guardianName: group.primaryGuardianName ?? "보호자 미지정",
    patientName: group.patient.name,
    receptionType: getReceptionTypeLabel(group.encounter),
    secondLineBadgeLabel: categorySummary,
    secondLineText: orderSummary,
    testId: `lab-chart-card-${group.encounter.id}`,
  };
}

function getImagingTaskQueueCardItem({
  actionTestId,
  item,
  testId,
}: {
  actionTestId: string;
  item: ImagingWorkItem;
  testId: string;
}): EmrTaskQueueCardItem {
  const orderLabel = item.order?.displayName ?? `${item.study.modality} ${item.study.bodyPart}`;

  return {
    actionAriaLabel: `${item.patient.name} ${orderLabel} 더보기`,
    actionTestId,
    assigneeName: item.radiologistName,
    eventActorName: getOrderRequesterName(item.order),
    eventKind: getTaskQueueEventKindFromStatus(item.order?.status),
    eventTime: getOrderEventTime(item.order, item.study.capturedAt ?? item.study.requestedAt),
    guardianName: item.primaryGuardian?.name ?? "보호자 미지정",
    patientName: item.patient.name,
    receptionType: getReceptionTypeLabel(item.encounter),
    secondLineBadgeLabel: item.study.modality,
    secondLineText: orderLabel,
    testId,
  };
}

function getImagingGroupTaskQueueCardItem(group: ImagingChartGroup): EmrTaskQueueCardItem {
  const latestItem = group.items[0];
  const categorySummary = joinTaskQueueSummary(
    group.items.map((item) => item.study.modality),
    "영상"
  );
  const orderSummary = joinTaskQueueSummary(
    group.items.map((item) => item.order?.displayName ?? `${item.study.modality} ${item.study.bodyPart}`),
    "영상 오더"
  );

  return {
    actionAriaLabel: `${group.patient.name} 영상검사 차트 더보기`,
    actionTestId: `imaging-chart-item-action-${group.encounter.id}`,
    assigneeName: latestItem?.radiologistName,
    eventActorName: getOrderRequesterName(latestItem?.order),
    eventKind: getTaskQueueEventKindFromStatus(latestItem?.order?.status),
    eventTime: getOrderEventTime(latestItem?.order, latestItem?.study.capturedAt ?? latestItem?.study.requestedAt),
    guardianName: group.primaryGuardianName ?? "보호자 미지정",
    patientName: group.patient.name,
    receptionType: getReceptionTypeLabel(group.encounter),
    secondLineBadgeLabel: categorySummary,
    secondLineText: orderSummary,
    testId: `imaging-chart-card-${group.encounter.id}`,
  };
}

const getActionableLabRows = (result: LabResult) =>
  result.rows.filter((row) => row.judgment !== "normal" && row.judgment !== "not_judged");

type LabResultRow = LabResult["rows"][number];
type LabJudgment = LabResultRow["judgment"];
type LabAssignmentStatus = "requested" | "in_progress" | "completed";
type LabHistoryGroup = {
  count: number;
  date: string;
  items: Array<{
    description: string;
    title: string;
  }>;
};

const currentLabAssignee = {
  id: "user-tech-hayun",
  name: getStaffName("user-tech-hayun") ?? "송하윤",
};

const parseReferenceRange = (referenceRange?: string) => {
  if (!referenceRange) return null;

  const match = referenceRange.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const min = Number(match[1]);
  const max = Number(match[2]);

  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return null;

  return { min, max };
};

const getRangeScale = (row: LabResultRow) => {
  const range = parseReferenceRange(row.referenceRange);
  const value = Number(row.value);

  if (!range || !Number.isFinite(value)) {
    return {
      lowerStart: 0,
      normalStart: 28,
      normalEnd: 72,
      upperEnd: 100,
      valuePercent: 50,
    };
  }

  const span = range.max - range.min;
  const lowerBound = range.min - span * 0.35;
  const upperBound = range.max + span * 0.35;
  const total = upperBound - lowerBound;
  const toPercent = (numericValue: number) =>
    Math.min(96, Math.max(4, ((numericValue - lowerBound) / total) * 100));

  return {
    lowerStart: 4,
    normalStart: toPercent(range.min),
    normalEnd: toPercent(range.max),
    upperEnd: 96,
    valuePercent: toPercent(value),
  };
};

const getDerivedLabJudgment = (row: LabResultRow, value: string): LabJudgment => {
  const range = parseReferenceRange(row.referenceRange);
  const numericValue = Number(value);

  if (!range || !Number.isFinite(numericValue)) return "not_judged";
  if (numericValue < range.min) return "low";
  if (numericValue > range.max) return "high";

  return "normal";
};

const rangeStateByJudgment: Partial<Record<LabResultRow["judgment"], { label: string; markerClassName: string }>> = {
  critical: {
    label: "초과",
    markerClassName: "bg-[var(--emr-status-danger-text)] fill-[var(--emr-status-danger-text)]",
  },
  high: {
    label: "초과",
    markerClassName: "bg-[var(--emr-status-warning-text)] fill-[var(--emr-status-warning-text)]",
  },
  low: {
    label: "미달",
    markerClassName: "bg-[var(--emr-status-info-text)] fill-[var(--emr-status-info-text)]",
  },
  normal: {
    label: "정상",
    markerClassName: "bg-[var(--emr-status-success-text)] fill-[var(--emr-status-success-text)]",
  },
};

const judgmentBadgeClassName: Record<LabResultRow["judgment"], string> = {
  critical:
    "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
  high:
    "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
  low:
    "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  normal:
    "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
  not_judged:
    "border-[var(--emr-status-neutral-border)] bg-[var(--emr-status-neutral-bg)] text-[var(--emr-status-neutral-text)]",
};

const labStatusOrder: LabResult["status"][] = ["pending", "received", "entered", "completed", "reviewed"];

const labStatusGroupLabel: Record<LabResult["status"], string> = {
  pending: "검사대기",
  received: "수신",
  entered: "결과입력",
  completed: "완료",
  reviewed: "확인",
};

const labStatusGroupColorToken: Record<LabResult["status"], string> = {
  pending: "--emr-status-neutral-text",
  received: "--emr-status-info-text",
  entered: "--emr-status-warning-text",
  completed: "--emr-status-success-text",
  reviewed: "--emr-status-success-text",
};

type LabResultTab = "all" | "cbc" | "chemistry";
type LabQueueView = "order" | "chart";
type ImagingQueueView = "order" | "chart";
type ImagingReadingStatus = "requested" | "reading" | "completed";
type FulfillmentQueueType = "lab" | "imaging";
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
    detail?: Record<string, unknown>;
    guardianName?: string;
    instruction?: string;
    orderDisplayName?: string;
    patientName?: string;
    requestingVetName?: string;
    serviceItemId?: string;
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
type FulfillmentQueueSnapshot = {
  summary?: FulfillmentWorkItemReadSummary;
  workItems: FulfillmentWorkItem[];
};
type LabResultSheetCatalogItem = {
  categoryId: string;
  categoryName: string;
  id: string;
  resultInputType: "number" | "text" | "select" | "positive_negative" | "grade";
  resultUnit?: string;
  sortOrder: number;
  testItemName: string;
};
type LabResultSheetCatalogStatus = "idle" | "loading" | "ready" | "empty" | "error" | "permission_denied";
type LabResultSheetCatalogLoadResult =
  | {
      items: LabResultSheetCatalogItem[];
      status: "ready";
    }
  | {
      items: [];
      status: Exclude<LabResultSheetCatalogStatus, "idle" | "loading" | "ready">;
    };
type LabResultSaveOutcome =
  | {
      ok: true;
    }
  | {
      message: string;
      ok: false;
      reason: "error" | "invalid" | "permission_denied";
      retryable: boolean;
    };

function getInitialImagingReadingStatus(status?: ImagingStudyStatus): ImagingReadingStatus {
  if (status === "read" || status === "reviewed") return "completed";
  if (status === "reading") return "reading";
  return "requested";
}

const labResultTabItems = [
  { value: "all" as const, label: "전체" },
  { value: "cbc" as const, label: "CBC" },
  { value: "chemistry" as const, label: "혈청화학" },
];

const labQueueViewItems = [
  { value: "order" as const, label: "오더별" },
  { value: "chart" as const, label: "차트별" },
];

const imagingQueueViewItems = [
  { value: "order" as const, label: "오더별" },
  { value: "chart" as const, label: "차트별" },
];

const fulfillmentQueueCache = new Map<string, FulfillmentQueueSnapshot>();
const fulfillmentQueueListeners = new Map<
  string,
  Set<(snapshot: FulfillmentQueueSnapshot) => void>
>();

function getFulfillmentQueueCacheKey(
  workspaceId: string,
  queueType: FulfillmentQueueType,
  selectedDate: string,
) {
  return `${workspaceId}:${selectedDate}:${queueType}`;
}

function setCachedFulfillmentQueue(cacheKey: string, snapshot: FulfillmentQueueSnapshot) {
  fulfillmentQueueCache.set(cacheKey, snapshot);
  fulfillmentQueueListeners.get(cacheKey)?.forEach((listener) => listener(snapshot));
}

function useWorkspaceIdFromPath() {
  if (typeof window === "undefined") return resolveWorkspacePathname();

  return resolveWorkspacePathname(window.location.pathname);
}

function isLiveAuthRuntime() {
  return getAuthRuntimeMode().authProvider === "supabase";
}

function getSnapshotString(
  snapshot: FulfillmentWorkItem["sourceSnapshot"] | undefined,
  key: keyof NonNullable<FulfillmentWorkItem["sourceSnapshot"]>,
  fallback: string,
) {
  const value = snapshot?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getSnapshotDetailString(
  snapshot: FulfillmentWorkItem["sourceSnapshot"] | undefined,
  key: string,
  fallback: string,
) {
  const value = snapshot?.detail?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

const stagingDemoEncounterBridgeByResolvedId: Record<string, string> = {
  "19426000-0000-4000-8000-000000000001": "encounter-kong-260501",
  "19426000-0000-4000-8000-000000000002": "encounter-nabi-260414",
  "19426000-0000-4000-8000-000000000003": "encounter-dubu-260501",
  "19426000-0000-4000-8000-000000000004": "encounter-haru-260430",
  "19426000-0000-4000-8000-000000000005": "encounter-coco-260501",
};

function getStagingBridgeChartBundle(workItem: FulfillmentWorkItem) {
  const bridgedEncounterId = stagingDemoEncounterBridgeByResolvedId[workItem.encounterId];

  return bridgedEncounterId ? getChartEncounter(bridgedEncounterId) : null;
}

function getLivePatientFromWorkItem(workItem: FulfillmentWorkItem): Patient {
  const handoffPatient = readChartLiveEncounterHandoff(workItem.encounterId)?.patient;
  if (handoffPatient) return handoffPatient;

  const bridgedPatient = getStagingBridgeChartBundle(workItem)?.patient;
  if (bridgedPatient) return bridgedPatient;

  const now = workItem.updatedAt ?? workItem.createdAt ?? new Date().toISOString();
  return {
    id: `live-patient-${workItem.id}`,
    patientNo: `LIVE-${workItem.id.slice(0, 8)}`,
    workspaceId: workItem.workspaceId,
    name: getSnapshotString(workItem.sourceSnapshot, "patientName", "환자 미상"),
    species: "cat",
    breed: getSnapshotDetailString(workItem.sourceSnapshot, "breed", "품종 미상"),
    estimatedAgeText: getSnapshotDetailString(workItem.sourceSnapshot, "age", "나이 미상"),
    sex: "unknown",
    handlingCautionLocked: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function getLiveGuardianFromWorkItem(workItem: FulfillmentWorkItem): Guardian | undefined {
  const handoffGuardian = readChartLiveEncounterHandoff(workItem.encounterId)?.primaryGuardian;
  if (handoffGuardian) return handoffGuardian;

  const bridgedGuardian = getStagingBridgeChartBundle(workItem)?.primaryGuardian;
  if (bridgedGuardian) return bridgedGuardian;

  const guardianName = getSnapshotString(workItem.sourceSnapshot, "guardianName", "");
  if (!guardianName) return undefined;

  const now = workItem.updatedAt ?? workItem.createdAt ?? new Date().toISOString();
  return {
    id: `live-guardian-${workItem.id}`,
    workspaceId: workItem.workspaceId,
    name: guardianName,
    createdAt: now,
    updatedAt: now,
  };
}

function getLiveEncounterFromWorkItem(workItem: FulfillmentWorkItem, patient: Patient): Encounter {
  const now = workItem.updatedAt ?? workItem.createdAt ?? new Date().toISOString();
  return {
    id: workItem.encounterId,
    workspaceId: workItem.workspaceId,
    patientId: patient.id,
    guardianId: getLiveGuardianFromWorkItem(workItem)?.id,
    encounterNo: `LIVE-${workItem.encounterId.slice(0, 8)}`,
    receptionType: "walk_in",
    chiefComplaint: getSnapshotDetailString(workItem.sourceSnapshot, "chiefComplaint", "오더 수행"),
    status: workItem.status === "completed" ? "completed" : "in_consultation",
    checkedInAt: workItem.createdAt,
    startedAt: workItem.createdAt,
    createdAt: now,
    updatedAt: now,
  };
}

function getLiveOrderFromWorkItem(workItem: FulfillmentWorkItem): EmrOrder {
  const now = workItem.updatedAt ?? workItem.createdAt ?? new Date().toISOString();
  return {
    id: workItem.orderId,
    workspaceId: workItem.workspaceId,
    encounterId: workItem.encounterId,
    serviceItemId: workItem.sourceSnapshot?.serviceItemId,
    orderType: workItem.queueType,
    displayName: getSnapshotString(workItem.sourceSnapshot, "orderDisplayName", "Live order"),
    status: workItem.status === "completed" ? "completed" : workItem.status === "returned" ? "re_requested" : "in_progress",
    workStatus: workItem.status === "completed" ? "completed" : "pending",
    priority: "normal",
    requestedByUserId: "user-vet",
    requestedAt: workItem.createdAt ?? now,
    currentAssigneeUserId: workItem.assignedToUserId ?? undefined,
    instruction: workItem.sourceSnapshot?.instruction,
    sortOrder: 0,
    createdAt: workItem.createdAt ?? now,
    updatedAt: now,
  };
}

function useFulfillmentQueue(queueType: FulfillmentQueueType, selectedDate?: string) {
  const workspaceId = useWorkspaceIdFromPath();
  const effectiveDate = selectedDate ?? "";
  const cacheKey = getFulfillmentQueueCacheKey(workspaceId, queueType, effectiveDate);
  const [queueState, setQueueState] = useState<{
    cacheKey: string;
    snapshot: FulfillmentQueueSnapshot;
  }>(() => ({
    cacheKey,
    snapshot: fulfillmentQueueCache.get(cacheKey) ?? { workItems: [] },
  }));
  const snapshot =
    queueState.cacheKey === cacheKey
      ? queueState.snapshot
      : fulfillmentQueueCache.get(cacheKey) ?? { workItems: [] };

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=${queueType}${effectiveDate ? `&date=${encodeURIComponent(effectiveDate)}` : ""}`,
        { headers: { "x-clair-demo-session-user-id": "user-tech" } }
      );
      const body = await response.json() as {
        ok?: boolean;
        summary?: FulfillmentWorkItemReadSummary;
        workItems?: FulfillmentWorkItem[];
      };
      setCachedFulfillmentQueue(
        cacheKey,
        response.ok && body.ok && Array.isArray(body.workItems)
          ? { summary: body.summary, workItems: body.workItems }
          : { workItems: [] },
      );
    } catch {
      setCachedFulfillmentQueue(cacheKey, { workItems: [] });
    }
  }, [cacheKey, effectiveDate, queueType, workspaceId]);

  useEffect(() => {
    // Fetching the server queue is an external sync; rendering decides whether fixtures are allowed.
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const listener = (nextSnapshot: FulfillmentQueueSnapshot) =>
      setQueueState({ cacheKey, snapshot: nextSnapshot });

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

  return { summary: snapshot.summary, updateStatus, workItems: snapshot.workItems };
}

async function loadLabResultSheetCatalog({
  orderDisplayName,
  serviceItemId,
  workspaceId,
}: {
  orderDisplayName?: string;
  serviceItemId?: string;
  workspaceId: string;
}): Promise<LabResultSheetCatalogLoadResult> {
  const params = new URLSearchParams();
  if (orderDisplayName) params.set("orderDisplayName", orderDisplayName);
  if (serviceItemId) params.set("serviceItemId", serviceItemId);

  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/lab-imaging/result-sheet-catalog?${params.toString()}`,
      {
        cache: "no-store",
        headers: { "x-clair-demo-session-user-id": "user-tech" },
      },
    );
    const body = (await response.json()) as {
      denialReason?: string;
      error?: string;
      items?: LabResultSheetCatalogItem[];
      ok?: boolean;
    };

    if (response.status === 401 || response.status === 403 || body.denialReason) {
      return { items: [], status: "permission_denied" };
    }
    if (!response.ok || !body.ok || !Array.isArray(body.items)) {
      return { items: [], status: "error" };
    }
    if (body.items.length === 0) return { items: [], status: "empty" };
    return { items: body.items, status: "ready" };
  } catch {
    return { items: [], status: "error" };
  }
}

function useLabResultSheetCatalogRows({
  result,
  workItem,
  workspaceId,
}: {
  result?: LabResult;
  workItem?: FulfillmentWorkItem;
  workspaceId: string;
}) {
  const [state, setState] = useState<{
    cacheKey: string;
    rows: LabResultRow[];
    status: LabResultSheetCatalogStatus;
  }>({ cacheKey: "", rows: [], status: "idle" });
  const [reloadToken, setReloadToken] = useState(0);
  const orderDisplayName = workItem?.sourceSnapshot?.orderDisplayName ?? result?.resultName;
  const serviceItemId = workItem?.sourceSnapshot?.serviceItemId;
  const resultId = result?.id;
  const resultRowCount = result?.rows.length ?? 0;
  const cacheKey = [
    workspaceId,
    resultId ?? "",
    serviceItemId ?? "",
    orderDisplayName ?? "",
  ].join(":");
  const shouldLoad = Boolean(resultId && resultRowCount === 0 && orderDisplayName);

  useEffect(() => {
    if (!shouldLoad || !resultId || !orderDisplayName) return;

    let canceled = false;

    const load = async () => {
      setState({ cacheKey, rows: [], status: "loading" });
      const next = await loadLabResultSheetCatalog({
        orderDisplayName,
        serviceItemId,
        workspaceId,
      });
      if (canceled) return;
      setState({
        cacheKey,
        rows: next.items.map((item) => ({
          id: `${resultId}-${item.id}`,
          labTestItemId: item.id,
          analyteName: item.testItemName,
          judgment: "not_judged",
          unit: item.resultUnit,
        })),
        status: next.status,
      });
    };

    void load();

    return () => {
      canceled = true;
    };
  }, [cacheKey, orderDisplayName, reloadToken, resultId, serviceItemId, shouldLoad, workspaceId]);

  const retry = useCallback(() => setReloadToken((current) => current + 1), []);

  if (!shouldLoad) return { cacheKey, retry, rows: [], status: "idle" as const };
  return state.cacheKey === cacheKey ? { ...state, retry } : { cacheKey, retry, rows: [], status: "loading" as const };
}

async function saveLabResultEntry({
  result,
  rows,
  workItem,
  workspaceId,
}: {
  result: LabResult;
  rows: LabResultRow[];
  workItem?: FulfillmentWorkItem;
  workspaceId: string;
}): Promise<LabResultSaveOutcome> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/lab-imaging/result-entries`,
      {
        body: JSON.stringify({
          encounterId: result.encounterId,
          orderId: result.orderId,
          resultId: result.id,
          rows,
          workItemId: workItem?.id,
        }),
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-clair-demo-session-user-id": "user-tech",
        },
        method: "POST",
      },
    );
    const body = (await response.json()) as {
      denialReason?: string;
      error?: string;
      ok?: boolean;
    };
    if (response.ok && body.ok === true) return { ok: true };

    if (response.status === 401 || response.status === 403 || body.denialReason) {
      return {
        message: "저장 권한이 없습니다.",
        ok: false,
        reason: "permission_denied",
        retryable: false,
      };
    }
    if (response.status === 400 || body.error === "invalid_lab_result_entry_payload") {
      return {
        message: "저장할 검사 결과가 완전하지 않습니다.",
        ok: false,
        reason: "invalid",
        retryable: false,
      };
    }
    return {
      message: "결과 저장에 실패했습니다.",
      ok: false,
      reason: "error",
      retryable: true,
    };
  } catch {
    return {
      message: "네트워크 오류로 저장하지 못했습니다.",
      ok: false,
      reason: "error",
      retryable: true,
    };
  }
}

function getFulfillmentTransitionPath(
  current: FulfillmentWorkItemStatus,
  target: "in_progress" | "completed" | "requested"
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

function getWorkItemsByOrderId(workItems: FulfillmentWorkItem[]) {
  return new Map(workItems.map((item) => [item.orderId, item]));
}

function applyFulfillmentToLabItems(
  items: LabWorkItem[],
  workItems: FulfillmentWorkItem[]
): LabWorkItem[] {
  const workItemsByOrderId = getWorkItemsByOrderId(workItems);
  const usedWorkItemIds = new Set<string>();

  const mappedItems = items.map((item) => {
    const workItem = item.order ? workItemsByOrderId.get(item.order.id) : undefined;
    if (!workItem) return item;
    usedWorkItemIds.add(workItem.id);

    return {
      ...item,
      result: {
        ...item.result,
        status: mapFulfillmentToLabStatus(workItem.status, item.result.status),
      },
      technicianName: getStaffName(workItem.assignedToUserId ?? undefined) ?? item.technicianName,
    };
  });

  return [
    ...mappedItems,
    ...createLiveLabItems(
      workItems.filter((workItem) => !usedWorkItemIds.has(workItem.id)),
    ),
  ];
}

function applyFulfillmentToImagingItems(
  items: ImagingWorkItem[],
  workItems: FulfillmentWorkItem[]
): ImagingWorkItem[] {
  const workItemsByOrderId = getWorkItemsByOrderId(workItems);
  const usedWorkItemIds = new Set<string>();

  const mappedItems = items.map((item) => {
    const workItem = item.order ? workItemsByOrderId.get(item.order.id) : undefined;
    if (!workItem) return item;
    usedWorkItemIds.add(workItem.id);

    return {
      ...item,
      study: {
        ...item.study,
        status: mapFulfillmentToImagingStatus(workItem.status, item.study.status),
      },
      radiologistName: getStaffName(workItem.assignedToUserId ?? undefined) ?? item.radiologistName,
    };
  });

  return [
    ...mappedItems,
    ...createLiveImagingItems(
      workItems.filter((workItem) => !usedWorkItemIds.has(workItem.id)),
    ),
  ];
}

function createLiveLabItems(workItems: FulfillmentWorkItem[]): LabWorkItem[] {
  return workItems
    .filter((workItem) => workItem.queueType === "lab")
    .map((workItem) => {
      const patient = getLivePatientFromWorkItem(workItem);
      const primaryGuardian = getLiveGuardianFromWorkItem(workItem);
      const encounter = getLiveEncounterFromWorkItem(workItem, patient);
      const order = getLiveOrderFromWorkItem(workItem);
      const timestamp = workItem.updatedAt ?? workItem.createdAt ?? new Date().toISOString();

      return {
        encounter,
        order,
        patient,
        primaryGuardian,
        result: {
          id: `live-lab-${workItem.id}`,
          workspaceId: workItem.workspaceId,
          patientId: patient.id,
          encounterId: workItem.encounterId,
          orderId: workItem.orderId,
          resultName: order.displayName,
          status: mapFulfillmentToLabStatus(workItem.status, "pending"),
          rows: [],
          collectedAt: workItem.createdAt ?? timestamp,
          receivedAt: timestamp,
          enteredAt: workItem.status === "in_progress" || workItem.status === "completed" ? timestamp : undefined,
          performedByUserId: workItem.assignedToUserId ?? undefined,
        },
        technicianName: workItem.assignedToUserId ? currentLabAssignee.name : undefined,
      };
    })
    .sort((a, b) => {
      const aTime = a.result.receivedAt ?? a.result.collectedAt ?? "";
      const bTime = b.result.receivedAt ?? b.result.collectedAt ?? "";
      return bTime.localeCompare(aTime);
    });
}

function createLiveImagingItems(workItems: FulfillmentWorkItem[]): ImagingWorkItem[] {
  return workItems
    .filter((workItem) => workItem.queueType === "imaging")
    .map((workItem) => {
      const patient = getLivePatientFromWorkItem(workItem);
      const primaryGuardian = getLiveGuardianFromWorkItem(workItem);
      const encounter = getLiveEncounterFromWorkItem(workItem, patient);
      const order = getLiveOrderFromWorkItem(workItem);
      const timestamp = workItem.updatedAt ?? workItem.createdAt ?? new Date().toISOString();

      return {
        encounter,
        order,
        patient,
        primaryGuardian,
        radiologistName: workItem.assignedToUserId ? currentLabAssignee.name : undefined,
        study: {
          id: `live-imaging-${workItem.id}`,
          workspaceId: workItem.workspaceId,
          patientId: patient.id,
          encounterId: workItem.encounterId,
          orderId: workItem.orderId,
          modality: getSnapshotDetailString(workItem.sourceSnapshot, "modality", "영상"),
          bodyPart: getSnapshotDetailString(workItem.sourceSnapshot, "bodyPart", order.displayName),
          status: mapFulfillmentToImagingStatus(workItem.status, "requested"),
          requestedAt: workItem.createdAt ?? timestamp,
          capturedAt: workItem.status === "in_progress" || workItem.status === "completed" ? timestamp : undefined,
          readAt: workItem.status === "completed" ? timestamp : undefined,
          radiologistUserId: workItem.assignedToUserId ?? undefined,
        },
      };
    })
    .sort((a, b) => {
      const aTime = a.study.capturedAt ?? a.study.requestedAt;
      const bTime = b.study.capturedAt ?? b.study.requestedAt;
      return bTime.localeCompare(aTime);
    });
}

function getLabItemsForRuntime(
  baseItems: LabWorkItem[],
  workItems: FulfillmentWorkItem[],
  options: { allowFixtureItems?: boolean } = {},
) {
  const allowFixtureItems = options.allowFixtureItems ?? true;
  if (isLiveAuthRuntime() || !allowFixtureItems) return createLiveLabItems(workItems);
  return applyFulfillmentToLabItems(baseItems, workItems);
}

function getImagingItemsForRuntime(
  baseItems: ImagingWorkItem[],
  workItems: FulfillmentWorkItem[],
  options: { allowFixtureItems?: boolean } = {},
) {
  const allowFixtureItems = options.allowFixtureItems ?? true;
  if (isLiveAuthRuntime() || !allowFixtureItems) return createLiveImagingItems(workItems);
  return applyFulfillmentToImagingItems(baseItems, workItems);
}

function getLiveLabDetail(labResultId: string, workItems: FulfillmentWorkItem[]): LabDetail | null {
  const item = createLiveLabItems(workItems).find(({ result }) => result.id === labResultId);
  if (!item) return null;

  return {
    ...item,
    allEquipmentReceipts: [],
    attachments: [],
    equipmentReceipts: [],
  };
}

function getFirstLiveLabDetail(workItems: FulfillmentWorkItem[]): LabDetail | null {
  const firstItem = createLiveLabItems(workItems)[0];
  if (!firstItem) return null;

  return {
    ...firstItem,
    allEquipmentReceipts: [],
    attachments: [],
    equipmentReceipts: [],
  };
}

function getLiveImagingDetail(imagingStudyId: string, workItems: FulfillmentWorkItem[]): ImagingDetail | null {
  const item = createLiveImagingItems(workItems).find(({ study }) => study.id === imagingStudyId);
  if (!item) return null;

  return {
    ...item,
    attachments: [],
  };
}

function getFirstLiveImagingDetail(workItems: FulfillmentWorkItem[]): ImagingDetail | null {
  const firstItem = createLiveImagingItems(workItems)[0];
  if (!firstItem) return null;

  return {
    ...firstItem,
    attachments: [],
  };
}

function mapFulfillmentToLabStatus(
  status: FulfillmentWorkItemStatus,
  fallback: LabResult["status"]
): LabResult["status"] {
  if (status === "completed") return "completed";
  if (status === "in_progress") return "entered";
  if (status === "accepted") return "received";
  if (status === "requested" || status === "returned") return "pending";
  if (status === "cancelled") return fallback;
  return fallback;
}

function mapFulfillmentToImagingStatus(
  status: FulfillmentWorkItemStatus,
  fallback: ImagingStudyStatus
): ImagingStudyStatus {
  if (status === "completed") return "reviewed";
  if (status === "in_progress") return "reading";
  if (status === "accepted") return "captured";
  if (status === "requested" || status === "returned") return "requested";
  if (status === "cancelled") return fallback;
  return fallback;
}

const imagingStatusOrder: ImagingStudyStatus[] = ["requested", "captured", "reading", "read", "reviewed"];

const imagingStatusGroupLabel: Record<ImagingStudyStatus, string> = {
  requested: "촬영대기",
  captured: "촬영완료",
  reading: "판독중",
  read: "판독완료",
  reviewed: "확인",
};

const imagingStatusGroupColorToken: Record<ImagingStudyStatus, string> = {
  requested: "--emr-status-neutral-text",
  captured: "--emr-status-info-text",
  reading: "--emr-status-warning-text",
  read: "--emr-status-success-text",
  reviewed: "--emr-status-success-text",
};

const fallbackLabHistoryGroups = [
  {
    date: "26.04.11",
    count: 2,
    items: [
      {
        title: "[CBC] CBC 검사 세트",
        description: "담당자명 · 담당자명 · 10:30 요청",
      },
      {
        title: "[CHEM] 혈청화학 검사",
        description: "ALT/BUN 결과 확인 · 10:42 완료",
      },
    ],
  },
  {
    date: "26.03.12",
    count: 2,
    items: [
      {
        title: "[CBC] CBC 검사 세트",
        description: "이전 결과 추적 · 10:30 요청",
      },
      {
        title: "요검사",
        description: "보호자 요청 검사 · 11:15 완료",
      },
    ],
  },
  {
    date: "26.03.10",
    count: 1,
    items: [
      {
        title: "심장사상충 키트",
        description: "예방 검사 · 09:40 완료",
      },
    ],
  },
];

function getLabResultDocumentId(result: LabResult) {
  const suffix = result.id.replace("lab-result-", "").toUpperCase();

  return `LAB-${suffix}`;
}

function getLabDetailFromSearchParams(
  searchParams: { get: (name: string) => string | null },
  selectedLabResultId: string,
  workItems: FulfillmentWorkItem[] = [],
  options: { allowMockFallback?: boolean } = {},
) {
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryLabResultId = searchParams.get("labResultId") ?? scenario?.labResultId;
  const effectiveLabResultId = queryLabResultId ?? selectedLabResultId;
  const liveDetail = getLiveLabDetail(effectiveLabResultId, workItems);
  const liveFallbackDetail = isLiveAuthRuntime() ? getFirstLiveLabDetail(workItems) : null;

  return {
    detail:
      liveDetail ??
      liveFallbackDetail ??
      (options.allowMockFallback === false || isLiveAuthRuntime()
        ? null
        : getLabDetail(effectiveLabResultId) ?? getLabDetail("lab-result-coco-cbc")),
    queryLabResultId,
  };
}

function getImagingDetailFromSearchParams(
  searchParams: { get: (name: string) => string | null },
  selectedImagingStudyId: string,
  workItems: FulfillmentWorkItem[] = [],
  options: { allowMockFallback?: boolean } = {},
) {
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryImagingStudyId = searchParams.get("imagingStudyId") ?? scenario?.imagingStudyId;
  const effectiveImagingStudyId = queryImagingStudyId ?? selectedImagingStudyId;
  const liveDetail = getLiveImagingDetail(effectiveImagingStudyId, workItems);
  const liveFallbackDetail = isLiveAuthRuntime() ? getFirstLiveImagingDetail(workItems) : null;

  return {
    detail:
      liveDetail ??
      liveFallbackDetail ??
      (options.allowMockFallback === false || isLiveAuthRuntime()
        ? null
        : getImagingDetail(effectiveImagingStudyId) ?? getImagingDetail("imaging-coco-thorax")),
    queryImagingStudyId,
  };
}

function getLabHistoryGroups(detail: LabDetail): LabHistoryGroup[] {
  const currentDate = formatShortDateTime(detail.result.enteredAt ?? detail.result.receivedAt)
    .slice(0, 8)
    .trim();
  const currentGroup = {
    date: currentDate || "오늘",
    count: 1,
    items: [
      {
        title: `[CBC] ${detail.result.resultName}`,
        description: `${detail.technicianName ?? "담당 미정"} · ${formatShortDateTime(
          detail.result.receivedAt ?? detail.result.collectedAt
        )} 수신`,
      },
    ],
  };

  return [currentGroup, ...fallbackLabHistoryGroups];
}

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

function getLabWorkItemSearchText(item: LabWorkItem) {
  return [
    item.patient.name,
    item.primaryGuardian?.name,
    getReceptionTypeLabel(item.encounter),
    item.order?.displayName,
    item.order?.status,
    item.result.resultName,
    item.result.status,
    labStatusGroupLabel[item.result.status],
    item.technicianName,
    getOrderRequesterName(item.order),
    getOrderEventTime(item.order, item.result.receivedAt ?? item.result.collectedAt),
  ]
    .filter(Boolean)
    .join(" ");
}

function getLabChartGroupSearchText(group: LabChartGroup) {
  return [
    group.patient.name,
    group.primaryGuardianName,
    getReceptionTypeLabel(group.encounter),
    ...group.items.map(getLabWorkItemSearchText),
  ]
    .filter(Boolean)
    .join(" ");
}

function getImagingWorkItemSearchText(item: ImagingWorkItem) {
  return [
    item.patient.name,
    item.primaryGuardian?.name,
    getReceptionTypeLabel(item.encounter),
    item.order?.displayName,
    item.order?.status,
    item.study.modality,
    item.study.bodyPart,
    item.study.status,
    imagingStatusGroupLabel[item.study.status],
    item.radiologistName,
    getOrderRequesterName(item.order),
    getOrderEventTime(item.order, item.study.capturedAt ?? item.study.requestedAt),
  ]
    .filter(Boolean)
    .join(" ");
}

function getImagingChartGroupSearchText(group: ImagingChartGroup) {
  return [
    group.patient.name,
    group.primaryGuardianName,
    getReceptionTypeLabel(group.encounter),
    ...group.items.map(getImagingWorkItemSearchText),
  ]
    .filter(Boolean)
    .join(" ");
}

function QueueActions({ onSearch }: { onSearch?: () => void }) {
  return (
    <>
      <EmrListHeaderIconButton ariaLabel="정렬">
        <CdsUtilitiesSortIcon className="size-4" />
      </EmrListHeaderIconButton>
      <EmrListHeaderIconButton ariaLabel="필터">
        <CdsActionsListFilterIcon className="size-4" />
      </EmrListHeaderIconButton>
      <EmrListHeaderIconButton ariaLabel="검색" onClick={onSearch}>
        <CdsActionsSearchIcon className="size-4" />
      </EmrListHeaderIconButton>
    </>
  );
}

function LabQueueGroup({
  collapsed,
  items,
  onSelectItem,
  onToggle,
  selectedLabResultId,
  status,
}: {
  collapsed: boolean;
  items: LabWorkItem[];
  onSelectItem: (itemId: string) => void;
  onToggle: () => void;
  selectedLabResultId?: string;
  status: LabResult["status"];
}) {
  const label = labStatusGroupLabel[status];

  return (
    <EmrSidePanelCollapsibleGroup
      collapsed={collapsed}
      count={items.length}
      countBadgeColorToken={labStatusGroupColorToken[status]}
      dataTestId={`lab-queue-status-${status}`}
      indicatorColorToken={labStatusGroupColorToken[status]}
      indicatorVisible={false}
      label={label}
      onToggle={onToggle}
    >
      {items.map((item) => (
        <LabQueueItem
          key={item.result.id}
          item={item}
          selected={item.result.id === selectedLabResultId}
          onSelect={() => onSelectItem(item.result.id)}
        />
      ))}
    </EmrSidePanelCollapsibleGroup>
  );
}

function LabQueueItem({
  item,
  selected,
  onSelect,
}: {
  item: LabWorkItem;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <div data-testid={`lab-queue-item-${item.result.id}`}>
      <EmrTaskQueueCard
        item={getLabTaskQueueCardItem({
          actionTestId: `lab-queue-item-action-${item.result.id}`,
          item,
          testId: `lab-queue-card-${item.result.id}`,
        })}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

type LabChartGroup = {
  encounter: Encounter;
  items: LabWorkItem[];
  patient: Patient;
  primaryGuardianName?: string;
};

function getLabChartGroups(items: LabWorkItem[]) {
  const groupsByEncounter = new Map<string, LabChartGroup>();

  items.forEach((item) => {
    const group = groupsByEncounter.get(item.encounter.id);

    if (group) {
      group.items.push(item);
      return;
    }

    groupsByEncounter.set(item.encounter.id, {
      encounter: item.encounter,
      items: [item],
      patient: item.patient,
      primaryGuardianName: item.primaryGuardian?.name,
    });
  });

  return Array.from(groupsByEncounter.values()).sort((a, b) => {
    const aTime = a.items[0]?.result.receivedAt ?? a.items[0]?.result.collectedAt ?? "";
    const bTime = b.items[0]?.result.receivedAt ?? b.items[0]?.result.collectedAt ?? "";

    return bTime.localeCompare(aTime);
  });
}

function LabChartQueueItem({
  group,
  onSelect,
  selected,
}: {
  group: LabChartGroup;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <div data-testid={`lab-chart-group-${group.encounter.id}`}>
      <EmrTaskQueueCard
        item={getLabGroupTaskQueueCardItem(group)}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

function ImagingQueueItem({
  item,
  selected,
  onSelect,
}: {
  item: ImagingWorkItem;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <div data-testid={`imaging-queue-item-${item.study.id}`}>
      <EmrTaskQueueCard
        item={getImagingTaskQueueCardItem({
          actionTestId: `imaging-queue-item-action-${item.study.id}`,
          item,
          testId: `imaging-queue-card-${item.study.id}`,
        })}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

function ImagingQueueGroup({
  collapsed,
  items,
  onSelectItem,
  onToggle,
  selectedImagingStudyId,
  status,
}: {
  collapsed: boolean;
  items: ImagingWorkItem[];
  onSelectItem: (itemId: string) => void;
  onToggle: () => void;
  selectedImagingStudyId?: string;
  status: ImagingStudyStatus;
}) {
  return (
    <EmrSidePanelCollapsibleGroup
      collapsed={collapsed}
      count={items.length}
      countBadgeColorToken={imagingStatusGroupColorToken[status]}
      dataTestId={`imaging-queue-status-${status}`}
      indicatorColorToken={imagingStatusGroupColorToken[status]}
      indicatorVisible={false}
      label={imagingStatusGroupLabel[status]}
      onToggle={onToggle}
    >
      {items.map((item) => (
        <ImagingQueueItem
          key={item.study.id}
          item={item}
          selected={item.study.id === selectedImagingStudyId}
          onSelect={() => onSelectItem(item.study.id)}
        />
      ))}
    </EmrSidePanelCollapsibleGroup>
  );
}

type ImagingChartGroup = {
  encounter: Encounter;
  items: ImagingWorkItem[];
  patient: Patient;
  primaryGuardianName?: string;
};

function getImagingChartGroups(items: ImagingWorkItem[]) {
  const groupsByEncounter = new Map<string, ImagingChartGroup>();

  items.forEach((item) => {
    const group = groupsByEncounter.get(item.encounter.id);

    if (group) {
      group.items.push(item);
      return;
    }

    groupsByEncounter.set(item.encounter.id, {
      encounter: item.encounter,
      items: [item],
      patient: item.patient,
      primaryGuardianName: item.primaryGuardian?.name,
    });
  });

  return Array.from(groupsByEncounter.values()).sort((a, b) => {
    const aTime = a.items[0]?.study.capturedAt ?? a.items[0]?.study.requestedAt ?? "";
    const bTime = b.items[0]?.study.capturedAt ?? b.items[0]?.study.requestedAt ?? "";

    return bTime.localeCompare(aTime);
  });
}

function ImagingChartQueueItem({
  group,
  onSelect,
  selected,
}: {
  group: ImagingChartGroup;
  onSelect: () => void;
  selected: boolean;
}) {
  return (
    <div data-testid={`imaging-chart-group-${group.encounter.id}`}>
      <EmrTaskQueueCard
        item={getImagingGroupTaskQueueCardItem(group)}
        selected={selected}
        onSelect={onSelect}
      />
    </div>
  );
}

export function LabSidePanel({
  onNavigateWorkspaceSurface,
  workspaceId,
}: ShellComponentProps) {
  const searchParams = useSearchParams();
  const queryLabResultId = searchParams.get("labResultId");
  const selectedLabResultId = useLabImagingStore((state) => state.selectedLabResultId);
  const selectLabResult = useLabImagingStore((state) => state.selectLabResult);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const { selectDate, selectedDate, todayDate } =
    useSelectedOperatingDate(workspaceId);
  const [queueView, setQueueView] = useState<LabQueueView>("order");
  const [collapsedStatusIds, setCollapsedStatusIds] = useState<Set<LabResult["status"]>>(() => new Set());
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fulfillmentQueue = useFulfillmentQueue("lab", selectedDate);
  const legacySalesDemo = isLegacySalesDemoWorkspace(workspaceId);
  const baseItems = useMemo(
    () => (legacySalesDemo ? getLabWorkItems() : []),
    [legacySalesDemo],
  );
  const items = useMemo(
    () => getLabItemsForRuntime(baseItems, fulfillmentQueue.workItems, {
      allowFixtureItems: legacySalesDemo,
    }),
    [baseItems, fulfillmentQueue.workItems, legacySalesDemo]
  );
  useEffect(() => {
    if (queryLabResultId) {
      if (items.some((item) => item.result.id === queryLabResultId)) {
        selectLabResult(queryLabResultId);
      }
      return;
    }

    if (!items.length || items.some((item) => item.result.id === selectedLabResultId)) return;
    selectLabResult(items[0].result.id);
  }, [items, queryLabResultId, selectLabResult, selectedLabResultId]);
  function handleSelectLabResult(resultId: string) {
    if (onNavigateWorkspaceSurface) {
      onNavigateWorkspaceSurface(
        buildWorkspaceSurfaceRoute({
          moduleId: "lab",
          params: { labResultId: resultId },
          search: searchParams,
          workspaceId,
        }),
        "lab",
      );
      return;
    }

    selectLabResult(resultId);
  }
  const effectiveSelectedLabResultId = items.some((item) => item.result.id === selectedLabResultId)
    ? selectedLabResultId
    : items[0]?.result.id;
  const chartGroups = useMemo(() => getLabChartGroups(items), [items]);
  const filteredItems = useMemo(
    () => items.filter((item) => matchesQueueSearch(getLabWorkItemSearchText(item), searchQuery)),
    [items, searchQuery]
  );
  const filteredChartGroups = useMemo(
    () => chartGroups.filter((group) => matchesQueueSearch(getLabChartGroupSearchText(group), searchQuery)),
    [chartGroups, searchQuery]
  );
  const groups = useMemo(
    () =>
      labStatusOrder
        .map((status) => ({
          status,
          items: filteredItems.filter((item) => item.result.status === status),
        }))
        .filter((group) => group.items.length > 0),
    [filteredItems]
  );
  const resultCount = queueView === "order" ? filteredItems.length : filteredChartGroups.length;
  const emptyStateTitle = getDatedQueueEmptyStateTitle({
    emptyObjectLabel: "임상병리 업무",
    filtered: (fulfillmentQueue.summary?.totalCount ?? items.length) > 0,
    selectedDate,
    todayDate,
  });
  const closeSearch = useCallback(() => {
    setSearchQuery("");
    setSearchActive(false);
  }, []);
  const toggleStatus = (status: LabResult["status"]) => {
    setCollapsedStatusIds((current) => {
      const next = new Set(current);

      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }

      return next;
    });
  };

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title="임상병리검사"
        collapseLabel="사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
        tabsClassName="ml-2.5"
        tabs={
          <SegmentedControl
            aria-label="임상병리검사 목록 보기"
            className="shrink-0"
            items={labQueueViewItems}
            value={queueView}
            variant="tabs"
            onValueChange={setQueueView}
          />
        }
      />
      <EmrDateNavigator
        dateLabel={formatKoreanOperatingDateLabel(selectedDate)}
        selectedDate={selectedDate}
        todayDate={todayDate}
        todayLabel={selectedDate === todayDate ? "오늘" : undefined}
        onDateChange={(date) => {
          selectDate(date);
          selectLabResult("");
        }}
        onNext={() => selectDate(addDaysToIsoDate(selectedDate, 1))}
        onPrevious={() => selectDate(addDaysToIsoDate(selectedDate, -1))}
      />
      <EmrListHeader
        label={queueView === "order" ? "검사 대기열" : "차트별 검사"}
        count={resultCount}
        search={{
          active: searchActive,
          closeLabel: "검사 대기열 검색 닫기",
          inputLabel: `${queueView === "order" ? "검사 대기열" : "차트별 검사"} 검색`,
          onClose: closeSearch,
          onQueryChange: setSearchQuery,
          placeholder: "환자, 보호자, 검사, 담당자 검색",
          query: searchQuery,
          resultCount,
        }}
        headerActions={<QueueActions onSearch={() => setSearchActive(true)} />}
      />
      <EmrSubpanelBody>
        {resultCount === 0 && searchQuery.trim() ? (
          <EmrListSearchEmptyState
            objectLabel={queueView === "order" ? "검사 대기열 항목" : "차트별 검사"}
            query={searchQuery}
            onClear={() => setSearchQuery("")}
          />
        ) : resultCount === 0 ? (
          <EmrQueueEmptyState title={emptyStateTitle} />
        ) : queueView === "order"
          ? groups.map((group) => (
              <LabQueueGroup
                key={group.status}
                collapsed={collapsedStatusIds.has(group.status)}
                items={group.items}
                onSelectItem={handleSelectLabResult}
                onToggle={() => toggleStatus(group.status)}
                selectedLabResultId={effectiveSelectedLabResultId}
                status={group.status}
              />
            ))
          : filteredChartGroups.map((group) => (
              <LabChartQueueItem
                key={group.encounter.id}
                group={group}
                selected={group.items.some((item) => item.result.id === effectiveSelectedLabResultId)}
                onSelect={() => {
                  const firstResultId = group.items[0]?.result.id;

                  if (firstResultId) {
                    handleSelectLabResult(firstResultId);
                  }
                }}
              />
            ))}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

export function ImagingSidePanel({
  onNavigateWorkspaceSurface,
  workspaceId,
}: ShellComponentProps) {
  const searchParams = useSearchParams();
  const queryImagingStudyId = searchParams.get("imagingStudyId");
  const selectedImagingStudyId = useLabImagingStore((state) => state.selectedImagingStudyId);
  const selectImagingStudy = useLabImagingStore((state) => state.selectImagingStudy);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const { selectDate, selectedDate, todayDate } =
    useSelectedOperatingDate(workspaceId);
  const [queueView, setQueueView] = useState<ImagingQueueView>("order");
  const [collapsedStatusIds, setCollapsedStatusIds] = useState<Set<ImagingStudyStatus>>(() => new Set());
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fulfillmentQueue = useFulfillmentQueue("imaging", selectedDate);
  const legacySalesDemo = isLegacySalesDemoWorkspace(workspaceId);
  const baseItems = useMemo(
    () => (legacySalesDemo ? getImagingWorkItems() : []),
    [legacySalesDemo],
  );
  const items = useMemo(
    () => getImagingItemsForRuntime(baseItems, fulfillmentQueue.workItems, {
      allowFixtureItems: legacySalesDemo,
    }),
    [baseItems, fulfillmentQueue.workItems, legacySalesDemo]
  );
  useEffect(() => {
    if (queryImagingStudyId) {
      if (items.some((item) => item.study.id === queryImagingStudyId)) {
        selectImagingStudy(queryImagingStudyId);
      }
      return;
    }

    if (!items.length || items.some((item) => item.study.id === selectedImagingStudyId)) return;
    selectImagingStudy(items[0].study.id);
  }, [items, queryImagingStudyId, selectImagingStudy, selectedImagingStudyId]);
  function handleSelectImagingStudy(studyId: string) {
    if (onNavigateWorkspaceSurface) {
      onNavigateWorkspaceSurface(
        buildWorkspaceSurfaceRoute({
          moduleId: "imaging",
          params: { imagingStudyId: studyId },
          search: searchParams,
          workspaceId,
        }),
        "imaging",
      );
      return;
    }

    selectImagingStudy(studyId);
  }
  const effectiveSelectedImagingStudyId = items.some((item) => item.study.id === selectedImagingStudyId)
    ? selectedImagingStudyId
    : items[0]?.study.id;
  const chartGroups = useMemo(() => getImagingChartGroups(items), [items]);
  const filteredItems = useMemo(
    () => items.filter((item) => matchesQueueSearch(getImagingWorkItemSearchText(item), searchQuery)),
    [items, searchQuery]
  );
  const filteredChartGroups = useMemo(
    () => chartGroups.filter((group) => matchesQueueSearch(getImagingChartGroupSearchText(group), searchQuery)),
    [chartGroups, searchQuery]
  );
  const groups = useMemo(
    () =>
      imagingStatusOrder
        .map((status) => ({
          status,
          items: filteredItems.filter((item) => item.study.status === status),
        }))
        .filter((group) => group.items.length > 0),
    [filteredItems]
  );
  const resultCount = queueView === "order" ? filteredItems.length : filteredChartGroups.length;
  const emptyStateTitle = getDatedQueueEmptyStateTitle({
    emptyObjectLabel: "영상 업무",
    filtered: (fulfillmentQueue.summary?.totalCount ?? items.length) > 0,
    selectedDate,
    todayDate,
  });
  const closeSearch = useCallback(() => {
    setSearchQuery("");
    setSearchActive(false);
  }, []);
  const toggleStatus = (status: ImagingStudyStatus) => {
    setCollapsedStatusIds((current) => {
      const next = new Set(current);

      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }

      return next;
    });
  };

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title="영상검사"
        collapseLabel="사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
        tabs={
          <SegmentedControl
            aria-label="영상검사 목록 보기"
            className="shrink-0"
            items={imagingQueueViewItems}
            value={queueView}
            variant="tabs"
            onValueChange={setQueueView}
          />
        }
      />
      <EmrDateNavigator
        dateLabel={formatKoreanOperatingDateLabel(selectedDate)}
        selectedDate={selectedDate}
        todayDate={todayDate}
        todayLabel={selectedDate === todayDate ? "오늘" : undefined}
        onDateChange={(date) => {
          selectDate(date);
          selectImagingStudy("");
        }}
        onNext={() => selectDate(addDaysToIsoDate(selectedDate, 1))}
        onPrevious={() => selectDate(addDaysToIsoDate(selectedDate, -1))}
      />
      <EmrListHeader
        label={queueView === "order" ? "영상 대기열" : "차트별 영상"}
        count={resultCount}
        search={{
          active: searchActive,
          closeLabel: "영상 대기열 검색 닫기",
          inputLabel: `${queueView === "order" ? "영상 대기열" : "차트별 영상"} 검색`,
          onClose: closeSearch,
          onQueryChange: setSearchQuery,
          placeholder: "환자, 보호자, 영상, 담당자 검색",
          query: searchQuery,
          resultCount,
        }}
        headerActions={<QueueActions onSearch={() => setSearchActive(true)} />}
      />
      <EmrSubpanelBody>
        {resultCount === 0 && searchQuery.trim() ? (
          <EmrListSearchEmptyState
            objectLabel={queueView === "order" ? "영상 대기열 항목" : "차트별 영상"}
            query={searchQuery}
            onClear={() => setSearchQuery("")}
          />
        ) : resultCount === 0 ? (
          <EmrQueueEmptyState title={emptyStateTitle} />
        ) : queueView === "order"
          ? groups.map((group) => (
              <ImagingQueueGroup
                key={group.status}
                collapsed={collapsedStatusIds.has(group.status)}
                items={group.items}
                onSelectItem={handleSelectImagingStudy}
                onToggle={() => toggleStatus(group.status)}
                selectedImagingStudyId={effectiveSelectedImagingStudyId}
                status={group.status}
              />
            ))
          : filteredChartGroups.map((group) => (
              <ImagingChartQueueItem
                key={group.encounter.id}
                group={group}
                selected={group.items.some((item) => item.study.id === effectiveSelectedImagingStudyId)}
                onSelect={() => {
                  const firstStudyId = group.items[0]?.study.id;

                  if (firstStudyId) {
                    handleSelectImagingStudy(firstStudyId);
                  }
                }}
              />
            ))}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

function getDatedQueueEmptyStateTitle({
  emptyObjectLabel,
  filtered,
  selectedDate,
  todayDate,
}: {
  emptyObjectLabel: string;
  filtered: boolean;
  selectedDate: string;
  todayDate: string;
}) {
  if (filtered) return `조건에 맞는 ${emptyObjectLabel}가 없습니다.`;

  void selectedDate;
  void todayDate;

  return `요청된 ${emptyObjectLabel}가 없습니다.`;
}

function LabResultInputSection({
  assigneeName,
  catalogStatus = "idle",
  onCatalogRetry,
  onSave,
  result,
}: {
  assigneeName: string;
  catalogStatus?: LabResultSheetCatalogStatus;
  onCatalogRetry?: () => void;
  onSave?: (rows: LabResultRow[]) => Promise<LabResultSaveOutcome>;
  result: LabResult;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [density, setDensity] = useState<EmrTableDensity>("standard");
  const [saveState, setSaveState] = useState<{
    message?: string;
    retryable?: boolean;
    resultId: string;
    value: "idle" | "saving" | "saved" | "error" | "invalid" | "permission_denied";
  }>(() => ({ resultId: result.id, value: "idle" }));
  const currentSaveState = saveState.resultId === result.id ? saveState.value : "idle";
  const currentSaveMessage = saveState.resultId === result.id ? saveState.message : undefined;
  const saveRetryable = saveState.resultId === result.id ? saveState.retryable === true : false;
  const initialRowValues = useMemo(
    () => Object.fromEntries(result.rows.map((row) => [row.id, row.value ?? ""])),
    [result.rows]
  );
  const [rowValueState, setRowValueState] = useState<{
    resultId: string;
    values: Record<string, string>;
  }>(() => ({ resultId: result.id, values: initialRowValues }));
  const rowValues = rowValueState.resultId === result.id ? rowValueState.values : initialRowValues;
  const rows = useMemo(
    () =>
      result.rows.map((row) => {
        const value = rowValues[row.id] ?? row.value ?? "";

        return {
          ...row,
          judgment: getDerivedLabJudgment(row, value),
          value,
        };
      }),
    [result.rows, rowValues]
  );
  const abnormalRows = rows.filter((row) => row.judgment !== "normal" && row.judgment !== "not_judged");
  const saveResult = async () => {
    if (!onSave) return;
    setSaveState({ resultId: result.id, value: "saving" });
    const outcome = await onSave(rows);
    setSaveState(
      outcome.ok
        ? { resultId: result.id, value: "saved" }
        : {
            message: outcome.message,
            resultId: result.id,
            retryable: outcome.retryable,
            value: outcome.reason,
          },
    );
  };
  const catalogMessage =
    catalogStatus === "loading"
      ? "결과지 항목을 불러오는 중"
      : catalogStatus === "permission_denied"
        ? "결과지 항목을 볼 권한이 없습니다."
        : catalogStatus === "error"
          ? "결과지 항목을 불러오지 못했습니다."
          : catalogStatus === "empty"
            ? "연결된 결과지 항목이 없습니다."
            : null;
  const saveStatusLabel =
    currentSaveState === "saved"
      ? "서버 저장됨"
      : currentSaveState === "saving"
        ? "저장 중"
        : currentSaveState === "permission_denied"
          ? "저장 권한이 없습니다"
          : currentSaveState === "invalid"
            ? "저장 항목 확인 필요"
            : "저장 실패";

  return (
    <EmrOrderGroupSection
      title={`${result.resultName} 세트`}
      titleClassName="emr-text-body leading-5"
      count={rows.length}
      meta={
        abnormalRows.length > 0 ? (
          <span className="emr-text-metadata font-medium text-destructive">
            비정상 {abnormalRows.length}
          </span>
        ) : (
          <span className="emr-text-metadata font-medium text-muted-foreground">
            정상 범위
          </span>
        )
      }
      actions={
        <>
          <EmrTableDensitySelector value={density} onValueChange={setDensity} />
          <Button variant="outline" size="xs" className="bg-card">
            판정적용
          </Button>
          <Button
            size="xs"
            data-testid="lab-result-save-button"
            disabled={!onSave || currentSaveState === "saving" || rows.length === 0}
            onClick={saveResult}
          >
            {currentSaveState === "saving" ? "저장 중" : "저장"}
          </Button>
          {currentSaveState !== "idle" ? (
            <span
              data-testid="lab-result-save-status"
              className={cn(
                "emr-text-metadata font-medium",
                currentSaveState === "error" || currentSaveState === "invalid" || currentSaveState === "permission_denied"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
              title={currentSaveMessage}
            >
              {saveStatusLabel}
            </span>
          ) : null}
          {saveRetryable ? (
            <Button
              variant="outline"
              size="xs"
              className="bg-card"
              data-testid="lab-result-save-retry-button"
              onClick={saveResult}
            >
              재시도
            </Button>
          ) : null}
        </>
      }
      collapsed={collapsed}
      onToggle={() => setCollapsed((current) => !current)}
    >
      <div>
        {catalogMessage ? (
          <div
            data-testid="lab-result-catalog-status"
            className={cn(
              "mb-3 flex min-h-10 flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 emr-text-metadata font-medium",
              catalogStatus === "permission_denied" || catalogStatus === "error"
                ? "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]"
                : "border-border bg-[var(--emr-surface-muted)] text-muted-foreground",
            )}
          >
            <span>{catalogMessage}</span>
            {catalogStatus === "error" && onCatalogRetry ? (
              <Button
                variant="outline"
                size="xs"
                className="bg-card"
                data-testid="lab-result-catalog-retry-button"
                onClick={onCatalogRetry}
              >
                다시 불러오기
              </Button>
            ) : null}
          </div>
        ) : null}
        <Table density={density} layout="scroll" minWidth={860} className="min-w-[860px] table-fixed">
          <colgroup>
            <col className="w-[32%]" />
            <col className="w-[14%]" />
            <col className="w-[8%]" />
            <col className="w-[26%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
          </colgroup>
          <TableHeader className="bg-[var(--emr-surface-muted)]">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="relative h-10 bg-[var(--emr-surface-muted)] px-1 py-1 emr-text-body font-medium text-muted-foreground">
                <div className="flex h-6 min-w-0 items-center px-1">항목</div>
              </TableHead>
              <TableHead className="relative h-10 bg-[var(--emr-surface-muted)] px-1 py-1 emr-text-body font-medium text-muted-foreground">
                <div className="flex h-6 min-w-0 items-center px-1">결과값</div>
              </TableHead>
              <TableHead className="relative h-10 bg-[var(--emr-surface-muted)] px-1 py-1 emr-text-body font-medium text-muted-foreground">
                <div className="flex h-6 min-w-0 items-center px-1">단위</div>
              </TableHead>
              <TableHead className="relative h-10 bg-[var(--emr-surface-muted)] px-1 py-1 emr-text-body font-medium text-muted-foreground">
                <div className="flex h-6 min-w-0 items-center justify-center px-1 text-center">정상범위</div>
              </TableHead>
              <TableHead className="relative h-10 bg-[var(--emr-surface-muted)] px-1 py-1 emr-text-body font-medium text-muted-foreground">
                <div className="flex h-6 min-w-0 items-center px-1">판정</div>
              </TableHead>
              <TableHead className="relative h-10 bg-[var(--emr-surface-muted)] px-1 py-1 emr-text-body font-medium text-muted-foreground">
                <div className="flex h-6 min-w-0 items-center px-1">담당자</div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="h-11 border-border bg-card text-foreground hover:!bg-[var(--emr-state-hover)]"
              >
              <TableCell className="h-11 px-1 py-2 font-medium whitespace-normal">
                <div className="flex min-h-6 min-w-0 items-center px-1 leading-5">{row.analyteName}</div>
              </TableCell>
              <TableCell className="h-11 px-1 py-2 font-medium">
                <div className="flex h-6 min-w-0 items-center px-1">
                  <Input
                    aria-label={`${row.analyteName} 결과값`}
                    className="h-8 w-24"
                    data-testid={`lab-result-input-${row.id}`}
                    value={row.value}
                    onChange={(event) => {
                      const nextValue = event.target.value;

                      setRowValueState((current) => {
                        const currentValues = current.resultId === result.id ? current.values : initialRowValues;

                        return {
                          resultId: result.id,
                          values: {
                            ...currentValues,
                            [row.id]: nextValue,
                          },
                        };
                      });
                    }}
                  />
                </div>
              </TableCell>
              <TableCell className="h-11 px-1 py-2 font-medium">
                <div className="flex h-6 min-w-0 items-center px-1">{row.unit ?? "-"}</div>
              </TableCell>
              <TableCell className="h-11 px-1 py-2 font-medium">
                <div className="flex min-h-6 min-w-0 items-center px-1">
                  <NormalRangeCell row={row} />
                </div>
              </TableCell>
              <TableCell className="h-11 px-1 py-2 font-medium" aria-live="polite">
                <div className="flex h-6 min-w-0 items-center px-1">
                  <Badge variant="outline" className={judgmentBadgeClassName[row.judgment]}>
                    {getStatusLabel("labJudgment", row.judgment)}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="h-11 px-1 py-2 font-medium" aria-live="polite">
                <div className="flex h-6 min-w-0 items-center px-1">
                  <span className="truncate emr-text-dense text-foreground">{assigneeName}</span>
                </div>
              </TableCell>
              </TableRow>
            ))}
            {!rows.length ? (
              <TableRow className="border-border bg-card hover:bg-card">
                <TableCell
                  colSpan={6}
                  className="h-24 text-center emr-text-dense font-medium text-muted-foreground"
                >
                  표시할 검사 결과가 없습니다.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </EmrOrderGroupSection>
  );
}

function NormalRangeCell({ row }: { row: LabResultRow }) {
  const range = parseReferenceRange(row.referenceRange);
  const scale = getRangeScale(row);
  const rangeState = rangeStateByJudgment[row.judgment] ?? {
    label: "미판정",
    markerClassName: "bg-[var(--emr-status-neutral-text)] fill-[var(--emr-status-neutral-text)]",
  };

  return (
    <div
      className="w-full max-w-[300px]"
      aria-label={`${row.analyteName} 정상범위 ${row.referenceRange ?? "-"} 결과 ${row.value} ${rangeState.label}`}
    >
      {range ? (
        <div className="relative mb-1 h-4 emr-text-metadata font-medium text-foreground">
          <span
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${scale.normalStart}%` }}
          >
            {range.min}
          </span>
          <span
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${scale.normalEnd}%` }}
          >
            {range.max}
          </span>
        </div>
      ) : (
        <div className="mb-1 h-4 emr-text-metadata font-medium text-foreground">-</div>
      )}
      <NormalRangeChart row={row} scale={scale} markerClassName={rangeState.markerClassName} />
    </div>
  );
}

function NormalRangeChart({
  markerClassName,
  row,
  scale,
}: {
  markerClassName: string;
  row: LabResultRow;
  scale: ReturnType<typeof getRangeScale>;
}) {
  return (
    <div
      role="img"
      aria-label={`${row.analyteName} 결과 위치 ${row.value}`}
      className="relative h-3 w-full"
    >
      <svg
        viewBox="0 0 100 12"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden="true"
      >
        <line
          x1={scale.lowerStart}
          x2={scale.normalStart}
          y1="6"
          y2="6"
          stroke="var(--emr-status-info-border)"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <line
          x1={scale.normalStart}
          x2={scale.normalEnd}
          y1="6"
          y2="6"
          stroke="var(--emr-status-success-border)"
          strokeWidth="3"
        />
        <line
          x1={scale.normalEnd}
          x2={scale.upperEnd}
          y1="6"
          y2="6"
          stroke="var(--emr-status-warning-border)"
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
      <span
        className={cn(
          "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow-sm transition-[left,background-color,fill] duration-300 ease-out",
          markerClassName
        )}
        style={{ left: `${scale.valuePercent}%` }}
      />
    </div>
  );
}

function LabResultCommentSection({ result }: { result: LabResult }) {
  const abnormalRows = getActionableLabRows(result);
  const defaultComment = abnormalRows.length
    ? `${abnormalRows.map((row) => row.analyteName).join(", ")} 항목이 참고치 밖입니다. 임상 증상과 함께 재평가가 필요합니다.`
    : "";

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex h-11 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <h2 className="emr-text-body font-semibold">검사결과 종합소견</h2>
          <Badge variant="secondary">담당자 코멘트</Badge>
        </div>
      </div>
      <div className="p-4">
        <Textarea
          aria-label="검사결과 종합소견"
          className="min-h-24 resize-y bg-background emr-text-dense leading-5"
          defaultValue={defaultComment}
          placeholder="검사자가 결과 해석, 재검 필요 여부, 보호자 안내 메모를 입력합니다."
        />
      </div>
    </section>
  );
}

type AttachmentPreviewItem = {
  fileName: string;
  fileSizeBytes?: number;
  id: string;
  mimeType: string;
  previewKind: "file" | "image";
};

const labDemoImageAttachment: AttachmentPreviewItem = {
  id: "lab-demo-blood-smear-image",
  fileName: "cbc-smear-preview.png",
  fileSizeBytes: 442368,
  mimeType: "image/png",
  previewKind: "image",
};

function AttachmentStrip({
  attachments,
  showImageExample = false,
}: {
  attachments: EmrAttachment[];
  showImageExample?: boolean;
}) {
  const displayAttachments: AttachmentPreviewItem[] = [
    ...attachments.map((attachment) => ({
      fileName: attachment.fileName,
      fileSizeBytes: attachment.fileSizeBytes,
      id: attachment.id,
      mimeType: attachment.mimeType,
      previewKind: attachment.mimeType.startsWith("image/") ? "image" as const : "file" as const,
    })),
    ...(showImageExample ? [labDemoImageAttachment] : []),
  ];

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex h-11 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <h2 className="emr-text-body font-semibold">첨부자료</h2>
          <Badge variant="secondary">{displayAttachments.length}</Badge>
        </div>
        <Button size="xs" variant="outline" className="bg-card" aria-label="첨부자료 추가">
          <CdsActionsPlusIcon data-icon="inline-start" />
          추가
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 p-4">
        {displayAttachments.map((attachment) => (
          <div key={attachment.id} className="min-w-[220px] overflow-hidden rounded-md border bg-card">
            {attachment.previewKind === "image" ? (
              <div className="flex h-24 items-center justify-center bg-[linear-gradient(135deg,var(--emr-status-info-bg),var(--emr-status-success-bg))]">
                <div className="flex size-12 items-center justify-center rounded-full bg-card/80 text-[var(--emr-status-info-text)] shadow-sm">
                  <CdsFilesImageIcon className="size-6" aria-hidden="true" />
                </div>
              </div>
            ) : (
              <div className="flex h-10 items-center px-3 pt-3 text-muted-foreground">
                <CdsFilesFileIcon className="size-5" aria-hidden="true" />
              </div>
            )}
            <div className="p-3 pt-2">
              <div className="truncate emr-text-dense font-medium">{attachment.fileName}</div>
              <div className="mt-1 emr-text-metadata text-muted-foreground">
                {attachment.mimeType} · {formatFileSize(attachment.fileSizeBytes)}
              </div>
            </div>
          </div>
        ))}
        {!displayAttachments.length ? (
          <div className="rounded-md border border-dashed p-3 emr-text-dense text-muted-foreground">
            첨부자료 없음
          </div>
        ) : null}
      </div>
    </section>
  );
}

function useCurrentLabDetail(workspaceId: string) {
  const searchParams = useSearchParams();
  const selectedLabResultId = useLabImagingStore((state) => state.selectedLabResultId);
  const fulfillmentQueue = useFulfillmentQueue("lab");

  return getLabDetailFromSearchParams(
    searchParams,
    selectedLabResultId,
    fulfillmentQueue.workItems,
    { allowMockFallback: isLegacySalesDemoWorkspace(workspaceId) },
  );
}

export function LabHeader({ workspaceId }: ShellComponentProps) {
  const { detail } = useCurrentLabDetail(workspaceId);

  if (!detail) return null;

  return (
    <EmrPatientContextBar
      patientItems={[
        { label: "환자", value: detail.patient.name },
        { label: "보호자", value: detail.primaryGuardian?.name ?? "보호자 미지정" },
        { label: "품종", value: detail.patient.breed ?? getSpeciesLabel(detail.patient) },
        { label: "나이", value: getPatientDisplayAge(detail.patient) },
        { label: "성별", value: getPatientSexLabel(detail.patient) },
      ]}
      vitalItems={[
        { label: "체중", value: "5.96 kg" },
        { label: "체온", value: "39.3°C" },
        { label: "호흡", value: "20 rpm" },
        { label: "혈압", value: "170 bpm" },
      ]}
      memoActions={[
        {
          label: "방문목적",
          summary:
            detail.encounter.visitPurpose ??
            detail.encounter.chiefComplaint ??
            "방문 목적 기록 없음",
        },
        {
          label: "보호자 메모",
          locked: true,
          summary: detail.primaryGuardian?.memo ?? "보호자 메모 없음",
          unavailableReason: "보호자 프로필 메모는 고객 정보 화면에서 관리합니다.",
        },
        {
          label: "환자 메모",
          summary:
            [
              detail.patient.allergyNote,
              detail.patient.specialNote,
              detail.patient.handlingCautionNote,
            ]
              .filter(Boolean)
              .join(" · ") || "환자 특이 메모 없음",
        },
        {
          label: "수납 메모",
          disabled: true,
          unavailableReason: "수납 메모는 수납 화면에서 관리합니다.",
        },
      ]}
      trailingItems={[
        { label: "검사", value: detail.result.resultName },
        { label: "상태", value: getStatusLabel("labResult", detail.result.status) },
      ]}
    />
  );
}

export function LabContentAside({ workspaceId }: ShellComponentProps) {
  const { detail } = useCurrentLabDetail(workspaceId);
  const setContentAsideOpen = useLayoutStore((state) => state.setContentAsideOpen);
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<Set<string>>(() => new Set());
  const groups = detail ? getLabHistoryGroups(detail) : [];
  const totalHistoryCount = groups.reduce((total, group) => total + group.count, 0);
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
    <EmrContentAsidePanel id="lab-content-aside">
      <EmrListHeader
        className="mx-0 h-6 border-y-0"
        count={totalHistoryCount}
        label="임상병리검사 이력"
        leadingAction={
          <EmrListHeaderIconButton ariaLabel="임상병리검사 이력 목록 접기" iconSize="md" onClick={() => setContentAsideOpen(false)}>
            <CdsNavigationChevronsLeftIcon className="size-4" />
          </EmrListHeaderIconButton>
        }
        headerActions={<QueueActions />}
      />
      <div className="h-px w-full shrink-0 bg-[var(--emr-line-subtle)]" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1">
          {groups.map((group) => (
            <EmrContentHistoryGroup
              key={group.date}
              collapsed={collapsedHistoryGroups.has(group.date)}
              count={group.count}
              dataTestId={`lab-history-group-${group.date}`}
              label={group.date}
              onToggle={() => toggleHistoryGroup(group.date)}
            >
              {group.items.map((item) => (
                <EmrContentHistoryItem
                  key={`${group.date}-${item.title}`}
                  title={item.title}
                  subtitle={item.description}
                />
              ))}
            </EmrContentHistoryGroup>
          ))}
        </div>
      </ScrollArea>
    </EmrContentAsidePanel>
  );
}

export function LabRightPanel({ workspaceId }: ShellComponentProps) {
  const { detail } = useCurrentLabDetail(workspaceId);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<Set<string> | null>(null);
  const [receiptToPaste, setReceiptToPaste] = useState<EquipmentReceipt | null>(null);
  const labWorkItems = useMemo(
    () => (isLegacySalesDemoWorkspace(workspaceId) ? getLabWorkItems() : []),
    [workspaceId],
  );
  const workItemByOrderId = useMemo(() => {
    const map = new Map<string, LabWorkItem>();

    labWorkItems.forEach((item) => {
      if (item.order?.id) {
        map.set(item.order.id, item);
      }
    });

    return map;
  }, [labWorkItems]);
  const linkedReceipts = useMemo(() => {
    if (!detail) return [];

    return detail.allEquipmentReceipts.filter((receipt) => receipt.orderId === detail.order?.id);
  }, [detail]);
  const visibleReceipts = linkedReceipts;
  const hasEnteredRows = Boolean(detail?.result.rows.some((row) => row.value));
  const latestReceiptDate = visibleReceipts[0]?.receivedAt ?? detail?.result.receivedAt;
  const receiptOperatingDate = latestReceiptDate?.slice(0, 10);
  const dateLabel = receiptOperatingDate ? formatKoreanOperatingDateLabel(receiptOperatingDate) : "-";
  const defaultExpandedReceiptId = visibleReceipts[0]?.id;

  return (
    <div
      id="lab-receipt-panel"
      className="group/lab-receipt-panel flex min-h-0 flex-1 flex-col"
      data-testid="lab-receipt-panel"
    >
      <div className="flex h-14 items-center px-4">
        <div className="relative flex min-w-0 max-w-full items-center">
          <h2 className="min-w-0 truncate text-sm font-semibold">장비 검사 수신함</h2>
          <span className="pointer-events-auto absolute left-full z-10 ml-1 flex w-7 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="opacity-0 text-[var(--emr-text-tertiary)] transition-opacity hover:text-[var(--emr-text-tertiary)] group-hover/lab-receipt-panel:opacity-100 focus-visible:opacity-100"
              aria-label="장비 검사 수신함 접기"
              onClick={() => setRightPanelOpen(false)}
            >
              <CdsNavigationChevronsRightIcon className="size-4" />
            </Button>
          </span>
        </div>
      </div>
      <EmrDateNavigator
        className="px-3"
        dateLabel={dateLabel}
        selectedDate={receiptOperatingDate}
        todayLabel="오늘"
      />
      <EmrListHeader
        className="mx-3"
        count={visibleReceipts.length}
        label="검사 결과"
        headerActions={
          <>
            <EmrListHeaderIconButton ariaLabel="장비 검사 수신함 정렬">
              <CdsUtilitiesSortIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="장비 검사 수신함 필터">
              <CdsActionsListFilterIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="장비 검사 수신함 검색">
              <CdsActionsSearchIcon className="size-4" />
            </EmrListHeaderIconButton>
          </>
        }
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          {visibleReceipts.map((receipt) => {
            const receiptWorkItem = receipt.orderId ? workItemByOrderId.get(receipt.orderId) : undefined;
            const previewRows = receiptWorkItem?.result.rows ?? [];
            const expanded = expandedReceiptIds
              ? expandedReceiptIds.has(receipt.id)
              : receipt.id === defaultExpandedReceiptId;

            return (
              <LabReceiptCard
                key={receipt.id}
                expanded={expanded}
                linkedToCurrentOrder={receipt.orderId === detail?.order?.id}
                orderLabel={receiptWorkItem?.order?.displayName ?? receiptWorkItem?.result.resultName ?? "오더 미지정"}
                patientLabel={receiptWorkItem?.patient.name ?? "환자 미지정"}
                previewRows={previewRows}
                primaryGuardianLabel={receiptWorkItem?.primaryGuardian?.name ?? "보호자 미지정"}
                receipt={receipt}
                onPaste={() => setReceiptToPaste(receipt)}
                onToggle={() => {
                  setExpandedReceiptIds((current) => {
                    const next = new Set(
                      current ?? (defaultExpandedReceiptId ? [defaultExpandedReceiptId] : [])
                    );

                    if (next.has(receipt.id)) {
                      next.delete(receipt.id);
                    } else {
                      next.add(receipt.id);
                    }

                    return next;
                  });
                }}
              />
            );
          })}
          {!visibleReceipts.length ? (
            <section className="rounded-md border border-dashed p-3 emr-text-dense text-muted-foreground">
              현재 오더와 연결된 장비결과가 없습니다.
            </section>
          ) : null}
        </div>
      </ScrollArea>
      <Dialog open={Boolean(receiptToPaste)} onOpenChange={(open) => !open && setReceiptToPaste(null)}>
        <EmrConfirmDialogContent
          title="검사결과를 붙여넣을까요?"
          description={
            <>
              {receiptToPaste?.equipmentName} 수신값을 현재 검사결과지에 입력합니다.
              {hasEnteredRows ? " 이전에 입력된 수치가 있으면 장비 수신값으로 덮어씁니다." : ""}
            </>
          }
          cancelLabel="취소"
          confirmLabel="붙여넣기"
          closeAriaLabel="검사결과 붙여넣기 확인 닫기"
          onCancel={() => setReceiptToPaste(null)}
          onConfirm={() => setReceiptToPaste(null)}
        />
      </Dialog>
    </div>
  );
}

function LabReceiptCard({
  expanded,
  linkedToCurrentOrder,
  onPaste,
  onToggle,
  orderLabel,
  patientLabel,
  previewRows,
  primaryGuardianLabel,
  receipt,
}: {
  expanded: boolean;
  linkedToCurrentOrder: boolean;
  onPaste: () => void;
  onToggle: () => void;
  orderLabel: string;
  patientLabel: string;
  previewRows: LabResultRow[];
  primaryGuardianLabel: string;
  receipt: EquipmentReceipt;
}) {
  const reduceMotion = useReducedMotion();
  const contentTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.24, ease: EMR_SIDE_PANEL_COLLAPSE_EASE },
        opacity: { duration: 0.14, ease: "easeOut" },
        y: { duration: 0.2, ease: EMR_SIDE_PANEL_COLLAPSE_EASE },
      };
  const contentExitTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.18, ease: EMR_SIDE_PANEL_COLLAPSE_EXIT_EASE },
        opacity: { duration: 0.12, ease: "easeIn" },
        y: { duration: 0.16, ease: EMR_SIDE_PANEL_COLLAPSE_EXIT_EASE },
      };
  const actionLabel = linkedToCurrentOrder
    ? "결과 붙여넣기"
    : receipt.status === "matched"
      ? "다른 오더 연결"
      : "수동 매칭 필요";
  const receivedTime = formatShortDateTime(receipt.receivedAt).slice(9);

  return (
    <section className="overflow-hidden rounded-lg border bg-card" data-testid={`lab-receipt-${receipt.id}`}>
      <button
        type="button"
        className={cn(
          "flex w-full items-start gap-3 px-4 text-left outline-none transition-colors hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50",
          expanded ? "pb-1 pt-3" : "py-3"
        )}
        aria-expanded={expanded}
        aria-label={`${receipt.equipmentName} 수신결과 ${expanded ? "접기" : "펼치기"}`}
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate emr-text-section font-semibold text-foreground">
              {receipt.equipmentName}
            </span>
            <span className="shrink-0 rounded border border-[var(--emr-line-subtle)] px-1.5 py-0.5 emr-text-metadata font-medium text-[var(--emr-text-secondary)]">
              {receivedTime} 수신
            </span>
          </div>
          <div className="mt-1 truncate emr-text-metadata font-medium text-muted-foreground">
            {patientLabel} · {primaryGuardianLabel} {orderLabel}
          </div>
        </div>
        <motion.span
          className="mt-1 flex shrink-0 items-center justify-center"
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: EMR_SIDE_PANEL_COLLAPSE_EASE }}
        >
          <ChevronDownIcon className="size-4 text-foreground" aria-hidden="true" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key={`${receipt.id}-preview`}
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0, transition: contentTransition }}
            exit={{ height: 0, opacity: 0, y: -4, transition: contentExitTransition }}
          >
            <div className="px-4 pb-3 pt-2">
              <div className="mb-2 h-px w-full bg-[var(--emr-line-subtle)]" />
              <div className="flex h-8 items-center justify-between gap-2">
                <h3 className="emr-text-dense font-semibold text-[var(--emr-text-secondary)]">검사 결과</h3>
                <Button
                  size="xs"
                  variant="outline"
                  className="bg-card"
                  disabled={!linkedToCurrentOrder}
                  onClick={onPaste}
                >
                  {actionLabel}
                </Button>
              </div>
              {previewRows.length ? (
                <div className="mt-2 overflow-hidden">
                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(52px,1fr)_minmax(48px,1fr)] bg-[var(--emr-surface-muted)] px-2 py-2 emr-text-metadata font-medium text-[var(--emr-text-secondary)]">
                    <span>검사 항목명</span>
                    <span>수치</span>
                    <span>단위</span>
                  </div>
                  {previewRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[minmax(0,2fr)_minmax(52px,1fr)_minmax(48px,1fr)] border-t px-2 py-2 emr-text-metadata leading-5"
                    >
                      <span className="truncate text-[var(--emr-text-secondary)]">{row.analyteName}</span>
                      <span className="text-foreground">{row.value}</span>
                      <span className="truncate text-muted-foreground">{row.unit ?? "-"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 rounded-md border border-dashed p-3 emr-text-metadata text-muted-foreground">
                  미리 볼 수 있는 검사 결과가 없습니다.
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

export function LabContent({ hasRightPanel, workspaceId }: ShellComponentProps) {
  const searchParams = useSearchParams();
  const selectedLabResultId = useLabImagingStore((state) => state.selectedLabResultId);
  const selectLabResult = useLabImagingStore((state) => state.selectLabResult);
  const contentAsideOpen = useLayoutStore((state) => state.contentAsideOpen);
  const setContentAsideOpen = useLayoutStore((state) => state.setContentAsideOpen);
  const rightPanelOpen = useLayoutStore((state) => state.rightPanelOpen);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
  const fulfillmentQueue = useFulfillmentQueue("lab");
  const { detail, queryLabResultId } = getLabDetailFromSearchParams(
    searchParams,
    selectedLabResultId,
    fulfillmentQueue.workItems,
    { allowMockFallback: isLegacySalesDemoWorkspace(workspaceId) },
  );
  const fulfillmentWorkItem = useMemo(
    () => fulfillmentQueue.workItems.find((item) => item.orderId === detail?.order?.id),
    [detail?.order?.id, fulfillmentQueue.workItems]
  );
  const catalogRowsState = useLabResultSheetCatalogRows({
    result: detail?.result,
    workItem: fulfillmentWorkItem,
    workspaceId,
  });
  const effectiveDetail = useMemo(() => {
    if (!detail) return null;
    if (detail.result.rows.length > 0 || catalogRowsState.rows.length === 0) return detail;

    return {
      ...detail,
      result: {
        ...detail.result,
        rows: catalogRowsState.rows,
      },
    };
  }, [catalogRowsState.rows, detail]);
  const saveResultRows = useCallback(
    (rows: LabResultRow[]) => {
      if (!effectiveDetail) {
        return Promise.resolve({
          message: "선택된 검사 결과가 없습니다.",
          ok: false,
          reason: "invalid",
          retryable: false,
        } satisfies LabResultSaveOutcome);
      }
      return saveLabResultEntry({
        result: effectiveDetail.result,
        rows,
        workItem: fulfillmentWorkItem,
        workspaceId,
      });
    },
    [effectiveDetail, fulfillmentWorkItem, workspaceId],
  );
  const [resultTab, setResultTab] = useState<LabResultTab>("all");
  const initialAssignment = {
    assigneeName: detail?.technicianName ?? "미지정",
    resultId: detail?.result.id ?? "",
    status: "requested" as LabAssignmentStatus,
  };
  const [assignmentState, setAssignmentState] = useState(initialAssignment);
  const assignment = assignmentState.resultId === initialAssignment.resultId ? assignmentState : initialAssignment;
  const equipmentReceiptCount = detail?.equipmentReceipts.filter((receipt) => receipt.orderId === detail.order?.id).length ?? 0;
  const startAssignment = async () => {
    if (fulfillmentWorkItem) {
      const transitionPath = getFulfillmentTransitionPath(fulfillmentWorkItem.status, "in_progress");
      if (!transitionPath) return;
      const updated = await fulfillmentQueue.updateStatus(fulfillmentWorkItem.id, transitionPath);
      if (!updated) return;
    }
    setAssignmentState({
      assigneeName: currentLabAssignee.name,
      resultId: initialAssignment.resultId,
      status: "in_progress",
    });
  };
  const completeAssignment = async () => {
    if (fulfillmentWorkItem) {
      const transitionPath = getFulfillmentTransitionPath(fulfillmentWorkItem.status, "completed");
      if (!transitionPath) return;
      const updated = await fulfillmentQueue.updateStatus(fulfillmentWorkItem.id, transitionPath);
      if (!updated) return;
    }
    setAssignmentState((current) => ({
      assigneeName:
        current.resultId === initialAssignment.resultId ? current.assigneeName : currentLabAssignee.name,
      resultId: initialAssignment.resultId,
      status: "completed",
    }));
  };
  const cancelAssignment = async () => {
    if (fulfillmentWorkItem) {
      const transitionPath = getFulfillmentTransitionPath(fulfillmentWorkItem.status, "requested");
      if (!transitionPath) return;
      const updated = await fulfillmentQueue.updateStatus(fulfillmentWorkItem.id, transitionPath);
      if (!updated) return;
    }
    setAssignmentState({
      assigneeName: "미지정",
      resultId: initialAssignment.resultId,
      status: "requested",
    });
  };

  useEffect(() => {
    if (queryLabResultId && queryLabResultId !== selectedLabResultId) {
      selectLabResult(queryLabResultId);
      return;
    }
    if (!queryLabResultId && detail?.result.id && detail.result.id !== selectedLabResultId) {
      selectLabResult(detail.result.id);
    }
  }, [detail?.result.id, queryLabResultId, selectLabResult, selectedLabResultId]);

  if (!effectiveDetail) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--emr-surface-workspace)] emr-text-dense text-muted-foreground">
        검사 대기열에서 항목을 선택해 주세요.
      </div>
    );
  }

  const displayDetail = effectiveDetail;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] px-4 py-3">
      <EmrInstructionHeaderStack
        titleBar={
          <EmrInstructionTitleBar
            title="임상병리검사 결과지"
            className="h-auto min-h-9 flex-wrap gap-2"
            titleClassName="text-[16px] leading-6"
            icon={
              <EmrInstructionHistoryToggle
                ariaLabelPrefix="임상병리검사 이력"
                controls="lab-content-aside"
                expanded={contentAsideOpen}
                tooltipLabel="임상병리검사 이력"
                onClick={() => setContentAsideOpen(!contentAsideOpen)}
              />
            }
            badge={
              <Badge variant="secondary" className="h-5 rounded-md px-2 emr-text-micro text-muted-foreground">
                {getLabResultDocumentId(displayDetail.result)}
              </Badge>
            }
            actions={
              <>
                <Button variant="outline" size="sm" className="bg-card">
                  <DownloadIcon data-icon="inline-start" />
                  PDF 다운로드
                </Button>
                <Button variant="outline" size="sm" className="bg-card">
                  <PrinterIcon data-icon="inline-start" />
                  출력하기
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="relative bg-card data-[state=on]:border-[var(--clair-color-atomic-black-alpha-16)] data-[state=on]:bg-[var(--clair-color-atomic-black-alpha-4)] data-[state=on]:text-[var(--emr-text-primary)]"
                  aria-controls="lab-receipt-panel"
                  aria-expanded={rightPanelOpen}
                  aria-pressed={rightPanelOpen}
                  data-state={rightPanelOpen ? "on" : "off"}
                  disabled={!hasRightPanel}
                  onClick={() => setRightPanelOpen(!rightPanelOpen)}
                >
                  <CdsUtilitiesHistoryIcon data-icon="inline-start" />
                  장비 검사 수신함
                  {equipmentReceiptCount ? (
                    <span
                      className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[var(--emr-status-info-text)] px-1 text-[10px] font-semibold leading-none text-[var(--emr-text-inverse)]"
                      aria-label={`새 장비결과 ${equipmentReceiptCount}건`}
                    >
                      {equipmentReceiptCount}
                    </span>
                  ) : null}
                </Button>
                <LabImagingStatusAction
                  activeLabel="검사중"
                  activeStatus="in_progress"
                  completeLabel="검사완료"
                  completedStatus="completed"
                  menuAriaLabel="검사 상태 액션"
                  requestedStatus="requested"
                  status={assignment.status}
                  onStart={startAssignment}
                  onComplete={completeAssignment}
                  onCancelAssignment={cancelAssignment}
                />
              </>
            }
          />
        }
        orderInfo={
          <div className="grid [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))] rounded-lg border border-border bg-card px-4 py-3">
            {[
              [
                "요청 일시",
                <span key="requested-at" className="flex flex-wrap items-center gap-1.5">
                  <span>{formatShortDateTime(displayDetail.result.collectedAt)}</span>
                  <EmrStatusBadge
                    label={getStatusLabel("labResult", displayDetail.result.status)}
                    marker="none"
                    testId="lab-result-status-label"
                  />
                </span>,
              ],
              [
                "환자 정보",
                `${displayDetail.patient.name}(${getPatientDisplayAge(displayDetail.patient)}) · ${displayDetail.patient.breed ?? getSpeciesLabel(displayDetail.patient)}`,
              ],
              ["요청 수의사", getStaffName(displayDetail.order?.requestedByUserId) ?? "이수지"],
              ["검사 담당", <span key="lab-assignee" aria-live="polite">{assignment.assigneeName}</span>],
              [
                "수신 장비",
                displayDetail.equipmentReceipts.find((receipt) => receipt.status === "matched")?.equipmentName ?? "미수신",
              ],
            ].map(([label, value]) => (
              <div key={label as string} className="min-w-0 border-r border-border px-3 last:border-r-0">
                <div className="emr-text-metadata font-medium text-muted-foreground">{label}</div>
                <div className="mt-1 flex min-h-6 min-w-0 items-center emr-text-dense font-medium text-foreground">{value}</div>
              </div>
            ))}
          </div>
        }
        filters={
          <EmrInstructionFilterTabs
            aria-label="검사 결과 필터"
            value={resultTab}
            items={labResultTabItems.map((item) => ({
              ...item,
              count: item.value === "all" ? displayDetail.result.rows.length : item.value === "cbc" ? displayDetail.result.rows.length : 0,
              disabled: item.value === "chemistry",
            }))}
            onValueChange={setResultTab}
          />
        }
      />

      <ScrollArea data-slot="lab-result-scroll-area" className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 pb-10 pt-4">
          <LabResultInputSection
            assigneeName={assignment.assigneeName}
            catalogStatus={detail?.result.rows.length === 0 ? catalogRowsState.status : "idle"}
            result={displayDetail.result}
            onCatalogRetry={catalogRowsState.retry}
            onSave={saveResultRows}
          />
          <LabResultCommentSection result={displayDetail.result} />
          <AttachmentStrip attachments={displayDetail.attachments} showImageExample />
        </div>
      </ScrollArea>
    </div>
  );
}

function useCurrentImagingDetail(workspaceId: string) {
  const searchParams = useSearchParams();
  const selectedImagingStudyId = useLabImagingStore((state) => state.selectedImagingStudyId);
  const fulfillmentQueue = useFulfillmentQueue("imaging");

  return getImagingDetailFromSearchParams(
    searchParams,
    selectedImagingStudyId,
    fulfillmentQueue.workItems,
    { allowMockFallback: isLegacySalesDemoWorkspace(workspaceId) },
  );
}

export function ImagingHeader({ hasRightPanel, workspaceId }: ShellComponentProps) {
  const { detail } = useCurrentImagingDetail(workspaceId);
  const rightPanelOpen = useLayoutStore((state) => state.rightPanelOpen);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);

  if (!detail) return null;

  return (
    <EmrPatientContextBar
      patientItems={[
        { label: "환자", value: detail.patient.name },
        { label: "보호자", value: detail.primaryGuardian?.name ?? "보호자 미지정" },
        { label: "품종", value: detail.patient.breed ?? getSpeciesLabel(detail.patient) },
        { label: "나이", value: getPatientDisplayAge(detail.patient) },
        { label: "성별", value: getPatientSexLabel(detail.patient) },
      ]}
      vitalItems={[
        { label: "체중", value: "5.96 kg" },
        { label: "체온", value: "39.3°C" },
        { label: "호흡", value: "20 rpm" },
        { label: "혈압", value: "170 bpm" },
      ]}
      memoActions={[
        {
          label: "방문목적",
          summary:
            detail.encounter.visitPurpose ??
            detail.encounter.chiefComplaint ??
            "방문 목적 기록 없음",
        },
        {
          label: "보호자 메모",
          locked: true,
          summary: detail.primaryGuardian?.memo ?? "보호자 메모 없음",
          unavailableReason: "보호자 프로필 메모는 고객 정보 화면에서 관리합니다.",
        },
        {
          label: "환자 메모",
          summary:
            [
              detail.patient.allergyNote,
              detail.patient.specialNote,
              detail.patient.handlingCautionNote,
            ]
              .filter(Boolean)
              .join(" · ") || "환자 특이 메모 없음",
        },
        {
          label: "수납 메모",
          disabled: true,
          unavailableReason: "수납 메모는 수납 화면에서 관리합니다.",
        },
      ]}
      trailingItems={[
        { label: "영상", value: detail.order?.displayName ?? `${detail.study.modality} ${detail.study.bodyPart}` },
        { label: "상태", value: getStatusLabel("imagingStudy", detail.study.status) },
      ]}
      onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
      rightPanelBadgeCount={detail.attachments.length}
      rightPanelDisabled={!hasRightPanel}
      rightPanelOpen={rightPanelOpen}
      rightPanelToggleLabel="종합소견"
    />
  );
}

type ImagingHistoryGroup = {
  count: number;
  date: string;
  items: ImagingWorkItem[];
};

function getImagingHistoryGroups(detail: ImagingDetail, allItems: ImagingWorkItem[]): ImagingHistoryGroup[] {
  const patientItems = allItems.filter((item) => item.patient.id === detail.patient.id);
  const groupsByDate = new Map<string, ImagingWorkItem[]>();

  patientItems.forEach((item) => {
    const date = formatShortDateTime(item.study.capturedAt ?? item.study.requestedAt).slice(0, 8).trim() || "오늘";
    const groupItems = groupsByDate.get(date) ?? [];

    groupItems.push(item);
    groupsByDate.set(date, groupItems);
  });

  return Array.from(groupsByDate.entries()).map(([date, items]) => ({
    count: items.length,
    date,
    items,
  }));
}

export function ImagingContentAside({ workspaceId }: ShellComponentProps) {
  const { detail } = useCurrentImagingDetail(workspaceId);
  const selectedImagingStudyId = useLabImagingStore((state) => state.selectedImagingStudyId);
  const selectImagingStudy = useLabImagingStore((state) => state.selectImagingStudy);
  const setContentAsideOpen = useLayoutStore((state) => state.setContentAsideOpen);
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<Set<string>>(() => new Set());
  const allItems = useMemo(
    () => (isLegacySalesDemoWorkspace(workspaceId) ? getImagingWorkItems() : []),
    [workspaceId],
  );
  const groups = detail ? getImagingHistoryGroups(detail, allItems) : [];
  const totalHistoryCount = groups.reduce((total, group) => total + group.count, 0);
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
    <EmrContentAsidePanel id="imaging-content-aside">
      <EmrListHeader
        className="mx-0 h-6 border-y-0"
        count={totalHistoryCount}
        label="영상검사 이력"
        leadingAction={
          <EmrListHeaderIconButton ariaLabel="영상검사 이력 목록 접기" iconSize="md" onClick={() => setContentAsideOpen(false)}>
            <CdsNavigationChevronsLeftIcon className="size-4" />
          </EmrListHeaderIconButton>
        }
        headerActions={<QueueActions />}
      />
      <div className="h-px w-full shrink-0 bg-[var(--emr-line-subtle)]" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1">
          {groups.map((group) => (
            <EmrContentHistoryGroup
              key={group.date}
              count={group.count}
              dataTestId={`imaging-history-group-${group.date}`}
              label={group.date}
              collapsed={collapsedHistoryGroups.has(group.date)}
              onToggle={() => toggleHistoryGroup(group.date)}
            >
              {group.items.map((item) => (
                <EmrContentHistoryItem
                  key={item.study.id}
                  selected={item.study.id === selectedImagingStudyId}
                  testId={`imaging-history-item-${item.study.id}`}
                  title={`${item.study.modality} · ${item.study.bodyPart}`}
                  subtitle={item.order?.displayName ?? getStatusLabel("imagingStudy", item.study.status)}
                  meta={`${item.radiologistName ?? "판독 미지정"} · ${formatShortDateTime(
                    item.study.capturedAt ?? item.study.requestedAt
                  )}`}
                  onSelect={() => selectImagingStudy(item.study.id)}
                />
              ))}
            </EmrContentHistoryGroup>
          ))}
        </div>
      </ScrollArea>
    </EmrContentAsidePanel>
  );
}

function getImagingDocumentId(study: ImagingStudy) {
  const suffix = study.id.replace("imaging-", "").toUpperCase();

  return `IMG-${suffix}`;
}

function ImagingOrderDetailTable({ detail }: { detail: ImagingDetail }) {
  const [density, setDensity] = useState<EmrTableDensity>("comfortable");

  return (
    <EmrOrderGroupSection
      title="Order 상세정보"
      count={1}
      meta={<span className="emr-text-metadata font-medium text-muted-foreground">같은 차트 기준</span>}
      actions={
        <>
          <EmrTableDensitySelector value={density} onValueChange={setDensity} />
          <Button size="xs" variant="outline" className="bg-card">
            PACS
          </Button>
        </>
      }
    >
      <div>
        <Table density={density} layout="scroll" minWidth={760} className="min-w-[760px] table-fixed leading-5">
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[25%]" />
            <col className="w-[18%]" />
            <col className="w-[17%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
          </colgroup>
          <TableHeader className="bg-[var(--emr-surface-muted)]">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-10 bg-[var(--emr-surface-muted)] px-2 emr-text-dense font-medium text-muted-foreground">검사분류</TableHead>
              <TableHead className="h-10 bg-[var(--emr-surface-muted)] px-2 emr-text-dense font-medium text-muted-foreground">검사명</TableHead>
              <TableHead className="h-10 bg-[var(--emr-surface-muted)] px-2 emr-text-dense font-medium text-muted-foreground">검사명(영문)</TableHead>
              <TableHead className="h-10 bg-[var(--emr-surface-muted)] px-2 emr-text-dense font-medium text-muted-foreground">요청자</TableHead>
              <TableHead className="h-10 bg-[var(--emr-surface-muted)] px-2 emr-text-dense font-medium text-muted-foreground">요청 일시</TableHead>
              <TableHead className="h-10 bg-[var(--emr-surface-muted)] px-2 emr-text-dense font-medium text-muted-foreground">검사 담당자</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-border bg-card hover:bg-[var(--emr-state-hover)]">
              <TableCell className="h-11 px-2 font-medium">
                <Badge variant="secondary" className="h-5 rounded-md px-1.5 emr-text-micro">
                  {detail.study.modality === "X-ray" ? "XR" : "US"}
                </Badge>
              </TableCell>
              <TableCell className="h-11 whitespace-normal px-2 font-medium">
                {detail.order?.displayName ?? detail.study.bodyPart}
              </TableCell>
              <TableCell className="h-11 whitespace-normal px-2 text-muted-foreground">
                {detail.study.modality} {detail.study.bodyPart}
              </TableCell>
              <TableCell className="h-11 px-2">
                <span className="block truncate">{getStaffName(detail.order?.requestedByUserId) ?? "이수지"}</span>
              </TableCell>
              <TableCell className="h-11 px-2">
                <span className="block truncate">{formatShortDateTime(detail.study.requestedAt)}</span>
              </TableCell>
              <TableCell className="h-11 px-2">
                <span className="block truncate">{detail.radiologistName ?? "미지정"}</span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </EmrOrderGroupSection>
  );
}

function ImagingReadingSections({ study }: { study: ImagingStudy }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex min-h-11 items-center justify-between gap-3 border-b px-4">
        <h2 className="emr-text-body font-semibold">스터디 판독의견</h2>
        <div className="flex h-8 items-center gap-1 rounded-lg bg-[var(--emr-surface-muted)] px-2 emr-text-dense font-semibold text-muted-foreground">
          <span>B</span>
          <span className="italic">I</span>
          <span>T</span>
          <span>link</span>
          <span>list</span>
        </div>
      </div>
      <div className="grid gap-3 p-4">
        <div>
          <div className="emr-text-metadata font-medium text-muted-foreground">Findings</div>
          <Textarea
            aria-label="영상 판독 내용"
            className="mt-2 min-h-32 resize-none bg-background emr-text-dense leading-5"
            defaultValue={study.reading}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="emr-text-metadata font-medium text-muted-foreground">Imaging Dx</div>
            <Textarea
              aria-label="Imaging Dx"
              className="mt-2 min-h-20 resize-none bg-background emr-text-dense leading-5"
              defaultValue={study.impression ? `${study.bodyPart} 영상상 위장관염 가능성` : ""}
            />
          </div>
          <div>
            <div className="emr-text-metadata font-medium text-muted-foreground">DDx</div>
            <Textarea
              aria-label="DDx"
              className="mt-2 min-h-20 resize-none bg-background emr-text-dense leading-5"
              defaultValue="이물, 급성 위장관염, 식이성 구토"
            />
          </div>
          <div>
            <div className="emr-text-metadata font-medium text-muted-foreground">Impression</div>
            <Textarea
              aria-label="영상 종합소견"
              className="mt-2 min-h-20 resize-none bg-background emr-text-dense leading-5"
              defaultValue={study.impression}
            />
          </div>
          <div>
            <div className="emr-text-metadata font-medium text-muted-foreground">Recommendation</div>
            <Textarea
              aria-label="Recommendation"
              className="mt-2 min-h-20 resize-none bg-background emr-text-dense leading-5"
              defaultValue="CBC 결과와 임상 증상을 종합해 추적 관찰합니다."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function ImagingContent({ workspaceId }: ShellComponentProps) {
  const searchParams = useSearchParams();
  const selectedImagingStudyId = useLabImagingStore((state) => state.selectedImagingStudyId);
  const selectImagingStudy = useLabImagingStore((state) => state.selectImagingStudy);
  const contentAsideOpen = useLayoutStore((state) => state.contentAsideOpen);
  const setContentAsideOpen = useLayoutStore((state) => state.setContentAsideOpen);
  const fulfillmentQueue = useFulfillmentQueue("imaging");
  const { detail, queryImagingStudyId } = getImagingDetailFromSearchParams(
    searchParams,
    selectedImagingStudyId,
    fulfillmentQueue.workItems,
    { allowMockFallback: isLegacySalesDemoWorkspace(workspaceId) },
  );
  const fulfillmentWorkItem = useMemo(
    () => fulfillmentQueue.workItems.find((item) => item.orderId === detail?.order?.id),
    [detail?.order?.id, fulfillmentQueue.workItems]
  );
  const initialAssignment = {
    assigneeName: detail?.radiologistName ?? "미지정",
    status: getInitialImagingReadingStatus(detail?.study.status),
    studyId: detail?.study.id ?? "",
  };
  const [assignmentState, setAssignmentState] = useState(initialAssignment);
  const assignment = assignmentState.studyId === initialAssignment.studyId ? assignmentState : initialAssignment;
  const startAssignment = async () => {
    if (fulfillmentWorkItem) {
      const transitionPath = getFulfillmentTransitionPath(fulfillmentWorkItem.status, "in_progress");
      if (!transitionPath) return;
      const updated = await fulfillmentQueue.updateStatus(fulfillmentWorkItem.id, transitionPath);
      if (!updated) return;
    }
    setAssignmentState({
      assigneeName: currentLabAssignee.name,
      status: "reading",
      studyId: initialAssignment.studyId,
    });
  };
  const completeAssignment = async () => {
    if (fulfillmentWorkItem) {
      const transitionPath = getFulfillmentTransitionPath(fulfillmentWorkItem.status, "completed");
      if (!transitionPath) return;
      const updated = await fulfillmentQueue.updateStatus(fulfillmentWorkItem.id, transitionPath);
      if (!updated) return;
    }
    setAssignmentState((current) => ({
      assigneeName:
        current.studyId === initialAssignment.studyId ? current.assigneeName : currentLabAssignee.name,
      status: "completed",
      studyId: initialAssignment.studyId,
    }));
  };
  const cancelAssignment = async () => {
    if (fulfillmentWorkItem) {
      const transitionPath = getFulfillmentTransitionPath(fulfillmentWorkItem.status, "requested");
      if (!transitionPath) return;
      const updated = await fulfillmentQueue.updateStatus(fulfillmentWorkItem.id, transitionPath);
      if (!updated) return;
    }
    setAssignmentState({
      assigneeName: "미지정",
      status: "requested",
      studyId: initialAssignment.studyId,
    });
  };

  useEffect(() => {
    if (queryImagingStudyId && queryImagingStudyId !== selectedImagingStudyId) {
      selectImagingStudy(queryImagingStudyId);
      return;
    }
    if (!queryImagingStudyId && detail?.study.id && detail.study.id !== selectedImagingStudyId) {
      selectImagingStudy(detail.study.id);
    }
  }, [detail?.study.id, queryImagingStudyId, selectImagingStudy, selectedImagingStudyId]);

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--emr-surface-workspace)] emr-text-dense text-muted-foreground">
        영상 대기열에서 항목을 선택해 주세요.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] px-4 py-3">
      <EmrInstructionHeaderStack
        titleBar={
          <EmrInstructionTitleBar
            title="영상검사 Order 상세"
            className="h-auto min-h-9 flex-wrap gap-2"
            icon={
              <EmrInstructionHistoryToggle
                ariaLabelPrefix="영상검사 이력"
                controls="imaging-content-aside"
                expanded={contentAsideOpen}
                tooltipLabel="영상검사 이력"
                onClick={() => setContentAsideOpen(!contentAsideOpen)}
              />
            }
            badge={
              <Badge variant="secondary" className="h-5 rounded-md px-2 emr-text-micro text-muted-foreground">
                {getImagingDocumentId(detail.study)}
              </Badge>
            }
            actions={
              <>
                <Button variant="outline" size="sm" className="bg-card">
                  PACS
                </Button>
                <LabImagingStatusAction
                  activeLabel="판독중"
                  activeStatus="reading"
                  completeLabel="판독완료"
                  completedStatus="completed"
                  menuAriaLabel="판독 상태 액션"
                  requestedStatus="requested"
                  status={assignment.status}
                  onStart={startAssignment}
                  onComplete={completeAssignment}
                  onCancelAssignment={cancelAssignment}
                />
              </>
            }
          />
        }
        orderInfo={
          <div className="grid [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))] rounded-lg border border-border bg-card px-4 py-3">
            {[
              [
                "요청 일시",
                <span key="requested-at" className="flex flex-wrap items-center gap-1.5">
                  <span>{formatShortDateTime(detail.study.requestedAt)}</span>
                  <EmrStatusBadge
                    label={getStatusLabel("imagingStudy", detail.study.status)}
                    marker="none"
                    testId="imaging-study-status-label"
                  />
                </span>,
              ],
              ["검사", detail.order?.displayName ?? `${detail.study.modality} ${detail.study.bodyPart}`],
              ["Modality", detail.study.modality],
              ["촬영 부위", detail.study.bodyPart],
              ["요청 수의사", getStaffName(detail.order?.requestedByUserId) ?? "이수지"],
              ["검사 담당", <span key="imaging-assignee" aria-live="polite">{assignment.assigneeName}</span>],
            ].map(([label, value]) => (
              <div key={label as string} className="min-w-0 border-r border-border px-3 last:border-r-0">
                <div className="emr-text-metadata font-medium text-muted-foreground">{label}</div>
                <div className="mt-1 flex min-h-6 min-w-0 items-center emr-text-dense font-medium text-foreground">{value}</div>
              </div>
            ))}
          </div>
        }
      />
      <ScrollArea data-slot="imaging-result-scroll-area" className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 pb-10 pt-4">
          <section className="rounded-lg bg-[var(--emr-status-warning-bg)] px-4 py-3 emr-text-dense font-medium leading-5 text-[var(--emr-status-warning-text)]">
            병원 내 직원이 남긴 코멘트와 총괄 지시사항을 판독 전에 확인합니다.
          </section>
          <ImagingOrderDetailTable detail={detail} />
          <ImagingReadingSections study={detail.study} />
          <AttachmentStrip attachments={detail.attachments} />
        </div>
      </ScrollArea>
    </div>
  );
}

function ImagingMediaStrip({ attachments }: { attachments: EmrAttachment[] }) {
  const mediaAttachments = attachments.filter((attachment) => attachment.mimeType.startsWith("image/"));

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {mediaAttachments.map((attachment) => (
        <div key={attachment.id} className="w-[92px] shrink-0 overflow-hidden rounded-md border bg-card">
          <div className="flex h-16 items-center justify-center bg-[linear-gradient(135deg,var(--emr-text-primary),var(--emr-text-secondary))] emr-text-metadata font-semibold text-[var(--emr-text-inverse)]">
            {attachment.mimeType.includes("png") ? "IMG" : "FILE"}
          </div>
          <div className="truncate px-2 py-1.5 emr-text-micro text-muted-foreground">{attachment.fileName}</div>
        </div>
      ))}
      {!mediaAttachments.length ? (
        <div className="rounded-md border border-dashed p-3 emr-text-metadata text-muted-foreground">
          미디어 첨부 없음
        </div>
      ) : null}
    </div>
  );
}

export function ImagingRightPanel({ workspaceId }: ShellComponentProps) {
  const { detail } = useCurrentImagingDetail(workspaceId);
  const labItems = useMemo(
    () => (isLegacySalesDemoWorkspace(workspaceId) ? getLabWorkItems() : []),
    [workspaceId],
  );
  const imagingItems = useMemo(
    () => (isLegacySalesDemoWorkspace(workspaceId) ? getImagingWorkItems() : []),
    [workspaceId],
  );

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center p-4 emr-text-dense text-muted-foreground">
        영상 대기열에서 항목을 선택해 주세요.
      </div>
    );
  }

  const sameEncounterLabItems = labItems.filter((item) => item.encounter.id === detail.encounter.id);
  const sameEncounterImagingItems = imagingItems.filter((item) => item.encounter.id === detail.encounter.id);
  const sameEncounterOrderCount = sameEncounterLabItems.length + sameEncounterImagingItems.length;
  const fileAttachments = detail.attachments.filter((attachment) => !attachment.mimeType.startsWith("image/"));

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="imaging-summary-panel">
      <div className="flex h-14 items-center justify-between px-4">
        <h2 className="min-w-0 truncate text-sm font-semibold">종합소견</h2>
        <Badge variant="secondary" className="h-5 rounded-md px-2 emr-text-micro text-muted-foreground">
          {sameEncounterOrderCount}
        </Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-3">
          <section className="overflow-hidden rounded-lg border bg-card">
            <div className="flex h-10 items-center justify-between border-b px-3">
              <h3 className="emr-text-dense font-semibold">같은 차트 내 Order</h3>
              <Badge variant="outline" className="h-5 rounded-md px-1.5 emr-text-micro">
                {sameEncounterOrderCount}
              </Badge>
            </div>
            <Table className="table-fixed emr-text-metadata">
              <TableBody>
                {sameEncounterLabItems.map((item) => (
                  <TableRow key={item.result.id}>
                    <TableCell className="h-9 w-14 px-3 text-muted-foreground">검사</TableCell>
                    <TableCell className="h-9 px-3 font-medium">{item.order?.displayName ?? item.result.resultName}</TableCell>
                  </TableRow>
                ))}
                {sameEncounterImagingItems.map((item) => (
                  <TableRow key={item.study.id}>
                    <TableCell className="h-9 w-14 px-3 text-muted-foreground">영상</TableCell>
                    <TableCell className="h-9 px-3 font-medium">{item.order?.displayName ?? `${item.study.modality} ${item.study.bodyPart}`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section>
            <div className="emr-text-dense font-semibold">보호자 공유용 종합 코멘트</div>
            <div className="mt-2 flex h-8 items-center gap-3 rounded-lg bg-[var(--emr-surface-muted)] px-3 emr-text-dense font-semibold text-muted-foreground">
              <span>B</span>
              <span className="italic">I</span>
              <span>T</span>
              <span>link</span>
              <span>list</span>
            </div>
            <Textarea
              aria-label="영상 종합 코멘트"
              className="mt-2 min-h-28 resize-none bg-background emr-text-dense leading-5"
              defaultValue={`- ${detail.study.impression ?? "종합소견 text"}\n- 보호자에게 CBC 결과와 함께 안내`}
            />
          </section>

          <section>
            <div className="mb-2 emr-text-dense font-semibold">미디어</div>
            <ImagingMediaStrip attachments={detail.attachments} />
          </section>

          <section>
            <div className="mb-2 emr-text-dense font-semibold">첨부 파일</div>
            <div className="flex flex-col gap-2">
              {fileAttachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex h-9 items-center justify-between gap-2 rounded-md bg-[var(--emr-surface-muted)] px-3 emr-text-metadata"
                >
                  <span className="truncate text-primary">{attachment.fileName}</span>
                  <Button variant="ghost" size="icon-xs" aria-label={`${attachment.fileName} 삭제`}>
                    <CdsFilesFileIcon className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
              {!fileAttachments.length ? (
                <div className="rounded-md border border-dashed p-3 emr-text-metadata text-muted-foreground">
                  첨부 파일 없음
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </ScrollArea>
      <div className="grid grid-cols-2 gap-2 border-t p-3">
        <Button variant="outline" size="sm" className="bg-card">
          취소
        </Button>
        <Button size="sm">저장</Button>
      </div>
    </div>
  );
}
