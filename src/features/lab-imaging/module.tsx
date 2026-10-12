"use client";

import { useModuleSidePanel, useModuleSidePanelSearchParams } from "@/components/emr/module-side-panel-context";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
} from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import {
  CdsActionsListFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsRefreshCcwIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsContentLink2Icon } from "@/components/cds-icons/content-and-editor";
import {
  CdsFilesFileIcon,
  CdsFilesImageIcon,
} from "@/components/cds-icons/files-and-layout";
import { CdsNavigationArrowDownIcon, CdsNavigationChevronsRightIcon } from "@/components/cds-icons/navigation";
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
import { useQueueViewPreference } from "@/features/work-queue/use-queue-view-preference";
import { PatientQueueContent, PatientQueueToggle, PatientQueueSortMenu, PatientQueueFilterMenu, type PatientQueueDisplayRow } from "@/components/emr/patient-queue";
import { comparePatientQueueRows, matchesPatientQueueFilter, type PatientQueueSort, type PatientQueueOrderSort } from "@/features/work-queue/patient-queue";
import { EmrOrderGroupSection } from "@/components/emr/order-group-section";
import {
  EmrEmptyState,
  EmrContentLoadingState,
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
import { EmrCopyLinkButton } from "@/components/emr/copy-link-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import { LabResultValueControl } from "./components/lab-result-value-control";
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
import { LabOverallFinding, LabResultHistoryDialog, LabResultRowDetail } from "@/features/lab-imaging/components/lab-result-phase2";
import { useLabAutosave } from "@/features/lab-imaging/lab-autosave";
import { useLabResultPhase2, type LabResultPhase2Data } from "@/features/lab-imaging/use-lab-result-phase2";
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
import { loadFulfillmentEligibleAssigneesRoute } from "@/features/fulfillment/client-eligible-assignees";
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
import {
  WorkspaceDocumentToolbar,
  WorkspaceDocumentWidthToggle,
  useWorkspaceDocumentLayout,
} from "@/shell/workspace-document-layout";
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

type ImagingReadingStatus = "requested" | "reading" | "completed";
type FulfillmentQueueType = "lab" | "imaging";
type FulfillmentTransitionCommand =
  | FulfillmentWorkItemAction
  | ({ action: FulfillmentWorkItemAction } & FulfillmentTransitionOptions);
type FulfillmentWorkItem = {
  assignedToDisplayName?: string | null;
  canManage?: boolean;
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
  status?: FulfillmentQueueReadStatus;
  workItems: FulfillmentWorkItem[];
};
type FulfillmentQueueReadStatus = "loading" | "ready" | "error" | "permission_denied";

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
      reason: "error" | "invalid" | "permission_denied" | "conflict";
      retryable: boolean;
    };

function getInitialImagingReadingStatus(
  status?: ImagingStudyStatus,
): ImagingReadingStatus {
  if (status === "read" || status === "reviewed") return "completed";
  if (status === "reading") return "reading";
  return "requested";
}

const fulfillmentQueueCache = new Map<string, FulfillmentQueueSnapshot>();
const fulfillmentQueueRequests = new Map<string, {
  controller: AbortController;
  promise: Promise<FulfillmentQueueSnapshot | null>;
}>();
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
  if (handoffPatient?.workspaceId === workItem.workspaceId && handoffPatient.id === workItem.patientId) return handoffPatient;

  const bridgedPatient = getStagingBridgeChartBundle(workItem)?.patient;
  if (getAuthRuntimeMode().authProvider === "mock" && isLegacySalesDemoWorkspace(workItem.workspaceId) && bridgedPatient) return bridgedPatient;

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
  const handoff = readChartLiveEncounterHandoff(
    workItem.encounterId,
  );
  const handoffGuardian = handoff?.primaryGuardian;
  if (handoff?.patient.id === workItem.patientId && handoffGuardian?.workspaceId === workItem.workspaceId) return handoffGuardian;

  const bridgedGuardian =
    getStagingBridgeChartBundle(workItem)?.primaryGuardian;
  if (getAuthRuntimeMode().authProvider === "mock" && isLegacySalesDemoWorkspace(workItem.workspaceId) && bridgedGuardian) return bridgedGuardian;

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
  options?: { enabled?: boolean; workItemId?: string },
) {
  const panelPresentation = useModuleSidePanel();
  const enabled = panelPresentation?.visible !== false && options?.enabled !== false;
  const workItemId = options?.workItemId;
  const workspaceId = useWorkspaceIdFromPath();
  const effectiveDate = selectedDate ?? "";
  const cacheKey = `${getFulfillmentQueueCacheKey(
    workspaceId,
    queueType,
    effectiveDate,
  )}:${workItemId ?? ""}`;
  const requestSeq = useRef(0);
  const [queueState, setQueueState] = useState<{
    cacheKey: string;
    snapshot: FulfillmentQueueSnapshot;
    status: FulfillmentQueueReadStatus;
  }>(() => ({ cacheKey, snapshot: emptyFulfillmentQueueSnapshot, status: "loading" }));
  const snapshot = queueState.cacheKey === cacheKey ? queueState.snapshot : emptyFulfillmentQueueSnapshot;
  const status = queueState.cacheKey === cacheKey ? queueState.status : "loading";

  const loadQueueSnapshot = useCallback((): Promise<FulfillmentQueueSnapshot | null> => {
    const pending = fulfillmentQueueRequests.get(cacheKey);
    if (pending && !pending.controller.signal.aborted) return pending.promise;
    const controller = new AbortController();
    const previousSnapshot = fulfillmentQueueCache.get(cacheKey);
    const promise = (async (): Promise<FulfillmentQueueSnapshot | null> => {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceId}/fulfillment/work-items?queueType=${queueType}${effectiveDate ? `&date=${encodeURIComponent(effectiveDate)}` : ""}${workItemId ? `&workItemId=${encodeURIComponent(workItemId)}` : ""}`,
          { headers: { "x-clair-demo-session-user-id": "user-tech" }, signal: controller.signal },
        );
        if (response.status === 401 || response.status === 403) {
          return { ...emptyFulfillmentQueueSnapshot, status: "permission_denied" };
        }
        const body = await response.json() as { ok?: boolean; denialReason?: string; summary?: FulfillmentWorkItemReadSummary; workItems?: FulfillmentWorkItem[] };
        if (!response.ok || !body.ok || !Array.isArray(body.workItems)) {
          const denied = response.status === 401 || response.status === 403 || body.denialReason === "unauthenticated" || body.denialReason === "permission_missing";
          return { ...(denied ? emptyFulfillmentQueueSnapshot : previousSnapshot ?? emptyFulfillmentQueueSnapshot), status: denied ? "permission_denied" : "error" };
        }
        return { summary: body.summary, workItems: body.workItems, status: "ready" };
      } catch {
        if (controller.signal.aborted) return null;
        return { ...(previousSnapshot ?? emptyFulfillmentQueueSnapshot), status: "error" };
      }
    })().then((nextSnapshot) => {
      if (controller.signal.aborted) return null;
      if (nextSnapshot) setCachedFulfillmentQueue(cacheKey, nextSnapshot);
      return nextSnapshot;
    }).finally(() => {
      if (fulfillmentQueueRequests.get(cacheKey)?.controller === controller) fulfillmentQueueRequests.delete(cacheKey);
    });
    fulfillmentQueueRequests.set(cacheKey, { controller, promise });
    return promise;
  }, [cacheKey, effectiveDate, queueType, workItemId, workspaceId]);

  const load = useCallback(async () => {
    if (!fulfillmentQueueListeners.get(cacheKey)?.size) return;
    const seq = ++requestSeq.current;
    const nextSnapshot = await loadQueueSnapshot();
    if (!nextSnapshot) return;
    if (seq === requestSeq.current) {
      setQueueState({ cacheKey, snapshot: nextSnapshot, status: nextSnapshot.status ?? "ready" });
    }
  }, [cacheKey, loadQueueSnapshot]);

  const refresh = useCallback(() => {
    // Explicit retries and post-mutation/realtime reads must not reuse a pre-mutation read.
    fulfillmentQueueRequests.get(cacheKey)?.controller.abort();
    fulfillmentQueueRequests.delete(cacheKey);
    setQueueState(current => ({ cacheKey, snapshot: current.cacheKey === cacheKey ? current.snapshot : emptyFulfillmentQueueSnapshot, status: "loading" }));
    return load();
  }, [cacheKey, load]);

  useEffect(() => {
    if (!enabled) return;
    const listener = (nextSnapshot: FulfillmentQueueSnapshot) =>
      setQueueState({ cacheKey, snapshot: nextSnapshot, status: nextSnapshot.status ?? "ready" });
    const listeners = fulfillmentQueueListeners.get(cacheKey) ?? new Set();
    listeners.add(listener);
    fulfillmentQueueListeners.set(cacheKey, listeners);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        fulfillmentQueueListeners.delete(cacheKey);
        fulfillmentQueueRequests.get(cacheKey)?.controller.abort();
        fulfillmentQueueRequests.delete(cacheKey);
        fulfillmentQueueCache.delete(cacheKey);
      }
    };
  }, [cacheKey, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void load();
    return () => { requestSeq.current += 1; };
  }, [enabled, load]);

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

    if (response.status === 409) {
      return { ok: false, reason: "conflict", retryable: false,
        message: "다른 수정이 저장됐습니다. 입력을 확인한 뒤 새로고침해 주세요." };
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
      message: "저장 실패: 결과를 저장하지 못했습니다.",
      ok: false,
      reason: "error",
      retryable: true,
    };
  } catch {
    return {
      message: "저장 실패: 네트워크 오류로 저장하지 못했습니다.",
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
      technicianName: workItem.assignedToUserId ? workItem.assignedToDisplayName ?? getStaffName(workItem.assignedToUserId) ?? "확인 불가" : undefined,
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
      radiologistName: workItem.assignedToUserId ? workItem.assignedToDisplayName ?? getStaffName(workItem.assignedToUserId) ?? "확인 불가" : undefined,
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
        technicianName: workItem.assignedToDisplayName ?? undefined,
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
        radiologistName: workItem.assignedToDisplayName ?? undefined,
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

function getPatientQueueRows(items: Array<LabWorkItem | ImagingWorkItem>, workItems: FulfillmentWorkItem[]): PatientQueueDisplayRow[] {
  const source = new Map(workItems.map(work => [`live-${work.queueType === "lab" ? "lab" : "imaging"}-${work.id}`, work]));
  const byOrder = getWorkItemsByOrderId(workItems);
  return items.map(item => {
    const isLab = "result" in item;
    const id = isLab ? item.result.id : item.study.id;
    const work = source.get(id) ?? (item.order ? byOrder.get(item.order.id) : undefined);
    const card = isLab
      ? getLabTaskQueueCardItem({ item, testId: `lab-queue-item-${id}`, actionTestId: `lab-queue-item-action-${id}` })
      : getImagingTaskQueueCardItem({ item, testId: `imaging-queue-item-${id}`, actionTestId: `imaging-queue-item-action-${id}` });
    const requestedAt = work?.createdAt ?? item.order?.requestedAt;
    return { id, card, assigneeSortName: card.assigneeName, assignedToUserId: work ? work.assignedToUserId : item.order?.currentAssigneeUserId, patientId: work ? work.patientId : item.patient.id, workspaceId: work?.workspaceId ?? item.patient.workspaceId,
      status: work?.status ?? item.order?.status ?? (isLab ? item.result.status : item.study.status), priority: work?.priority ?? item.order?.priority,
      requestedAt, originChartId: work?.originChartId, originChartCreatedAt: work?.originChartCreatedAt,
      waitMinutes: requestedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(requestedAt)) / 60000)) : 0 };
  });
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
  const panelPresentation = useModuleSidePanel();
  const passivePanel = Boolean(panelPresentation && (!panelPresentation.isCurrentModule || !panelPresentation.visible));
  const searchParams = useModuleSidePanelSearchParams();
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
  const [patientView, setPatientView, viewPreferenceReady] = useQueueViewPreference(workspaceId, "lab");
  const [patientSort, setPatientSort] = useState<PatientQueueSort>("priority");
  const [patientOrderSort, setPatientOrderSort] = useState<PatientQueueOrderSort>("request");
  const [orderSortSelected, setOrderSortSelected] = useState(false);
  const [patientFilter, setPatientFilter] = useState("all");
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fulfillmentQueue = useFulfillmentQueue("lab", selectedDate);
  useQueueRealtimeRefresh({
    enabled: panelPresentation?.visible !== false,
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
    if (passivePanel) return;
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
  }, [passivePanel, items, queryLabResultId, selectLabResult, selectedLabResultId]);
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
    const href = buildWorkspaceSurfaceRoute({
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
      });
    if (!panelPresentation || panelPresentation.isCurrentModule) {
      selectDate(date);
      selectLabResult("");
    }
    if (panelPresentation) panelPresentation.onDateChange(href);
    else onNavigateWorkspaceSurface?.(href, "lab");
  }
  const effectiveSelectedLabResultId = items.some(
    (item) => item.result.id === selectedLabResultId,
  )
    ? selectedLabResultId
    : undefined;
  const patientRows = useMemo(() => getPatientQueueRows(items, fulfillmentQueue.workItems), [items, fulfillmentQueue.workItems]);
  const patientRowsById = useMemo(() => new Map(patientRows.map(row => [row.id, row])), [patientRows]);
  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        matchesQueueSearch(getLabWorkItemSearchText(item), searchQuery) && matchesPatientQueueFilter(patientRowsById.get(item.result.id)!, patientFilter),
      ),
    [items, searchQuery, patientRowsById, patientFilter],
  );
  const visiblePatientRows = useMemo(() => { const ids = new Set(filteredItems.map(item => item.result.id)); return patientRows.filter(row => ids.has(row.id)); }, [filteredItems, patientRows]);
  const groups = useMemo(
    () =>
      labStatusOrder
        .map((status) => ({
          status,
          items: filteredItems.filter((item) => item.result.status === status).sort((left, right) => orderSortSelected ? comparePatientQueueRows(patientRowsById.get(left.result.id)!, patientRowsById.get(right.result.id)!, patientOrderSort) : 0),
        }))
        .filter((group) => group.items.length > 0),
    [filteredItems, patientRowsById, patientOrderSort, orderSortSelected],
  );
  const resultCount = filteredItems.length;
  const sourceItemCount = fulfillmentQueue.summary?.totalCount ?? items.length;
  const sourceHasItems = sourceItemCount > 0;
  const queueControlsDisabled = !sourceHasItems && patientFilter === "all";
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
          <>
            <PatientQueueToggle active={patientView} disabled={!viewPreferenceReady || queueControlsDisabled || fulfillmentQueue.status === "permission_denied"} onChange={() => {
              if (patientView && effectiveSelectedLabResultId) { const selected = items.find(item => item.result.id === effectiveSelectedLabResultId); if (selected) setCollapsedStatusIds(current => { const next = new Set(current); next.delete(selected.result.status); return next; }); }
              setPatientView(current => !current);
            }} />
            <PatientQueueSortMenu orderSort={patientView || orderSortSelected ? patientOrderSort : undefined} onOrderSort={sort => { setPatientOrderSort(sort); setOrderSortSelected(true); }} groupSort={patientView ? patientSort : undefined} onGroupSort={patientView ? setPatientSort : undefined} disabled={queueControlsDisabled} /><PatientQueueFilterMenu value={patientFilter} onChange={setPatientFilter} disabled={queueControlsDisabled} /><EmrListHeaderIconButton ariaLabel="검색" onClick={() => setSearchActive(true)}><CdsActionsSearchIcon className="size-4" /></EmrListHeaderIconButton>
          </>
        }
      />
      <EmrSubpanelBody density="queue">
        {fulfillmentQueue.status === "error" ? <EmrQueueEmptyState
          kind="read-error" placement="panel-center" title="업무 대기열을 불러오지 못했습니다"
          primaryAction={<Button variant="outline" size="sm" onClick={() => { void fulfillmentQueue.refresh(); }}>재시도</Button>}
        /> : <PatientQueueContent key={`${workspaceId}:${selectedDate}`} active={patientView} allRows={patientRows} rows={visiblePatientRows} selectedId={effectiveSelectedLabResultId} groupSort={patientSort} orderSort={patientOrderSort} onSelect={handleSelectLabResult} onClearConditions={() => { setPatientFilter("all"); closeSearch(); }} readable={fulfillmentQueue.status !== "permission_denied"} ready={fulfillmentQueue.status === "ready"}>

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
        </PatientQueueContent>}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

export function ImagingSidePanel({
  onNavigateWorkspaceSurface,
  workspaceId,
}: ShellComponentProps) {
  const panelPresentation = useModuleSidePanel();
  const passivePanel = Boolean(panelPresentation && (!panelPresentation.isCurrentModule || !panelPresentation.visible));
  const searchParams = useModuleSidePanelSearchParams();
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
  const [patientView, setPatientView, viewPreferenceReady] = useQueueViewPreference(workspaceId, "imaging");
  const [patientSort, setPatientSort] = useState<PatientQueueSort>("priority");
  const [patientOrderSort, setPatientOrderSort] = useState<PatientQueueOrderSort>("request");
  const [orderSortSelected, setOrderSortSelected] = useState(false);
  const [patientFilter, setPatientFilter] = useState("all");
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const fulfillmentQueue = useFulfillmentQueue("imaging", selectedDate);
  useQueueRealtimeRefresh({
    enabled: panelPresentation?.visible !== false,
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
    if (passivePanel) return;
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
  }, [passivePanel, items, queryImagingStudyId, selectImagingStudy, selectedImagingStudyId]);
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
    const href = buildWorkspaceSurfaceRoute({
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
      });
    if (!panelPresentation || panelPresentation.isCurrentModule) {
      selectDate(date);
      selectImagingStudy("");
    }
    if (panelPresentation) panelPresentation.onDateChange(href);
    else onNavigateWorkspaceSurface?.(href, "imaging");
  }
  const effectiveSelectedImagingStudyId = items.some(
    (item) => item.study.id === selectedImagingStudyId,
  )
    ? selectedImagingStudyId
    : undefined;
  const patientRows = useMemo(() => getPatientQueueRows(items, fulfillmentQueue.workItems), [items, fulfillmentQueue.workItems]);
  const patientRowsById = useMemo(() => new Map(patientRows.map(row => [row.id, row])), [patientRows]);
  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        matchesQueueSearch(getImagingWorkItemSearchText(item), searchQuery) && matchesPatientQueueFilter(patientRowsById.get(item.study.id)!, patientFilter),
      ),
    [items, searchQuery, patientRowsById, patientFilter],
  );
  const visiblePatientRows = useMemo(() => { const ids = new Set(filteredItems.map(item => item.study.id)); return patientRows.filter(row => ids.has(row.id)); }, [filteredItems, patientRows]);
  const groups = useMemo(
    () =>
      imagingStatusOrder
        .map((status) => ({
          status,
          items: filteredItems.filter((item) => item.study.status === status).sort((left, right) => orderSortSelected ? comparePatientQueueRows(patientRowsById.get(left.study.id)!, patientRowsById.get(right.study.id)!, patientOrderSort) : 0),
        }))
        .filter((group) => group.items.length > 0),
    [filteredItems, patientRowsById, patientOrderSort, orderSortSelected],
  );
  const resultCount = filteredItems.length;
  const sourceItemCount = fulfillmentQueue.summary?.totalCount ?? items.length;
  const sourceHasItems = sourceItemCount > 0;
  const queueControlsDisabled = !sourceHasItems && patientFilter === "all";
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
          <>
            <PatientQueueToggle active={patientView} disabled={!viewPreferenceReady || queueControlsDisabled || fulfillmentQueue.status === "permission_denied"} onChange={() => {
              if (patientView && effectiveSelectedImagingStudyId) { const selected = items.find(item => item.study.id === effectiveSelectedImagingStudyId); if (selected) setCollapsedStatusIds(current => { const next = new Set(current); next.delete(selected.study.status); return next; }); }
              setPatientView(current => !current);
            }} />
            <PatientQueueSortMenu orderSort={patientView || orderSortSelected ? patientOrderSort : undefined} onOrderSort={sort => { setPatientOrderSort(sort); setOrderSortSelected(true); }} groupSort={patientView ? patientSort : undefined} onGroupSort={patientView ? setPatientSort : undefined} disabled={queueControlsDisabled} /><PatientQueueFilterMenu value={patientFilter} onChange={setPatientFilter} disabled={queueControlsDisabled} /><EmrListHeaderIconButton ariaLabel="검색" onClick={() => setSearchActive(true)}><CdsActionsSearchIcon className="size-4" /></EmrListHeaderIconButton>
          </>
        }
      />
      <EmrSubpanelBody density="queue">
        {fulfillmentQueue.status === "error" ? <EmrQueueEmptyState
          kind="read-error" placement="panel-center" title="업무 대기열을 불러오지 못했습니다"
          primaryAction={<Button variant="outline" size="sm" onClick={() => { void fulfillmentQueue.refresh(); }}>재시도</Button>}
        /> : <PatientQueueContent key={`${workspaceId}:${selectedDate}`} active={patientView} allRows={patientRows} rows={visiblePatientRows} selectedId={effectiveSelectedImagingStudyId} groupSort={patientSort} orderSort={patientOrderSort} onSelect={handleSelectImagingStudy} onClearConditions={() => { setPatientFilter("all"); closeSearch(); }} readable={fulfillmentQueue.status !== "permission_denied"} ready={fulfillmentQueue.status === "ready"}>

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
        </PatientQueueContent>}
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
  routeResultId,
  search,
  staffInstruction,
  catalogStatus = "idle",
  emptyRowsKind = "no-data",
  onCatalogRetry,
  onSave,
  phase2,
  phase2Status,
  onPhase2Refresh,
  result,
}: {
  assigneeName: string;
  routeResultId: string;
  search: string;
  staffInstruction?: string;
  catalogStatus?: LabResultSheetCatalogStatus;
  emptyRowsKind?: Extract<EmrEmptyStateKind, "no-data" | "upstream-pending">;
  onCatalogRetry?: () => void;
  onSave?: (
    rows: LabResultRow[],
    requestId: string,
    expectedRevision: number,
  ) => Promise<LabResultSaveOutcome>;
  phase2: LabResultPhase2Data | null;
  phase2Status: "loading" | "ready" | "error" | "permission_denied";
  onPhase2Refresh: () => void;
  result: LabResult;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [density, setDensity] = useState<EmrTableDensity>("standard");
  const autosave = useLabAutosave<LabResultRow[]>(
    `${result.workspaceId}:${result.id}:rows`,
    async (snapshot, requestId, expectedRevision) => {
      if (!onSave) return { ok: false, reason: "permission_denied", message: "저장 권한이 없습니다.", retryable: false };
      const outcome = await onSave(snapshot, requestId, expectedRevision);
      return outcome.ok ? { ok: true, revision: outcome.entryWriteRevision } : outcome;
    },
    result.entryWriteRevision ?? 0,
    snapshot => snapshot.some(row => row.interpretationRule && !evaluateLabProfileValue(row.interpretationRule, {
      value: row.value ?? null, qualifier: row.qualifier, deviceFlag: row.deviceFlag, resultState: row.resultPresence,
    }).valid) ? "선택한 프로필의 값 형식과 결과 상태를 확인해 주세요." : null,
  );
  const currentSaveState = autosave.state.value;
  const rows = useMemo(() => (autosave.state.draft ?? result.rows).map(row => {
    const evaluation = row.interpretationRule ? evaluateLabProfileValue(row.interpretationRule, {
      value: row.value ?? null, qualifier: row.qualifier, deviceFlag: row.deviceFlag, resultState: row.resultPresence,
    }) : null;
    return { ...row, judgment: getDerivedLabJudgment(row, row.value ?? ""),
      resultState: evaluation?.valid ? evaluation.state : row.resultState };
  }), [autosave.state.draft, result.rows]);
  const queueChange = autosave.change;
  const measurementDrafts = useRef<{ resultId: string; rows: Map<string, Pick<LabResultRow, "value" | "qualifier" | "deviceFlag">> }>({ resultId: result.id, rows: new Map() });
  const handleMetadataChange = useCallback((rowId: string, patch: Partial<LabResultRow>) => {
    if (measurementDrafts.current.resultId !== result.id) measurementDrafts.current = { resultId: result.id, rows: new Map() };
    queueChange(rows.map(row => {
      if (row.id !== rowId) return row;
      if (patch.resultPresence === "instrument_no_result") {
        if (row.resultPresence !== "instrument_no_result") measurementDrafts.current.rows.set(row.id, {
          value: row.value, qualifier: row.qualifier, deviceFlag: row.deviceFlag,
        });
        return { ...row, ...patch, value: undefined, qualifier: "exact", deviceFlag: undefined };
      }
      if (patch.resultPresence === "value" && row.resultPresence === "instrument_no_result") {
        const previous = measurementDrafts.current.rows.get(row.id);
        measurementDrafts.current.rows.delete(row.id);
        return { ...row, ...patch, ...previous };
      }
      return { ...row, ...patch };
    }));
  }, [queueChange, rows, result.id]);
  const handleValueChange = useCallback((rowId: string, value: string) => {
    queueChange(rows.map(row => row.id === rowId ? { ...row, value } : row));
  }, [queueChange, rows]);
  const abnormalRows = rows.filter(
    (row) => row.judgment !== "normal" && row.judgment !== "not_judged",
  );
  const notJudgedRows = rows.filter(row => row.judgment === "not_judged");
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

  return (
    <div className="flex flex-col gap-2" onBlurCapture={autosave.flush}>
    <EmrOrderGroupSection
      className="lab-result-sheet-order-group [&>section]:px-4 [&>section]:pt-3 [&>section]:!pb-3 [&>section>div:first-child]:h-7 [&>section>div:first-child]:px-0 [&>section>div:first-child]:py-0"
      title={`${result.resultName} 세트`}
      titleClassName="emr-text-body font-medium leading-5"
      count={rows.length}
      meta={
        abnormalRows.length > 0 ? (
          <span className="emr-text-metadata font-medium text-destructive">
            비정상 {abnormalRows.length}
          </span>
        ) : notJudgedRows.length ? (
          <span className="emr-text-metadata font-medium text-muted-foreground">미판정 {notJudgedRows.length}</span>
        ) : (
          <span className="emr-text-metadata font-medium text-muted-foreground">
            정상 범위
          </span>
        )
      }
      actions={
        <>
          <EmrTableDensitySelector value={density} onValueChange={setDensity} className="h-7 min-h-7 w-[82px] rounded-[8px] px-2 py-1 text-xs leading-4 tracking-[0.3px] [&>svg]:!size-3" />
          <Button variant="outline" size="sm" className="h-7 w-[79px] gap-1 rounded-[8px] px-2 text-xs leading-4 tracking-[0.3px]" disabled={!phase2} onClick={() => setHistoryOpen(true)}>
            <CdsUtilitiesHistoryIcon className="!size-3" aria-hidden="true" />수정이력
          </Button>
          <LabResultTableLinkButton
            date={getOperatingDateFromIso(result.enteredAt ?? result.receivedAt ?? result.collectedAt) ?? new URLSearchParams(search).get("date") ?? undefined}
            resultId={routeResultId}
            search={search}
            workspaceId={result.workspaceId}
          />
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
        {phase2Status === "error" || phase2Status === "permission_denied" ? <div role="alert" className="mb-3 flex items-center justify-between gap-2 rounded-md border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] px-3 py-2 emr-text-metadata text-[var(--emr-status-danger-text)]">
          <span>{phase2Status === "permission_denied" ? "소견과 첨부자료를 볼 권한이 없습니다." : "소견과 첨부자료를 불러오지 못했습니다."}</span>
          {phase2Status === "error" ? <Button variant="outline" size="xs" onClick={onPhase2Refresh}>다시 불러오기</Button> : null}
        </div> : null}
        <LabResultDataTable
          assigneeName={assigneeName}
          staffInstruction={staffInstruction}
          density={density}
          persistedResult={result}
          emptyRowsKind={emptyRowsKind}
          initialLoading={catalogStatus === "loading" && rows.length === 0}
          onMetadataChange={handleMetadataChange}
          onValueChange={handleValueChange}
          expandedRowId={expandedRowId}
          onExpandedRowChange={setExpandedRowId}
          phase2={phase2}
          phase2Status={phase2Status}
          onPhase2Refresh={onPhase2Refresh}
          rows={rows}
        />
        <LabResultHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} result={result} events={phase2?.events ?? []} />
      </div>
    </EmrOrderGroupSection>
    {currentSaveState !== "idle" ? <div className="flex min-h-7 flex-wrap items-center justify-end gap-2 px-4">
      <span role="status" data-testid="lab-result-save-status" className={cn("emr-text-metadata font-medium",
        ["error", "invalid", "permission_denied", "conflict"].includes(currentSaveState) ? "text-destructive" : "text-muted-foreground"
      )}>{autosave.state.message}</span>
      {autosave.state.retryable ? <Button variant="outline" size="xs" data-testid="lab-result-save-retry-button" onClick={autosave.retry}>재시도</Button> : null}

    </div> : null}
    </div>
  );
}

function LabResultTableLinkButton({ date, resultId, search, workspaceId }: {
  date?: string;
  resultId: string;
  search: string;
  workspaceId: string;
}) {
  const copyLink = async () => {
    const route = buildWorkspaceSurfaceRoute({
      moduleId: "lab",
      params: { date, labResultId: resultId },
      removeParams: ["scenario", "patientId", "encounterId", "queueItemId", "workItemId", "labResultId", "imagingStudyId", "invoiceId", "orderId", "taskId", "historyEncounterId", "drawer", "context"],
      search,
      workspaceId,
    });
    const url = new URL(route, window.location.origin);
    url.hash = "lab-result-table";
    try {
      await navigator.clipboard.writeText(url.href);
      toast.success("결과표 링크를 복사했어요.");
    } catch {
      toast.error("결과표 링크를 복사하지 못했어요.");
    }
  };

  return <Button type="button" variant="outline" size="sm" className="h-7 w-[82px] gap-1 rounded-[8px] px-2 text-xs leading-4 tracking-[0.3px]"
    aria-label="검사 결과표 링크 복사" onClick={() => void copyLink()}>
    <CdsContentLink2Icon className="!size-3" aria-hidden="true" />링크 복사
  </Button>;
}

type LabResultTableContext = {
  assigneeName: string;
  canEdit: boolean;
  canRequestRetest: boolean;
  persistedResult: LabResult;
  expandedRowId: string | null;
  onExpandedRowChange: (rowId: string | null) => void;
  onValueChange: (rowId: string, value: string) => void;
  onMetadataChange: (rowId: string, patch: Partial<LabResultRow>) => void;
};

function LabResultDataTable({
  assigneeName,
  staffInstruction,
  density,
  emptyRowsKind,
  initialLoading,
  onValueChange,
  onMetadataChange,
  persistedResult,
  expandedRowId,
  onExpandedRowChange,
  phase2,
  phase2Status,
  onPhase2Refresh,
  rows,
}: {
  assigneeName: string;
  staffInstruction?: string;
  density: EmrTableDensity;
  emptyRowsKind: Extract<EmrEmptyStateKind, "no-data" | "upstream-pending">;
  initialLoading: boolean;
  onValueChange: (rowId: string, value: string) => void;
  onMetadataChange: (rowId: string, patch: Partial<LabResultRow>) => void;
  persistedResult: LabResult;
  expandedRowId: string | null;
  onExpandedRowChange: (rowId: string | null) => void;
  phase2: LabResultPhase2Data | null;
  phase2Status: "loading" | "ready" | "error" | "permission_denied";
  onPhase2Refresh: () => void;
  rows: LabResultRow[];
}) {
  const tableAnchorRef = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  useEffect(() => {
    const viewport = tableAnchorRef.current?.querySelector<HTMLDivElement>('[data-slot="table-container"]');
    if (!viewport) return;
    // Observe the viewport content box, excluding its existing padding.
    const observer = new ResizeObserver(([entry]) => {
      setAvailableWidth(entry.contentRect.width);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const columns = useMemo<ColumnDef<LabResultRow, unknown>[]>(
    () => [
      {
        id: "disclosure",
        size: 24,
        minSize: 24,
        maxSize: 24,
        enableSorting: false,
        enableResizing: false,
        header: () => <span className="sr-only">검사 소견</span>,
        meta: { label: "소견 펼치기", resize: "none", align: "center", cellPadding: "none" },
        cell: ({ row, table }) => {
          const { expandedRowId, onExpandedRowChange } = table.options.meta as LabResultTableContext;
          const expanded = expandedRowId === row.original.id;
          return <Button type="button" variant="ghost" size="icon-xs" className="mx-auto rounded-[6px] bg-transparent aria-expanded:bg-transparent" aria-expanded={expanded}
            aria-controls={`lab-result-detail-${row.original.id}`} aria-label={`${row.original.analyteName} 검사 소견 ${expanded ? "접기" : "펼치기"}`}
            onClick={() => onExpandedRowChange(expanded ? null : row.original.id)}>
            <CdsNavigationArrowDownIcon className={cn("!size-3.5", expanded && "rotate-180")} aria-hidden="true" />
          </Button>;
        },
      },
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
        cell: ({ row, table }) => {
          const { persistedResult, canRequestRetest } = table.options.meta as LabResultTableContext;
          const savedRow = persistedResult.rows.find((saved) => saved.id === row.original.id);
          return (
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate font-medium">{row.original.analyteName}</span>
              {persistedResult.resultDefinitionOrigin === "canonical" && savedRow &&
              (savedRow.value?.trim() || savedRow.resultPresence === "instrument_no_result") ? (
                <AtomicLabRetestAction result={persistedResult} row={savedRow} disabled={!canRequestRetest} />
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
        cell: ({ row, table }) => {
          const { canEdit, onValueChange, onMetadataChange } = table.options.meta as LabResultTableContext;
          return <LabResultValueControl disabled={!canEdit} row={row.original} onValueChange={onValueChange} onMetadataChange={onMetadataChange} />;
        },
      },
      {
        id: "measurementUnavailable",
        size: 88,
        minSize: 80,
        enableSorting: false,
        enableResizing: false,
        header: "측정 불가",
        meta: { align: "center", label: "측정 불가", resize: "none" },
        cell: ({ row, table }) => {
          const { canEdit, onMetadataChange } = table.options.meta as LabResultTableContext;
          return row.original.interpretationRule ? <EmrTableCheckbox
            aria-label={`${row.original.analyteName} 측정 불가`}
            disabled={!canEdit}
            checked={row.original.resultPresence === "instrument_no_result"}
            onCheckedChange={checked => onMetadataChange(row.original.id, { resultPresence: checked ? "instrument_no_result" : "value" })}
          /> : null;
        },
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
        size: 254,
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
              size="md"
              className={cn("rounded-[6px]", judgmentBadgeClassName[row.original.judgment])}
            >
              {getStatusLabel("labJudgment", row.original.judgment)}
            </Badge>
          </div>
        ),
      },
      {
        id: "assignee",
        size: 160,
        minSize: 100,
        enableSorting: false,
        enableResizing: false,
        header: "담당자",
        meta: { label: "담당자", resize: "none" },
        cell: ({ table }) => {
          const { assigneeName } = table.options.meta as LabResultTableContext;
          return <Avatar size="sm" title={assigneeName} aria-label={assigneeName}>
            <AvatarFallback>{assigneeName.slice(0, 2)}</AvatarFallback>
          </Avatar>;
        },
      },
    ],
    [],
  );
  const columnSizing = useMemo<ColumnSizingState>(() => {
    const preferredWidth = columns.reduce((total, column) => total + column.size!, 0);
    if (!availableWidth || availableWidth >= preferredWidth) return {};
    const minimumWidth = columns.reduce((total, column) => total + column.minSize!, 0);
    const ratio = Math.max(0, (availableWidth - minimumWidth) / (preferredWidth - minimumWidth));
    return Object.fromEntries(columns.map(column => [
      column.id!,
      column.minSize! + (column.size! - column.minSize!) * ratio,
    ]));
  }, [availableWidth, columns]);
  // TanStack Table owns the result grid controller.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    columns,
    // Stable cell renderers retain input focus during autosave.
    meta: { assigneeName, canEdit: phase2?.canEdit === true, canRequestRetest: phase2?.canRequestRetest ?? phase2?.canEdit === true, persistedResult, expandedRowId, onExpandedRowChange, onValueChange, onMetadataChange } satisfies LabResultTableContext,
    data: rows,
    enableColumnResizing: false,
    enableSorting: false,
    state: { columnSizing },
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <div ref={tableAnchorRef} id="lab-result-table" data-testid="lab-result-table-anchor" tabIndex={-1} className="lab-result-sheet-table-anchor mt-3 scroll-mt-2 outline-none [&_[data-slot=table-head][data-column-id=disclosure]_[data-emr-table-content]]:sr-only">
    <EmrDataTable
      aria-label="임상병리 검사 결과 입력"
      className="table-fixed"
      containerClassName="overflow-x-auto overflow-y-hidden rounded-lg bg-[var(--emr-surface-muted)] px-2 pb-2 pt-1"
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
      renderAfterRow={(tableRow) => expandedRowId === tableRow.original.id ? (
        <TableRow className="border-border bg-[var(--emr-surface-muted)] hover:bg-[var(--emr-surface-muted)]">
          <TableCell colSpan={tableRow.getVisibleCells().length} className="!p-0">
            <div id={`lab-result-detail-${tableRow.original.id}`} className={tableRow.original.id === rows.at(-1)?.id ? "overflow-hidden rounded-b-[6px]" : undefined}>
              <LabResultRowDetail result={persistedResult} row={tableRow.original} staffInstruction={staffInstruction} finding={tableRow.original.note ?? ""}
                onFindingChange={value => onMetadataChange(tableRow.original.id, { note: value })}
                phase2={phase2} readStatus={phase2Status} refresh={onPhase2Refresh} />
            </div>
          </TableCell>
        </TableRow>
      ) : null}
      skeletonRowCount={5}
      table={table}
      viewportMode="content"
      getRowProps={(row) => ({
        className: expandedRowId === row.original.id ? "!border-b-0 [&>[data-slot=table-cell]]:!border-b-0" : undefined,
        "data-testid": "lab-result-row-" + row.original.id,
      })}
    />
    </div>
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

  if (!range) {
    return <span className="text-muted-foreground">{row.referenceRange ?? "참고범위 없음"}</span>;
  }

  if (!row.value?.trim() || row.judgment === "not_judged") {
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
  title = "첨부자료",
}: {
  attachments: EmrAttachment[];
  showImageExample?: boolean;
  allowDemoContent?: boolean;
  title?: string;
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
          <h2 className="emr-text-body font-semibold">{title}</h2>
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
  const { selectedDate } = useSelectedOperatingDate(workspaceId, searchParams.get("date"));
  const queue = useFulfillmentQueue("lab", selectedDate);
  const resultId = searchParams.get("labResultId") ?? getDemoScenarioFromParams(searchParams)?.labResultId ?? selectedLabResultId;
  const workItemId = resultId?.startsWith("live-lab-") ? resultId.slice("live-lab-".length) : undefined;
  // A shared link can select a result outside the current date. Read that item only.
  const needsSelectedItem = Boolean(workItemId && queue.status === "ready" && !queue.workItems.some((item) => item.id === workItemId));
  const selectedItem = useFulfillmentQueue("lab", undefined, { workItemId, enabled: needsSelectedItem });
  const fulfillmentQueue = needsSelectedItem ? selectedItem : queue;

  return {
    ...getLabDetailFromSearchParams(
      searchParams,
      selectedLabResultId,
      fulfillmentQueue.workItems,
      { allowMockFallback: isLegacySalesDemoWorkspace(workspaceId) },
    ),
    status: isLegacySalesDemoWorkspace(workspaceId) ? "ready" as const : fulfillmentQueue.status,
    retry: fulfillmentQueue.refresh,
  };
}

// Share the mounted slot owner's read; the receipt's local UI still resets on close.
const LabCurrentDetailContext = createContext<ReturnType<typeof useCurrentLabDetail> | null>(null);

export function LabSlotAvailabilityProvider({
  children,
  workspaceId,
}: WorkspaceSlotAvailabilityProviderProps) {
  const currentDetail = useCurrentLabDetail(workspaceId);
  const hasSelectedDetail = Boolean(currentDetail.detail);

  return (
    <LabCurrentDetailContext.Provider value={currentDetail}>
      {children({
        hasContentAside: hasSelectedDetail,
        hasRightPanel: hasSelectedDetail,
      })}
    </LabCurrentDetailContext.Provider>
  );
}

export function LabHeader({ workspaceId }: ShellComponentProps) {
  const { detail } = useContext(LabCurrentDetailContext) ?? { detail: null };
  const profileInteractions = usePatientContextProfileInteractions({
    allowLocalProfiles: getAuthRuntimeMode().authProvider === "mock" && isLegacySalesDemoWorkspace(workspaceId),
    encounter: detail?.encounter,
    encounterId: detail?.encounter.id,
    guardian: detail?.primaryGuardian,
    includeMemoSummaries: true,
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
        guardianItems={profileInteractions.guardianItems}
        patientInteraction={profileInteractions.patientInteraction}
        patientItems={profileInteractions.patientItems}
        vitalAction={vitalAction}
        vitalItems={latestVitals.items}
        memoActions={profileInteractions.memoActions}
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
  const { detail } = useContext(LabCurrentDetailContext) ?? { detail: null };
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
      label="임상검사 이력"
      key={`${workspaceId}:${detail.patient.id}`}
      kind="lab"
      entries={entries}
      status={legacyFixture ? "ready" : history.status}
      onCollapse={() => setContentAsideOpen(false)}
    />
  );
}

export function LabRightPanel({ workspaceId }: ShellComponentProps) {
  const currentDetail = useContext(LabCurrentDetailContext);
  const readStatus = currentDetail?.status ?? "loading";
  const detail = readStatus === "permission_denied" ? undefined : currentDetail?.detail;
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

  const readFailed = readStatus === "error" || readStatus === "permission_denied";
  const listResolved = Boolean(detail) && !readFailed;
  const visibleReceipts = listResolved ? linkedReceipts : [];
  const hasEnteredRows = Boolean(detail?.result.rows.some((row) => row.value));
  const latestReceiptDate =
    visibleReceipts[0]?.receivedAt ?? detail?.result.receivedAt;
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
                data-workspace-receipt-collapse="true"
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
          count={listResolved ? visibleReceipts.length : "-"}
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
          <div className="flex flex-col gap-3 p-3" aria-busy={readStatus === "loading"}>
            {!listResolved && !readFailed && readStatus === "loading" ? (
              <EmrQueueLoadingState title="검사 정보를 불러오는 중입니다" />
            ) : readFailed ? (
              <EmrEmptyState
                kind={readStatus === "permission_denied" ? "no-permission" : "read-error"}
                surface="queue"
                size="sm"
                role="alert"
                title={readStatus === "permission_denied" ? "검사 정보를 볼 권한이 없습니다" : "검사 정보를 불러오지 못했습니다"}
                primaryAction={readStatus === "permission_denied" ? undefined : (
                  <Button variant="outline" onClick={() => void currentDetail?.retry()}>재시도</Button>
                )}
              />
            ) : null}
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
            {listResolved && !visibleReceipts.length ? (
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
  const documentLayout = useWorkspaceDocumentLayout();
  const allowDemoContent =
    isLegacySalesDemoWorkspace(workspaceId) && !isLiveAuthRuntime();
  const searchParams = useSearchParams();
  const routeSearch = searchParams.toString();
  const selectedLabResultId = useLabImagingStore(
    (state) => state.selectedLabResultId,
  );
  const focusedTableLink = useRef<string | null>(null);
  const selectLabResult = useLabImagingStore((state) => state.selectLabResult);
  const contentAsideOpen = useLayoutStore((state) => state.contentAsideOpen);
  const setContentAsideOpen = useLayoutStore(
    (state) => state.setContentAsideOpen,
  );
  const rightPanelOpen = useLayoutStore((state) => state.rightPanelOpen);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
  const { selectedDate } = useSelectedOperatingDate(workspaceId, searchParams.get("date"));
  const fulfillmentQueue = useFulfillmentQueue("lab", selectedDate);
  useQueueRealtimeRefresh({ workspaceId, scopeKey: "lab-owner-detail", onQueueChange: fulfillmentQueue.refresh });
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
  const phase2 = useLabResultPhase2(workspaceId, effectiveDetail?.result.id, !allowDemoContent && Boolean(persistedResult.result), fulfillmentWorkItem?.rowRevision);
  const refreshPhase2 = phase2.refresh;
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
    async (rows: LabResultRow[], requestId: string, expectedRevision: number) => {
      if (!phase2.data?.canEdit) return { ok: false, reason: "permission_denied", message: "현재 담당자만 수정할 수 있습니다.", retryable: false } satisfies LabResultSaveOutcome;
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
          entryWriteRevision: expectedRevision,
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
        refreshPhase2();
      }
      return outcome;
    },
    [
      effectiveDetail,
      fulfillmentWorkItem,
      workspaceId,
      reloadPersistedResult,
      allowDemoContent,
      refreshPhase2,
      phase2.data?.canEdit,
    ],
  );
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

  useEffect(() => {
    let frame = 0;
    const syncTableLinkFocus = () => {
      const params = new URLSearchParams(routeSearch);
      const targetResultId = params.get("labResultId");
      if (!targetResultId || targetResultId !== detail?.result.id || window.location.hash !== "#lab-result-table") {
        focusedTableLink.current = null;
        return;
      }
      if (!allowDemoContent && persistedResult.status === "loading") return;
      const identity = `${workspaceId}:${targetResultId}:${params.get("date") ?? ""}`;
      if (focusedTableLink.current === identity) return;
      const target = document.getElementById("lab-result-table");
      if (!target) return;
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "start" });
        focusedTableLink.current = identity;
      });
    };
    syncTableLinkFocus();
    window.addEventListener("hashchange", syncTableLinkFocus);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", syncTableLinkFocus);
    };
  }, [allowDemoContent, detail?.result.id, persistedResult.status, routeSearch, workspaceId]);

  if (fulfillmentQueue.status === "loading" && !effectiveDetail) {
    return <EmrContentLoadingState testId="lab-content-loading-state" title="검사 업무를 불러오는 중입니다" />;
  }
  if (!effectiveDetail && (fulfillmentQueue.status === "error" || fulfillmentQueue.status === "permission_denied")) {
    const denied = fulfillmentQueue.status === "permission_denied";
    return <div className="flex h-full items-center justify-center px-6 py-10"><EmrEmptyState
      kind={denied ? "no-permission" : "read-error"} surface="content" size="md" role="alert"
      title={denied ? "검사 업무를 볼 권한이 없습니다" : "검사 업무를 불러오지 못했습니다"}
      primaryAction={denied ? undefined : <Button variant="outline" onClick={() => void fulfillmentQueue.refresh()}>재시도</Button>}
    /></div>;
  }

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

  const titleBar = (
    <EmrInstructionTitleBar
            className={documentLayout ? "min-h-9 flex-wrap gap-2" : "px-4"}
            title="임상병리검사 결과지"
            icon={
              <EmrInstructionHistoryToggle
                ariaLabelPrefix="임상병리검사 이력"
                controls={documentLayout?.historyControlsId ?? "lab-content-aside"}
                expanded={documentLayout?.historyVisible ?? contentAsideOpen}
                tooltipLabel="임상병리검사 이력"
                onClick={documentLayout?.toggleHistory ?? (() => setContentAsideOpen(!contentAsideOpen))}
              />
            }
            badge={
              <EmrCopyLinkButton
                ariaLabel="임상병리검사 결과지 링크 복사"
                date={getOperatingDateFromIso(
                  detail?.result.enteredAt ?? detail?.result.receivedAt ??
                  displayDetail.result.enteredAt ?? displayDetail.result.receivedAt,
                ) ?? selectedDate}
                moduleId="lab"
                params={{ labResultId: detail?.result.id ?? displayDetail.result.id }}
                workspaceId={workspaceId}
              />
            }
            actions={
              <>
                <WorkspaceDocumentWidthToggle />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="relative bg-card data-[state=on]:border-[var(--emr-border-default)] data-[state=on]:bg-[var(--emr-state-selected)] data-[state=on]:text-[var(--emr-text-primary)]"
                  aria-controls={documentLayout?.rightControlsId ?? "lab-receipt-panel"}
                  aria-expanded={documentLayout?.rightVisible ?? rightPanelOpen}
                  aria-pressed={documentLayout?.rightVisible ?? rightPanelOpen}
                  data-state={(documentLayout?.rightVisible ?? rightPanelOpen) ? "on" : "off"}
                  disabled={!hasRightPanel}
                  onClick={documentLayout?.toggleRight ?? (() => setRightPanelOpen(!rightPanelOpen))}
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
                    assignedToDisplayName={fulfillmentWorkItem.assignedToDisplayName}
                    canManage={fulfillmentWorkItem.canManage}
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
  );

  return (
    <div data-slot="lab-content" className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] pb-2">
      {documentLayout ? <WorkspaceDocumentToolbar>{titleBar}</WorkspaceDocumentToolbar> : null}
      <EmrInstructionHeaderStack
        chartAligned={!documentLayout}
        titleBar={documentLayout ? null : titleBar}
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
                      ? fulfillmentWorkItem.assignedToDisplayName ?? "담당자 지정됨"
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
          <div
            role="group"
            aria-label="검사 결과 개수"
            className="flex min-h-8 items-center border-b border-[var(--emr-border-default)] pb-2 emr-text-dense font-medium"
          >
            전체 {displayDetail.result.rows.length}
          </div>
        }
      />

      <ScrollArea data-slot="lab-result-scroll-area" className="min-h-0 flex-1">
        <div data-slot="instruction-result-scroll-content" className={cn("flex flex-col gap-4 pb-10 pt-4", !documentLayout && "px-4")}>
          {phase2.status === "ready" && !phase2.data?.canEdit ? <div role="status" className="rounded-lg border border-border bg-card px-4 py-3 emr-text-dense text-muted-foreground">
            {!fulfillmentWorkItem?.assignedToUserId ? "담당하기 후 결과·소견·첨부자료를 입력할 수 있습니다." : "현재 담당자만 결과·소견·첨부자료를 수정할 수 있습니다."}
          </div> : null}
          <LabResultInputSection
            key={`${workspaceId}:${displayDetail.result.id}:rows`}
            routeResultId={detail?.result.id ?? selectedLabResultId ?? displayDetail.result.id}
            assigneeName={
              allowDemoContent
                ? assignment.assigneeName
              : fulfillmentWorkItem?.assignedToUserId ? fulfillmentWorkItem.assignedToDisplayName ?? "담당자 지정됨" : "미지정"
            }
            search={routeSearch}
            staffInstruction={displayDetail.order?.instruction}
            catalogStatus={
              !allowDemoContent ? persistedResult.status : detail?.result.rows.length === 0
                ? catalogRowsState.status
                : "idle"
            }
            emptyRowsKind={fulfillmentWorkItem ? "upstream-pending" : "no-data"}
            result={effectiveDetail.result}
            onCatalogRetry={allowDemoContent ? catalogRowsState.retry : persistedResult.retry}
            onSave={saveResultRows}
            phase2={phase2.data}
            phase2Status={phase2.status}
            onPhase2Refresh={phase2.refresh}
          />
          <LabOverallFinding key={`${workspaceId}:${displayDetail.result.id}:overall`} result={displayDetail.result} phase2={phase2.data} readStatus={phase2.status} refresh={phase2.refresh} />
          {displayDetail.attachments.length || allowDemoContent ? <AttachmentStrip
            allowDemoContent={allowDemoContent} attachments={displayDetail.attachments}
            showImageExample title="공통 첨부자료"
          /> : null}
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
  workspaceId,
}: ShellComponentProps) {
  const { detail } = useCurrentImagingDetail(workspaceId);
  const profileInteractions = usePatientContextProfileInteractions({
    allowLocalProfiles: getAuthRuntimeMode().authProvider === "mock" && isLegacySalesDemoWorkspace(workspaceId),
    encounter: detail?.encounter,
    encounterId: detail?.encounter.id,
    guardian: detail?.primaryGuardian,
    includeMemoSummaries: true,
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
        guardianItems={profileInteractions.guardianItems}
        patientInteraction={profileInteractions.patientInteraction}
        patientItems={profileInteractions.patientItems}
        vitalAction={vitalAction}
        vitalItems={latestVitals.items}
        memoActions={profileInteractions.memoActions}
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
          modality: item.study.modality,
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
          modality: typeof modality === "string" ? modality : undefined,
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
    key={`${workspaceId}:${detail.patient.id}`}
    kind="imaging"
    entries={entries}
    status={legacyFixture ? "ready" : history.status}
    onCollapse={() => setContentAsideOpen(false)}
  />;
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

export function ImagingContent({ workspaceId, hasRightPanel }: ShellComponentProps) {
  const documentLayout = useWorkspaceDocumentLayout();
  const { rightPanelOpen, setRightPanelOpen } = useLayoutStore();
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
  useQueueRealtimeRefresh({ workspaceId, scopeKey: "imaging-owner-detail", onQueueChange: fulfillmentQueue.refresh });
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

  if (fulfillmentQueue.status === "loading" && !detail) {
    return <EmrContentLoadingState testId="imaging-content-loading-state" title="영상 업무를 불러오는 중입니다" />;
  }
  if (!detail && (fulfillmentQueue.status === "error" || fulfillmentQueue.status === "permission_denied")) {
    const denied = fulfillmentQueue.status === "permission_denied";
    return <div className="flex h-full items-center justify-center px-6 py-10"><EmrEmptyState
      kind={denied ? "no-permission" : "read-error"} surface="content" size="md" role="alert"
      title={denied ? "영상 업무를 볼 권한이 없습니다" : "영상 업무를 불러오지 못했습니다"}
      primaryAction={denied ? undefined : <Button variant="outline" onClick={() => void fulfillmentQueue.refresh()}>재시도</Button>}
    /></div>;
  }

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

  const summaryAction = (
    <Button variant="outline" size="sm" className="bg-card" disabled={!hasRightPanel}
      aria-label={(documentLayout?.rightVisible ?? rightPanelOpen) ? "종합소견 패널 접기" : "종합소견 패널 열기"}
      aria-controls={documentLayout?.rightControlsId ?? "imaging-summary-panel"}
      aria-expanded={documentLayout?.rightVisible ?? rightPanelOpen} aria-pressed={documentLayout?.rightVisible ?? rightPanelOpen}
      data-state={(documentLayout?.rightVisible ?? rightPanelOpen) ? "on" : "off"}
      onClick={documentLayout?.toggleRight ?? (() => setRightPanelOpen(!rightPanelOpen))}>
      종합소견 <Badge variant="secondary" className="ml-1">{detail.attachments.length}</Badge>
    </Button>
  );

  const titleBar = (
    <EmrInstructionTitleBar
            className={documentLayout ? "min-h-9 flex-wrap gap-2" : "px-4"}
            title="영상검사 Order 상세"
            icon={
              <EmrInstructionHistoryToggle
                ariaLabelPrefix="영상검사 이력"
                controls={documentLayout?.historyControlsId ?? "imaging-content-aside"}
                expanded={documentLayout?.historyVisible ?? contentAsideOpen}
                tooltipLabel="영상검사 이력"
                onClick={documentLayout?.toggleHistory ?? (() => setContentAsideOpen(!contentAsideOpen))}
              />
            }
            badge={
              <EmrCopyLinkButton
                ariaLabel="영상검사 Order 상세 링크 복사"
                date={getOperatingDateFromIso(detail.study.requestedAt) ?? selectedDate}
                moduleId="imaging"
                params={{ imagingStudyId: detail.study.id }}
                workspaceId={workspaceId}
              />
            }
            actions={
              <>
                <WorkspaceDocumentWidthToggle showWhenUnavailable />
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
                    assignedToDisplayName={fulfillmentWorkItem.assignedToDisplayName}
                    canManage={fulfillmentWorkItem.canManage}
                    completeLabel="판독완료"
                    loadEligibleAssignees={loadEligibleAssignees}
                    onTransition={transitionFulfillment}
                    startPhase="interpretation_in_progress"
                    status={fulfillmentWorkItem.status}
                  >
                    {summaryAction}
                  </FulfillmentExecutionActions>
                ) : (
                  <>
                    {summaryAction}
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
                )}
                <EmrInstructionOutputMenu />
              </>
            }
          />
  );

  return (
    <div data-slot="imaging-content" className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] pb-2">
      {documentLayout ? <WorkspaceDocumentToolbar>{titleBar}</WorkspaceDocumentToolbar> : null}
      <EmrInstructionHeaderStack
        chartAligned={!documentLayout}
        titleBar={documentLayout ? null : titleBar}
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
                      ? fulfillmentWorkItem.assignedToDisplayName ?? "담당자 지정됨"
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
        <div data-slot="instruction-result-scroll-content" className={cn("flex flex-col gap-4 pb-10 pt-4", !documentLayout && "px-4")}>
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
              : fulfillmentWorkItem?.assignedToUserId ? fulfillmentWorkItem.assignedToDisplayName ?? "담당자 지정됨" : "미지정"}
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
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
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
      id="imaging-summary-panel"
      className="bg-[var(--emr-surface-rightpanel)]"
      data-testid="imaging-summary-panel"
      header={
        <EmrRightPanelHeader className="justify-between">
          <h2 className="min-w-0 truncate text-sm font-semibold">종합소견</h2>
          <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="h-5 rounded-md px-2 emr-text-micro text-muted-foreground"
          >
            {sameEncounterOrderCount}
          </Badge>
            <EmrRightPanelHeaderIconButton aria-label="종합소견 패널 접기" onClick={() => setRightPanelOpen(false)}>
              <CdsNavigationChevronsRightIcon />
            </EmrRightPanelHeaderIconButton>
          </div>
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
