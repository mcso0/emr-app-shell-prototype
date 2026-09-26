"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CdsActionsListFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsRefreshCcwIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsFilesFileIcon,
  CdsFilesImageIcon,
  CdsFilesMoreHorizontalIcon,
} from "@/components/cds-icons/files-and-layout";
import { CdsNavigationChevronsRightIcon } from "@/components/cds-icons/navigation";
import {
  CdsUtilitiesHistoryIcon,
  CdsUtilitiesSortIcon,
} from "@/components/cds-icons/utilities-and-misc";
import { ChevronDownIcon } from "@/components/icons";
import {
  EmrInstructionHeaderStack,
  EmrInstructionHistoryToggle,
  EmrInstructionOutputMenu,
  EmrInstructionTitleBar,
} from "@/components/emr/instruction-header-stack";
import { EmrInstructionFilterTabs } from "@/components/emr/instruction-filter-tabs";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import {
  EmrRightPanel,
  EmrRightPanelBody,
  EmrRightPanelFooter,
} from "@/components/emr/right-panel";
import { EmrRightPanelHeader } from "@/components/emr/right-panel-header";
import { EmrRightPanelHeaderIconButton } from "@/components/emr/right-panel-header-icon-button";
import {
  EmrDateNavigator,
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrQueueEmptyState,
  EmrQueueLoadingState,
  EmrListSearchEmptyState,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import { EmrOrderGroupSection } from "@/components/emr/order-group-section";
import {
  EmrEmptyState,
  type EmrEmptyStateKind,
} from "@/components/emr/empty-state";
import { EmrDataTable } from "@/components/emr/emr-data-table";
import { EmrMainContentHeader } from "@/components/emr/main-content-header";
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
  type EmrTaskQueueCardItem,
} from "@/components/emr/task-queue-card";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
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
import {
  FulfillmentWorkLifecycleAction,
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
import type { FulfillmentEligibleAssignee } from "@/features/fulfillment/server-fulfillment-assignee-core";
import type {
  FulfillmentWorkItemAction,
  FulfillmentWorkItemStatus,
} from "@/features/fulfillment/server-fulfillment-work-item-core";
import { useLabImagingStore } from "@/features/lab-imaging/store";
import { evaluateLabProfileValue } from "./result-profile-contract";
import { usePersistedLabResult } from "./use-persisted-lab-result";
import { AtomicLabRetestAction } from "./components/atomic-retest-dialog";
import { useQueueRealtimeRefresh } from "@/features/work-queue/queue-realtime-refresh";
import { usePatientLatestVitalItems } from "@/features/patient-vitals/use-patient-latest-vitals";
import { useContextVitalEditor } from "@/features/patient-vitals/use-context-vital-editor";
import { usePatientContextProfileInteractions } from "@/features/customer/use-patient-context-profile-interactions";
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
  formatOperatingShortTime,
  formatKoreanOperatingDateLabel,
  formatShortOperatingDate,
  getOperatingDateFromIso,
} from "@/lib/emr-domain/demo-date";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import { buildWorkspaceSurfaceRoute } from "@/shell/workspace-surface-route";
import type {
  ShellComponentProps,
  WorkspaceSlotAvailabilityProviderProps,
} from "@/types/emr";
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

const formatShortDateTime = (dateTime?: string) => {
  const operatingDate = getOperatingDateFromIso(dateTime);
  const operatingTime = formatOperatingShortTime(dateTime);
  return operatingDate && operatingTime !== "-"
    ? `${formatShortOperatingDate(operatingDate)} ${operatingTime}`
    : "-";
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "-";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

const getReceptionTypeLabel = (encounter: Encounter) =>
  encounter.appointmentId ? "예약" : "외래";

const getTaskQueueClockTime = (dateTime?: string) =>
  formatShortDateTime(dateTime).slice(9).trim() || "-";
type QueueOrder = EmrOrder & { requesterName?: string };

const getOrderRequesterName = (order?: QueueOrder) =>
  order?.requesterName ??
  (order && (!isLegacySalesDemoWorkspace(order.workspaceId) || isLiveAuthRuntime())
    ? "정보 없음"
    : getStaffName(order?.requestedByUserId) ?? "이수지");
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
    eventTime: getOrderEventTime(
      item.order,
      item.result.receivedAt ?? item.result.collectedAt,
    ),
    guardianName: item.primaryGuardian?.name ?? "보호자 미지정",
    patientName: item.patient.name,
    receptionType: getReceptionTypeLabel(item.encounter),
    secondLineBadgeLabel: item.result.resultName,
    secondLineText: orderLabel,
    testId,
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
  const orderLabel =
    item.order?.displayName ?? `${item.study.modality} ${item.study.bodyPart}`;

  return {
    actionAriaLabel: `${item.patient.name} ${orderLabel} 더보기`,
    actionTestId,
    assigneeName: item.radiologistName,
    eventActorName: getOrderRequesterName(item.order),
    eventKind: getTaskQueueEventKindFromStatus(item.order?.status),
    eventTime: getOrderEventTime(
      item.order,
      item.study.capturedAt ?? item.study.requestedAt,
    ),
    guardianName: item.primaryGuardian?.name ?? "보호자 미지정",
    patientName: item.patient.name,
    receptionType: getReceptionTypeLabel(item.encounter),
    secondLineBadgeLabel: item.study.modality,
    secondLineText: orderLabel,
    testId,
  };
}

const getActionableLabRows = (result: LabResult) =>
  result.rows.filter(
    (row) => row.judgment !== "normal" && row.judgment !== "not_judged",
  );

type LabResultRow = LabResult["rows"][number];
type LabJudgment = LabResultRow["judgment"];
type LabAssignmentStatus = "requested" | "in_progress" | "completed";
const currentLabAssignee = {
  id: "user-tech-hayun",
  name: getStaffName("user-tech-hayun") ?? "송하윤",
};

const parseReferenceRange = (referenceRange?: string) => {
  if (!referenceRange) return null;

  const match = referenceRange.match(
    /^\s*(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)\s*$/,
  );
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

const getDerivedLabJudgment = (
  row: LabResultRow,
  value: string,
): LabJudgment => {
  if (row.interpretationRule) {
    const result = evaluateLabProfileValue(row.interpretationRule, { value, qualifier: row.qualifier,
      deviceFlag: row.deviceFlag, resultState: row.resultPresence });
    return result.valid ? result.judgment : "not_judged";
  }
  if (!value.trim()) return "not_judged";
  const range = parseReferenceRange(row.referenceRange);
  const numericValue = Number(value);

  if (!range || !Number.isFinite(numericValue)) return "not_judged";
  if (numericValue < range.min) return "low";
  if (numericValue > range.max) return "high";

  return "normal";
};

const rangeStateByJudgment: Partial<
  Record<LabResultRow["judgment"], { label: string; markerClassName: string }>
> = {
  critical: {
    label: "초과",
    markerClassName:
      "bg-[var(--emr-status-danger-text)] fill-[var(--emr-status-danger-text)]",
  },
  high: {
    label: "초과",
    markerClassName:
      "bg-[var(--emr-status-warning-text)] fill-[var(--emr-status-warning-text)]",
  },
  low: {
    label: "미달",
    markerClassName:
      "bg-[var(--emr-status-info-text)] fill-[var(--emr-status-info-text)]",
  },
  normal: {
    label: "정상",
    markerClassName:
      "bg-[var(--emr-status-success-text)] fill-[var(--emr-status-success-text)]",
  },
};

const judgmentBadgeClassName: Record<LabResultRow["judgment"], string> = {
  abnormal: "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
  critical:
    "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-[var(--emr-status-danger-text)]",
  high: "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
  low: "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
  normal:
    "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
  not_judged:
    "border-[var(--emr-status-neutral-border)] bg-[var(--emr-status-neutral-bg)] text-[var(--emr-status-neutral-text)]",
};

const labStatusOrder: LabResult["status"][] = [
  "pending",
  "received",
  "entered",
  "completed",
  "reviewed",
];

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
type ImagingReadingStatus = "requested" | "reading" | "completed";
type FulfillmentQueueType = "lab" | "imaging";
type FulfillmentTransitionCommand =
  | FulfillmentWorkItemAction
  | ({ action: FulfillmentWorkItemAction } & FulfillmentTransitionOptions);
type FulfillmentWorkItem = {
  assignedToUserId?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  encounterId: string;
  guardianName?: string | null;
  id: string;
  orderId: string;
  patientId?: string | null;
  patientName?: string | null;
  queueType: FulfillmentQueueType;
  requestedByUserId?: string;
  requesterName?: string | null;
  requestCycle: number;
  rowRevision: number;
  sourceSnapshot?: {
    billingName?: string;
    displayName?: string;
    detail?: Record<string, unknown>;
    guardianName?: string;
    instruction?: string;
    orderDisplayName?: string;
    effectiveDisplayName?: string;
    inHospitalOrderName?: string;
    standardOrderName?: string;
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
type FulfillmentQueueReadStatus = "loading" | "ready";

async function loadFulfillmentEligibleAssigneesRoute({
  workItemId,
  workspaceId,
}: {
  workItemId: string;
  workspaceId: string;
}): Promise<FulfillmentEligibleAssignee[]> {
  const response = await fetch(
    `/api/workspaces/${workspaceId}/fulfillment/work-items/${workItemId}/assignees`,
    { headers: { "x-clair-demo-session-user-id": "user-tech" } },
  );
  const body = (await response.json()) as {
    assignees?: FulfillmentEligibleAssignee[];
    ok?: boolean;
  };
  if (!response.ok || !body.ok || !Array.isArray(body.assignees)) {
    throw new Error("eligible_assignees_unavailable");
  }
  return body.assignees;
}
type LabResultSheetCatalogItem = {
  categoryId: string;
  categoryName: string;
  id: string;
  rowId?: string;
  resultInputType: "number" | "text" | "select" | "positive_negative" | "grade";
  resultValueKind?: "numeric" | "text" | "coded";
  decimalScale?: number;
  resultUnit?: string;
  sortOrder: number;
  testItemName: string;
};
type LabResultSheetCatalogStatus =
  "idle" | "loading" | "ready" | "empty" | "error" | "permission_denied";
type LabResultSheetCatalogLoadResult =
  | {
      items: LabResultSheetCatalogItem[];
      status: "ready";
    }
  | {
      items: [];
      status: Exclude<
        LabResultSheetCatalogStatus,
        "idle" | "loading" | "ready"
      >;
    };
type LabResultSaveOutcome =
  | {
      entryWriteRevision?: number;
      ok: true;
    }
  | {
      message: string;
      ok: false;
      reason: "error" | "invalid" | "permission_denied";
      retryable: boolean;
    };

function getInitialImagingReadingStatus(
  status?: ImagingStudyStatus,
): ImagingReadingStatus {
  if (status === "read" || status === "reviewed") return "completed";
  if (status === "reading") return "reading";
  return "requested";
}

const labResultTabItems = [
  { value: "all" as const, label: "전체" },
  { value: "cbc" as const, label: "CBC" },
  { value: "chemistry" as const, label: "혈청화학" },
];

const fulfillmentQueueCache = new Map<string, FulfillmentQueueSnapshot>();
const fulfillmentQueueListeners = new Map<
  string,
  Set<(snapshot: FulfillmentQueueSnapshot) => void>
>();
const emptyFulfillmentQueueSnapshot: FulfillmentQueueSnapshot = {
  workItems: [],
};

function getFulfillmentQueueCacheKey(
  workspaceId: string,
  queueType: FulfillmentQueueType,
  selectedDate: string,
) {
  return `${workspaceId}:${selectedDate}:${queueType}`;
}

function setCachedFulfillmentQueue(
  cacheKey: string,
  snapshot: FulfillmentQueueSnapshot,
) {
  fulfillmentQueueCache.set(cacheKey, snapshot);
  fulfillmentQueueListeners
    .get(cacheKey)
    ?.forEach((listener) => listener(snapshot));
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
  const bridgedEncounterId =
    stagingDemoEncounterBridgeByResolvedId[workItem.encounterId];

  return bridgedEncounterId ? getChartEncounter(bridgedEncounterId) : null;
}

function getLivePatientFromWorkItem(workItem: FulfillmentWorkItem): Patient {
  const handoffPatient = readChartLiveEncounterHandoff(
    workItem.encounterId,
  )?.patient;
  if (handoffPatient) return handoffPatient;

  const bridgedPatient = getStagingBridgeChartBundle(workItem)?.patient;
  if (bridgedPatient) return bridgedPatient;

  const now =
    workItem.updatedAt ?? workItem.createdAt ?? new Date().toISOString();
  return {
    id: workItem.patientId ?? `live-patient-${workItem.id}`,
    patientNo: `LIVE-${workItem.id.slice(0, 8)}`,
    workspaceId: workItem.workspaceId,
    name:
      workItem.patientName ??
      getSnapshotString(workItem.sourceSnapshot, "patientName", "환자 미상"),
    species: "cat",
    breed: getSnapshotDetailString(
      workItem.sourceSnapshot,
      "breed",
      "품종 미상",
    ),
    estimatedAgeText: getSnapshotDetailString(
      workItem.sourceSnapshot,
      "age",
      "나이 미상",
    ),
    sex: "unknown",
    handlingCautionLocked: false,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function getLiveGuardianFromWorkItem(
  workItem: FulfillmentWorkItem,
): Guardian | undefined {
  const handoffGuardian = readChartLiveEncounterHandoff(
    workItem.encounterId,
  )?.primaryGuardian;
  if (handoffGuardian) return handoffGuardian;

  const bridgedGuardian =
    getStagingBridgeChartBundle(workItem)?.primaryGuardian;
  if (bridgedGuardian) return bridgedGuardian;

  const guardianName =
    workItem.guardianName ??
    getSnapshotString(workItem.sourceSnapshot, "guardianName", "");
  if (!guardianName) return undefined;

  const now =
    workItem.updatedAt ?? workItem.createdAt ?? new Date().toISOString();
  return {
    id: `live-guardian-${workItem.id}`,
    workspaceId: workItem.workspaceId,
    name: guardianName,
    createdAt: now,
    updatedAt: now,
  };
}

function getLiveEncounterFromWorkItem(
  workItem: FulfillmentWorkItem,
  patient: Patient,
): Encounter {
  const now =
    workItem.updatedAt ?? workItem.createdAt ?? new Date().toISOString();
  return {
    id: workItem.encounterId,
    workspaceId: workItem.workspaceId,
    patientId: patient.id,
    guardianId: getLiveGuardianFromWorkItem(workItem)?.id,
    encounterNo: `LIVE-${workItem.encounterId.slice(0, 8)}`,
    receptionType: "walk_in",
    chiefComplaint: getSnapshotDetailString(
      workItem.sourceSnapshot,
      "chiefComplaint",
      "오더 수행",
    ),
    status: workItem.status === "completed" ? "completed" : "in_consultation",
    checkedInAt: workItem.createdAt,
    startedAt: workItem.createdAt,
    createdAt: now,
    updatedAt: now,
  };
}

function getLiveOrderFromWorkItem(workItem: FulfillmentWorkItem): QueueOrder {
  const now =
    workItem.updatedAt ?? workItem.createdAt ?? new Date().toISOString();
  return {
    id: workItem.orderId,
    workspaceId: workItem.workspaceId,
    encounterId: workItem.encounterId,
    serviceItemId: workItem.sourceSnapshot?.serviceItemId,
    orderType: workItem.queueType,
    displayName: getFulfillmentOrderDisplayName(workItem.sourceSnapshot) ?? "검사명 정보 없음",
    status:
      workItem.status === "completed"
        ? "completed"
        : workItem.status === "returned"
          ? "re_requested"
          : "in_progress",
    workStatus: workItem.status === "completed" ? "completed" : "pending",
    priority: "normal",
    requestedByUserId: workItem.requestedByUserId ?? "",
    requesterName: workItem.requesterName ?? undefined,
    requestedAt: workItem.createdAt ?? now,
    currentAssigneeUserId: workItem.assignedToUserId ?? undefined,
    instruction: workItem.sourceSnapshot?.instruction,
    sortOrder: 0,
    createdAt: workItem.createdAt ?? now,
    updatedAt: now,
  };
}

function useFulfillmentQueue(
  queueType: FulfillmentQueueType,
  selectedDate?: string,
) {
  const workspaceId = useWorkspaceIdFromPath();
  const effectiveDate = selectedDate ?? "";
  const cacheKey = getFulfillmentQueueCacheKey(
    workspaceId,
    queueType,
    effectiveDate,
  );
  const cachedSnapshot = fulfillmentQueueCache.get(cacheKey);
  const [queueState, setQueueState] = useState<{
    cacheKey: string;
    snapshot: FulfillmentQueueSnapshot;
    status: FulfillmentQueueReadStatus;
  }>(() => ({
    cacheKey,
    snapshot: cachedSnapshot ?? emptyFulfillmentQueueSnapshot,
    status: cachedSnapshot ? "ready" : "loading",
  }));
  const fallbackSnapshot = fulfillmentQueueCache.get(cacheKey);
  const snapshot =
    queueState.cacheKey === cacheKey
      ? queueState.snapshot
      : (fallbackSnapshot ?? emptyFulfillmentQueueSnapshot);
  const status =
    queueState.cacheKey === cacheKey
      ? queueState.status
      : fallbackSnapshot
        ? "ready"
        : "loading";

  const loadQueueSnapshot =
    useCallback(async (): Promise<FulfillmentQueueSnapshot> => {
      const previousSnapshot = fulfillmentQueueCache.get(cacheKey);

      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=${queueType}${effectiveDate ? `&date=${encodeURIComponent(effectiveDate)}` : ""}`,
          { headers: { "x-clair-demo-session-user-id": "user-tech" } },
        );
        const body = (await response.json()) as {
          ok?: boolean;
          summary?: FulfillmentWorkItemReadSummary;
          workItems?: FulfillmentWorkItem[];
        };
        const nextSnapshot =
          response.ok && body.ok && Array.isArray(body.workItems)
            ? { summary: body.summary, workItems: body.workItems }
            : (previousSnapshot ?? emptyFulfillmentQueueSnapshot);
        return nextSnapshot;
      } catch {
        return previousSnapshot ?? emptyFulfillmentQueueSnapshot;
      }
    }, [cacheKey, effectiveDate, queueType, workspaceId]);

  const applyQueueSnapshot = useCallback(
    (nextSnapshot: FulfillmentQueueSnapshot) => {
      setCachedFulfillmentQueue(cacheKey, nextSnapshot);
      setQueueState({ cacheKey, snapshot: nextSnapshot, status: "ready" });
    },
    [cacheKey],
  );

  const refresh = useCallback(async () => {
    applyQueueSnapshot(await loadQueueSnapshot());
  }, [applyQueueSnapshot, loadQueueSnapshot]);

  useEffect(() => {
    let canceled = false;

    // Fetching the server queue is an external sync; rendering decides whether fixtures are allowed.
    async function loadInitialQueue() {
      const nextSnapshot = await loadQueueSnapshot();
      if (canceled) return;
      applyQueueSnapshot(nextSnapshot);
    }

    void loadInitialQueue();

    return () => {
      canceled = true;
    };
  }, [applyQueueSnapshot, loadQueueSnapshot]);

  useEffect(() => {
    const listener = (nextSnapshot: FulfillmentQueueSnapshot) =>
      setQueueState({ cacheKey, snapshot: nextSnapshot, status: "ready" });

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
    status,
    summary: snapshot.summary,
    updateStatus,
    workItems: snapshot.workItems,
  };
}

async function loadLabResultSheetCatalog({
  orderDisplayName,
  resultId,
  serviceItemId,
  workspaceId,
}: {
  orderDisplayName?: string;
  resultId?: string;
  serviceItemId?: string;
  workspaceId: string;
}): Promise<LabResultSheetCatalogLoadResult> {
  const params = new URLSearchParams();
  if (orderDisplayName) params.set("orderDisplayName", orderDisplayName);
  if (resultId) params.set("resultId", resultId);
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

    if (
      response.status === 401 ||
      response.status === 403 ||
      body.denialReason
    ) {
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
  const orderDisplayName =
    workItem?.sourceSnapshot?.orderDisplayName ?? result?.resultName;
  const serviceItemId = workItem?.sourceSnapshot?.serviceItemId;
  const resultId = result?.id;
  const resultRowCount = result?.rows.length ?? 0;
  const cacheKey = [
    workspaceId,
    resultId ?? "",
    serviceItemId ?? "",
    orderDisplayName ?? "",
  ].join(":");
  const shouldLoad = Boolean(
    resultId && resultRowCount === 0 && orderDisplayName,
  );

  useEffect(() => {
    if (!shouldLoad || !resultId || !orderDisplayName) return;

    let canceled = false;

    const load = async () => {
      setState({ cacheKey, rows: [], status: "loading" });
      const next = await loadLabResultSheetCatalog({
        orderDisplayName,
        resultId,
        serviceItemId,
        workspaceId,
      });
      if (canceled) return;
      setState({
        cacheKey,
        rows: next.items.map((item) => ({
          id: item.rowId ?? `${resultId}-${item.id}`,
          labTestItemId: item.id,
          analyteName: item.testItemName,
          judgment: "not_judged",
          decimalScale: item.decimalScale,
          resultInputType: item.resultInputType,
          resultValueKind: item.resultValueKind,
          unit: item.resultUnit,
        })),
        status: next.status,
      });
    };

    void load();

    return () => {
      canceled = true;
    };
  }, [
    cacheKey,
    orderDisplayName,
    reloadToken,
    resultId,
    serviceItemId,
    shouldLoad,
    workspaceId,
  ]);

  const retry = useCallback(() => setReloadToken((current) => current + 1), []);

  if (!shouldLoad)
    return { cacheKey, retry, rows: [], status: "idle" as const };
  return state.cacheKey === cacheKey
    ? { ...state, retry }
    : { cacheKey, retry, rows: [], status: "loading" as const };
}

async function saveLabResultEntry({
  result,
  requestId,
  rows,
  workItem,
  workspaceId,
}: {
  result: LabResult;
  requestId: string;
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
          expectedEntryWriteRevision: result.entryWriteRevision ?? 0,
          requestId,
          rows: rows.map((row) => ({
            note: row.note ?? null,
            rowId: row.id,
            value: row.value ?? null,
            ...(row.interpretationRule ? { qualifier: row.qualifier ?? "exact", deviceFlag: row.deviceFlag ?? null,
              resultState: row.resultPresence ?? "value" } : {}),
          })),
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
      entryWriteRevision?: number;
      error?: string;
      ok?: boolean;
      savedResult?: { entryWriteRevision?: number };
    };
    if (response.ok && body.ok === true) {
      return {
        entryWriteRevision:
          body.entryWriteRevision ?? body.savedResult?.entryWriteRevision,
        ok: true,
      };
    }

    if (
      response.status === 401 ||
      response.status === 403 ||
      body.denialReason
    ) {
      return {
        message: "저장 권한이 없습니다.",
        ok: false,
        reason: "permission_denied",
        retryable: false,
      };
    }
    if (
      response.status === 400 ||
      body.error === "invalid_lab_result_entry_payload"
    ) {
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

function getWorkItemsByOrderId(workItems: FulfillmentWorkItem[]) {
  return new Map(workItems.map((item) => [item.orderId, item]));
}

function applyFulfillmentToLabItems(
  items: LabWorkItem[],
  workItems: FulfillmentWorkItem[],
): LabWorkItem[] {
  const workItemsByOrderId = getWorkItemsByOrderId(workItems);
  const usedWorkItemIds = new Set<string>();

  const mappedItems = items.map((item) => {
    const workItem = item.order
      ? workItemsByOrderId.get(item.order.id)
      : undefined;
    if (!workItem) return item;
    usedWorkItemIds.add(workItem.id);

    return {
      ...item,
      result: {
        ...item.result,
        status: mapFulfillmentToLabStatus(workItem.status, item.result.status),
      },
      technicianName:
        getStaffName(workItem.assignedToUserId ?? undefined) ??
        item.technicianName,
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
  workItems: FulfillmentWorkItem[],
): ImagingWorkItem[] {
  const workItemsByOrderId = getWorkItemsByOrderId(workItems);
  const usedWorkItemIds = new Set<string>();

  const mappedItems = items.map((item) => {
    const workItem = item.order
      ? workItemsByOrderId.get(item.order.id)
      : undefined;
    if (!workItem) return item;
    usedWorkItemIds.add(workItem.id);

    return {
      ...item,
      study: {
        ...item.study,
        status: mapFulfillmentToImagingStatus(
          workItem.status,
          item.study.status,
        ),
      },
      radiologistName:
        getStaffName(workItem.assignedToUserId ?? undefined) ??
        item.radiologistName,
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
    .map((workItem): LabWorkItem => {
      const patient = getLivePatientFromWorkItem(workItem);
      const primaryGuardian = getLiveGuardianFromWorkItem(workItem);
      const encounter = getLiveEncounterFromWorkItem(workItem, patient);
      const order = getLiveOrderFromWorkItem(workItem);
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
          // Queue creation/assignment is not specimen collection or performance.
          // Actual metadata must come from its persisted result/execution record.
        },
      };
    })
    .sort((a, b) => {
      const aTime = a.result.receivedAt ?? a.result.collectedAt ?? "";
      const bTime = b.result.receivedAt ?? b.result.collectedAt ?? "";
      return bTime.localeCompare(aTime);
    });
}

function createLiveImagingItems(
  workItems: FulfillmentWorkItem[],
): ImagingWorkItem[] {
  return workItems
    .filter((workItem) => workItem.queueType === "imaging")
    .map((workItem): ImagingWorkItem => {
      const patient = getLivePatientFromWorkItem(workItem);
      const primaryGuardian = getLiveGuardianFromWorkItem(workItem);
      const encounter = getLiveEncounterFromWorkItem(workItem, patient);
      const order = getLiveOrderFromWorkItem(workItem);

      return {
        encounter,
        order,
        patient,
        primaryGuardian,
        study: {
          id: `live-imaging-${workItem.id}`,
          workspaceId: workItem.workspaceId,
          patientId: patient.id,
          encounterId: workItem.encounterId,
          orderId: workItem.orderId,
          modality: getSnapshotDetailString(
            workItem.sourceSnapshot,
            "modality",
            "영상",
          ),
          bodyPart: getSnapshotDetailString(
            workItem.sourceSnapshot,
            "bodyPart",
            order.displayName,
          ),
          status: mapFulfillmentToImagingStatus(workItem.status, "requested"),
          requestedAt: workItem.createdAt ?? "",
          // Queue state is not evidence of image acquisition or interpretation.
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
  if (isLiveAuthRuntime() || !allowFixtureItems)
    return createLiveLabItems(workItems);
  return applyFulfillmentToLabItems(baseItems, workItems);
}

function getImagingItemsForRuntime(
  baseItems: ImagingWorkItem[],
  workItems: FulfillmentWorkItem[],
  options: { allowFixtureItems?: boolean } = {},
) {
  const allowFixtureItems = options.allowFixtureItems ?? true;
  if (isLiveAuthRuntime() || !allowFixtureItems)
    return createLiveImagingItems(workItems);
  return applyFulfillmentToImagingItems(baseItems, workItems);
}

function getLiveLabDetail(
  labResultId: string,
  workItems: FulfillmentWorkItem[],
): LabDetail | null {
  const item = createLiveLabItems(workItems).find(
    ({ result }) => result.id === labResultId,
  );
  if (!item) return null;

  return {
    ...item,
    allEquipmentReceipts: [],
    attachments: [],
    equipmentReceipts: [],
  };
}

function getLiveImagingDetail(
  imagingStudyId: string,
  workItems: FulfillmentWorkItem[],
): ImagingDetail | null {
  const item = createLiveImagingItems(workItems).find(
    ({ study }) => study.id === imagingStudyId,
  );
  if (!item) return null;

  return {
    ...item,
    attachments: [],
  };
}

function mapFulfillmentToLabStatus(
  status: FulfillmentWorkItemStatus,
  fallback: LabResult["status"],
): LabResult["status"] {
  if (status === "completed") return "completed";
  if (status === "in_progress" || status === "paused") return "entered";
  if (status === "requested" || status === "returned") return "pending";
  if (status === "cancelled") return fallback;
  return fallback;
}

function mapFulfillmentToImagingStatus(
  status: FulfillmentWorkItemStatus,
  fallback: ImagingStudyStatus,
): ImagingStudyStatus {
  if (status === "completed") return "reviewed";
  if (status === "in_progress" || status === "paused") return "reading";
  if (status === "requested" || status === "returned") return "requested";
  if (status === "cancelled") return fallback;
  return fallback;
}

const imagingStatusOrder: ImagingStudyStatus[] = [
  "requested",
  "captured",
  "reading",
  "read",
  "reviewed",
];

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
  const queryLabResultId =
    searchParams.get("labResultId") ?? scenario?.labResultId;
  const effectiveLabResultId = queryLabResultId ?? selectedLabResultId;
  const liveDetail = getLiveLabDetail(effectiveLabResultId, workItems);

  return {
    detail:
      liveDetail ??
      (options.allowMockFallback === false || isLiveAuthRuntime()
        ? null
        : effectiveLabResultId
          ? getLabDetail(effectiveLabResultId)
          : null),
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
  const queryImagingStudyId =
    searchParams.get("imagingStudyId") ?? scenario?.imagingStudyId;
  const effectiveImagingStudyId = queryImagingStudyId ?? selectedImagingStudyId;
  const liveDetail = getLiveImagingDetail(effectiveImagingStudyId, workItems);

  return {
    detail:
      liveDetail ??
      (options.allowMockFallback === false || isLiveAuthRuntime()
        ? null
        : effectiveImagingStudyId
          ? getImagingDetail(effectiveImagingStudyId)
          : null),
    queryImagingStudyId,
  };
}

const normalizeQueueSearchText = (value: string) =>
  value.toLocaleLowerCase("ko").trim();

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
    getOrderEventTime(
      item.order,
      item.result.receivedAt ?? item.result.collectedAt,
    ),
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
    getOrderEventTime(
      item.order,
      item.study.capturedAt ?? item.study.requestedAt,
    ),
  ]
    .filter(Boolean)
    .join(" ");
}

function QueueActions({
  disabled = false,
  onSearch,
}: {
  disabled?: boolean;
  onSearch?: () => void;
}) {
  return (
    <>
      <EmrListHeaderIconButton ariaLabel="정렬" disabled={disabled}>
        <CdsUtilitiesSortIcon className="size-4" />
      </EmrListHeaderIconButton>
      <EmrListHeaderIconButton ariaLabel="필터" disabled={disabled}>
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

export function LabSidePanel({
  onNavigateWorkspaceSurface,
  workspaceId,
}: ShellComponentProps) {
  const searchParams = useSearchParams();
  const queryLabResultId = searchParams.get("labResultId");
  const selectedLabResultId = useLabImagingStore(
    (state) => state.selectedLabResultId,
  );
  const selectLabResult = useLabImagingStore((state) => state.selectLabResult);
  const setModulePanelOpen = useLayoutStore(
    (state) => state.setModulePanelOpen,
  );
  const { selectDate, selectedDate, todayDate } =
    useSelectedOperatingDate(workspaceId, searchParams.get("date"));
  const [collapsedStatusIds, setCollapsedStatusIds] = useState<
    Set<LabResult["status"]>
  >(() => new Set());
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fulfillmentQueue = useFulfillmentQueue("lab", selectedDate);
  useQueueRealtimeRefresh({
    onQueueChange: fulfillmentQueue.refresh,
    scopeKey: `lab:${selectedDate}`,
    workspaceId,
  });
  const legacySalesDemo = isLegacySalesDemoWorkspace(workspaceId);
  const baseItems = useMemo(
    () => (legacySalesDemo ? getLabWorkItems() : []),
    [legacySalesDemo],
  );
  const items = useMemo(
    () =>
      getLabItemsForRuntime(baseItems, fulfillmentQueue.workItems, {
        allowFixtureItems: legacySalesDemo,
      }),
    [baseItems, fulfillmentQueue.workItems, legacySalesDemo],
  );
  useEffect(() => {
    if (queryLabResultId) {
      if (items.some((item) => item.result.id === queryLabResultId)) {
        selectLabResult(queryLabResultId);
      }
      return;
    }

    if (!selectedLabResultId && items[0]) {
      selectLabResult(items[0].result.id);
      return;
    }

    if (!selectedLabResultId) return;
    if (items.some((item) => item.result.id === selectedLabResultId)) return;
    selectLabResult("");
  }, [items, queryLabResultId, selectLabResult, selectedLabResultId]);
  function handleSelectLabResult(resultId: string) {
    const item = items.find((candidate) => candidate.result.id === resultId);
    if (!item) return;

    if (onNavigateWorkspaceSurface) {
      onNavigateWorkspaceSurface(
        buildWorkspaceSurfaceRoute({
          moduleId: "lab",
          params: {
            date: selectedDate,
            encounterId: item.encounter.id,
            labResultId: resultId,
          },
          removeParams: ["imagingStudyId", "invoiceId", "workItemId"],
          search: searchParams,
          workspaceId,
        }),
        "lab",
      );
      return;
    }

    selectLabResult(resultId);
  }
  function handleSelectDate(date: string) {
    selectDate(date);
    selectLabResult("");
    if (!onNavigateWorkspaceSurface) return;
    onNavigateWorkspaceSurface(
      buildWorkspaceSurfaceRoute({
        moduleId: "lab",
        params: { date },
        removeParams: [
          "encounterId",
          "imagingStudyId",
          "invoiceId",
          "labResultId",
          "patientId",
          "workItemId",
        ],
        search: searchParams,
        workspaceId,
      }),
      "lab",
    );
  }
  const effectiveSelectedLabResultId = items.some(
    (item) => item.result.id === selectedLabResultId,
  )
    ? selectedLabResultId
    : undefined;
  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        matchesQueueSearch(getLabWorkItemSearchText(item), searchQuery),
      ),
    [items, searchQuery],
  );
  const groups = useMemo(
    () =>
      labStatusOrder
        .map((status) => ({
          status,
          items: filteredItems.filter((item) => item.result.status === status),
        }))
        .filter((group) => group.items.length > 0),
    [filteredItems],
  );
  const resultCount = filteredItems.length;
  const sourceItemCount = fulfillmentQueue.summary?.totalCount ?? items.length;
  const sourceHasItems = sourceItemCount > 0;
  const queueControlsDisabled = !sourceHasItems;
  const emptyStateTitle = getDatedQueueEmptyStateTitle({
    emptyObjectLabel: "검사 업무",
    filtered: sourceHasItems,
    selectedDate,
    todayDate,
  });
  const showLabQueueLoadingState =
    fulfillmentQueue.status === "loading" && resultCount === 0;
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
      />
      <EmrDateNavigator
        dateLabel={formatKoreanOperatingDateLabel(selectedDate)}
        selectedDate={selectedDate}
        todayDate={todayDate}
        todayLabel={selectedDate === todayDate ? "오늘" : undefined}
        onDateChange={handleSelectDate}
        onNext={() => handleSelectDate(addDaysToIsoDate(selectedDate, 1))}
        onPrevious={() => handleSelectDate(addDaysToIsoDate(selectedDate, -1))}
      />
      <EmrListHeader
        label="검사 대기열"
        count={resultCount}
        topDividerVisible
        search={{
          active: searchActive,
          closeLabel: "검사 대기열 검색 닫기",
          inputLabel: "검사 대기열 검색",
          onClose: closeSearch,
          onQueryChange: setSearchQuery,
          placeholder: "환자, 보호자, 검사, 담당자 검색",
          query: searchQuery,
          resultCount,
        }}
        headerActions={
          <QueueActions
            disabled={queueControlsDisabled}
            onSearch={() => setSearchActive(true)}
          />
        }
      />
      <EmrSubpanelBody density="queue">
        {showLabQueueLoadingState ? (
          <EmrQueueLoadingState
            placement="panel-center"
            title="임상병리 검사 정보를 불러오는 중입니다"
          />
        ) : sourceHasItems && resultCount === 0 && searchQuery.trim() ? (
          <EmrListSearchEmptyState
            objectLabel="검사 대기열 항목"
            placement="panel-center"
            query={searchQuery}
            onClear={() => setSearchQuery("")}
          />
        ) : resultCount === 0 ? (
          <EmrQueueEmptyState
            description={
              sourceHasItems
                ? "조건을 바꾸면 검사 업무가 다시 표시됩니다"
                : "오늘 표시할 검사 업무가 없습니다"
            }
            placement="panel-center"
            title={emptyStateTitle}
          />
        ) : (
          groups.map((group) => (
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
        )}
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
  const selectedImagingStudyId = useLabImagingStore(
    (state) => state.selectedImagingStudyId,
  );
  const selectImagingStudy = useLabImagingStore(
    (state) => state.selectImagingStudy,
  );
  const setModulePanelOpen = useLayoutStore(
    (state) => state.setModulePanelOpen,
  );
  const { selectDate, selectedDate, todayDate } =
    useSelectedOperatingDate(workspaceId, searchParams.get("date"));
  const [collapsedStatusIds, setCollapsedStatusIds] = useState<
    Set<ImagingStudyStatus>
  >(() => new Set());
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fulfillmentQueue = useFulfillmentQueue("imaging", selectedDate);
  useQueueRealtimeRefresh({
    onQueueChange: fulfillmentQueue.refresh,
    scopeKey: `imaging:${selectedDate}`,
    workspaceId,
  });
  const legacySalesDemo = isLegacySalesDemoWorkspace(workspaceId);
  const baseItems = useMemo(
    () => (legacySalesDemo ? getImagingWorkItems() : []),
    [legacySalesDemo],
  );
  const items = useMemo(
    () =>
      getImagingItemsForRuntime(baseItems, fulfillmentQueue.workItems, {
        allowFixtureItems: legacySalesDemo,
      }),
    [baseItems, fulfillmentQueue.workItems, legacySalesDemo],
  );
  useEffect(() => {
    if (queryImagingStudyId) {
      if (items.some((item) => item.study.id === queryImagingStudyId)) {
        selectImagingStudy(queryImagingStudyId);
      }
      return;
    }

    if (!selectedImagingStudyId && items[0]) {
      selectImagingStudy(items[0].study.id);
      return;
    }

    if (!selectedImagingStudyId) return;
    if (items.some((item) => item.study.id === selectedImagingStudyId)) return;
    selectImagingStudy("");
  }, [items, queryImagingStudyId, selectImagingStudy, selectedImagingStudyId]);
  function handleSelectImagingStudy(studyId: string) {
    const item = items.find((candidate) => candidate.study.id === studyId);
    if (!item) return;

    if (onNavigateWorkspaceSurface) {
      onNavigateWorkspaceSurface(
        buildWorkspaceSurfaceRoute({
          moduleId: "imaging",
          params: {
            date: selectedDate,
            encounterId: item.encounter.id,
            imagingStudyId: studyId,
          },
          removeParams: ["invoiceId", "labResultId", "workItemId"],
          search: searchParams,
          workspaceId,
        }),
        "imaging",
      );
      return;
    }

    selectImagingStudy(studyId);
  }
  function handleSelectDate(date: string) {
    selectDate(date);
    selectImagingStudy("");
    if (!onNavigateWorkspaceSurface) return;
    onNavigateWorkspaceSurface(
      buildWorkspaceSurfaceRoute({
        moduleId: "imaging",
        params: { date },
        removeParams: [
          "encounterId",
          "imagingStudyId",
          "invoiceId",
          "labResultId",
          "patientId",
          "workItemId",
        ],
        search: searchParams,
        workspaceId,
      }),
      "imaging",
    );
  }
  const effectiveSelectedImagingStudyId = items.some(
    (item) => item.study.id === selectedImagingStudyId,
  )
    ? selectedImagingStudyId
    : undefined;
  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        matchesQueueSearch(getImagingWorkItemSearchText(item), searchQuery),
      ),
    [items, searchQuery],
  );
  const groups = useMemo(
    () =>
      imagingStatusOrder
        .map((status) => ({
          status,
          items: filteredItems.filter((item) => item.study.status === status),
        }))
        .filter((group) => group.items.length > 0),
    [filteredItems],
  );
  const resultCount = filteredItems.length;
  const sourceItemCount = fulfillmentQueue.summary?.totalCount ?? items.length;
  const sourceHasItems = sourceItemCount > 0;
  const queueControlsDisabled = !sourceHasItems;
  const emptyStateTitle = getDatedQueueEmptyStateTitle({
    emptyObjectLabel: "영상 업무",
    filtered: sourceHasItems,
    selectedDate,
    todayDate,
  });
  const showImagingQueueLoadingState =
    fulfillmentQueue.status === "loading" && resultCount === 0;
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
      />
      <EmrDateNavigator
        dateLabel={formatKoreanOperatingDateLabel(selectedDate)}
        selectedDate={selectedDate}
        todayDate={todayDate}
        todayLabel={selectedDate === todayDate ? "오늘" : undefined}
        onDateChange={handleSelectDate}
        onNext={() => handleSelectDate(addDaysToIsoDate(selectedDate, 1))}
        onPrevious={() => handleSelectDate(addDaysToIsoDate(selectedDate, -1))}
      />
      <EmrListHeader
        label="영상 대기열"
        count={resultCount}
        topDividerVisible
        search={{
          active: searchActive,
          closeLabel: "영상 대기열 검색 닫기",
          inputLabel: "영상 대기열 검색",
          onClose: closeSearch,
          onQueryChange: setSearchQuery,
          placeholder: "환자, 보호자, 영상, 담당자 검색",
          query: searchQuery,
          resultCount,
        }}
        headerActions={
          <QueueActions
            disabled={queueControlsDisabled}
            onSearch={() => setSearchActive(true)}
          />
        }
      />
      <EmrSubpanelBody density="queue">
        {showImagingQueueLoadingState ? (
          <EmrQueueLoadingState
            placement="panel-center"
            title="영상검사 정보를 불러오는 중입니다"
          />
        ) : sourceHasItems && resultCount === 0 && searchQuery.trim() ? (
          <EmrListSearchEmptyState
            objectLabel="영상 대기열 항목"
            placement="panel-center"
            query={searchQuery}
            onClear={() => setSearchQuery("")}
          />
        ) : resultCount === 0 ? (
          <EmrQueueEmptyState
            description={
              sourceHasItems
                ? "조건을 바꾸면 영상 업무가 다시 표시됩니다"
                : "오늘 표시할 영상 업무가 없습니다"
            }
            placement="panel-center"
            title={emptyStateTitle}
          />
        ) : (
          groups.map((group) => (
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
        )}
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
  if (filtered) return `조건에 맞는 ${emptyObjectLabel}가 없습니다`;

  void selectedDate;
  void todayDate;

  return `${emptyObjectLabel}가 없습니다`;
}

function LabResultInputSection({
  assigneeName,
  catalogStatus = "idle",
  emptyRowsKind = "no-data",
  onCatalogRetry,
  onSave,
  result,
}: {
  assigneeName: string;
  catalogStatus?: LabResultSheetCatalogStatus;
  emptyRowsKind?: Extract<EmrEmptyStateKind, "no-data" | "upstream-pending">;
  onCatalogRetry?: () => void;
  onSave?: (
    rows: LabResultRow[],
    requestId: string,
  ) => Promise<LabResultSaveOutcome>;
  result: LabResult;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [density, setDensity] = useState<EmrTableDensity>("standard");
  const [saveRequestId, setSaveRequestId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<{
    message?: string;
    retryable?: boolean;
    resultId: string;
    value:
      "idle" | "saving" | "saved" | "error" | "invalid" | "permission_denied";
  }>(() => ({ resultId: result.id, value: "idle" }));
  const currentSaveState =
    saveState.resultId === result.id ? saveState.value : "idle";
  const currentSaveMessage =
    saveState.resultId === result.id ? saveState.message : undefined;
  const saveRetryable =
    saveState.resultId === result.id ? saveState.retryable === true : false;
  const initialRowValues = useMemo(
    () =>
      Object.fromEntries(result.rows.map((row) => [row.id, row.value ?? ""])),
    [result.rows],
  );
  const [rowValueState, setRowValueState] = useState<{
    resultId: string;
    values: Record<string, string>;
  }>(() => ({ resultId: result.id, values: initialRowValues }));
  const rowValues =
    rowValueState.resultId === result.id
      ? rowValueState.values
      : initialRowValues;
  const [metadataState, setMetadataState] = useState<{ resultId: string; rows: Record<string, Partial<LabResultRow>> }>({ resultId: result.id, rows: {} });
  const rowMetadata = useMemo(() => metadataState.resultId === result.id ? metadataState.rows : {}, [metadataState, result.id]);
  const rows = useMemo(
    () =>
      result.rows.map((row) => {
        const edited = { ...row, ...rowMetadata[row.id], value: rowValues[row.id] ?? row.value ?? "" };
        const evaluation = edited.interpretationRule ? evaluateLabProfileValue(edited.interpretationRule, {
          value: edited.value, qualifier: edited.qualifier, deviceFlag: edited.deviceFlag, resultState: edited.resultPresence,
        }) : null;
        return { ...edited, judgment: getDerivedLabJudgment(edited, edited.value),
          resultState: evaluation?.valid ? evaluation.state : edited.resultState };
      }),
    [result.rows, rowValues, rowMetadata],
  );
  const abnormalRows = rows.filter(
    (row) => row.judgment !== "normal" && row.judgment !== "not_judged",
  );
  const saveResult = async () => {
    if (!onSave) return;
    if (rows.some(row => row.interpretationRule && !evaluateLabProfileValue(row.interpretationRule, {
      value: row.value ?? null, qualifier: row.qualifier, deviceFlag: row.deviceFlag, resultState: row.resultPresence,
    }).valid)) {
      setSaveState({ resultId: result.id, value: "invalid", message: "선택한 프로필의 값 형식과 결과 상태를 확인해 주세요." });
      return;
    }
    const requestId = saveRequestId ?? crypto.randomUUID();
    setSaveRequestId(requestId);
    setSaveState({ resultId: result.id, value: "saving" });
    const outcome = await onSave(rows, requestId);
    if (outcome.ok) setSaveRequestId(null);
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
          {result.resultDefinitionOrigin === "canonical" && onCatalogRetry ? <Button variant="outline" size="xs" disabled={currentSaveState === "saving"}
            onClick={() => {
              setSaveRequestId(null); setSaveState({ resultId: result.id, value: "idle" });
              setRowValueState({ resultId: "", values: {} }); setMetadataState({ resultId: "", rows: {} }); onCatalogRetry();
            }}>입력 초기화·재조회</Button> : null}
          <Button variant="outline" size="xs" disabled title="후속 단계에서 제공">
            수정이력
          </Button>
          <Button variant="outline" size="xs" disabled title="후속 단계에서 제공">
            차트에 복사하기
          </Button>
          <Button
            size="xs"
            data-testid="lab-result-save-button"
            disabled={
              !onSave || currentSaveState === "saving" || rows.length === 0
            }
            onClick={saveResult}
          >
            {currentSaveState === "saving" ? "저장 중" : "저장"}
          </Button>
          {currentSaveState !== "idle" ? (
            <span
              data-testid="lab-result-save-status"
              className={cn(
                "emr-text-metadata font-medium",
                currentSaveState === "error" ||
                  currentSaveState === "invalid" ||
                  currentSaveState === "permission_denied"
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
        <LabResultDataTable
          assigneeName={assigneeName}
          density={density}
          persistedResult={result}
          emptyRowsKind={emptyRowsKind}
          initialLoading={catalogStatus === "loading" && rows.length === 0}
          onMetadataChange={(rowId, patch) => {
            setSaveRequestId(null);
            setMetadataState(current => ({ resultId: result.id, rows: {
              ...(current.resultId === result.id ? current.rows : {}),
              [rowId]: { ...(current.resultId === result.id ? current.rows[rowId] : {}), ...patch },
            } }));
          }}
          onValueChange={(rowId, value) => {
            setSaveRequestId(null);
            setRowValueState((current) => {
              const currentValues =
                current.resultId === result.id
                  ? current.values
                  : initialRowValues;

              return {
                resultId: result.id,
                values: {
                  ...currentValues,
                  [rowId]: value,
                },
              };
            });
          }}
          rows={rows}
        />
      </div>
    </EmrOrderGroupSection>
  );
}

function LabResultValueControl({
  row,
  onValueChange,
  onMetadataChange,
}: {
  row: LabResultRow;
  onValueChange: (rowId: string, value: string) => void;
  onMetadataChange: (rowId: string, patch: Partial<LabResultRow>) => void;
}) {
  const rule = row.interpretationRule;
  const noResult = row.resultPresence === "instrument_no_result";
  const label = `${row.analyteName} 결과값`;

  return (
    <div className="flex w-full min-w-0 items-center gap-1.5">
      {rule?.resultValueKind === "coded" ? (
        <select
          aria-label={label}
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 emr-text-dense"
          disabled={noResult}
          value={row.value ?? ""}
          onChange={(event) => onValueChange(row.id, event.target.value)}
        >
          <option value="">{noResult ? "측정 불가" : "선택 안 함"}</option>
          {rule.codes.map((code) => (
            <option key={code.code} value={code.code}>{code.label}</option>
          ))}
        </select>
      ) : (
        <Input
          aria-label={label}
          className="h-7 min-w-0 flex-1 emr-text-dense"
          data-testid={`lab-result-input-${row.id}`}
          disabled={noResult}
          inputMode={rule?.resultValueKind === "numeric" || row.resultInputType === "number" ? "decimal" : undefined}
          placeholder={noResult ? "측정 불가" : "검사 결과값 입력"}
          value={row.value ?? ""}
          onChange={(event) => onValueChange(row.id, event.target.value)}
        />
      )}
      {!noResult && row.qualifier && row.qualifier !== "exact" ? (
        <span className="emr-text-metadata shrink-0 text-muted-foreground">
          {row.qualifier === "less_than" ? "미만" : "초과"}
        </span>
      ) : null}
      {rule ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`${row.analyteName} 추가 결과 정보`}
              />
            }
          >
            <CdsFilesMoreHorizontalIcon className="size-4" aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64">
            <PopoverTitle className="emr-text-dense">{row.analyteName} 추가 결과 정보</PopoverTitle>
            <label className="flex flex-col gap-1 emr-text-metadata text-muted-foreground">
              결과 상태
              <select
                aria-label={`${row.analyteName} 결과 상태`}
                className="h-8 rounded-md border border-input bg-background px-2 text-foreground"
                value={row.resultPresence ?? "value"}
                onChange={(event) => {
                  const presence = event.target.value as "value" | "instrument_no_result";
                  if (presence === "instrument_no_result") onValueChange(row.id, "");
                  onMetadataChange(row.id, { resultPresence: presence, qualifier: "exact", deviceFlag: undefined });
                }}
              >
                <option value="value">결과 입력</option>
                <option value="instrument_no_result">측정 불가</option>
              </select>
            </label>
            {rule.resultValueKind === "numeric" && !noResult ? (
              <>
                <label className="flex flex-col gap-1 emr-text-metadata text-muted-foreground">
                  부등호
                  <select
                    aria-label={`${row.analyteName} 부등호`}
                    className="h-8 rounded-md border border-input bg-background px-2 text-foreground"
                    value={row.qualifier ?? "exact"}
                    onChange={(event) => onMetadataChange(row.id, { qualifier: event.target.value as LabResultRow["qualifier"] })}
                  >
                    <option value="exact">정확한 값</option>
                    <option value="less_than">미만 (&lt;)</option>
                    <option value="greater_than">초과 (&gt;)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 emr-text-metadata text-muted-foreground">
                  장비 경고
                  <Input
                    aria-label={`${row.analyteName} 장비 경고`}
                    className="h-8"
                    maxLength={200}
                    placeholder="장비 경고(있는 경우)"
                    value={row.deviceFlag ?? ""}
                    onChange={(event) => onMetadataChange(row.id, { deviceFlag: event.target.value || undefined })}
                  />
                </label>
              </>
            ) : null}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

function LabResultDataTable({
  assigneeName,
  density,
  emptyRowsKind,
  initialLoading,
  onValueChange,
  onMetadataChange,
  persistedResult,
  rows,
}: {
  assigneeName: string;
  density: EmrTableDensity;
  emptyRowsKind: Extract<EmrEmptyStateKind, "no-data" | "upstream-pending">;
  initialLoading: boolean;
  onValueChange: (rowId: string, value: string) => void;
  onMetadataChange: (rowId: string, patch: Partial<LabResultRow>) => void;
  persistedResult: LabResult;
  rows: LabResultRow[];
}) {
  const columns = useMemo<ColumnDef<LabResultRow, unknown>[]>(
    () => [
      {
        id: "analyteName",
        accessorKey: "analyteName",
        size: 280,
        minSize: 180,
        enableSorting: false,
        enableResizing: false,
        header: "항목",
        meta: {
          label: "항목",
          resize: "none",
          textMode: "two-line-if-long",
        },
        cell: ({ row }) => {
          const savedRow = persistedResult.rows.find((saved) => saved.id === row.original.id);
          return (
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate font-medium">{row.original.analyteName}</span>
              {persistedResult.resultDefinitionOrigin === "canonical" && savedRow &&
              (savedRow.value?.trim() || savedRow.resultPresence === "instrument_no_result") ? (
                <AtomicLabRetestAction result={persistedResult} row={savedRow} />
              ) : null}
            </div>
          );
        },
      },
      {
        id: "value",
        accessorKey: "value",
        size: 240,
        minSize: 200,
        enableSorting: false,
        enableResizing: false,
        header: "결과값",
        meta: { label: "결과값", resize: "none" },
        cell: ({ row }) => (
          <LabResultValueControl
            row={row.original}
            onValueChange={onValueChange}
            onMetadataChange={onMetadataChange}
          />
        ),
      },
      {
        id: "unit",
        accessorKey: "unit",
        size: 120,
        minSize: 80,
        enableSorting: false,
        enableResizing: false,
        header: "단위",
        meta: { label: "단위", resize: "none" },
        cell: ({ row }) => row.original.unit ?? "-",
      },
      {
        id: "referenceRange",
        accessorKey: "referenceRange",
        size: 278,
        minSize: 220,
        enableSorting: false,
        enableResizing: false,
        header: "정상범위",
        meta: {
          align: "center",
          grow: true,
          label: "정상범위",
          resize: "none",
        },
        cell: ({ row }) => <NormalRangeCell row={row.original} />,
      },
      {
        id: "judgment",
        accessorKey: "judgment",
        size: 120,
        minSize: 100,
        enableSorting: false,
        enableResizing: false,
        header: "판정",
        meta: { label: "판정", resize: "none" },
        cell: ({ row }) => (
          <div aria-live="polite">
            <Badge
              variant="outline"
              className={judgmentBadgeClassName[row.original.judgment]}
            >
              {getStatusLabel("labJudgment", row.original.judgment)}
            </Badge>
          </div>
        ),
      },
      {
        id: "assignee",
        accessorFn: () => assigneeName,
        size: 160,
        minSize: 100,
        enableSorting: false,
        enableResizing: false,
        header: "담당자",
        meta: { label: "담당자", resize: "none" },
        cell: () => (
          <Avatar size="sm" title={assigneeName} aria-label={assigneeName}>
            <AvatarFallback>{assigneeName.slice(0, 2)}</AvatarFallback>
          </Avatar>
        ),
      },
    ],
    [assigneeName, onValueChange, onMetadataChange, persistedResult],
  );
  // TanStack Table owns the result grid controller.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: rows,
    enableColumnResizing: false,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <EmrDataTable
      aria-label="임상병리 검사 결과 입력"
      className="table-fixed"
      density={density}
      initialLoading={initialLoading}
      renderAfterRows={({ visibleColumnCount }) =>
        !initialLoading && rows.length === 0 ? (
          <TableRow className="border-border bg-card hover:bg-card">
            <TableCell colSpan={visibleColumnCount} className="h-32 px-3 py-6">
              <div className="flex justify-center">
                <EmrEmptyState
                  surface="table"
                  kind={emptyRowsKind}
                  title="검사 결과 항목이 없습니다"
                  description="결과지 항목이 연결되면 입력할 수 있습니다."
                />
              </div>
            </TableCell>
          </TableRow>
        ) : null
      }
      skeletonRowCount={5}
      table={table}
      viewportMode="content"
      getRowProps={(row) => ({
        className: undefined,
        "data-testid": "lab-result-row-" + row.original.id,
      })}
    />
  );
}

function NormalRangeCell({ row }: { row: LabResultRow }) {
  const range = parseReferenceRange(row.referenceRange);
  const scale = getRangeScale(row);
  const rangeState = rangeStateByJudgment[row.judgment] ?? {
    label: "미판정",
    markerClassName:
      "bg-[var(--emr-status-neutral-text)] fill-[var(--emr-status-neutral-text)]",
  };

  if (!range || !row.value?.trim() || row.judgment === "not_judged") {
    return <span className="text-muted-foreground">{row.referenceRange ?? "참고범위 없음"} · 미판정</span>;
  }

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
        <div className="mb-1 h-4 emr-text-metadata font-medium text-foreground">
          -
        </div>
      )}
      <NormalRangeChart
        row={row}
        scale={scale}
        markerClassName={rangeState.markerClassName}
      />
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
          markerClassName,
        )}
        style={{ left: `${scale.valuePercent}%` }}
      />
    </div>
  );
}

function LabResultCommentSection({
  result,
  allowDemoContent = false,
}: {
  result: LabResult;
  allowDemoContent?: boolean;
}) {
  if (!allowDemoContent) {
    return (
      <section className="rounded-lg border bg-card p-4">
        <h2 className="emr-text-body font-semibold">검사결과 종합소견</h2>
        <p className="mt-2 emr-text-dense text-muted-foreground">
          종합소견 저장은 아직 지원하지 않습니다. 검사 결과는 결과표에서 입력해
          주세요.
        </p>
      </section>
    );
  }
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
  allowDemoContent = false,
}: {
  attachments: EmrAttachment[];
  showImageExample?: boolean;
  allowDemoContent?: boolean;
}) {
  const displayAttachments: AttachmentPreviewItem[] = [
    ...attachments.map((attachment) => ({
      fileName: attachment.fileName,
      fileSizeBytes: attachment.fileSizeBytes,
      id: attachment.id,
      mimeType: attachment.mimeType,
      previewKind: attachment.mimeType.startsWith("image/")
        ? ("image" as const)
        : ("file" as const),
    })),
    ...(allowDemoContent && showImageExample ? [labDemoImageAttachment] : []),
  ];

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex h-11 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <h2 className="emr-text-body font-semibold">첨부자료</h2>
          <Badge variant="secondary">{displayAttachments.length}</Badge>
        </div>
        <Button
          size="xs"
          variant="outline"
          className="bg-card"
          aria-label={
            allowDemoContent ? "첨부자료 추가" : "첨부자료 추가 미지원"
          }
          disabled={!allowDemoContent}
        >
          <CdsActionsPlusIcon data-icon="inline-start" />
          {allowDemoContent ? "추가" : "추가 미지원"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 p-4">
        {displayAttachments.map((attachment) => (
          <div
            key={attachment.id}
            className="min-w-[220px] overflow-hidden rounded-md border bg-card"
          >
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
              <div className="truncate emr-text-dense font-medium">
                {attachment.fileName}
              </div>
              <div className="mt-1 emr-text-metadata text-muted-foreground">
                {attachment.mimeType} ·{" "}
                {formatFileSize(attachment.fileSizeBytes)}
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
  const selectedLabResultId = useLabImagingStore(
    (state) => state.selectedLabResultId,
  );
  const fulfillmentQueue = useFulfillmentQueue("lab");

  return getLabDetailFromSearchParams(
    searchParams,
    selectedLabResultId,
    fulfillmentQueue.workItems,
    { allowMockFallback: isLegacySalesDemoWorkspace(workspaceId) },
  );
}

export function LabSlotAvailabilityProvider({
  children,
  workspaceId,
}: WorkspaceSlotAvailabilityProviderProps) {
  const { detail } = useCurrentLabDetail(workspaceId);
  const hasSelectedDetail = Boolean(detail);

  return children({
    hasContentAside: hasSelectedDetail,
    hasRightPanel: hasSelectedDetail,
  });
}

export function LabHeader({ workspaceId }: ShellComponentProps) {
  const { detail } = useCurrentLabDetail(workspaceId);
  const profileInteractions = usePatientContextProfileInteractions({
    allowLocalProfiles: isLegacySalesDemoWorkspace(workspaceId),
    guardian: detail?.primaryGuardian,
    patient: detail?.patient,
    workspaceId,
  });
  const latestVitals = usePatientLatestVitalItems({
    encounterId: detail?.encounter.id,
    fallbackItems: isLegacySalesDemoWorkspace(workspaceId)
      ? [
          { label: "체중", value: "5.96 kg" },
          { label: "체온", value: "39.3°C" },
          { label: "호흡", value: "20 rpm" },
          { label: "혈압", value: "170 mmHg" },
        ]
      : undefined,
    workspaceId,
  });
  const { vitalAction, vitalDialog } = useContextVitalEditor({
    encounterId: detail?.encounter.id,
    encounterIsActive: detail?.encounter.status === "in_consultation",
    latestVitals,
    workspaceId,
  });

  if (!detail) {
    return <EmrMainContentHeader aria-hidden="true" heightMode="fixed" />;
  }

  return (
    <>
    <EmrMainContentHeader heightMode="fixed">
      <EmrPatientContextBar
        key={detail.encounter.id}
        guardianInteraction={profileInteractions.guardianInteraction}
        guardianItems={[
          {
            label: "보호자",
            value: detail.primaryGuardian?.name ?? "보호자 미지정",
          },
        ]}
        patientInteraction={profileInteractions.patientInteraction}
        patientItems={[
          { label: "환자", value: detail.patient.name },
          {
            label: "품종",
            value: detail.patient.breed ?? getSpeciesLabel(detail.patient),
          },
          { label: "나이", value: getPatientDisplayAge(detail.patient) },
          { label: "성별", value: getPatientSexLabel(detail.patient) },
        ]}
        vitalAction={vitalAction}
        vitalItems={latestVitals.items}
        memoActions={[
          {
            label: "방문목적",
            summary:
              detail.encounter.visitPurpose ??
              detail.encounter.chiefComplaint ??
              "방문 목적 기록 없음",
          },
          {
            label: "보호자메모",
            locked: true,
            summary: detail.primaryGuardian?.memo ?? "보호자 메모 없음",
            unavailableReason:
              "보호자 프로필 메모는 고객 정보 화면에서 관리합니다.",
          },
          {
            label: "환자메모",
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
            label: "수납메모",
            disabled: true,
            unavailableReason: "수납 메모는 수납 화면에서 관리합니다.",
          },
        ]}
        trailingItems={[
          { label: "검사", value: detail.result.resultName },
          {
            label: "상태",
            value: getStatusLabel("labResult", detail.result.status),
          },
        ]}
      />
    </EmrMainContentHeader>
    {vitalDialog}
    </>
  );
}

export function LabContentAside({ onNavigateWorkspaceSurface, workspaceId }: ShellComponentProps) {
  const searchParams = useSearchParams();
  const { detail } = useCurrentLabDetail(workspaceId);
  const setContentAsideOpen = useLayoutStore(
    (state) => state.setContentAsideOpen,
  );
  const selectedLabResultId = useLabImagingStore((state) => state.selectedLabResultId);
  const selectLabResult = useLabImagingStore((state) => state.selectLabResult);
  const history = usePatientFulfillmentHistory(workspaceId, detail?.patient.id, ["lab"]);
  const selectHistoryResult = (resultId: string, encounterId: string, timestamp: string) => {
    if (onNavigateWorkspaceSurface) {
      onNavigateWorkspaceSurface(buildWorkspaceSurfaceRoute({
        moduleId: "lab",
        params: { date: getOperatingDateFromIso(timestamp), encounterId, labResultId: resultId },
        removeParams: ["imagingStudyId", "invoiceId", "workItemId"],
        search: searchParams,
        workspaceId,
      }), "lab");
    } else selectLabResult(resultId);
  };

  if (!detail) {
    return null;
  }

  const legacyFixture = isLegacySalesDemoWorkspace(workspaceId);
  const entries: PatientHistoryEntry[] = legacyFixture
    ? getLabWorkItems()
        .filter((item) => item.patient.id === detail.patient.id)
        .map((item) => ({
          id: item.result.id,
          title: item.result.resultName,
          timestamp: item.result.enteredAt ?? item.result.receivedAt ?? item.result.collectedAt ?? item.order?.requestedAt ?? item.encounter.createdAt,
          status: getStatusLabel("labResult", item.result.status),
          assignee: item.technicianName,
          selected: item.result.id === selectedLabResultId,
          onSelect: () => selectHistoryResult(
            item.result.id,
            item.encounter.id,
            item.result.enteredAt ?? item.result.receivedAt ?? item.result.collectedAt ?? item.order?.requestedAt ?? item.encounter.createdAt,
          ),
        }))
    : history.workItems.map((item) => ({
        id: item.id,
        title: getFulfillmentOrderDisplayName(item.sourceSnapshot) ?? "검사명 정보 없음",
        timestamp: item.createdAt,
        status: getPatientHistoryStatus(item.status),
        assignee: item.assignedToUserId
          ? history.assigneeNames[item.assignedToUserId] ?? getStaffName(item.assignedToUserId) ?? "확인 불가"
          : undefined,
        selected: `live-lab-${item.id}` === selectedLabResultId,
        onSelect: () => selectHistoryResult(`live-lab-${item.id}`, item.encounterId, item.createdAt),
      }));

  return (
    <PatientHistoryAside
      id="lab-content-aside"
      label="임상병리검사 이력"
      actions={<QueueActions />}
      entries={entries}
      status={legacyFixture ? "ready" : history.status}
      onCollapse={() => setContentAsideOpen(false)}
    />
  );
}

export function LabRightPanel({ workspaceId }: ShellComponentProps) {
  const { detail } = useCurrentLabDetail(workspaceId);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
  const [expandedReceiptIds, setExpandedReceiptIds] =
    useState<Set<string> | null>(null);
  const [receiptToPaste, setReceiptToPaste] = useState<EquipmentReceipt | null>(
    null,
  );
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

    return detail.allEquipmentReceipts.filter(
      (receipt) => receipt.orderId === detail.order?.id,
    );
  }, [detail]);

  if (!detail) return null;

  const visibleReceipts = linkedReceipts;
  const hasEnteredRows = detail.result.rows.some((row) => row.value);
  const latestReceiptDate =
    visibleReceipts[0]?.receivedAt ?? detail.result.receivedAt;
  const receiptOperatingDate = latestReceiptDate?.slice(0, 10);
  const dateLabel = receiptOperatingDate
    ? formatKoreanOperatingDateLabel(receiptOperatingDate)
    : "-";
  const defaultExpandedReceiptId = visibleReceipts[0]?.id;

  return (
    <EmrRightPanel
      id="lab-receipt-panel"
      className="group/lab-receipt-panel bg-[var(--emr-surface-rightpanel)]"
      data-testid="lab-receipt-panel"
      header={
        <EmrRightPanelHeader>
          <div className="relative flex min-w-0 max-w-full items-center">
            <h2 className="min-w-0 truncate text-sm font-semibold">
              장비 검사 수신함
            </h2>
            <span className="pointer-events-auto absolute left-full z-10 ml-1 flex w-8 shrink-0">
              <EmrRightPanelHeaderIconButton
                className="opacity-0 text-[var(--emr-text-tertiary)] transition-opacity hover:text-[var(--emr-text-tertiary)] group-hover/lab-receipt-panel:opacity-100 focus-visible:opacity-100"
                aria-label="장비 검사 수신함 접기"
                onClick={() => setRightPanelOpen(false)}
              >
                <CdsNavigationChevronsRightIcon className="size-4" />
              </EmrRightPanelHeaderIconButton>
            </span>
          </div>
        </EmrRightPanelHeader>
      }
    >
      <EmrRightPanelBody>
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
          topDividerVisible
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
              const receiptWorkItem = receipt.orderId
                ? workItemByOrderId.get(receipt.orderId)
                : undefined;
              const previewRows = receiptWorkItem?.result.rows ?? [];
              const expanded = expandedReceiptIds
                ? expandedReceiptIds.has(receipt.id)
                : receipt.id === defaultExpandedReceiptId;

              return (
                <LabReceiptCard
                  key={receipt.id}
                  expanded={expanded}
                  linkedToCurrentOrder={receipt.orderId === detail?.order?.id}
                  orderLabel={
                    receiptWorkItem?.order?.displayName ??
                    receiptWorkItem?.result.resultName ??
                    "오더 미지정"
                  }
                  patientLabel={receiptWorkItem?.patient.name ?? "환자 미지정"}
                  previewRows={previewRows}
                  primaryGuardianLabel={
                    receiptWorkItem?.primaryGuardian?.name ?? "보호자 미지정"
                  }
                  receipt={receipt}
                  onPaste={() => setReceiptToPaste(receipt)}
                  onToggle={() => {
                    setExpandedReceiptIds((current) => {
                      const next = new Set(
                        current ??
                          (defaultExpandedReceiptId
                            ? [defaultExpandedReceiptId]
                            : []),
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
        <Dialog
          open={Boolean(receiptToPaste)}
          onOpenChange={(open) => !open && setReceiptToPaste(null)}
        >
          <EmrConfirmDialogContent
            title="검사결과를 붙여넣을까요?"
            description={
              <>
                {receiptToPaste?.equipmentName} 수신값을 현재 검사결과지에
                입력합니다.
                {hasEnteredRows
                  ? " 이전에 입력된 수치가 있으면 장비 수신값으로 덮어씁니다."
                  : ""}
              </>
            }
            cancelLabel="취소"
            confirmLabel="붙여넣기"
            closeAriaLabel="검사결과 붙여넣기 확인 닫기"
            onCancel={() => setReceiptToPaste(null)}
            onConfirm={() => setReceiptToPaste(null)}
          />
        </Dialog>
      </EmrRightPanelBody>
    </EmrRightPanel>
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
    <section
      className="overflow-hidden rounded-lg border bg-card"
      data-testid={`lab-receipt-${receipt.id}`}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-start gap-3 px-4 text-left outline-none transition-colors hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50",
          expanded ? "pb-1 pt-3" : "py-3",
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
            <span className="shrink-0 rounded border border-[var(--emr-border-subtle)] px-1.5 py-0.5 emr-text-metadata font-medium text-[var(--emr-text-secondary)]">
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
          transition={
            reduceMotion
              ? { duration: 0 }
              : { duration: 0.2, ease: EMR_SIDE_PANEL_COLLAPSE_EASE }
          }
        >
          <ChevronDownIcon
            className="size-4 text-foreground"
            aria-hidden="true"
          />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key={`${receipt.id}-preview`}
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{
              height: "auto",
              opacity: 1,
              y: 0,
              transition: contentTransition,
            }}
            exit={{
              height: 0,
              opacity: 0,
              y: -4,
              transition: contentExitTransition,
            }}
          >
            <div className="px-4 pb-3 pt-2">
              <div className="mb-2 h-px w-full bg-[var(--emr-border-subtle)]" />
              <div className="flex h-8 items-center justify-between gap-2">
                <h3 className="emr-text-dense font-semibold text-[var(--emr-text-secondary)]">
                  검사 결과
                </h3>
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
                      <span className="truncate text-[var(--emr-text-secondary)]">
                        {row.analyteName}
                      </span>
                      <span className="text-foreground">{row.value}</span>
                      <span className="truncate text-muted-foreground">
                        {row.unit ?? "-"}
                      </span>
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

export function LabContent({
  hasRightPanel,
  workspaceId,
}: ShellComponentProps) {
  const allowDemoContent =
    isLegacySalesDemoWorkspace(workspaceId) && !isLiveAuthRuntime();
  const searchParams = useSearchParams();
  const selectedLabResultId = useLabImagingStore(
    (state) => state.selectedLabResultId,
  );
  const selectLabResult = useLabImagingStore((state) => state.selectLabResult);
  const contentAsideOpen = useLayoutStore((state) => state.contentAsideOpen);
  const setContentAsideOpen = useLayoutStore(
    (state) => state.setContentAsideOpen,
  );
  const rightPanelOpen = useLayoutStore((state) => state.rightPanelOpen);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
  const { selectedDate } = useSelectedOperatingDate(workspaceId, searchParams.get("date"));
  const fulfillmentQueue = useFulfillmentQueue("lab", selectedDate);
  const { detail, queryLabResultId } = getLabDetailFromSearchParams(
    searchParams,
    selectedLabResultId,
    fulfillmentQueue.workItems,
    { allowMockFallback: allowDemoContent },
  );
  const fulfillmentWorkItem = useMemo(
    () =>
      fulfillmentQueue.workItems.find(
        (item) => item.orderId === detail?.order?.id,
      ),
    [detail?.order?.id, fulfillmentQueue.workItems],
  );
  const catalogRowsState = useLabResultSheetCatalogRows({
    result: allowDemoContent ? detail?.result : undefined,
    workItem: fulfillmentWorkItem,
    workspaceId,
  });
  const persistedResult = usePersistedLabResult(workspaceId, fulfillmentWorkItem?.id, detail?.result, !allowDemoContent);
  const reloadPersistedResult = persistedResult.retry;
  const effectiveDetail = useMemo(() => {
    if (!detail) return null;
    if (!allowDemoContent) return { ...detail, result: persistedResult.result ?? { ...detail.result, rows: [] } };
    if (detail.result.rows.length > 0 || catalogRowsState.rows.length === 0)
      return detail;

    return {
      ...detail,
      result: {
        ...detail.result,
        rows: catalogRowsState.rows,
      },
    };
  }, [allowDemoContent, catalogRowsState.rows, detail, persistedResult.result]);
  const [savedEntryRevision, setSavedEntryRevision] = useState<{
    workspaceId: string;
    resultId: string;
    revision: number;
  } | null>(null);
  const saveResultRevision =
    savedEntryRevision?.workspaceId === workspaceId && savedEntryRevision?.resultId === effectiveDetail?.result.id
      ? Math.max(savedEntryRevision.revision, effectiveDetail?.result.entryWriteRevision ?? 0)
      : effectiveDetail?.result.entryWriteRevision;
  const saveResultRows = useCallback(
    async (rows: LabResultRow[], requestId: string) => {
      if (!effectiveDetail) {
        return Promise.resolve({
          message: "선택된 검사 결과가 없습니다.",
          ok: false,
          reason: "invalid",
          retryable: false,
        } satisfies LabResultSaveOutcome);
      }
      const outcome = await saveLabResultEntry({
        result: {
          ...effectiveDetail.result,
          entryWriteRevision: saveResultRevision,
        },
        requestId,
        rows,
        workItem: fulfillmentWorkItem,
        workspaceId,
      });
      if (outcome.ok && outcome.entryWriteRevision !== undefined) {
        setSavedEntryRevision({
          workspaceId,
          resultId: effectiveDetail.result.id,
          revision: outcome.entryWriteRevision,
        });
        if (!allowDemoContent) reloadPersistedResult();
      }
      return outcome;
    },
    [
      effectiveDetail,
      fulfillmentWorkItem,
      saveResultRevision,
      workspaceId,
      reloadPersistedResult,
      allowDemoContent,
    ],
  );
  const [resultTab, setResultTab] = useState<LabResultTab>("all");
  const initialAssignment = {
    assigneeName: detail?.technicianName ?? "미지정",
    resultId: detail?.result.id ?? "",
    status: "requested" as LabAssignmentStatus,
  };
  const [assignmentState, setAssignmentState] = useState(initialAssignment);
  const assignment =
    assignmentState.resultId === initialAssignment.resultId
      ? assignmentState
      : initialAssignment;
  const equipmentReceiptCount =
    detail?.equipmentReceipts.filter(
      (receipt) => receipt.orderId === detail.order?.id,
    ).length ?? 0;
  const startAssignment = async () => {
    if (fulfillmentWorkItem) {
      const transitionPath = getFulfillmentTransitionPath(
        fulfillmentWorkItem.status,
        "in_progress",
      );
      if (!transitionPath) return;
      const updated = await fulfillmentQueue.updateStatus(
        fulfillmentWorkItem.id,
        transitionPath,
      );
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
      const transitionPath = getFulfillmentTransitionPath(
        fulfillmentWorkItem.status,
        "completed",
      );
      if (!transitionPath) return;
      const updated = await fulfillmentQueue.updateStatus(
        fulfillmentWorkItem.id,
        transitionPath,
      );
      if (!updated) return;
    }
    setAssignmentState((current) => ({
      assigneeName:
        current.resultId === initialAssignment.resultId
          ? current.assigneeName
          : currentLabAssignee.name,
      resultId: initialAssignment.resultId,
      status: "completed",
    }));
  };
  const cancelAssignment = async () => {
    if (fulfillmentWorkItem) {
      const transitionPath = getFulfillmentTransitionPath(
        fulfillmentWorkItem.status,
        "requested",
      );
      if (!transitionPath) return;
      const updated = await fulfillmentQueue.updateStatus(
        fulfillmentWorkItem.id,
        transitionPath,
      );
      if (!updated) return;
    }
    setAssignmentState({
      assigneeName: "미지정",
      resultId: initialAssignment.resultId,
      status: "requested",
    });
  };
  const transitionFulfillment = (
    action: FulfillmentWorkItemAction,
    options?: FulfillmentTransitionOptions,
  ) =>
    fulfillmentWorkItem
      ? fulfillmentQueue.updateStatus(fulfillmentWorkItem.id, [
          { action, ...options },
        ])
      : Promise.resolve(false);
  const loadEligibleAssignees = () =>
    fulfillmentWorkItem
      ? loadFulfillmentEligibleAssigneesRoute({
          workItemId: fulfillmentWorkItem.id,
          workspaceId: fulfillmentWorkItem.workspaceId,
        })
      : Promise.resolve([]);

  useEffect(() => {
    if (queryLabResultId && queryLabResultId !== selectedLabResultId) {
      selectLabResult(queryLabResultId);
    }
  }, [queryLabResultId, selectLabResult, selectedLabResultId]);

  if (!effectiveDetail) {
    const labWorkItemCount =
      fulfillmentQueue.summary?.totalCount ?? fulfillmentQueue.workItems.length;
    const hasLabWorkItems = labWorkItemCount > 0;

    return (
      <div className="flex h-full items-center justify-center bg-[var(--emr-surface-workspace)] emr-text-dense text-muted-foreground">
        <EmrEmptyState
          kind={hasLabWorkItems ? "no-scope-result" : "upstream-pending"}
          priority="supporting"
          size="xl"
          surface="content"
          description={
            hasLabWorkItems
              ? "대기열에서 검사 업무를 선택하면 상세가 표시됩니다."
              : "오늘 표시할 검사 업무가 없습니다."
          }
          primaryAction={
            hasLabWorkItems ? undefined : (
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
          title={
            hasLabWorkItems
              ? "검사 대기열에서 항목을 선택해 주세요"
              : "검사 업무가 없습니다"
          }
        />
      </div>
    );
  }

  const displayDetail = {
    ...effectiveDetail,
    result: {
      ...effectiveDetail.result,
      entryWriteRevision: saveResultRevision,
    },
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] pb-2">
      <EmrInstructionHeaderStack
        chartAligned
        titleBar={
          <EmrInstructionTitleBar
            className="px-4"
            title="임상병리검사 결과지"
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
              <Badge
                variant="secondary"
                className="h-[22px] max-w-40 truncate rounded-md px-2 text-xs text-muted-foreground"
                title={getLabResultDocumentId(displayDetail.result)}
              >
                {getLabResultDocumentId(displayDetail.result)}
              </Badge>
            }
            actions={
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="relative bg-card data-[state=on]:border-[var(--emr-border-default)] data-[state=on]:bg-[var(--emr-state-selected)] data-[state=on]:text-[var(--emr-text-primary)]"
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
                {fulfillmentWorkItem ? (
                  <FulfillmentWorkLifecycleAction
                    activityLabel="검사"
                    assignedToUserId={fulfillmentWorkItem.assignedToUserId}
                    completeLabel="검사완료"
                    loadEligibleAssignees={loadEligibleAssignees}
                    onTransition={transitionFulfillment}
                    startPhase="inputting"
                    status={fulfillmentWorkItem.status}
                  />
                ) : (
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
                )}
                <EmrInstructionOutputMenu />
              </>
            }
          />
        }
        orderInfo={
          <div data-slot="instruction-info-card" className="grid min-h-[72px] [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))] rounded-lg border border-border bg-card px-4 py-3">
            {[
              [
                "요청 일시",
                <span
                  key="requested-at"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <span>
                    {formatShortDateTime(displayDetail.order?.requestedAt)}
                  </span>
                  <EmrStatusBadge
                    label={getStatusLabel(
                      "labResult",
                      displayDetail.result.status,
                    )}
                    marker="none"
                    testId="lab-result-status-label"
                  />
                </span>,
              ],
              [
                "환자 정보",
                `${displayDetail.patient.name}(${getPatientDisplayAge(displayDetail.patient)}) · ${displayDetail.patient.breed ?? getSpeciesLabel(displayDetail.patient)}`,
              ],
              [
                "요청 수의사",
                allowDemoContent
                  ? (getStaffName(displayDetail.order?.requestedByUserId) ??
                    "이수지")
                  : fulfillmentWorkItem?.requesterName ??
                    getSnapshotString(
                      fulfillmentWorkItem?.sourceSnapshot,
                      "requestingVetName",
                      "정보 없음",
                    ),
              ],
              [
                "검사 담당",
                <span key="lab-assignee" aria-live="polite">
                  {allowDemoContent
                    ? assignment.assigneeName
                    : fulfillmentWorkItem?.assignedToUserId
                      ? "담당자 지정됨"
                      : "미지정"}
                </span>,
              ],
              [
                "수신 장비",
                displayDetail.equipmentReceipts.find(
                  (receipt) => receipt.status === "matched",
                )?.equipmentName ?? "미수신",
              ],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="min-w-0 border-r border-border px-3 first:pl-0 last:border-r-0 last:pr-0"
              >
                <div className="emr-text-metadata font-medium text-muted-foreground">
                  {label}
                </div>
                <div className="mt-1 flex min-h-6 min-w-0 items-center emr-text-dense font-medium text-foreground">
                  {value}
                </div>
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
              count:
                item.value === "all"
                  ? displayDetail.result.rows.length
                  : item.value === "cbc"
                    ? displayDetail.result.rows.length
                    : 0,
              disabled: item.value === "chemistry",
            }))}
            onValueChange={setResultTab}
          />
        }
      />

      <ScrollArea data-slot="lab-result-scroll-area" className="min-h-0 flex-1">
        <div data-slot="instruction-result-scroll-content" className="flex flex-col gap-4 px-4 pb-10 pt-4">
          {displayDetail.result.resultProfileLabel ? <p className="text-sm text-muted-foreground" data-testid="lab-frozen-profile">{displayDetail.result.resultProfileLabel}</p> : null}
          <LabResultInputSection
            assigneeName={
              allowDemoContent
                ? assignment.assigneeName
                : fulfillmentWorkItem?.assignedToUserId ? "담당자 지정됨" : "미지정"
            }
            catalogStatus={
              !allowDemoContent ? persistedResult.status : detail?.result.rows.length === 0
                ? catalogRowsState.status
                : "idle"
            }
            emptyRowsKind={fulfillmentWorkItem ? "upstream-pending" : "no-data"}
            result={displayDetail.result}
            onCatalogRetry={allowDemoContent ? catalogRowsState.retry : persistedResult.retry}
            onSave={saveResultRows}
          />
          <LabResultCommentSection
            result={displayDetail.result}
            allowDemoContent={allowDemoContent}
          />
          <AttachmentStrip
            allowDemoContent={allowDemoContent}
            attachments={displayDetail.attachments}
            showImageExample
          />
        </div>
      </ScrollArea>
    </div>
  );
}

function useCurrentImagingDetail(workspaceId: string) {
  const searchParams = useSearchParams();
  const selectedImagingStudyId = useLabImagingStore(
    (state) => state.selectedImagingStudyId,
  );
  const { selectedDate } = useSelectedOperatingDate(workspaceId, searchParams.get("date"));
  const fulfillmentQueue = useFulfillmentQueue("imaging", selectedDate);

  return getImagingDetailFromSearchParams(
    searchParams,
    selectedImagingStudyId,
    fulfillmentQueue.workItems,
    { allowMockFallback: isLegacySalesDemoWorkspace(workspaceId) },
  );
}

export function ImagingSlotAvailabilityProvider({
  children,
  workspaceId,
}: WorkspaceSlotAvailabilityProviderProps) {
  const { detail } = useCurrentImagingDetail(workspaceId);
  const hasSelectedDetail = Boolean(detail);

  return children({
    hasContentAside: hasSelectedDetail,
    hasRightPanel: hasSelectedDetail,
  });
}

export function ImagingHeader({
  hasRightPanel,
  workspaceId,
}: ShellComponentProps) {
  const { detail } = useCurrentImagingDetail(workspaceId);
  const profileInteractions = usePatientContextProfileInteractions({
    allowLocalProfiles: isLegacySalesDemoWorkspace(workspaceId),
    guardian: detail?.primaryGuardian,
    patient: detail?.patient,
    workspaceId,
  });
  const rightPanelOpen = useLayoutStore((state) => state.rightPanelOpen);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
  const latestVitals = usePatientLatestVitalItems({
    encounterId: detail?.encounter.id,
    fallbackItems: isLegacySalesDemoWorkspace(workspaceId)
      ? [
          { label: "체중", value: "5.96 kg" },
          { label: "체온", value: "39.3°C" },
          { label: "호흡", value: "20 rpm" },
          { label: "혈압", value: "170 mmHg" },
        ]
      : undefined,
    workspaceId,
  });
  const { vitalAction, vitalDialog } = useContextVitalEditor({
    encounterId: detail?.encounter.id,
    encounterIsActive: detail?.encounter.status === "in_consultation",
    latestVitals,
    workspaceId,
  });

  if (!detail) {
    return <EmrMainContentHeader aria-hidden="true" heightMode="fixed" />;
  }

  return (
    <>
    <EmrMainContentHeader heightMode="fixed">
      <EmrPatientContextBar
        key={detail.encounter.id}
        guardianInteraction={profileInteractions.guardianInteraction}
        guardianItems={[
          {
            label: "보호자",
            value: detail.primaryGuardian?.name ?? "보호자 미지정",
          },
        ]}
        patientInteraction={profileInteractions.patientInteraction}
        patientItems={[
          { label: "환자", value: detail.patient.name },
          {
            label: "품종",
            value: detail.patient.breed ?? getSpeciesLabel(detail.patient),
          },
          { label: "나이", value: getPatientDisplayAge(detail.patient) },
          { label: "성별", value: getPatientSexLabel(detail.patient) },
        ]}
        vitalAction={vitalAction}
        vitalItems={latestVitals.items}
        memoActions={[
          {
            label: "방문목적",
            summary:
              detail.encounter.visitPurpose ??
              detail.encounter.chiefComplaint ??
              "방문 목적 기록 없음",
          },
          {
            label: "보호자메모",
            locked: true,
            summary: detail.primaryGuardian?.memo ?? "보호자 메모 없음",
            unavailableReason:
              "보호자 프로필 메모는 고객 정보 화면에서 관리합니다.",
          },
          {
            label: "환자메모",
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
            label: "수납메모",
            disabled: true,
            unavailableReason: "수납 메모는 수납 화면에서 관리합니다.",
          },
        ]}
        trailingItems={[
          {
            label: "영상",
            value:
              detail.order?.displayName ??
              `${detail.study.modality} ${detail.study.bodyPart}`,
          },
          {
            label: "상태",
            value: getStatusLabel("imagingStudy", detail.study.status),
          },
        ]}
        onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
        rightPanelBadgeCount={detail.attachments.length}
        rightPanelDisabled={!hasRightPanel}
        rightPanelOpen={rightPanelOpen}
        rightPanelToggleLabel="종합소견"
      />
    </EmrMainContentHeader>
    {vitalDialog}
    </>
  );
}

export function ImagingContentAside({ onNavigateWorkspaceSurface, workspaceId }: ShellComponentProps) {
  const searchParams = useSearchParams();
  const { detail } = useCurrentImagingDetail(workspaceId);
  const selectedImagingStudyId = useLabImagingStore(
    (state) => state.selectedImagingStudyId,
  );
  const selectImagingStudy = useLabImagingStore(
    (state) => state.selectImagingStudy,
  );
  const setContentAsideOpen = useLayoutStore(
    (state) => state.setContentAsideOpen,
  );
  const history = usePatientFulfillmentHistory(workspaceId, detail?.patient.id, ["imaging"]);
  const selectHistoryStudy = (studyId: string, encounterId: string, timestamp: string) => {
    if (onNavigateWorkspaceSurface) {
      onNavigateWorkspaceSurface(buildWorkspaceSurfaceRoute({
        moduleId: "imaging",
        params: { date: getOperatingDateFromIso(timestamp), encounterId, imagingStudyId: studyId },
        removeParams: ["invoiceId", "labResultId", "workItemId"],
        search: searchParams,
        workspaceId,
      }), "imaging");
    } else selectImagingStudy(studyId);
  };

  if (!detail) {
    return null;
  }

  const legacyFixture = isLegacySalesDemoWorkspace(workspaceId);
  const entries: PatientHistoryEntry[] = legacyFixture
    ? getImagingWorkItems()
        .filter((item) => item.patient.id === detail.patient.id)
        .map((item) => ({
          id: item.study.id,
          title: `${item.study.modality} · ${item.study.bodyPart}`,
          timestamp: item.study.capturedAt ?? item.study.requestedAt,
          status: getStatusLabel("imagingStudy", item.study.status),
          assignee: item.radiologistName,
          selected: item.study.id === selectedImagingStudyId,
          onSelect: () => selectHistoryStudy(item.study.id, item.encounter.id, item.study.capturedAt ?? item.study.requestedAt),
        }))
    : history.workItems.map((item) => {
        const modality = item.sourceSnapshot.detail?.modality;
        const bodyPart = item.sourceSnapshot.detail?.bodyPart;
        const title = getFulfillmentOrderDisplayName(item.sourceSnapshot)
          ?? (typeof modality === "string" && typeof bodyPart === "string"
            ? `${modality} · ${bodyPart}`
            : "검사명 정보 없음");
        return {
          id: item.id,
          title,
          timestamp: item.createdAt,
          status: getPatientHistoryStatus(item.status),
          assignee: item.assignedToUserId
            ? history.assigneeNames[item.assignedToUserId] ?? getStaffName(item.assignedToUserId) ?? "확인 불가"
            : undefined,
          selected: `live-imaging-${item.id}` === selectedImagingStudyId,
          onSelect: () => selectHistoryStudy(`live-imaging-${item.id}`, item.encounterId, item.createdAt),
        };
      });

  return <PatientHistoryAside
    id="imaging-content-aside"
    label="영상검사 이력"
    actions={<QueueActions />}
    entries={entries}
    status={legacyFixture ? "ready" : history.status}
    onCollapse={() => setContentAsideOpen(false)}
  />;
}

function getImagingDocumentId(study: ImagingStudy) {
  const suffix = study.id.replace("imaging-", "").toUpperCase();

  return `IMG-${suffix}`;
}

function ImagingOrderDetailTable({
  detail,
  requesterName,
  assigneeName,
}: {
  detail: ImagingDetail;
  requesterName: string;
  assigneeName: string;
}) {
  const [density, setDensity] = useState<EmrTableDensity>("comfortable");
  const columns = useMemo<ColumnDef<ImagingDetail, unknown>[]>(
    () => [
      {
        id: "category",
        accessorFn: (row) => row.study.modality,
        size: 100,
        minSize: 88,
        enableSorting: false,
        enableResizing: false,
        header: "검사분류",
        meta: { label: "검사분류", resize: "none" },
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className="h-5 rounded-md px-1.5 emr-text-micro"
          >
            {row.original.study.modality === "X-ray"
              ? "XR"
              : row.original.study.modality === "Ultrasound"
                ? "US"
                : row.original.study.modality}
          </Badge>
        ),
      },
      {
        id: "displayName",
        accessorFn: (row) => row.order?.displayName ?? row.study.bodyPart,
        size: 220,
        minSize: 180,
        enableSorting: false,
        enableResizing: false,
        header: "검사명",
        meta: {
          label: "검사명",
          resize: "none",
          textMode: "two-line-if-long",
        },
        cell: ({ row }) =>
          row.original.order?.displayName ?? row.original.study.bodyPart,
      },
      {
        id: "englishName",
        accessorFn: (row) => row.study.modality + " " + row.study.bodyPart,
        size: 180,
        minSize: 140,
        enableSorting: false,
        enableResizing: false,
        header: "검사명(영문)",
        meta: {
          label: "검사명(영문)",
          resize: "none",
          textMode: "two-line-if-long",
        },
        cell: ({ row }) =>
          row.original.study.modality + " " + row.original.study.bodyPart,
      },
      {
        id: "requestedBy",
        accessorFn: () => requesterName,
        size: 130,
        minSize: 110,
        enableSorting: false,
        enableResizing: false,
        header: "요청자",
        meta: { label: "요청자", resize: "none" },
        cell: () => requesterName,
      },
      {
        id: "requestedAt",
        accessorFn: (row) => row.study.requestedAt,
        size: 150,
        minSize: 130,
        enableSorting: false,
        enableResizing: false,
        header: "요청 일시",
        meta: { label: "요청 일시", resize: "none" },
        cell: ({ row }) => formatShortDateTime(row.original.study.requestedAt),
      },
      {
        id: "radiologist",
        accessorFn: () => assigneeName,
        size: 120,
        minSize: 100,
        enableSorting: false,
        enableResizing: false,
        header: "검사 담당자",
        meta: { label: "검사 담당자", resize: "none" },
        cell: () => assigneeName,
      },
    ],
    [requesterName, assigneeName],
  );
  const tableData = useMemo(() => [detail], [detail]);
  // TanStack Table owns the imaging detail grid controller.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    data: tableData,
    enableColumnResizing: false,
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.study.id,
  });

  return (
    <EmrOrderGroupSection
      title="Order 상세정보"
      count={1}
      meta={
        <span className="emr-text-metadata font-medium text-muted-foreground">
          같은 차트 기준
        </span>
      }
      actions={
        <>
          <EmrTableDensitySelector value={density} onValueChange={setDensity} />
          <Button size="xs" variant="outline" className="bg-card">
            PACS
          </Button>
        </>
      }
    >
      <EmrDataTable
        aria-label="영상검사 Order 상세정보"
        className="table-fixed leading-5"
        density={density}
        overscrollAxes="horizontal"
        table={table}
        viewportMode="content"
        getRowProps={(row) => ({
          className: undefined,
          "data-testid": "imaging-order-detail-row-" + row.original.study.id,
        })}
      />
    </EmrOrderGroupSection>
  );
}
function ImagingReadingSections({
  study,
  allowDemoContent = false,
}: {
  study: ImagingStudy;
  allowDemoContent?: boolean;
}) {
  if (!allowDemoContent) {
    return (
      <section className="rounded-lg border bg-card p-4">
        <h2 className="emr-text-body font-semibold">스터디 판독의견</h2>
        <p className="mt-2 emr-text-dense text-muted-foreground">
          이 영역의 판독의견 저장은 아직 지원하지 않습니다. 판독 내용은
          수행기록에서 입력하고 이력에서 확인해 주세요.
        </p>
      </section>
    );
  }
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
          <div className="emr-text-metadata font-medium text-muted-foreground">
            Findings
          </div>
          <Textarea
            aria-label="영상 판독 내용"
            className="mt-2 min-h-32 resize-none bg-background emr-text-dense leading-5"
            defaultValue={study.reading}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="emr-text-metadata font-medium text-muted-foreground">
              Imaging Dx
            </div>
            <Textarea
              aria-label="Imaging Dx"
              className="mt-2 min-h-20 resize-none bg-background emr-text-dense leading-5"
              defaultValue={
                study.impression
                  ? `${study.bodyPart} 영상상 위장관염 가능성`
                  : ""
              }
            />
          </div>
          <div>
            <div className="emr-text-metadata font-medium text-muted-foreground">
              DDx
            </div>
            <Textarea
              aria-label="DDx"
              className="mt-2 min-h-20 resize-none bg-background emr-text-dense leading-5"
              defaultValue="이물, 급성 위장관염, 식이성 구토"
            />
          </div>
          <div>
            <div className="emr-text-metadata font-medium text-muted-foreground">
              Impression
            </div>
            <Textarea
              aria-label="영상 종합소견"
              className="mt-2 min-h-20 resize-none bg-background emr-text-dense leading-5"
              defaultValue={study.impression}
            />
          </div>
          <div>
            <div className="emr-text-metadata font-medium text-muted-foreground">
              Recommendation
            </div>
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
  const allowDemoContent =
    isLegacySalesDemoWorkspace(workspaceId) && !isLiveAuthRuntime();
  const searchParams = useSearchParams();
  const selectedImagingStudyId = useLabImagingStore(
    (state) => state.selectedImagingStudyId,
  );
  const selectImagingStudy = useLabImagingStore(
    (state) => state.selectImagingStudy,
  );
  const contentAsideOpen = useLayoutStore((state) => state.contentAsideOpen);
  const setContentAsideOpen = useLayoutStore(
    (state) => state.setContentAsideOpen,
  );
  const { selectedDate } = useSelectedOperatingDate(workspaceId, searchParams.get("date"));
  const fulfillmentQueue = useFulfillmentQueue("imaging", selectedDate);
  const { detail, queryImagingStudyId } = getImagingDetailFromSearchParams(
    searchParams,
    selectedImagingStudyId,
    fulfillmentQueue.workItems,
    { allowMockFallback: isLegacySalesDemoWorkspace(workspaceId) },
  );
  const fulfillmentWorkItem = useMemo(
    () =>
      fulfillmentQueue.workItems.find(
        (item) => item.orderId === detail?.order?.id,
      ),
    [detail?.order?.id, fulfillmentQueue.workItems],
  );
  const initialAssignment = {
    assigneeName: detail?.radiologistName ?? "미지정",
    status: getInitialImagingReadingStatus(detail?.study.status),
    studyId: detail?.study.id ?? "",
  };
  const [assignmentState, setAssignmentState] = useState(initialAssignment);
  const assignment =
    assignmentState.studyId === initialAssignment.studyId
      ? assignmentState
      : initialAssignment;
  const startAssignment = async () => {
    if (fulfillmentWorkItem) {
      const transitionPath = getFulfillmentTransitionPath(
        fulfillmentWorkItem.status,
        "in_progress",
      );
      if (!transitionPath) return;
      const updated = await fulfillmentQueue.updateStatus(
        fulfillmentWorkItem.id,
        transitionPath,
      );
      if (!updated) return;
    }
    setAssignmentState({
      assigneeName: currentLabAssignee.name,
      status: "reading",
      studyId: initialAssignment.studyId,
    });
  };
  const transitionFulfillment = (
    action: FulfillmentWorkItemAction,
    options?: FulfillmentTransitionOptions,
  ) =>
    fulfillmentWorkItem
      ? fulfillmentQueue.updateStatus(fulfillmentWorkItem.id, [
          { action, ...options },
        ])
      : Promise.resolve(false);
  const loadEligibleAssignees = () =>
    fulfillmentWorkItem
      ? loadFulfillmentEligibleAssigneesRoute({
          workItemId: fulfillmentWorkItem.id,
          workspaceId: fulfillmentWorkItem.workspaceId,
        })
      : Promise.resolve([]);
  const completeAssignment = async () => {
    if (fulfillmentWorkItem) {
      const transitionPath = getFulfillmentTransitionPath(
        fulfillmentWorkItem.status,
        "completed",
      );
      if (!transitionPath) return;
      const updated = await fulfillmentQueue.updateStatus(
        fulfillmentWorkItem.id,
        transitionPath,
      );
      if (!updated) return;
    }
    setAssignmentState((current) => ({
      assigneeName:
        current.studyId === initialAssignment.studyId
          ? current.assigneeName
          : currentLabAssignee.name,
      status: "completed",
      studyId: initialAssignment.studyId,
    }));
  };
  const cancelAssignment = async () => {
    if (fulfillmentWorkItem) {
      const transitionPath = getFulfillmentTransitionPath(
        fulfillmentWorkItem.status,
        "requested",
      );
      if (!transitionPath) return;
      const updated = await fulfillmentQueue.updateStatus(
        fulfillmentWorkItem.id,
        transitionPath,
      );
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
    }
  }, [queryImagingStudyId, selectImagingStudy, selectedImagingStudyId]);

  if (!detail) {
    const imagingWorkItemCount =
      fulfillmentQueue.summary?.totalCount ?? fulfillmentQueue.workItems.length;
    const hasImagingWorkItems = imagingWorkItemCount > 0;

    return (
      <div className="flex h-full items-center justify-center bg-[var(--emr-surface-workspace)] emr-text-dense text-muted-foreground">
        <EmrEmptyState
          kind={hasImagingWorkItems ? "no-scope-result" : "upstream-pending"}
          priority="supporting"
          size="xl"
          surface="content"
          description={
            hasImagingWorkItems
              ? "대기열에서 영상 업무를 선택하면 상세가 표시됩니다."
              : "오늘 표시할 영상 업무가 없습니다."
          }
          primaryAction={
            hasImagingWorkItems ? undefined : (
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
          title={
            hasImagingWorkItems
              ? "영상 대기열에서 항목을 선택해 주세요"
              : "영상 업무가 없습니다"
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] pb-2">
      <EmrInstructionHeaderStack
        chartAligned
        titleBar={
          <EmrInstructionTitleBar
            className="px-4"
            title="영상검사 Order 상세"
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
              <Badge
                variant="secondary"
                className="h-[22px] max-w-40 truncate rounded-md px-2 text-xs text-muted-foreground"
                title={getImagingDocumentId(detail.study)}
              >
                {getImagingDocumentId(detail.study)}
              </Badge>
            }
            actions={
              <>
                <Button variant="outline" size="sm" className="bg-card">
                  PACS
                </Button>
                {fulfillmentWorkItem ? (
                  <FulfillmentExecutionActions
                    workspaceId={fulfillmentWorkItem.workspaceId}
                    workItemId={fulfillmentWorkItem.id}
                    onSaved={fulfillmentQueue.refresh}
                    activityLabel="판독"
                    assignedToUserId={fulfillmentWorkItem.assignedToUserId}
                    completeLabel="판독완료"
                    loadEligibleAssignees={loadEligibleAssignees}
                    onTransition={transitionFulfillment}
                    startPhase="interpretation_in_progress"
                    status={fulfillmentWorkItem.status}
                  />
                ) : (
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
                )}
                <EmrInstructionOutputMenu />
              </>
            }
          />
        }
        orderInfo={
          <div data-slot="instruction-info-card" className="grid min-h-[72px] [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))] rounded-lg border border-border bg-card px-4 py-3">
            {[
              [
                "요청 일시",
                <span
                  key="requested-at"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  <span>{formatShortDateTime(detail.study.requestedAt)}</span>
                  <EmrStatusBadge
                    label={getStatusLabel("imagingStudy", detail.study.status)}
                    marker="none"
                    testId="imaging-study-status-label"
                  />
                </span>,
              ],
              [
                "검사",
                detail.order?.displayName ??
                  `${detail.study.modality} ${detail.study.bodyPart}`,
              ],
              ["Modality", detail.study.modality],
              ["촬영 부위", detail.study.bodyPart],
              [
                "요청 수의사",
                allowDemoContent
                  ? (getStaffName(detail.order?.requestedByUserId) ?? "이수지")
                  : fulfillmentWorkItem?.requesterName ??
                    getSnapshotString(
                      fulfillmentWorkItem?.sourceSnapshot,
                      "requestingVetName",
                      "정보 없음",
                    ),
              ],
              [
                "검사 담당",
                <span key="imaging-assignee" aria-live="polite">
                  {allowDemoContent
                    ? assignment.assigneeName
                    : fulfillmentWorkItem?.assignedToUserId
                      ? "담당자 지정됨"
                      : "미지정"}
                </span>,
              ],
            ].map(([label, value]) => (
              <div
                key={label as string}
                className="min-w-0 border-r border-border px-3 first:pl-0 last:border-r-0 last:pr-0"
              >
                <div className="emr-text-metadata font-medium text-muted-foreground">
                  {label}
                </div>
                <div className="mt-1 flex min-h-6 min-w-0 items-center emr-text-dense font-medium text-foreground">
                  {value}
                </div>
              </div>
            ))}
          </div>
        }
      />
      <ScrollArea
        data-slot="imaging-result-scroll-area"
        className="min-h-0 flex-1"
      >
        <div data-slot="instruction-result-scroll-content" className="flex flex-col gap-4 px-4 pb-10 pt-4">
          <section className="rounded-lg bg-[var(--emr-status-warning-bg)] px-4 py-3 emr-text-dense font-medium leading-5 text-[var(--emr-status-warning-text)]">
            병원 내 직원이 남긴 코멘트와 총괄 지시사항을 판독 전에 확인합니다.
          </section>
          <ImagingOrderDetailTable
            detail={detail}
            requesterName={allowDemoContent
              ? getStaffName(detail.order?.requestedByUserId) ?? "이수지"
              : fulfillmentWorkItem?.requesterName ??
                getSnapshotString(fulfillmentWorkItem?.sourceSnapshot, "requestingVetName", "정보 없음")}
            assigneeName={allowDemoContent
              ? assignment.assigneeName
              : fulfillmentWorkItem?.assignedToUserId ? "담당자 지정됨" : "미지정"}
          />
          <ImagingReadingSections
            study={detail.study}
            allowDemoContent={allowDemoContent}
          />
          <AttachmentStrip
            attachments={detail.attachments}
            allowDemoContent={allowDemoContent}
          />
        </div>
      </ScrollArea>
    </div>
  );
}

function ImagingMediaStrip({ attachments }: { attachments: EmrAttachment[] }) {
  const mediaAttachments = attachments.filter((attachment) =>
    attachment.mimeType.startsWith("image/"),
  );

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {mediaAttachments.map((attachment) => (
        <div
          key={attachment.id}
          className="w-[92px] shrink-0 overflow-hidden rounded-md border bg-card"
        >
          <div className="flex h-16 items-center justify-center bg-[linear-gradient(135deg,var(--emr-text-primary),var(--emr-text-secondary))] emr-text-metadata font-semibold text-[var(--emr-text-inverse)]">
            {attachment.mimeType.includes("png") ? "IMG" : "FILE"}
          </div>
          <div className="truncate px-2 py-1.5 emr-text-micro text-muted-foreground">
            {attachment.fileName}
          </div>
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
  const allowDemoContent =
    isLegacySalesDemoWorkspace(workspaceId) && !isLiveAuthRuntime();
  const { detail } = useCurrentImagingDetail(workspaceId);
  const labItems = useMemo(
    () => (isLegacySalesDemoWorkspace(workspaceId) ? getLabWorkItems() : []),
    [workspaceId],
  );
  const imagingItems = useMemo(
    () =>
      isLegacySalesDemoWorkspace(workspaceId) ? getImagingWorkItems() : [],
    [workspaceId],
  );

  if (!detail) return null;

  const sameEncounterLabItems = labItems.filter(
    (item) => item.encounter.id === detail.encounter.id,
  );
  const sameEncounterImagingItems = imagingItems.filter(
    (item) => item.encounter.id === detail.encounter.id,
  );
  const sameEncounterOrderCount =
    sameEncounterLabItems.length + sameEncounterImagingItems.length;
  const fileAttachments = detail.attachments.filter(
    (attachment) => !attachment.mimeType.startsWith("image/"),
  );

  return (
    <EmrRightPanel
      className="bg-[var(--emr-surface-rightpanel)]"
      data-testid="imaging-summary-panel"
      header={
        <EmrRightPanelHeader className="justify-between">
          <h2 className="min-w-0 truncate text-sm font-semibold">종합소견</h2>
          <Badge
            variant="secondary"
            className="h-5 rounded-md px-2 emr-text-micro text-muted-foreground"
          >
            {sameEncounterOrderCount}
          </Badge>
        </EmrRightPanelHeader>
      }
    >
      <EmrRightPanelBody>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-4 p-3">
            <section className="overflow-hidden rounded-lg border bg-card">
              <div className="flex h-10 items-center justify-between border-b px-3">
                <h3 className="emr-text-dense font-semibold">
                  같은 차트 내 Order
                </h3>
                <Badge
                  variant="outline"
                  className="h-5 rounded-md px-1.5 emr-text-micro"
                >
                  {sameEncounterOrderCount}
                </Badge>
              </div>
              <Table className="table-fixed emr-text-metadata">
                <TableBody>
                  {sameEncounterLabItems.map((item) => (
                    <TableRow key={item.result.id}>
                      <TableCell className="h-9 w-14 px-3 text-muted-foreground">
                        검사
                      </TableCell>
                      <TableCell className="h-9 px-3 font-medium">
                        {item.order?.displayName ?? item.result.resultName}
                      </TableCell>
                    </TableRow>
                  ))}
                  {sameEncounterImagingItems.map((item) => (
                    <TableRow key={item.study.id}>
                      <TableCell className="h-9 w-14 px-3 text-muted-foreground">
                        영상
                      </TableCell>
                      <TableCell className="h-9 px-3 font-medium">
                        {item.order?.displayName ??
                          `${item.study.modality} ${item.study.bodyPart}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            <section>
              <div className="emr-text-dense font-semibold">
                보호자 공유용 종합 코멘트
              </div>
              {allowDemoContent ? (
                <>
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
                </>
              ) : (
                <p className="mt-2 emr-text-dense text-muted-foreground">
                  공유용 종합 코멘트 저장은 아직 지원하지 않습니다. 판독 내용은
                  수행기록과 이력에서 확인해 주세요.
                </p>
              )}
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
                    <span className="truncate text-primary">
                      {attachment.fileName}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`${attachment.fileName} 삭제`}
                      disabled={!allowDemoContent}
                    >
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
      </EmrRightPanelBody>
      <EmrRightPanelFooter
        size="compact"
        className="grid grid-cols-2 gap-2 p-3"
      >
        <Button variant="outline" size="sm" className="bg-card" disabled={!allowDemoContent}>
          취소
        </Button>
        <Button size="sm" disabled={!allowDemoContent}>
          {allowDemoContent ? "저장" : "저장 미지원"}
        </Button>
      </EmrRightPanelFooter>
    </EmrRightPanel>
  );
}
