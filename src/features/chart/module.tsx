"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CdsActionsRotateCcwIcon,
  CdsActionsSaveIcon,
  CdsActionsTrash2Icon,
  CdsActionsListFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsNavigationChevronsLeftIcon,
  CdsNavigationChevronsRightIcon,
} from "@/components/cds-icons/navigation";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrContentAsidePanel } from "@/components/emr/content-aside-panel";
import {
  EmrContentHistoryGroup,
  EmrContentHistoryItem,
} from "@/components/emr/content-history-list";
import {
  EmrInstructionHeaderStack,
  EmrInstructionHistoryToggle,
  EmrInstructionTitleBar,
} from "@/components/emr/instruction-header-stack";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
} from "@/components/emr/subpanel";
import { EmrOrderQueueSidePanel } from "@/components/emr/order-queue-side-panel";
import { EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import { EmrTableDensitySelector } from "@/components/emr/table-density-selector";
import { EmrTableFilterBuilder } from "@/components/emr/table-filter-builder";
import {
  createInitialEmrTableFilterBuilderModel,
  filterRowsByEmrTableFilterBuilder,
  getEmrTableFilterBuilderActiveCount,
  type EmrTableFilterBuilderField,
} from "@/components/emr/table-filter-builder-model";
import {
  EmrTableCellText,
  EmrTableHeaderCell,
} from "@/components/emr/table-primitives";
import {
  getTaskQueueEventKindFromStatus,
  type EmrTaskQueueCardItem,
} from "@/components/emr/task-queue-card";
import type { EmrRowActionMenuItem } from "@/components/emr/row-action-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BuildingIcon,
  ClockIcon,
  StethoscopeIcon,
  UsersIcon,
} from "@/components/icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createChartEncounterBundleFromLiveHandoff,
  getChartEncounter,
  getChartHistoryRows,
  getChartInvoiceLineByOrderId,
  getChartOrderGroups,
  getChartQueueItems,
  getChartQueueStatuses,
  getChartStaffName,
  getConsultationCallRooms,
  type ChartEncounterBundle,
  type ChartHistoryRow,
  type ChartOrderGroup,
} from "@/features/chart/data";
import {
  readChartLiveEncounterHandoff,
  saveChartLiveEncounterHandoff,
} from "@/features/chart/live-encounter-handoff";
import type {
  ChartLiveQueueRecord,
  ChartLiveQueueResponse,
} from "@/features/chart/chart-live-queue";
import { useAuthClient, type AuthSession } from "@/features/auth/auth-client";
import { getDemoActorHeaders } from "@/features/auth/demo-actor";
import { ChartLineTabGroup } from "@/features/chart/components/chart-line-tab-group";
import { ChartSectionTitle } from "@/features/chart/components/chart-section-title";
import { SoapRichTextEditor } from "@/features/chart/components/soap-rich-text-editor";
import { useChartStore } from "@/features/chart/store";
import { useSelectedOperatingDate } from "@/features/work-queue/use-selected-operating-date";
import {
  getPatientDisplayAge,
  getPatientSexLabel,
  getSpeciesLabel,
} from "@/features/reception/data";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
import {
  isLegacySalesDemoWorkspace,
} from "@/lib/emr-domain/demo-workspaces";
import {
  formatOperatingShortTime,
  formatShortOperatingDate,
  getOperatingDateFromIso,
} from "@/lib/emr-domain/demo-date";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import { buildWorkspaceSurfaceRoute } from "@/shell/workspace-surface-route";
import type {
  EmrColumnResize,
  EmrTableDensity,
  EmrTableHeaderInteraction,
} from "@/components/emr/table-density";
import type { OrderQueueItem, ShellComponentProps } from "@/types/emr";
import type { ChartOrderCatalogSearchRow } from "@/features/hospital-admin/server-order-catalog";
import type {
  Diagnosis,
  DiagnosisType,
  EmrOrder,
  EmrOrderStatus,
  EmrOrderType,
  Encounter,
  SoapNote,
  WaitingQueueEntry,
} from "@/types/emr-domain";

type ChartBundle = ChartEncounterBundle;
type OrderFilter = "all" | EmrOrderType | "billing";
type SoapSaveState = "idle" | "loading" | "saving" | "saved" | "error" | "conflict";
type ChartSoapNoteRouteResponse =
  | {
      ok: true;
      status: number;
      soapNote: SoapNote | null;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartCompletionSnapshot = {
  encounterId: string;
  workspaceId: string;
  status: Encounter["status"];
  chartCompletedAt?: string;
  chartCompletedByUserId?: string;
  updatedAt: string;
};
type ChartCompletionRouteResponse =
  | {
      ok: true;
      status: number;
      completion: ChartCompletionSnapshot;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ConsultationFlowSnapshot = {
  callEvent?: {
    id: string;
    displayText: string;
    deliveryStatus: "queued";
    roomId: string;
    roomName: string;
  };
  encounter: Encounter;
  queueEntry: WaitingQueueEntry;
};
type ConsultationFlowRouteResponse =
  | {
      ok: true;
      status: number;
      flow: ConsultationFlowSnapshot;
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartDiagnosisRouteResponse =
  | {
      ok: true;
      status: number;
      diagnoses: Diagnosis[];
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderDraftSnapshot = {
  billingDisplayName: string;
  encounterId: string;
  lineTotalSnapshot: number;
  orderId: string;
  quantity: number;
  unitPriceSnapshot: number;
  updatedAt: string;
};
type ChartOrderDraftRouteResponse =
  | {
      ok: true;
      status: number;
      orderDrafts: ChartOrderDraftSnapshot[];
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderActionKind = "bill" | "confirm";
type ChartOrderCatalogSelectionInput = {
  billingDisplayName: string;
  guardianName?: string;
  orderId: string;
  patientName?: string;
  quantity: number;
  rowType: "individual" | "set";
  sourcePresetId: string;
};
type ChartOrderActionSnapshot = {
  appliedSnapshot?: {
    billingName: string;
    destinationModule?: string;
    inHospitalOrderName?: string;
    lineTotalSnapshot: number;
    orderType?: EmrOrderType;
    priceKrw: number;
    quantity: number;
    sourcePresetId: string;
    standardOrderName: string;
  };
  billingCandidateId?: string | null;
  billingCandidateStatus: string;
  confirmedAt?: string | null;
  confirmedByUserId?: string | null;
  encounterId: string;
  orderConfirmationStatus: string;
  orderId: string;
  status: EmrOrderStatus;
  updatedAt: string;
};
type ChartOrderActionRouteResponse =
  | {
      ok: true;
      status: number;
      billingCandidates?: ChartBillingCandidateSnapshot[];
      orderActions: ChartOrderActionSnapshot[];
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderLifecycleSnapshot = {
  cancellationReason?: string | null;
  encounterId: string;
  orderId: string;
  status: EmrOrderStatus;
  updatedAt: string;
  updatedByUserId?: string | null;
};
type ChartOrderLifecycleRouteResponse =
  | {
      ok: true;
      status: number;
      lifecycles: ChartOrderLifecycleSnapshot[];
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartBillingCandidateSnapshot = {
  billingCandidateId: string;
  orderId: string;
};
type ChartBillingCandidateRouteResponse =
  | {
      ok: true;
      status: number;
      candidates: ChartBillingCandidateSnapshot[];
    }
  | {
      ok: false;
      status: number;
      denialReason?: string;
      error?: string;
    };
type ChartOrderCatalogRouteResponse =
  | {
      ok: true;
      status?: number;
      rows: ChartOrderCatalogSearchRow[];
    }
  | {
      ok: false;
      status?: number;
      denialReason?: string;
      error?: string;
    };

const CHART_TOP_DEFAULT_PERCENT = 50;
const CHART_TOP_MIN_PX = 180;
const CHART_ORDER_MIN_PX = 170;
const CHART_RESIZER_HEIGHT_PX = 16;
const CHART_RESIZER_STEP_PERCENT = 5;
const chartSelectedEncounterStoragePrefix =
  "clair-emr:chart-selected-encounter:v1";
const legacySalesDemoDefaultEncounterId = "encounter-coco-260501";

const chartQueueFilterItems = [
  { value: "all", label: "전체" },
  { value: "appointment", label: "예약" },
  { value: "walk-in", label: "외래" },
];

const emptyChartQueueItems: OrderQueueItem[] = [];

const orderTypeMeta: Record<EmrOrderType, { handoff: string; label: string }> =
  {
    dispensing: { label: "조제", handoff: "조제 대기열" },
    imaging: { label: "영상", handoff: "영상 판독" },
    lab: { label: "검사", handoff: "검사 결과" },
    treatment: { label: "처치", handoff: "처치 진행" },
  };

const orderStatusLabel: Record<EmrOrderStatus, string> = {
  cancelled: "취소",
  confirmed: "확정",
  completed: "완료",
  in_progress: "진행중",
  re_requested: "재요청",
  requested: "요청",
};

function getChartTaskCardItem(item: OrderQueueItem): EmrTaskQueueCardItem {
  const receptionEventLabel = item.receptionType === "예약" ? "예약" : "접수";

  return {
    actionAriaLabel: `${item.patientName} ${item.orderName} 더보기`,
    actionMenuDensity: "compact",
    actionTestId: `order-queue-item-action-${item.id}`,
    assigneeName: item.assigneeName,
    eventActorName: item.requesterName,
    eventKind: getTaskQueueEventKindFromStatus(item.statusId),
    eventText: `${item.time} ${receptionEventLabel}`,
    eventTime: item.time,
    guardianName: item.guardianName,
    patientName: item.patientName,
    receptionType: item.receptionType,
    secondLineBadgeLabel: "방문목적",
    secondLineText: item.orderType || item.orderName,
    testId: `order-queue-item-${item.id}`,
  };
}

function getChartQueueActionItems({
  item,
  onRequestCall,
  onSelect,
}: {
  item: OrderQueueItem;
  onRequestCall: () => void;
  onSelect: () => void;
}): EmrRowActionMenuItem[] {
  const items: EmrRowActionMenuItem[] = [];

  if (item.statusId === "waiting") {
    items.push({
      key: "call",
      label: "호출하기",
      onSelect: () => {
        onRequestCall();
        onSelect();
      },
      testId: `chart-queue-action-call-${item.id}`,
    });
  }

  items.push(
    {
      key: "open",
      label: "차트 열기",
      onSelect,
      testId: `chart-queue-action-open-${item.id}`,
    },
    {
      key: "assign",
      label: item.assigneeName ? "담당자 보기" : "담당하기",
      onSelect,
      testId: `chart-queue-action-assign-${item.id}`,
    },
    {
      key: "patient",
      label: "환자 정보",
      disabled: true,
      testId: `chart-queue-action-patient-${item.id}`,
    },
    {
      key: "guardian",
      label: "보호자 정보",
      disabled: true,
      testId: `chart-queue-action-guardian-${item.id}`,
    },
  );

  return items;
}

const chartOrderTabs: Array<{ value: OrderFilter; label: string }> = [
  { value: "all", label: "전체오더" },
  { value: "lab", label: "임상" },
  { value: "imaging", label: "영상" },
  { value: "dispensing", label: "조제" },
  { value: "treatment", label: "처치" },
  { value: "billing", label: "수납" },
];

const getShortDateTime = (dateTime?: string) => {
  if (!dateTime) return "-";

  const operatingDate = getOperatingDateFromIso(dateTime);
  if (!operatingDate) return "-";

  return `${formatShortOperatingDate(operatingDate)} ${formatOperatingShortTime(dateTime)}`;
};

const getShortClockTime = (dateTime?: string) =>
  formatOperatingShortTime(dateTime);

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const getDiagnosisLabel = (diagnoses: Diagnosis[]) =>
  diagnoses.length
    ? diagnoses.map((diagnosis) => diagnosis.diagnosisText).join(", ")
    : "진단 미입력";

const getSoapSectionStatusText = (
  status?: SoapNote["status"],
  statusAt?: string,
) => {
  if (!status) return "자동저장 대기";
  const statusLabel =
    status === "autosaved"
      ? "자동저장됨"
      : status === "draft"
        ? "작성중"
        : getStatusLabel("soap", status);

  return statusAt
    ? `${statusLabel} · ${getShortClockTime(statusAt)}`
    : statusLabel;
};

const getSoapStatusText = (soapNote?: SoapNote) =>
  soapNote
    ? getSoapSectionStatusText(
        soapNote.status,
        soapNote.signedAt ?? soapNote.autosavedAt ?? soapNote.updatedAt,
      )
    : "차트 대기";

const isChartReadyForBilling = (
  encounter: Pick<Encounter, "chartCompletedAt" | "status">,
) =>
  Boolean(encounter.chartCompletedAt) ||
  encounter.status === "ready_for_billing";

const getChartCompletionStatusText = (
  encounter: Pick<Encounter, "chartCompletedAt" | "status">,
) => {
  if (isChartReadyForBilling(encounter)) {
    return `작성완료 · ${getShortClockTime(encounter.chartCompletedAt)}`;
  }

  if (encounter.status === "completed") return "수납완료";
  if (encounter.status === "ordered") return "오더 진행중";
  if (encounter.status === "in_consultation") return "진료중";
  if (encounter.status === "waiting") return "차트 대기";

  return getStatusLabel("encounter", encounter.status);
};

function getConsultationWorkflowStatusText(
  encounter: Pick<Encounter, "chartCompletedAt" | "status">,
  queueEntry?: Pick<WaitingQueueEntry, "status">,
) {
  if (isChartReadyForBilling(encounter)) return "작성완료 / 수납대기";
  if (encounter.status === "completed") return "수납완료";
  if (encounter.status === "ordered") return "오더 진행중";
  if (encounter.status === "in_consultation" || queueEntry?.status === "in_progress") {
    return "진료중";
  }
  if (queueEntry?.status === "called") return "호출됨";
  if (queueEntry?.status === "waiting") return "호출 대기";
  return getChartCompletionStatusText(encounter);
}

function canCompleteChartFromWorkflow(
  encounter: Pick<Encounter, "chartCompletedAt" | "status">,
  queueEntry?: Pick<WaitingQueueEntry, "status">,
) {
  if (isChartReadyForBilling(encounter) || encounter.status === "completed") return false;
  return (
    encounter.status === "in_consultation" ||
    encounter.status === "ordered" ||
    queueEntry?.status === "in_progress"
  );
}

const getDiagnosisSystemLabel = (diagnosis: Diagnosis) => {
  const text = diagnosis.diagnosisText;

  if (/(위장|구토|식욕|설사|소화)/.test(text)) return "소화기";
  if (/(피부|가려움|발진|재진)/.test(text)) return "피부";
  if (/(예방|접종|건강검진)/.test(text)) return "예방";
  if (/(탈수|전신|수액)/.test(text)) return "전신";
  if (/(검사|혈액|염증)/.test(text)) return "검사";

  return "기타";
};

const getSoapSystemLabel = (diagnosis: Diagnosis) =>
  "systemLabel" in diagnosis && typeof diagnosis.systemLabel === "string"
    ? diagnosis.systemLabel
    : getDiagnosisSystemLabel(diagnosis);

type DiagnosisCatalogItem = {
  id: string;
  name: string;
  systemLabel: string;
  synonyms: string[];
  defaultType: DiagnosisType;
  hint: string;
};

type EditableDiagnosis = Diagnosis & {
  systemLabel: string;
  catalogMatched: boolean;
  isPrimary: boolean;
};

const diagnosisCatalog: DiagnosisCatalogItem[] = [
  {
    id: "dx-acute-gastroenteritis",
    name: "급성 위장관염 의심",
    systemLabel: "소화기",
    synonyms: [
      "acute gastroenteritis",
      "AGE",
      "구토",
      "설사",
      "식욕저하",
      "위장염",
    ],
    defaultType: "suspected",
    hint: "구토/설사/식욕저하 내원에서 자주 사용",
  },
  {
    id: "dx-dietary-indiscretion",
    name: "식이성 위장장애",
    systemLabel: "소화기",
    synonyms: ["dietary indiscretion", "음식", "과식", "구토"],
    defaultType: "suspected",
    hint: "식이 변화나 이물 섭취 가능성 확인 전",
  },
  {
    id: "dx-foreign-body",
    name: "위장관 이물 감별",
    systemLabel: "소화기",
    synonyms: ["foreign body", "이물", "구토", "복부영상"],
    defaultType: "differential",
    hint: "영상검사로 배제 또는 확인 필요",
  },
  {
    id: "dx-pancreatitis",
    name: "췌장염 감별",
    systemLabel: "소화기",
    synonyms: ["pancreatitis", "PLI", "복통", "구토", "식욕저하"],
    defaultType: "differential",
    hint: "혈액검사/특이 검사로 감별",
  },
  {
    id: "dx-mild-dehydration",
    name: "경도 탈수",
    systemLabel: "전신",
    synonyms: ["dehydration", "탈수", "수액", "구토"],
    defaultType: "suspected",
    hint: "수액 처치 판단 근거로 기록",
  },
  {
    id: "dx-allergic-dermatitis",
    name: "알러지성 피부염",
    systemLabel: "피부",
    synonyms: ["allergic dermatitis", "가려움", "발진", "피부염"],
    defaultType: "confirmed",
    hint: "피부 병변과 재진 이력 기반",
  },
  {
    id: "dx-wellness-check",
    name: "예방접종 전 건강 확인",
    systemLabel: "예방",
    synonyms: ["wellness", "vaccination", "예방접종", "건강검진"],
    defaultType: "confirmed",
    hint: "예방접종 전 진찰 기록",
  },
];

const diagnosisTypeLabel: Record<DiagnosisType, string> = {
  confirmed: "확진",
  differential: "감별",
  suspected: "의심",
};

const normalizeDiagnosisQuery = (value: string) =>
  value.trim().toLocaleLowerCase("ko-KR");

const buildDiagnosisSearchText = (item: DiagnosisCatalogItem) =>
  [item.name, item.systemLabel, item.hint, ...item.synonyms]
    .join(" ")
    .toLocaleLowerCase("ko-KR");

const getDiagnosisSearchResults = (query: string, soapNote?: SoapNote) => {
  const normalizedQuery = normalizeDiagnosisQuery(query);
  const contextText = [
    soapNote?.subjective,
    soapNote?.objective,
    soapNote?.assessment,
    soapNote?.plan,
  ]
    .filter(Boolean)
    .join(" ");

  if (normalizedQuery) {
    return diagnosisCatalog
      .filter((item) =>
        buildDiagnosisSearchText(item).includes(normalizedQuery),
      )
      .slice(0, 6);
  }

  if (/(구토|위장|식욕|탈수|복부)/.test(contextText)) {
    return diagnosisCatalog.slice(0, 5);
  }

  return diagnosisCatalog.slice(0, 4);
};

const toEditableDiagnosis = (
  diagnosis: Diagnosis,
  index: number,
): EditableDiagnosis => ({
  ...diagnosis,
  catalogMatched:
    Boolean(diagnosis.diagnosisCatalogId) ||
    diagnosisCatalog.some((item) => item.name === diagnosis.diagnosisText),
  isPrimary: index === 0,
  systemLabel: getDiagnosisSystemLabel(diagnosis),
});

function getLiveHandoffBundle(encounterId: string) {
  const handoff = readChartLiveEncounterHandoff(encounterId);

  return handoff
    ? createChartEncounterBundleFromLiveHandoff({
        encounter: handoff.encounter,
        patient: handoff.patient,
        primaryGuardian: handoff.primaryGuardian,
        veterinarianName: handoff.veterinarianName,
      })
    : null;
}

function getLiveQueueBundle(
  selectedEncounterId: string,
  liveQueueRecords: ChartLiveQueueRecord[],
) {
  const record = liveQueueRecords.find(
    (item) => item.encounter.id === selectedEncounterId,
  );

  return record
    ? createChartEncounterBundleFromLiveHandoff({
        encounter: record.encounter,
        patient: record.patient,
        primaryGuardian: record.primaryGuardian,
        veterinarianName: record.veterinarianName,
      })
    : null;
}

function getSelectedBundle(
  selectedEncounterId: string,
  liveQueueRecords: ChartLiveQueueRecord[] = [],
  options: { allowMockFallback?: boolean } = {},
) {
  const liveBundle =
    getLiveQueueBundle(selectedEncounterId, liveQueueRecords) ??
    getLiveHandoffBundle(selectedEncounterId);

  if (liveBundle) return liveBundle;

  if (options.allowMockFallback === false) return null;

  if (!selectedEncounterId) return getChartEncounter(legacySalesDemoDefaultEncounterId);

  return (
    getChartEncounter(selectedEncounterId) ??
    getChartEncounter(legacySalesDemoDefaultEncounterId)
  );
}

function resolveChartBundleVeterinarianName(bundle: ChartBundle) {
  return (
    bundle.veterinarianName ??
    getChartStaffName(bundle.encounter.primaryVeterinarianId)
  );
}

function getChartBundleVeterinarianName(bundle: ChartBundle) {
  return resolveChartBundleVeterinarianName(bundle) ?? "담당 미정";
}

function getChartHistoryVeterinarianName(
  row: ChartHistoryRow,
  bundle: ChartBundle,
) {
  if (row.encounter.id === bundle.encounter.id) {
    return resolveChartBundleVeterinarianName(bundle) ?? "미정";
  }

  return getChartStaffName(row.encounter.primaryVeterinarianId) ?? "미정";
}

function getSelectedEncounterStorageKey(workspaceId: string) {
  return `${chartSelectedEncounterStoragePrefix}:${workspaceId}`;
}

function readStoredSelectedChartEncounterId(workspaceId: string) {
  if (typeof window === "undefined") return null;

  const value = window.sessionStorage.getItem(
    getSelectedEncounterStorageKey(workspaceId),
  );
  return value && value.trim() ? value : null;
}

function saveSelectedChartEncounterId(workspaceId: string, encounterId: string) {
  if (typeof window === "undefined" || !encounterId) return;

  window.sessionStorage.setItem(
    getSelectedEncounterStorageKey(workspaceId),
    encounterId,
  );
}

function chooseRecoverableLiveEncounterId({
  currentEncounterId,
  explicitEncounterId,
  records,
  workspaceId,
}: {
  currentEncounterId: string;
  explicitEncounterId: string | null;
  records: ChartLiveQueueRecord[];
  workspaceId: string;
}) {
  const liveEncounterIds = new Set(
    records.map((record) => record.encounter.id),
  );
  if (explicitEncounterId && liveEncounterIds.has(explicitEncounterId)) {
    return explicitEncounterId;
  }
  if (currentEncounterId && liveEncounterIds.has(currentEncounterId)) {
    return currentEncounterId;
  }

  const storedEncounterId = readStoredSelectedChartEncounterId(workspaceId);
  if (storedEncounterId && liveEncounterIds.has(storedEncounterId)) {
    return storedEncounterId;
  }

  return records[0]?.encounter.id ?? null;
}

function getChartHistoryRowsForBundle(bundle: ChartBundle): ChartHistoryRow[] {
  const rows = getChartHistoryRows(bundle.patient.id);

  if (rows.some((row) => row.encounter.id === bundle.encounter.id)) {
    return rows;
  }

  const currentRow: ChartHistoryRow = {
    diagnoses: bundle.diagnoses.filter(
      (diagnosis) => diagnosis.encounterId === bundle.encounter.id,
    ),
    encounter: bundle.encounter,
    soapNote: bundle.soapNotes.find(
      (soapNote) => soapNote.encounterId === bundle.encounter.id,
    ),
  };

  return [currentRow, ...rows].sort((a, b) =>
    (b.encounter.checkedInAt ?? b.encounter.createdAt).localeCompare(
      a.encounter.checkedInAt ?? a.encounter.createdAt,
    ),
  );
}

function mapLiveChartQueueRecordToItem(
  record: ChartLiveQueueRecord,
): OrderQueueItem {
  return {
    id: record.encounter.id,
    instructionId: record.encounter.encounterNo,
    patientName: record.patient.name,
    guardianName: record.primaryGuardian?.name ?? "보호자 미지정",
    patientAge: getPatientDisplayAge(record.patient),
    patientBreed: record.patient.breed,
    patientSex: getPatientSexLabel(record.patient),
    receptionType: record.encounter.appointmentId ? "예약" : "외래",
    orderName:
      record.encounter.chiefComplaint ??
      record.encounter.visitPurpose ??
      "진료 대기",
    orderType: record.encounter.visitPurpose ?? "진료",
    orderTypeCategory: "treatment",
    requesterName: record.veterinarianName ?? "담당 미정",
    assigneeName: record.veterinarianName,
    startedAt: getShortClockTime(record.encounter.startedAt),
    statusId: record.queueEntry.status,
    time: getShortClockTime(record.queueEntry.enteredAt),
  };
}

function getChartVitals(bundle: ChartBundle) {
  if (bundle.patient.id === "patient-kong") {
    return [
      { label: "체중", value: "2.3kg" },
      { label: "체온", value: "39.1℃" },
      { label: "호흡", value: "24rpm" },
      { label: "혈압", value: "130bpm" },
    ];
  }

  return [
    { label: "체중", value: "5.96kg" },
    { label: "체온", value: "39.3℃" },
    { label: "호흡", value: "20rpm" },
    { label: "혈압", value: "170bpm" },
  ];
}

function useScenarioEncounterSync() {
  const searchParams = useSearchParams();
  const lastAppliedQueryEncounterId = useRef<string | null>(null);
  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const liveQueueRecords = useChartStore((state) => state.liveQueueRecords);
  const selectEncounter = useChartStore((state) => state.selectEncounter);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryEncounterId =
    searchParams.get("encounterId") ?? scenario?.encounterId ?? null;
  const queryEncounterBundle = queryEncounterId
    ? (getChartEncounter(queryEncounterId) ??
      getLiveQueueBundle(queryEncounterId, liveQueueRecords) ??
      getLiveHandoffBundle(queryEncounterId))
    : null;
  const hasValidQueryEncounter =
    queryEncounterId !== null && queryEncounterBundle !== null;

  useEffect(() => {
    if (!queryEncounterId || !hasValidQueryEncounter) return;
    if (lastAppliedQueryEncounterId.current === queryEncounterId) return;

    lastAppliedQueryEncounterId.current = queryEncounterId;
    if (selectedEncounterId !== queryEncounterId) {
      selectEncounter(queryEncounterId);
    }
  }, [
    hasValidQueryEncounter,
    liveQueueRecords,
    queryEncounterId,
    selectEncounter,
    selectedEncounterId,
  ]);
}

function useExplicitChartEncounterId() {
  const searchParams = useSearchParams();
  const scenario = getDemoScenarioFromParams(searchParams);

  return searchParams.get("encounterId") ?? scenario?.encounterId ?? null;
}

function useDemoScenarioChartEncounterId() {
  const searchParams = useSearchParams();
  const scenario = getDemoScenarioFromParams(searchParams);

  return scenario?.encounterId ?? null;
}

export function ChartSidePanel({
  onNavigateWorkspaceSurface,
  workspaceId,
}: ShellComponentProps) {
  const searchParams = useSearchParams();
  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const liveQueueRecords = useChartStore((state) => state.liveQueueRecords);
  const liveQueueStatus = useChartStore((state) => state.liveQueueStatus);
  const requestConsultationCall = useChartStore(
    (state) => state.requestConsultationCall,
  );
  const selectEncounter = useChartStore((state) => state.selectEncounter);
  const setLiveQueueState = useChartStore((state) => state.setLiveQueueState);
  const { setModulePanelOpen, setSelectedQueueItem } = useLayoutStore();
  const {
    hydrated: authHydrated,
    session: authSession,
    hydrate: hydrateAuthSession,
  } = useAuthClient();
  const actorHeaders = useMemo(
    () => getDemoActorHeader(authSession),
    [authSession],
  );
  const legacySalesDemo = isLegacySalesDemoWorkspace(workspaceId);
  const { selectDate, selectedDate, todayDate } =
    useSelectedOperatingDate(workspaceId);
  const mockItems = useMemo(
    () => (legacySalesDemo ? getChartQueueItems() : emptyChartQueueItems),
    [legacySalesDemo],
  );
  const liveItems = useMemo(
    () => liveQueueRecords.map(mapLiveChartQueueRecordToItem),
    [liveQueueRecords],
  );
  const liveMode = liveQueueStatus === "ready";
  const items = useMemo(
    () => (liveMode ? liveItems : mockItems),
    [liveItems, liveMode, mockItems],
  );
  const explicitQueryEncounterId = useExplicitChartEncounterId();
  const selectWorkspaceEncounter = (itemId: string) => {
    const href = buildWorkspaceSurfaceRoute({
      moduleId: "treatment",
      params: { encounterId: itemId },
      search: searchParams,
      workspaceId,
    });

    if (onNavigateWorkspaceSurface) {
      onNavigateWorkspaceSurface(href, "treatment");
      return;
    }

    if (liveMode) saveSelectedChartEncounterId(workspaceId, itemId);
    selectEncounter(itemId);
    setSelectedQueueItem("treatment", itemId);
  };

  useEffect(() => {
    hydrateAuthSession();
  }, [hydrateAuthSession]);

  useEffect(() => {
    if (!authHydrated) return;

    let cancelled = false;
    setLiveQueueState({ records: [], status: "loading" });

    async function loadLiveQueue() {
      const result = await loadChartLiveQueue({
        actorHeaders,
        date: selectedDate,
        workspaceId,
      });
      if (cancelled) return;

      if (!result.ok) {
        setLiveQueueState({
          error: result.denialReason ?? result.error ?? "db_read_failed",
          records: [],
          status: "error",
        });
        return;
      }

      result.queue.forEach((record) => {
        saveChartLiveEncounterHandoff({
          encounter: record.encounter,
          patient: record.patient,
          primaryGuardian: record.primaryGuardian,
          veterinarianName: record.veterinarianName,
        });
      });
      setLiveQueueState({ records: result.queue, status: "ready" });

      if (
        explicitQueryEncounterId &&
        !result.queue.some(
          (record) => record.encounter.id === explicitQueryEncounterId,
        )
      ) {
        saveSelectedChartEncounterId(workspaceId, explicitQueryEncounterId);
        if (selectedEncounterId !== explicitQueryEncounterId) {
          selectEncounter(explicitQueryEncounterId);
        }
        return;
      }

      const nextSelectedEncounterId = chooseRecoverableLiveEncounterId({
        currentEncounterId: selectedEncounterId,
        explicitEncounterId: explicitQueryEncounterId,
        records: result.queue,
        workspaceId,
      });

      if (nextSelectedEncounterId) {
        saveSelectedChartEncounterId(workspaceId, nextSelectedEncounterId);
        if (selectedEncounterId !== nextSelectedEncounterId) {
          selectEncounter(nextSelectedEncounterId);
        }
      }
    }

    void loadLiveQueue();

    return () => {
      cancelled = true;
    };
  }, [
    actorHeaders,
    authHydrated,
    explicitQueryEncounterId,
    selectedDate,
    selectEncounter,
    selectedEncounterId,
    setLiveQueueState,
    workspaceId,
  ]);

  useEffect(() => {
    if (liveQueueStatus !== "ready" || liveItems.length === 0) return;
    if (liveItems.some((item) => item.id === selectedEncounterId)) return;
    if (explicitQueryEncounterId) return;
    saveSelectedChartEncounterId(workspaceId, liveItems[0].id);
    selectEncounter(liveItems[0].id);
  }, [
    explicitQueryEncounterId,
    liveItems,
    liveQueueStatus,
    selectEncounter,
    selectedEncounterId,
    workspaceId,
  ]);

  useEffect(() => {
    if (liveMode || items.length === 0) return;
    if (items.some((item) => item.id === selectedEncounterId)) return;
    if (explicitQueryEncounterId) return;
    selectEncounter(
      items.find((item) => item.id === legacySalesDemoDefaultEncounterId)?.id ??
        items[0].id,
    );
  }, [
    items,
    explicitQueryEncounterId,
    liveMode,
    selectEncounter,
    selectedEncounterId,
  ]);

  return (
    <EmrOrderQueueSidePanel
      emptyObjectLabel="진료 업무"
      filterAriaLabel="진료 대기 유형 필터"
      filterItems={chartQueueFilterItems}
      getFilterValue={(item) =>
        item.receptionType === "예약" ? "appointment" : "walk-in"
      }
      getActionItems={(item, onSelect) =>
        getChartQueueActionItems({
          item,
          onRequestCall: () => requestConsultationCall(item.id),
          onSelect,
        })
      }
      getTaskCardItem={getChartTaskCardItem}
      items={items}
      listLabel="진료 대기열"
      selectedDate={selectedDate}
      selectedItemId={selectedEncounterId}
      statuses={getChartQueueStatuses()}
      title="진료/차트"
      todayDate={todayDate}
      onCollapse={() => setModulePanelOpen(false)}
      onDateChange={(date) => {
        selectDate(date);
        if (selectedEncounterId) selectEncounter("");
      }}
      onSelectItem={selectWorkspaceEncounter}
    />
  );
}

export function ChartHeader({ workspaceId }: ShellComponentProps) {
  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const liveQueueRecords = useChartStore((state) => state.liveQueueRecords);
  const allowStoreMockFallback = useChartStore(
    (state) => state.liveQueueStatus !== "ready",
  );
  const demoScenarioEncounterId = useDemoScenarioChartEncounterId();
  const allowMockFallback =
    isLegacySalesDemoWorkspace(workspaceId) &&
    (allowStoreMockFallback ||
      selectedEncounterId === demoScenarioEncounterId);
  const bundle = getSelectedBundle(selectedEncounterId, liveQueueRecords, {
    allowMockFallback,
  });

  if (!bundle) return null;

  const veterinarianName = getChartBundleVeterinarianName(bundle);

  return (
    <EmrPatientContextBar
      patientItems={[
        { label: "차트번호", value: bundle.encounter.encounterNo },
        {
          label: "환자",
          value: `${bundle.patient.name} · 보호자 ${bundle.primaryGuardian?.name ?? "미지정"}`,
        },
        {
          label: "품종",
          value: bundle.patient.breed ?? getSpeciesLabel(bundle.patient),
        },
        { label: "나이", value: getPatientDisplayAge(bundle.patient) },
        { label: "성별", value: getPatientSexLabel(bundle.patient) },
      ]}
      vitalItems={getChartVitals(bundle)}
      memoActions={[
        {
          label: "방문목적",
          summary:
            bundle.encounter.visitPurpose ??
            bundle.encounter.chiefComplaint ??
            "방문 목적 기록 없음",
        },
        {
          label: "보호자 메모",
          locked: true,
          summary: bundle.primaryGuardian?.memo ?? "보호자 메모 없음",
          unavailableReason: "보호자 프로필 메모는 고객 정보 화면에서 관리합니다.",
        },
        {
          label: "환자 메모",
          summary:
            [
              bundle.patient.allergyNote,
              bundle.patient.specialNote,
              bundle.patient.handlingCautionNote,
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
      trailingItems={[{ label: "담당 수의사", value: veterinarianName }]}
    />
  );
}

export function ChartContentAside({ workspaceId }: ShellComponentProps) {
  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const liveQueueRecords = useChartStore((state) => state.liveQueueRecords);
  const allowStoreMockFallback = useChartStore(
    (state) => state.liveQueueStatus !== "ready",
  );
  const demoScenarioEncounterId = useDemoScenarioChartEncounterId();
  const allowMockFallback =
    isLegacySalesDemoWorkspace(workspaceId) &&
    (allowStoreMockFallback ||
      selectedEncounterId === demoScenarioEncounterId);
  const selectEncounter = useChartStore((state) => state.selectEncounter);
  const setContentAsideOpen = useLayoutStore(
    (state) => state.setContentAsideOpen,
  );
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<
    Set<string>
  >(() => new Set());
  const bundle = getSelectedBundle(selectedEncounterId, liveQueueRecords, {
    allowMockFallback,
  });
  const historyRows = useMemo(
    () => (bundle ? getChartHistoryRowsForBundle(bundle) : []),
    [bundle],
  );
  const historyGroups = useMemo(
    () =>
      historyRows.reduce<Array<{ date: string; rows: ChartHistoryRow[] }>>(
        (groups, row) => {
          const date = getShortDateTime(
            row.encounter.checkedInAt ?? row.encounter.createdAt,
          ).slice(0, 8);
          const group = groups.find((item) => item.date === date);

          if (group) {
            group.rows.push(row);
          } else {
            groups.push({ date, rows: [row] });
          }

          return groups;
        },
        [],
      ),
    [historyRows],
  );
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

  if (!bundle) return null;

  return (
    <EmrContentAsidePanel id="chart-content-aside">
      <EmrListHeader
        className="mx-0 h-6 border-y-0"
        count={historyRows.length}
        label="차트이력"
        leadingAction={
          <EmrListHeaderIconButton
            ariaLabel="차트 이력 목록 접기"
            iconSize="md"
            onClick={() => setContentAsideOpen(false)}
          >
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
      <div className="h-px w-full shrink-0 bg-[var(--emr-line-hairline)]" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 pb-3">
          {historyGroups.map((group) => (
            <EmrContentHistoryGroup
              key={group.date}
              collapsed={collapsedHistoryGroups.has(group.date)}
              count={group.rows.length}
              dataTestId={`chart-history-group-${group.date}`}
              label={group.date}
              onToggle={() => toggleHistoryGroup(group.date)}
            >
              {group.rows.map((row) => (
                <ChartHistoryItem
                  key={row.encounter.id}
                  bundle={bundle}
                  row={row}
                  selected={row.encounter.id === selectedEncounterId}
                  onSelect={() => selectEncounter(row.encounter.id)}
                />
              ))}
            </EmrContentHistoryGroup>
          ))}
        </div>
      </ScrollArea>
      <div className="flex shrink-0 gap-2 border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-workspace)] py-3">
        <Button variant="outline" size="sm" className="bg-card">
          수술 차트
        </Button>
        <Button size="sm">외래 차트 추가</Button>
      </div>
    </EmrContentAsidePanel>
  );
}

function ChartHistoryItem({
  bundle,
  onSelect,
  row,
  selected,
}: {
  bundle: ChartBundle;
  onSelect: () => void;
  row: ChartHistoryRow;
  selected: boolean;
}) {
  const primaryDiagnosis = row.diagnoses[0]?.diagnosisText;
  const summary =
    row.soapNote?.assessment ??
    primaryDiagnosis ??
    row.encounter.chiefComplaint ??
    "진료 기록 없음";
  const category = row.encounter.visitPurpose ?? "외래";
  const statusLabel = getStatusLabel("encounter", row.encounter.status);

  return (
    <EmrContentHistoryItem
      selected={selected}
      testId={`chart-history-item-${row.encounter.id}`}
      title={primaryDiagnosis ?? row.encounter.encounterNo}
      badge={
        <Badge
          variant="outline"
          className="h-5 shrink-0 rounded-md px-1.5 emr-text-micro"
        >
          {statusLabel}
        </Badge>
      }
      subtitle={
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0">{category}</span>
          <span className="truncate">{summary}</span>
        </span>
      }
      meta={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">
            담당 {getChartHistoryVeterinarianName(row, bundle)}
          </span>
          <span className="truncate">{row.encounter.encounterNo}</span>
          <span className="shrink-0">
            {getShortDateTime(
              row.encounter.checkedInAt ?? row.encounter.createdAt,
            )}
          </span>
        </span>
      }
      onSelect={onSelect}
    />
  );
}

const soapTemplateRows = [
  { label: "주관적", valueKey: "subjective" },
  { label: "객관적", valueKey: "objective" },
  { label: "평가", valueKey: "assessment" },
  { label: "계획", valueKey: "plan" },
] as const;

const soapDefaultTemplate: Record<
  (typeof soapTemplateRows)[number]["valueKey"],
  string
> = {
  subjective: "보호자 진술:",
  objective: "신체검사 소견:",
  assessment: "평가:",
  plan: "계획:",
};

const soapSystemOptions = [
  "소화기",
  "호흡기",
  "피부",
  "전신",
  "예방",
  "검사",
  "기타",
] as const;
const SOAP_VISIBLE_SYSTEM_TAB_COUNT = 3;

type SoapEditorField = {
  id: (typeof soapTemplateRows)[number]["valueKey"];
  label: string;
  value: string;
};

type SoapSectionState = {
  id: string;
  systemLabel?: string;
  title: string;
  fields: SoapEditorField[];
  content: string;
  status?: SoapNote["status"];
  statusAt?: string;
  attachmentCount: number;
  deletable: boolean;
  version: number;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function buildSoapEditorFields(
  soapNote?: SoapNote,
  useDefaultTemplate = true,
): SoapEditorField[] {
  return soapTemplateRows.map(({ label, valueKey }) => ({
    id: valueKey,
    label,
    value:
      soapNote?.[valueKey] ??
      (useDefaultTemplate ? soapDefaultTemplate[valueKey] : ""),
  }));
}

const buildSystemSoapId = (systemLabel: string) => `system-${systemLabel}`;

const createSystemSoapSection = (systemLabel: string): SoapSectionState => ({
  id: buildSystemSoapId(systemLabel),
  systemLabel,
  title: systemLabel,
  fields: buildSoapEditorFields(),
  content: buildSoapDocumentHtml(buildSoapEditorFields()),
  status: "draft",
  statusAt: undefined,
  attachmentCount: 0,
  deletable: true,
  version: 0,
});

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, "")
    .replaceAll("&nbsp;", " ")
    .trim();

function buildSoapDocumentHtml(fields: SoapEditorField[]) {
  return fields
    .map((field) => {
      const value = stripHtml(field.value);
      return `<p><strong>${escapeHtml(field.label)}</strong></p><p>${escapeHtml(value)}</p>`;
    })
    .join("");
}

const hasMeaningfulSoapContent = (section: SoapSectionState) => {
  const plainValue = stripHtml(section.content);
  const templateValue = stripHtml(
    buildSoapDocumentHtml(buildSoapEditorFields()),
  );
  return Boolean(plainValue && plainValue !== templateValue);
};

function getDemoActorHeader(session: AuthSession | null) {
  return getDemoActorHeaders(session);
}

function extractSoapFieldsFromHtml(content: string) {
  const fallback = {
    subjective: stripHtml(content),
    objective: "",
    assessment: "",
    plan: "",
  };

  if (typeof document === "undefined") return fallback;

  const labelToField = new Map<string, keyof typeof fallback>(
    soapTemplateRows.map(({ label, valueKey }) => [label, valueKey]),
  );
  const root = document.createElement("div");
  root.innerHTML = content;
  const paragraphs = Array.from(root.querySelectorAll("p"));
  const fields = { ...fallback, subjective: "" };
  let foundStructuredField = false;

  for (let index = 0; index < paragraphs.length; index += 1) {
    const label = paragraphs[index]?.textContent?.trim() ?? "";
    const field = labelToField.get(label);

    if (!field) continue;

    fields[field] = paragraphs[index + 1]?.textContent?.trim() ?? "";
    foundStructuredField = true;
  }

  return foundStructuredField ? fields : fallback;
}

async function loadChartSoapNote({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartSoapNoteRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/soap-notes?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartSoapNoteRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function saveChartSoapNote({
  actorHeaders,
  content,
  encounterId,
  expectedUpdatedAt,
  mode,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  content: string;
  encounterId: string;
  expectedUpdatedAt?: string | null;
  mode: "autosave" | "manual_save";
  workspaceId: string;
}): Promise<ChartSoapNoteRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/soap-notes`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({
          encounterId,
          expectedUpdatedAt,
          mode,
          ...extractSoapFieldsFromHtml(content),
        }),
      },
    );
    const body = (await response.json()) as ChartSoapNoteRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function loadChartCompletion({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartCompletionRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/completion?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartCompletionRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadChartDiagnoses({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartDiagnosisRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/diagnoses?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartDiagnosisRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function saveChartDiagnosesRoute({
  actorHeaders,
  diagnoses,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  diagnoses: EditableDiagnosis[];
  encounterId: string;
  workspaceId: string;
}): Promise<ChartDiagnosisRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/diagnoses`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({
          encounterId,
          diagnoses: diagnoses.map((diagnosis, index) => ({
            id: diagnosis.id,
            diagnosisCatalogId: diagnosis.diagnosisCatalogId,
            diagnosisText: diagnosis.diagnosisText,
            diagnosisType: diagnosis.diagnosisType,
            isPrimary: diagnosis.isPrimary,
            sortOrder: index,
          })),
        }),
      },
    );
    const body = (await response.json()) as ChartDiagnosisRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function loadChartOrderDraft({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartOrderDraftRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-drafts?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartOrderDraftRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadChartLiveQueue({
  actorHeaders,
  date,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  date: string;
  workspaceId: string;
}): Promise<ChartLiveQueueResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/live-queue?date=${encodeURIComponent(date)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartLiveQueueResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadChartOrderCatalog({
  actorHeaders,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  workspaceId: string;
}): Promise<ChartOrderCatalogRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/order-catalog?mode=chart-search`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartOrderCatalogRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function saveChartOrderDraftRoute({
  actorHeaders,
  encounterId,
  rows,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  rows: ChartOrderDraftRow[];
  workspaceId: string;
}): Promise<ChartOrderDraftRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-drafts`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({
          encounterId,
          orders: rows.map((row) => ({
            orderId: row.order.id,
            billingDisplayName: row.billingName,
            quantity: getDraftQuantity(row.quantityInput) ?? 0,
            ...(row.catalogSearchRow
              ? {
                  appliedSnapshot: row.catalogSearchRow.appliedSnapshot,
                  categoryGroup: row.catalogSearchRow.categoryGroup,
                  displayName: row.catalogSearchRow.displayName,
                  rowType: row.catalogSearchRow.rowType,
                  sourcePresetId: row.catalogSearchRow.sourcePresetId,
                  sourcePresetVersion: row.catalogSearchRow.sourcePresetVersion,
                  unitPriceSnapshot:
                    row.catalogSearchRow.appliedSnapshot.appliedPriceKrw,
                }
              : {}),
          })),
        }),
      },
    );
    const body = (await response.json()) as ChartOrderDraftRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function loadChartOrderActions({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartOrderActionRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-actions?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartOrderActionRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadChartOrderLifecycles({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartOrderLifecycleRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-lifecycle?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartOrderLifecycleRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadChartBillingCandidates({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartBillingCandidateRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/billing/invoice-candidates?encounterId=${encodeURIComponent(encounterId)}`,
      {
        cache: "no-store",
        headers: actorHeaders,
      },
    );
    const body = (await response.json()) as ChartBillingCandidateRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function saveChartOrderActionRoute({
  action,
  actorHeaders,
  catalogSelections,
  encounterId,
  orderIds,
  workspaceId,
}: {
  action: ChartOrderActionKind;
  actorHeaders?: Record<string, string>;
  catalogSelections?: ChartOrderCatalogSelectionInput[];
  encounterId: string;
  orderIds: string[];
  workspaceId: string;
}): Promise<ChartOrderActionRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/order-actions`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({
          action,
          catalogSelections,
          encounterId,
          orderIds,
        }),
      },
    );
    const body = (await response.json()) as ChartOrderActionRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function completeChartRoute({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartCompletionRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/completion`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({ encounterId }),
      },
    );
    const body = (await response.json()) as ChartCompletionRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function mutateConsultationFlowRoute({
  action,
  actorHeaders,
  encounterId,
  roomId,
  workspaceId,
}: {
  action: "call" | "start";
  actorHeaders?: Record<string, string>;
  encounterId: string;
  roomId?: string;
  workspaceId: string;
}): Promise<ConsultationFlowRouteResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/consultation-flow`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(actorHeaders ?? {}),
        },
        body: JSON.stringify({ action, encounterId, ...(roomId ? { roomId } : {}) }),
      },
    );
    const body = (await response.json()) as ConsultationFlowRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

function SoapPanel({
  actorHeaders,
  diagnoses,
  encounterId,
  onPersistedSoapNote,
  soapNote,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  diagnoses: Diagnosis[];
  encounterId: string;
  onPersistedSoapNote: (soapNote: SoapNote) => void;
  soapNote?: SoapNote;
  workspaceId: string;
}) {
  const defaultSection = useMemo<SoapSectionState>(() => {
    const fields = buildSoapEditorFields(soapNote);

    return {
      id: "default",
      title: "기본 SOAP",
      fields,
      content: buildSoapDocumentHtml(fields),
      status: soapNote?.status,
      statusAt:
        soapNote?.signedAt ?? soapNote?.autosavedAt ?? soapNote?.updatedAt,
      attachmentCount: 0,
      deletable: false,
      version: 0,
    };
  }, [soapNote]);
  const [sectionOverrides, setSectionOverrides] = useState<
    Record<string, SoapSectionState>
  >({});
  const [manualSystemLabels, setManualSystemLabels] = useState<string[]>([]);
  const [deletedSystemLabels, setDeletedSystemLabels] = useState<string[]>([]);
  const [activeSoapId, setActiveSoapId] = useState("default");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteSoapId, setDeleteSoapId] = useState<string | null>(null);
  const [resetSoapId, setResetSoapId] = useState<string | null>(null);
  const [pendingDefaultContent, setPendingDefaultContent] = useState<
    string | null
  >(null);
  const [saveState, setSaveState] = useState<SoapSaveState>("idle");
  const latestDefaultContentRef = useRef(defaultSection.content);
  const expectedUpdatedAtRef = useRef<string | null>(soapNote?.updatedAt ?? null);

  const diagnosisSystemSections = useMemo(() => {
    const labels = diagnoses.map(getSoapSystemLabel).filter(Boolean);
    return Array.from(new Set(labels));
  }, [diagnoses]);

  const systemLabels = useMemo(() => {
    const labels = [
      ...diagnosisSystemSections.filter(
        (systemLabel) => !deletedSystemLabels.includes(systemLabel),
      ),
      ...manualSystemLabels,
    ];
    return Array.from(new Set(labels));
  }, [deletedSystemLabels, diagnosisSystemSections, manualSystemLabels]);

  const soapSections = useMemo(
    () => [
      sectionOverrides.default ?? defaultSection,
      ...systemLabels.map((systemLabel) => {
        const id = buildSystemSoapId(systemLabel);
        return sectionOverrides[id] ?? createSystemSoapSection(systemLabel);
      }),
    ],
    [defaultSection, sectionOverrides, systemLabels],
  );
  const resolvedActiveSoapId = soapSections.some(
    (section) => section.id === activeSoapId,
  )
    ? activeSoapId
    : "default";
  const activeSection =
    soapSections.find((section) => section.id === resolvedActiveSoapId) ??
    soapSections[0];
  const addedSystemLabels = new Set(
    soapSections
      .map((section) => section.systemLabel)
      .filter(
        (systemLabel): systemLabel is string => typeof systemLabel === "string",
      ),
  );
  const systemSections = soapSections.filter(
    (section) => section.id !== "default",
  );
  const visibleSystemSections = systemSections.slice(
    0,
    SOAP_VISIBLE_SYSTEM_TAB_COUNT,
  );
  const overflowSystemSections = systemSections.slice(
    SOAP_VISIBLE_SYSTEM_TAB_COUNT,
  );
  const activeInOverflow = overflowSystemSections.some(
    (section) => section.id === resolvedActiveSoapId,
  );
  const deleteTarget = soapSections.find(
    (section) => section.id === deleteSoapId,
  );
  const resetTarget = soapSections.find(
    (section) => section.id === resetSoapId,
  );

  const updateSectionOverride = (section: SoapSectionState) => {
    setSectionOverrides((currentOverrides) => ({
      ...currentOverrides,
      [section.id]: section,
    }));
  };

  const updateActiveSoapContent = (content: string) => {
    if (!activeSection) return;
    updateSectionOverride({ ...activeSection, content });
    if (activeSection.id === "default") {
      latestDefaultContentRef.current = content;
      setPendingDefaultContent(content);
      setSaveState("saving");
    }
  };

  const persistDefaultSoapContent = async (
    content: string,
    mode: "autosave" | "manual_save",
  ) => {
    setSaveState("saving");
    const result = await saveChartSoapNote({
      actorHeaders,
      content,
      encounterId,
      expectedUpdatedAt: expectedUpdatedAtRef.current,
      mode,
      workspaceId,
    });

    if (!result.ok || !result.soapNote) {
      if (!result.ok && result.denialReason === "soap_note_conflict") {
        setSaveState("conflict");
        return;
      }
      setSaveState("error");
      return;
    }

    setSaveState("saved");
    latestDefaultContentRef.current = content;
    expectedUpdatedAtRef.current = result.soapNote.updatedAt;
    onPersistedSoapNote(result.soapNote);
    updateSectionOverride({
      ...defaultSection,
      content,
      status: result.soapNote.status,
      statusAt:
        result.soapNote.signedAt ??
        result.soapNote.autosavedAt ??
        result.soapNote.updatedAt,
      version: defaultSection.version + 1,
    });
  };

  useEffect(() => {
    latestDefaultContentRef.current = defaultSection.content;
  }, [defaultSection.content]);

  useEffect(() => {
    expectedUpdatedAtRef.current = soapNote?.updatedAt ?? null;
  }, [soapNote?.updatedAt]);

  useEffect(() => {
    if (pendingDefaultContent === null) return;

    const timerId = window.setTimeout(() => {
      void persistDefaultSoapContent(pendingDefaultContent, "autosave");
      setPendingDefaultContent(null);
    }, 800);

    return () => window.clearTimeout(timerId);
  }, [pendingDefaultContent]);

  const addSystemSoap = (systemLabel: string, shouldActivate: boolean) => {
    const nextSection = createSystemSoapSection(systemLabel);
    setDeletedSystemLabels((currentLabels) =>
      currentLabels.filter((label) => label !== systemLabel),
    );
    setManualSystemLabels((currentLabels) => {
      if (
        currentLabels.includes(systemLabel) ||
        diagnosisSystemSections.includes(systemLabel)
      )
        return currentLabels;
      return [...currentLabels, systemLabel];
    });
    setSectionOverrides((currentOverrides) =>
      currentOverrides[nextSection.id]
        ? currentOverrides
        : {
            ...currentOverrides,
            [nextSection.id]: nextSection,
          },
    );
    if (shouldActivate) {
      setActiveSoapId(nextSection.id);
    }
  };

  const confirmDeleteSoap = () => {
    if (!deleteTarget?.deletable) return;

    const sectionToRestore = deleteTarget;
    const targetIndex = soapSections.findIndex(
      (section) => section.id === deleteTarget.id,
    );
    const nextActiveId =
      targetIndex > 0
        ? (soapSections[targetIndex - 1]?.id ?? "default")
        : "default";

    if (deleteTarget.systemLabel) {
      setDeletedSystemLabels((currentLabels) =>
        currentLabels.includes(deleteTarget.systemLabel!)
          ? currentLabels
          : [...currentLabels, deleteTarget.systemLabel!],
      );
      setManualSystemLabels((currentLabels) =>
        currentLabels.filter((label) => label !== deleteTarget.systemLabel),
      );
    }
    setSectionOverrides((currentOverrides) => {
      const nextOverrides = { ...currentOverrides };
      delete nextOverrides[deleteTarget.id];
      return nextOverrides;
    });

    setActiveSoapId(nextActiveId);
    setDeleteSoapId(null);

    toast.success(`${sectionToRestore.title} SOAP를 삭제했습니다.`, {
      action: {
        label: "되돌리기",
        onClick: () => {
          if (sectionToRestore.systemLabel) {
            setDeletedSystemLabels((currentLabels) =>
              currentLabels.filter(
                (label) => label !== sectionToRestore.systemLabel,
              ),
            );
            setManualSystemLabels((currentLabels) =>
              currentLabels.includes(sectionToRestore.systemLabel!)
                ? currentLabels
                : [...currentLabels, sectionToRestore.systemLabel!],
            );
          }
          updateSectionOverride(sectionToRestore);
          setActiveSoapId(sectionToRestore.id);
        },
      },
    });
  };

  const confirmResetSoap = () => {
    if (!resetTarget) return;

    const previousSection = resetTarget;
    const resetFields = buildSoapEditorFields();
    updateSectionOverride({
      ...resetTarget,
      fields: resetFields,
      content: buildSoapDocumentHtml(resetFields),
      version: resetTarget.version + 1,
    });
    setResetSoapId(null);

    toast.success(
      `${previousSection.title} 내용을 기본 템플릿으로 초기화했습니다.`,
      {
        action: {
          label: "되돌리기",
          onClick: () => {
            updateSectionOverride(previousSection);
            setActiveSoapId(previousSection.id);
          },
        },
      },
    );
  };

  const soapTabItems = [
    { value: "default", label: "기본 SOAP" },
    ...visibleSystemSections.map((section) => ({
      value: section.id,
      label: section.title,
    })),
  ];
  const soapTabs = (
    <div className="relative z-20 flex min-w-0 flex-1 items-stretch gap-2.5">
      <ChartLineTabGroup
        aria-label="SOAP 분류"
        items={soapTabItems}
        value={resolvedActiveSoapId}
        onValueChange={setActiveSoapId}
      />
      {overflowSystemSections.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="SOAP 더보기"
            aria-pressed={activeInOverflow}
            className={cn(
              "inline-flex h-full shrink-0 items-center gap-1 px-2 emr-text-body font-semibold  outline-none transition-colors hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50",
              activeInOverflow ? "text-foreground" : "text-muted-foreground",
            )}
          >
            더보기
            <Badge variant="outline" className="ml-1 px-1.5 text-[10px]">
              {overflowSystemSections.length}
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {overflowSystemSections.map((section) => (
              <DropdownMenuItem
                key={section.id}
                className="h-8 cursor-pointer justify-between"
                onClick={() => setActiveSoapId(section.id)}
              >
                <span>{section.title}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`${section.title} SOAP 삭제`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteSoapId(section.id);
                  }}
                >
                  <CdsActionsXIcon className="size-3" />
                </Button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
  const activeStatusText =
    saveState === "loading"
      ? "저장 상태 확인 중"
      : saveState === "saving"
        ? "자동저장 중"
        : saveState === "conflict"
          ? "저장 충돌"
        : saveState === "error"
          ? "저장 실패"
          : getSoapSectionStatusText(
              activeSection?.status,
              activeSection?.statusAt,
            );

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] shadow-[var(--clair-shadow-xs)]">
      <div className="relative z-10 flex h-12 min-h-12 shrink-0 items-stretch justify-between gap-3 border-b border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4">
        {soapTabs}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-center bg-card"
          onClick={() => setAddDialogOpen(true)}
        >
          <CdsActionsPlusIcon data-icon="inline-start" />
          SOAP 추가
        </Button>
        {activeSection ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${activeSection.title}${activeSection.title.endsWith("SOAP") ? "" : " SOAP"} 작업`}
                  className="relative z-30 self-center text-muted-foreground"
                >
                  <CdsFilesMoreHorizontalIcon className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                className="h-8 cursor-pointer"
                onClick={() => setResetSoapId(activeSection.id)}
              >
                <CdsActionsRotateCcwIcon data-icon="inline-start" />
                초기화
              </DropdownMenuItem>
              <DropdownMenuItem
                className="h-8 cursor-pointer"
                onClick={() => {
                  updateSectionOverride({
                    ...activeSection,
                    attachmentCount: activeSection.attachmentCount + 1,
                  });
                }}
              >
                첨부
                {activeSection.attachmentCount
                  ? ` ${activeSection.attachmentCount}`
                  : ""}
              </DropdownMenuItem>
              {activeSection.deletable ? (
                <DropdownMenuItem
                  className="h-8 cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => setDeleteSoapId(activeSection.id)}
                >
                  <CdsActionsTrash2Icon data-icon="inline-start" />
                  삭제
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {saveState === "conflict" ? (
        <div
          role="alert"
          className="border-b border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] px-4 py-2 text-sm text-[var(--emr-status-warning-text)]"
        >
          다른 탭이나 사용자가 먼저 SOAP를 저장했어. 현재 입력은 유지되며, 최신 내용을 확인한 뒤 다시 저장해.
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--emr-surface-panel)]">
        {activeSection ? (
          <div className="flex min-h-0 flex-1 flex-col bg-[var(--emr-surface-panel)]">
            <SoapRichTextEditor
              key={`${soapNote?.id ?? "empty"}-${soapNote?.updatedAt ?? "initial"}-${activeSection.id}-${activeSection.version}`}
              initialContent={activeSection.content}
              label={activeSection.title}
              onContentChange={updateActiveSoapContent}
            />
            <div className="flex min-h-9 items-center justify-between border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 emr-text-metadata text-muted-foreground">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground"
                  onClick={() => setResetSoapId(activeSection.id)}
                >
                  <CdsActionsRotateCcwIcon data-icon="inline-start" />
                  초기화
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-destructive hover:text-destructive"
                  disabled={!activeSection.deletable}
                  onClick={() => setDeleteSoapId(activeSection.id)}
                >
                  <CdsActionsTrash2Icon data-icon="inline-start" />
                  삭제
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground"
                  disabled={activeSection.id !== "default"}
                  onClick={() =>
                    void persistDefaultSoapContent(
                      latestDefaultContentRef.current,
                      "manual_save",
                    )
                  }
                >
                  <CdsActionsSaveIcon data-icon="inline-start" />
                  SOAP 저장
                </Button>
                <span>{activeStatusText}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-[460px] gap-0 p-0" showCloseButton>
          <DialogHeader className="border-b border-[var(--emr-line-hairline)] px-6 py-5">
            <DialogTitle className="text-[18px] font-bold leading-6 text-foreground">
              SOAP 진단계통 선택
            </DialogTitle>
            <DialogDescription className="emr-text-dense">
              진단명 섹션의 계통분류와 같은 기준으로 SOAP 탭을 추가합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1 p-3">
            {soapSystemOptions.map((systemLabel) => {
              const alreadyAdded = addedSystemLabels.has(systemLabel);

              return (
                <button
                  key={systemLabel}
                  type="button"
                  disabled={alreadyAdded}
                  className="flex min-h-11 items-center justify-between rounded-md px-3 text-left emr-text-dense transition-colors hover:bg-[var(--emr-state-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    addSystemSoap(systemLabel, true);
                    setAddDialogOpen(false);
                  }}
                >
                  <span className="font-semibold text-foreground">
                    {systemLabel}
                  </span>
                  {alreadyAdded ? (
                    <Badge variant="outline">이미 추가됨</Badge>
                  ) : null}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteSoapId !== null}
        onOpenChange={(open) => !open && setDeleteSoapId(null)}
      >
        {deleteTarget ? (
          <EmrConfirmDialogContent
            title={`${deleteTarget.title} SOAP 삭제`}
            description={
              hasMeaningfulSoapContent(deleteTarget)
                ? "작성된 SOAP 내용이 삭제됩니다. 계속할까요?"
                : "이 SOAP 탭을 삭제할까요?"
            }
            cancelLabel="취소"
            confirmLabel="삭제"
            confirmButtonVariant="destructive"
            onCancel={() => setDeleteSoapId(null)}
            onConfirm={confirmDeleteSoap}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={resetSoapId !== null}
        onOpenChange={(open) => !open && setResetSoapId(null)}
      >
        {resetTarget ? (
          <EmrConfirmDialogContent
            title={`${resetTarget.title} SOAP 초기화`}
            description="현재 SOAP의 주관적, 객관적, 평가, 계획 내용을 기본 템플릿으로 되돌립니다."
            cancelLabel="취소"
            confirmLabel="초기화"
            onCancel={() => setResetSoapId(null)}
            onConfirm={confirmResetSoap}
          />
        ) : null}
      </Dialog>
    </section>
  );
}

function AssessmentPanel({
  diagnosisRows,
  onDiagnosisRowsChange,
  saveStatusText,
  setDiagnosisRows,
  soapNote,
}: {
  diagnosisRows: EditableDiagnosis[];
  onDiagnosisRowsChange: (rows: EditableDiagnosis[]) => void;
  saveStatusText: string;
  setDiagnosisRows: Dispatch<SetStateAction<EditableDiagnosis[]>>;
  soapNote?: SoapNote;
}) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchResults = useMemo(
    () => getDiagnosisSearchResults(searchQuery, soapNote),
    [searchQuery, soapNote],
  );
  const normalizedSearchQuery = normalizeDiagnosisQuery(searchQuery);
  const canAddFreeText =
    normalizedSearchQuery.length > 0 &&
    !diagnosisCatalog.some(
      (item) => normalizeDiagnosisQuery(item.name) === normalizedSearchQuery,
    );
  const resultModeLabel = normalizedSearchQuery
    ? "검색 결과"
    : "SOAP/주호소 기반 추천";
  const commitDiagnosisRows = (nextRows: EditableDiagnosis[]) => {
    setDiagnosisRows(nextRows);
    onDiagnosisRowsChange(nextRows);
  };

  const addDiagnosisFromCatalog = (item: DiagnosisCatalogItem) => {
    if (diagnosisRows.some((row) => row.diagnosisText === item.name)) return;

    commitDiagnosisRows([
      ...diagnosisRows,
      {
        catalogMatched: true,
        createdAt: new Date().toISOString(),
        createdByUserId: "user-vet-suji",
        diagnosisCatalogId: item.id,
        diagnosisText: item.name,
        diagnosisType: item.defaultType,
        encounterId: soapNote?.encounterId ?? "session-only-encounter",
        id: `diagnosis-session-${item.id}`,
        isPrimary: diagnosisRows.length === 0,
        sortOrder: diagnosisRows.length,
        systemLabel: item.systemLabel,
      },
    ]);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const addFreeTextDiagnosis = () => {
    const diagnosisText = searchQuery.trim();
    if (!diagnosisText) return;

    if (
      diagnosisRows.some(
        (row) =>
          normalizeDiagnosisQuery(row.diagnosisText) === normalizedSearchQuery,
      )
    ) {
      return;
    }

    commitDiagnosisRows([
      ...diagnosisRows,
      {
        catalogMatched: false,
        createdAt: new Date().toISOString(),
        createdByUserId: "user-vet-suji",
        diagnosisText,
        diagnosisType: "suspected",
        encounterId: soapNote?.encounterId ?? "session-only-encounter",
        id: `diagnosis-session-free-${normalizedSearchQuery.replace(/\s+/g, "-")}`,
        isPrimary: diagnosisRows.length === 0,
        sortOrder: diagnosisRows.length,
        systemLabel: getDiagnosisSystemLabel({
          createdAt: "",
          createdByUserId: "",
          diagnosisText,
          diagnosisType: "suspected",
          encounterId: "",
          id: "",
        }),
      },
    ]);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const toggleConfirmedDiagnosis = (diagnosisId: string) => {
    commitDiagnosisRows(
      diagnosisRows.map((row) =>
        row.id === diagnosisId
          ? {
              ...row,
              diagnosisType:
                row.diagnosisType === "confirmed" ? "suspected" : "confirmed",
            }
          : row,
      ),
    );
  };

  const togglePrimaryDiagnosis = (diagnosisId: string) => {
    commitDiagnosisRows(
      diagnosisRows.map((row) =>
        row.id === diagnosisId ? { ...row, isPrimary: !row.isPrimary } : row,
      ),
    );
  };

  const removeDiagnosis = (diagnosisId: string) => {
    commitDiagnosisRows(diagnosisRows.filter((row) => row.id !== diagnosisId));
  };

  return (
    <section
      aria-label="진단명 관리"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] shadow-[var(--clair-shadow-xs)]"
    >
      <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4 py-2">
        <span className="flex min-w-0 items-center gap-2">
          <ChartSectionTitle title="진단명" />
          <span
            data-testid="chart-diagnosis-save-status"
            className="emr-text-metadata font-medium text-muted-foreground"
          >
            {saveStatusText}
          </span>
        </span>
        <Button
          variant="outline"
          size="sm"
          className="bg-card"
          onClick={() => {
            setSearchOpen(true);
            searchInputRef.current?.focus();
          }}
        >
          분류검색
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--emr-surface-panel)] p-4">
        <div className="grid gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger
                nativeButton={false}
                render={<div className="relative min-w-0" />}
              >
                <CdsActionsSearchIcon
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  ref={searchInputRef}
                  aria-label="진단명 검색"
                  autoComplete="off"
                  placeholder="한글, 영문, 약자, 연관검색어로 진단명 검색"
                  value={searchQuery}
                  className="h-9 bg-[var(--emr-surface-panel)] pl-9 emr-text-dense"
                  onFocus={() => setSearchOpen(true)}
                  onValueChange={(value) => {
                    setSearchQuery(value);
                    setSearchOpen(true);
                  }}
                />
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="max-h-72 w-[var(--anchor-width)] gap-1 overflow-y-auto p-1.5"
                initialFocus={false}
              >
                <div className="px-2 py-1 emr-text-micro font-semibold text-muted-foreground">
                  {resultModeLabel}
                </div>
                <div
                  role="listbox"
                  aria-label="진단명 검색 결과"
                  className="grid gap-1"
                >
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={diagnosisRows.some(
                        (row) => row.diagnosisText === item.name,
                      )}
                      className="grid gap-1 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[var(--emr-state-hover)] aria-selected:bg-[var(--emr-state-selected)]"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addDiagnosisFromCatalog(item)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className="shrink-0">
                          {item.systemLabel}
                        </Badge>
                        <span className="truncate emr-text-dense font-semibold text-foreground">
                          {item.name}
                        </span>
                        <span className="shrink-0 emr-text-micro text-muted-foreground">
                          {diagnosisTypeLabel[item.defaultType]}
                        </span>
                      </span>
                      <span className="truncate emr-text-micro text-muted-foreground">
                        {item.hint}
                      </span>
                    </button>
                  ))}
                  {canAddFreeText ? (
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      className="rounded-md border border-dashed border-[var(--emr-line-hairline)] px-2.5 py-2 text-left emr-text-dense transition-colors hover:bg-[var(--emr-state-hover)]"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={addFreeTextDiagnosis}
                    >
                      <span className="font-semibold">
                        ‘{searchQuery.trim()}’ 직접 추가
                      </span>
                      <span className="mt-0.5 block emr-text-micro text-muted-foreground">
                        카탈로그 미연결 진단명으로 이 차트에만 표시
                      </span>
                    </button>
                  ) : null}
                  {!searchResults.length && !canAddFreeText ? (
                    <div className="px-2.5 py-3 emr-text-metadata text-muted-foreground">
                      표시할 추천 진단명이 없습니다.
                    </div>
                  ) : null}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              size="sm"
              className="h-9 bg-card px-0"
              onClick={() => {
                setSearchOpen(true);
                searchInputRef.current?.focus();
              }}
            >
              검색
            </Button>
          </div>
          <div className="overflow-hidden rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]">
            <div className="grid grid-cols-[86px_minmax(0,1fr)_56px_56px_72px] bg-[var(--emr-surface-muted)] px-3 py-2 emr-text-metadata font-semibold text-muted-foreground">
              <span>계통분류</span>
              <span>진단명</span>
              <span>확진</span>
              <span>중점</span>
              <span>수의사</span>
            </div>
            {diagnosisRows.map((diagnosis) => (
              <div
                key={diagnosis.id}
                className="grid grid-cols-[86px_minmax(0,1fr)_56px_56px_72px] items-center border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 py-2 emr-text-dense"
              >
                <Badge variant="outline">{diagnosis.systemLabel}</Badge>
                <EmrTableCellText
                  mode="two-line-if-long"
                  fullText={diagnosis.diagnosisText}
                  className="font-medium"
                >
                  {diagnosis.diagnosisText}
                </EmrTableCellText>
                <button
                  type="button"
                  aria-label={`${diagnosis.diagnosisText} 확진 토글`}
                  aria-pressed={diagnosis.diagnosisType === "confirmed"}
                  className="w-fit rounded-md px-2 py-1 emr-text-metadata font-semibold text-muted-foreground transition-colors hover:bg-[var(--emr-state-hover)] aria-pressed:bg-[var(--emr-state-selected)] aria-pressed:text-foreground"
                  onClick={() => toggleConfirmedDiagnosis(diagnosis.id)}
                >
                  {diagnosis.diagnosisType === "confirmed" ? "✓" : "-"}
                </button>
                <button
                  type="button"
                  aria-label={`${diagnosis.diagnosisText} 중점 진단 표시`}
                  aria-pressed={diagnosis.isPrimary}
                  className="w-fit rounded-md px-2 py-1 emr-text-metadata font-semibold text-muted-foreground transition-colors hover:bg-[var(--emr-state-hover)] aria-pressed:bg-[var(--emr-state-selected)] aria-pressed:text-foreground"
                  onClick={() => togglePrimaryDiagnosis(diagnosis.id)}
                >
                  {diagnosis.isPrimary ? "✓" : "-"}
                </button>
                <span className="flex min-w-0 items-center justify-between gap-1">
                  <EmrTableCellText
                    mode="one-line"
                    fullText={
                      getChartStaffName(diagnosis.createdByUserId) ?? "미정"
                    }
                  >
                    {getChartStaffName(diagnosis.createdByUserId) ?? "미정"}
                  </EmrTableCellText>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`${diagnosis.diagnosisText} 삭제`}
                    onClick={() => removeDiagnosis(diagnosis.id)}
                  >
                    <CdsActionsXIcon className="size-3" />
                  </Button>
                </span>
              </div>
            ))}
            {!diagnosisRows.length ? (
              <div className="border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 py-6 text-center emr-text-dense text-muted-foreground">
                진단 입력 전입니다.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function AssessmentHistory({
  historyRows,
}: {
  historyRows: ChartHistoryRow[];
}) {
  return (
    <section className="rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="emr-text-body font-semibold">진단 이력</h2>
        <Badge variant="outline">{historyRows.length}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {historyRows.map((row) => (
          <div
            key={row.encounter.id}
            className="rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {getShortDateTime(
                  row.encounter.checkedInAt ?? row.encounter.createdAt,
                )}
              </span>
              <Badge variant="outline">
                {getStatusLabel("encounter", row.encounter.status)}
              </Badge>
            </div>
            <p className="mt-2 emr-text-dense leading-5">
              {row.soapNote?.assessment ?? getDiagnosisLabel(row.diagnoses)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ChartRightPanel({ workspaceId }: ShellComponentProps) {
  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const liveQueueRecords = useChartStore((state) => state.liveQueueRecords);
  const allowStoreMockFallback = useChartStore(
    (state) => state.liveQueueStatus !== "ready",
  );
  const demoScenarioEncounterId = useDemoScenarioChartEncounterId();
  const allowMockFallback =
    isLegacySalesDemoWorkspace(workspaceId) &&
    (allowStoreMockFallback ||
      selectedEncounterId === demoScenarioEncounterId);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
  const bundle = getSelectedBundle(selectedEncounterId, liveQueueRecords, {
    allowMockFallback,
  });
  const historyRows = useMemo(
    () => (bundle ? getChartHistoryRowsForBundle(bundle) : []),
    [bundle],
  );

  if (!bundle) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 items-center border-b border-[var(--emr-line-hairline)] px-3">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="flex min-w-0 max-w-full items-center gap-1">
            <h2 className="min-w-0 truncate text-sm font-semibold">
              환자 정보
            </h2>
            <EmrListHeaderIconButton
              ariaLabel="환자 정보 패널 접기"
              iconSize="md"
              onClick={() => setRightPanelOpen(false)}
            >
              <CdsNavigationChevronsRightIcon className="size-4" />
            </EmrListHeaderIconButton>
          </div>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          <AssessmentHistory historyRows={historyRows} />
          <section className="rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] p-3">
            <div className="font-semibold">개인/민감 정보</div>
            <p className="mt-2 emr-text-metadata leading-5 text-muted-foreground">
              보호자 메모:{" "}
              {bundle.primaryGuardian?.memo ??
                "물 섭취 후 재구토, 검사 비용 설명을 먼저 요청."}
            </p>
          </section>
          <section className="rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] p-3">
            <div className="font-semibold">부가 정보</div>
            <p className="mt-2 emr-text-metadata leading-5 text-muted-foreground">
              환자 메모:{" "}
              {bundle.patient.specialNote ??
                "진료대에서 긴장도가 높아 보호자 동석 권장."}
            </p>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

type ChartOrderTableRow = {
  groupTitle: string;
  order: EmrOrder;
};

type ChartOrderDraftRow = ChartOrderTableRow & {
  billingCandidateId?: string | null;
  billingName: string;
  committedBillingName: string;
  committedQuantityInput: string;
  catalogSearchRow?: ChartOrderCatalogSearchRow;
  quantityInput: string;
  unitPrice?: number;
};

type ChartOrderSortKey =
  | "groupTitle"
  | "orderType"
  | "status"
  | "displayName"
  | "billingName"
  | "quantity"
  | "unitPrice"
  | "lineTotal"
  | "requestedBy";

type ChartOrderSortState = {
  direction: "asc" | "desc";
  key: ChartOrderSortKey;
} | null;

const chartOrderSortLabels: Record<ChartOrderSortKey, string> = {
  billingName: "청구서명",
  displayName: "Order명",
  groupTitle: "그룹",
  lineTotal: "청구금액",
  orderType: "분류",
  quantity: "수량",
  requestedBy: "수의사",
  status: "상태",
  unitPrice: "단가",
};

const chartOrderStatusOrder: EmrOrderStatus[] = [
  "requested",
  "re_requested",
  "in_progress",
  "confirmed",
  "completed",
  "cancelled",
];

const getChartOrderDraftRows = (
  orderGroups: ChartOrderGroup[],
): ChartOrderDraftRow[] =>
  orderGroups.flatMap(({ group, orders }) =>
    orders.map((order) => {
      const invoiceLine = getChartInvoiceLineByOrderId(order.id);
      const quantityInput = String(invoiceLine?.quantity ?? 1);
      const billingName = invoiceLine?.description ?? order.displayName;

      return {
        billingName,
        committedBillingName: billingName,
        committedQuantityInput: quantityInput,
        groupTitle: group?.title ?? "개별 오더",
        order,
        quantityInput,
        unitPrice: invoiceLine?.unitPrice,
      };
    }),
  );

const applyPersistedOrderDrafts = (
  rows: ChartOrderDraftRow[],
  snapshots: ChartOrderDraftSnapshot[],
  options: { preserveMissingRows?: boolean } = {},
): ChartOrderDraftRow[] => {
  const snapshotByOrderId = new Map(
    snapshots.map((snapshot) => [snapshot.orderId, snapshot]),
  );

  return (
    options.preserveMissingRows
      ? rows
      : rows.filter((row) => snapshotByOrderId.has(row.order.id))
  ).map((row) => {
    const snapshot = snapshotByOrderId.get(row.order.id);
    if (!snapshot) return row;

    const quantityInput = String(snapshot.quantity);

    return {
      ...row,
      billingName: snapshot.billingDisplayName,
      committedBillingName: snapshot.billingDisplayName,
      committedQuantityInput: quantityInput,
      quantityInput,
      unitPrice: snapshot.unitPriceSnapshot,
    };
  });
};

const getChartCatalogSourceKey = ({
  sourcePresetId,
}: Pick<ChartOrderCatalogSearchRow, "sourcePresetId">) => sourcePresetId;

const getChartDraftRowCatalogSourceKey = (row: ChartOrderDraftRow) => {
  if (row.catalogSearchRow)
    return getChartCatalogSourceKey(row.catalogSearchRow);

  const legacyCatalogId = row.order.id.match(
    /^catalog-(?:individual|set)-(.+)$/,
  );
  if (legacyCatalogId?.[1]) return legacyCatalogId[1];

  return row.order.serviceItemId;
};

const hasChartCatalogDraftIdentity = (row: ChartOrderDraftRow) =>
  Boolean(row.catalogSearchRow) ||
  /^catalog-(?:individual|set)-/.test(row.order.id);

const chartOrderDraftUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isChartOrderDraftUuid(value: string) {
  return chartOrderDraftUuidPattern.test(value);
}

function prepareChartOrderDraftRowsForPersistence(rows: ChartOrderDraftRow[]) {
  const orderIdMap = new Map<string, string>();
  const nextRows = rows.map((row) => {
    if (
      isChartOrderDraftUuid(row.order.id) ||
      !hasChartCatalogDraftIdentity(row)
    ) {
      return row;
    }

    const nextOrderId = createChartOrderDraftId();
    orderIdMap.set(row.order.id, nextOrderId);

    return {
      ...row,
      order: {
        ...row.order,
        id: nextOrderId,
      },
    };
  });

  return { orderIdMap, rows: nextRows };
}

function remapChartOrderIdSet(
  orderIds: Set<string>,
  orderIdMap: Map<string, string>,
) {
  if (orderIdMap.size === 0) return orderIds;

  return new Set(
    Array.from(orderIds).map((orderId) => orderIdMap.get(orderId) ?? orderId),
  );
}

const applyPersistedOrderActions = (
  rows: ChartOrderDraftRow[],
  snapshots: ChartOrderActionSnapshot[],
  workspaceId: string,
): ChartOrderDraftRow[] => {
  const snapshotByOrderId = new Map(
    snapshots.map((snapshot) => [snapshot.orderId, snapshot]),
  );

  const nextRows = rows.map((row) => {
    const snapshot = snapshotByOrderId.get(row.order.id);
    if (!snapshot) return row;

    return {
      ...row,
      billingCandidateId:
        snapshot.billingCandidateId === undefined
          ? row.billingCandidateId
          : snapshot.billingCandidateId,
      order: {
        ...row.order,
        status: snapshot.status,
        updatedAt: snapshot.updatedAt,
      },
    };
  });

  const existingOrderIds = new Set(nextRows.map((row) => row.order.id));
  const restoredRows = snapshots
    .filter(
      (snapshot) =>
        snapshot.appliedSnapshot && !existingOrderIds.has(snapshot.orderId),
    )
    .map((snapshot, index) => {
      const applied = snapshot.appliedSnapshot;
      const now = snapshot.updatedAt;
      const orderType = applied?.orderType ?? "treatment";
      const order: EmrOrder = {
        id: snapshot.orderId,
        workspaceId,
        encounterId: snapshot.encounterId,
        serviceItemId: applied?.sourcePresetId,
        orderType,
        displayName:
          applied?.inHospitalOrderName ??
          applied?.standardOrderName ??
          applied?.billingName ??
          "Catalog Order",
        status: snapshot.status,
        workStatus: "pending",
        priority: "normal",
        requestedByUserId: snapshot.confirmedByUserId ?? "user-vet",
        requestedAt: snapshot.confirmedAt ?? now,
        sortOrder: (rows.length + index + 1) * 10,
        createdAt: snapshot.confirmedAt ?? now,
        updatedAt: now,
      };
      const quantityInput = String(applied?.quantity ?? 1);

      return {
        billingName: applied?.billingName ?? order.displayName,
        committedBillingName: applied?.billingName ?? order.displayName,
        committedQuantityInput: quantityInput,
        groupTitle: "Workspace catalog",
        order,
        quantityInput,
        unitPrice: applied?.priceKrw,
      } satisfies ChartOrderDraftRow;
    });

  return [...nextRows, ...restoredRows];
};

const applyPersistedOrderLifecycles = (
  rows: ChartOrderDraftRow[],
  snapshots: ChartOrderLifecycleSnapshot[],
): ChartOrderDraftRow[] => {
  const snapshotByOrderId = new Map(
    snapshots.map((snapshot) => [snapshot.orderId, snapshot]),
  );

  return rows.map((row) => {
    const snapshot = snapshotByOrderId.get(row.order.id);
    if (!snapshot) return row;

    return {
      ...row,
      order: {
        ...row.order,
        status: snapshot.status,
        updatedAt: snapshot.updatedAt,
      },
    };
  });
};

const applyBillingCandidatesToOrderRows = (
  rows: ChartOrderDraftRow[],
  candidates: ChartBillingCandidateSnapshot[],
): ChartOrderDraftRow[] => {
  const candidateByOrderId = new Map(
    candidates.map((candidate) => [candidate.orderId, candidate]),
  );

  return rows.map((row) => {
    const candidate = candidateByOrderId.get(row.order.id);
    if (!candidate) return row;

    return {
      ...row,
      billingCandidateId: candidate.billingCandidateId,
    };
  });
};

const isChartOrderIncompleteForBilling = (row: ChartOrderDraftRow) =>
  row.order.status !== "completed" && row.order.status !== "cancelled";

const getChartOrderStatusLabel = (row: ChartOrderDraftRow) => {
  if (row.billingCandidateId) return "수납 후보";
  return orderStatusLabel[row.order.status];
};

const getDraftQuantity = (quantityInput: string) => {
  const quantity = Number(quantityInput);

  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
};

const getDraftLineTotal = (row: ChartOrderDraftRow) => {
  const quantity = getDraftQuantity(row.quantityInput);

  if (quantity === null || row.unitPrice === undefined) return undefined;

  return quantity * row.unitPrice;
};

const isChartOrderDraftRowDirty = (row: ChartOrderDraftRow) =>
  row.billingName !== row.committedBillingName ||
  row.quantityInput !== row.committedQuantityInput;

type ChartOrderTableColumn = {
  align?: "left" | "center" | "right";
  className: string;
  interaction: EmrTableHeaderInteraction;
  label: string;
  resize: EmrColumnResize;
};

const chartOrderTableColumns: ChartOrderTableColumn[] = [
  {
    className: "w-10 px-3",
    interaction: "static",
    label: "선택",
    resize: "none",
  },
  {
    className: "w-[132px]",
    interaction: "compound",
    label: "그룹",
    resize: "data-column",
  },
  {
    className: "w-[72px]",
    interaction: "filterable",
    label: "분류",
    resize: "data-column",
  },
  {
    className: "w-[76px]",
    interaction: "filterable",
    label: "상태",
    resize: "data-column",
  },
  {
    className: "w-[260px]",
    interaction: "compound",
    label: "Order명",
    resize: "data-column",
  },
  {
    className: "w-[220px]",
    interaction: "compound",
    label: "청구서명",
    resize: "data-column",
  },
  {
    align: "right",
    className: "w-[68px]",
    interaction: "sortable",
    label: "수량",
    resize: "data-column",
  },
  {
    align: "right",
    className: "w-[84px]",
    interaction: "sortable",
    label: "단가",
    resize: "data-column",
  },
  {
    align: "right",
    className: "w-[96px]",
    interaction: "sortable",
    label: "청구금액",
    resize: "data-column",
  },
  {
    className: "w-[76px]",
    interaction: "filterable",
    label: "수의사",
    resize: "data-column",
  },
  {
    align: "right",
    className: "w-[116px]",
    interaction: "static",
    label: "작업",
    resize: "none",
  },
];

function getChartOrderNumericValue(
  row: ChartOrderDraftRow,
  key: "quantity" | "unitPrice" | "lineTotal",
) {
  if (key === "quantity") return getDraftQuantity(row.quantityInput);
  if (key === "unitPrice") return row.unitPrice ?? null;

  return getDraftLineTotal(row) ?? null;
}

function compareNullableNumbers(a: number | null, b: number | null) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  return a - b;
}

function compareChartOrderValues(
  a: ChartOrderDraftRow,
  b: ChartOrderDraftRow,
  key: ChartOrderSortKey,
) {
  if (key === "groupTitle") {
    return a.groupTitle.localeCompare(b.groupTitle, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });
  }

  if (key === "orderType") {
    return (
      chartOrderTabs.findIndex((tab) => tab.value === a.order.orderType) -
      chartOrderTabs.findIndex((tab) => tab.value === b.order.orderType)
    );
  }

  if (key === "status") {
    return (
      chartOrderStatusOrder.indexOf(a.order.status) -
      chartOrderStatusOrder.indexOf(b.order.status)
    );
  }

  if (key === "displayName") {
    return a.order.displayName.localeCompare(b.order.displayName, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });
  }

  if (key === "billingName") {
    return a.billingName.localeCompare(b.billingName, "ko-KR", {
      numeric: true,
      sensitivity: "base",
    });
  }

  if (key === "requestedBy") {
    return (
      getChartStaffName(a.order.requestedByUserId) ?? "미정"
    ).localeCompare(
      getChartStaffName(b.order.requestedByUserId) ?? "미정",
      "ko-KR",
      { numeric: true, sensitivity: "base" },
    );
  }

  return compareNullableNumbers(
    getChartOrderNumericValue(a, key),
    getChartOrderNumericValue(b, key),
  );
}

function sortChartOrderRows(
  rows: ChartOrderDraftRow[],
  sortState: ChartOrderSortState,
) {
  if (!sortState) return rows;

  return rows
    .map((row, index) => ({ index, row }))
    .sort((a, b) => {
      const compared = compareChartOrderValues(a.row, b.row, sortState.key);
      if (compared === 0) return a.index - b.index;

      return sortState.direction === "asc" ? compared : -compared;
    })
    .map((entry) => entry.row);
}

function ChartOrderSortableHead({
  align = "left",
  className,
  columnKey,
  interaction = "sortable",
  label,
  onSort,
  resize = "data-column",
  sortState,
}: {
  align?: "left" | "center" | "right";
  className?: string;
  columnKey: ChartOrderSortKey;
  interaction?: EmrTableHeaderInteraction;
  label: string;
  onSort: (key: ChartOrderSortKey) => void;
  resize?: EmrColumnResize;
  sortState: ChartOrderSortState;
}) {
  const active = sortState?.key === columnKey;
  const nextAction =
    !active || !sortState
      ? `${label} 오름차순 정렬`
      : sortState.direction === "asc"
        ? `${label} 내림차순 정렬`
        : `${label} 정렬 해제`;
  const activeDirectionLabel =
    sortState?.direction === "asc"
      ? "오름차순"
      : sortState?.direction === "desc"
        ? "내림차순"
        : "";
  const ariaLabel = active
    ? `현재 정렬: ${label} ${activeDirectionLabel}. 클릭하면 ${nextAction}.`
    : `정렬 없음. 클릭하면 ${nextAction}.`;

  return (
    <EmrTableHeaderCell
      align={align}
      className={className}
      interaction={interaction}
      resize={resize}
      sortDirection={active ? sortState.direction : undefined}
      sortLabel={ariaLabel}
      title={ariaLabel}
      onSort={() => onSort(columnKey)}
    >
      {label}
    </EmrTableHeaderCell>
  );
}

function ChartOrderTable({
  allVisibleSelected,
  density,
  hasCommittedRows,
  invalidOrderIds,
  onAddOrder,
  onDeleteOrder,
  onSort,
  onToggleAll,
  onToggleOrder,
  onUpdateBillingName,
  onUpdateQuantity,
  onUnavailableAction,
  rows,
  selectedOrderIds,
  someVisibleSelected,
  sortState,
}: {
  allVisibleSelected: boolean;
  density: EmrTableDensity;
  hasCommittedRows: boolean;
  invalidOrderIds: Set<string>;
  onAddOrder: () => void;
  onDeleteOrder: (orderId: string) => void;
  onSort: (key: ChartOrderSortKey) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleOrder: (orderId: string, checked: boolean) => void;
  onUpdateBillingName: (orderId: string, billingName: string) => void;
  onUpdateQuantity: (orderId: string, quantityInput: string) => void;
  onUnavailableAction: (
    action: ChartUnavailableAction,
    targetName?: string,
  ) => void;
  rows: ChartOrderDraftRow[];
  selectedOrderIds: Set<string>;
  someVisibleSelected: boolean;
  sortState: ChartOrderSortState;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]">
      <Table
        aria-label="처방/오더 테이블"
        density={density}
        layout="scroll"
        minWidth={1160}
        className="table-fixed bg-[var(--emr-surface-panel)]"
      >
        <TableHeader className="sticky top-0 z-10 bg-[var(--emr-surface-muted)]">
          <TableRow className="border-[var(--emr-line-hairline)] hover:bg-transparent">
            <EmrTableHeaderCell
              className={chartOrderTableColumns[0].className}
              interaction={chartOrderTableColumns[0].interaction}
              resize={chartOrderTableColumns[0].resize}
            >
              <EmrTableCheckbox
                aria-label="오더 전체 선택"
                checked={allVisibleSelected}
                indeterminate={someVisibleSelected}
                disabled={!rows.length}
                onCheckedChange={(checked) => onToggleAll(Boolean(checked))}
              />
            </EmrTableHeaderCell>
            <ChartOrderSortableHead
              className={chartOrderTableColumns[1].className}
              columnKey="groupTitle"
              interaction={chartOrderTableColumns[1].interaction}
              label={chartOrderSortLabels.groupTitle}
              resize={chartOrderTableColumns[1].resize}
              sortState={sortState}
              onSort={onSort}
            />
            <ChartOrderSortableHead
              className={chartOrderTableColumns[2].className}
              columnKey="orderType"
              interaction={chartOrderTableColumns[2].interaction}
              label={chartOrderSortLabels.orderType}
              resize={chartOrderTableColumns[2].resize}
              sortState={sortState}
              onSort={onSort}
            />
            <ChartOrderSortableHead
              className={chartOrderTableColumns[3].className}
              columnKey="status"
              interaction={chartOrderTableColumns[3].interaction}
              label={chartOrderSortLabels.status}
              resize={chartOrderTableColumns[3].resize}
              sortState={sortState}
              onSort={onSort}
            />
            <ChartOrderSortableHead
              className={chartOrderTableColumns[4].className}
              columnKey="displayName"
              interaction={chartOrderTableColumns[4].interaction}
              label={chartOrderSortLabels.displayName}
              resize={chartOrderTableColumns[4].resize}
              sortState={sortState}
              onSort={onSort}
            />
            <ChartOrderSortableHead
              className={chartOrderTableColumns[5].className}
              columnKey="billingName"
              interaction={chartOrderTableColumns[5].interaction}
              label={chartOrderSortLabels.billingName}
              resize={chartOrderTableColumns[5].resize}
              sortState={sortState}
              onSort={onSort}
            />
            <ChartOrderSortableHead
              align={chartOrderTableColumns[6].align}
              className={chartOrderTableColumns[6].className}
              columnKey="quantity"
              interaction={chartOrderTableColumns[6].interaction}
              label={chartOrderSortLabels.quantity}
              resize={chartOrderTableColumns[6].resize}
              sortState={sortState}
              onSort={onSort}
            />
            <ChartOrderSortableHead
              align={chartOrderTableColumns[7].align}
              className={chartOrderTableColumns[7].className}
              columnKey="unitPrice"
              interaction={chartOrderTableColumns[7].interaction}
              label={chartOrderSortLabels.unitPrice}
              resize={chartOrderTableColumns[7].resize}
              sortState={sortState}
              onSort={onSort}
            />
            <ChartOrderSortableHead
              align={chartOrderTableColumns[8].align}
              className={chartOrderTableColumns[8].className}
              columnKey="lineTotal"
              interaction={chartOrderTableColumns[8].interaction}
              label={chartOrderSortLabels.lineTotal}
              resize={chartOrderTableColumns[8].resize}
              sortState={sortState}
              onSort={onSort}
            />
            <ChartOrderSortableHead
              className={chartOrderTableColumns[9].className}
              columnKey="requestedBy"
              interaction={chartOrderTableColumns[9].interaction}
              label={chartOrderSortLabels.requestedBy}
              resize={chartOrderTableColumns[9].resize}
              sortState={sortState}
              onSort={onSort}
            />
            <EmrTableHeaderCell
              align={chartOrderTableColumns[10].align}
              className={chartOrderTableColumns[10].className}
              interaction={chartOrderTableColumns[10].interaction}
              resize={chartOrderTableColumns[10].resize}
            >
              작업
            </EmrTableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const { groupTitle, order } = row;
            const dirty = isChartOrderDraftRowDirty(row);
            const invalidQuantity = invalidOrderIds.has(order.id);
            const lineTotal = getDraftLineTotal(row);
            const selected = selectedOrderIds.has(order.id);
            const requestedByName =
              getChartStaffName(order.requestedByUserId) ?? "미정";

            return (
              <TableRow
                key={order.id}
                data-testid={`chart-order-row-${order.id}`}
                data-dirty={dirty ? "true" : undefined}
                data-state={selected ? "selected" : undefined}
                className="border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] hover:bg-[var(--emr-state-hover)] data-[dirty=true]:bg-[var(--emr-accent-subtle)]/40 data-[state=selected]:bg-[var(--emr-state-selected)]"
              >
                <TableCell className="px-3">
                  <EmrTableCheckbox
                    aria-label={`${order.displayName} 선택`}
                    checked={selected}
                    onCheckedChange={(checked) =>
                      onToggleOrder(order.id, Boolean(checked))
                    }
                  />
                </TableCell>
                <TableCell className="overflow-hidden emr-text-metadata font-medium text-muted-foreground">
                  <EmrTableCellText mode="one-line" fullText={groupTitle}>
                    {groupTitle}
                  </EmrTableCellText>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="max-w-full truncate">
                    {orderTypeMeta[order.orderType].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <EmrStatusBadge
                    label={getChartOrderStatusLabel(row)}
                    marker="none"
                  />
                </TableCell>
                <TableCell className="min-w-0 whitespace-normal py-2">
                  <EmrTableCellText
                    mode="two-line-if-long"
                    fullText={order.displayName}
                    className="font-medium"
                  >
                    {order.displayName}
                  </EmrTableCellText>
                  <EmrTableCellText
                    mode="one-line"
                    fullText={
                      order.instruction ??
                      orderTypeMeta[order.orderType].handoff
                    }
                    className="emr-text-metadata text-muted-foreground"
                  >
                    {order.instruction ??
                      orderTypeMeta[order.orderType].handoff}
                  </EmrTableCellText>
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`${order.displayName} 청구서명 수정`}
                    value={row.billingName}
                    className="h-7 min-w-0 bg-[var(--emr-surface-panel)] px-2 emr-text-metadata"
                    onChange={(event) =>
                      onUpdateBillingName(order.id, event.target.value)
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`${order.displayName} 수량 수정`}
                    aria-invalid={invalidQuantity}
                    inputMode="decimal"
                    title={
                      invalidQuantity
                        ? "수량은 숫자로 입력해 주세요."
                        : undefined
                    }
                    value={row.quantityInput}
                    className={cn(
                      "h-7 min-w-0 bg-[var(--emr-surface-panel)] px-2 text-right emr-text-metadata tabular-nums",
                      invalidQuantity &&
                        "border-[var(--emr-status-danger-border)]",
                    )}
                    onChange={(event) =>
                      onUpdateQuantity(order.id, event.target.value)
                    }
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <EmrTableCellText mode="one-line">
                    {row.unitPrice !== undefined
                      ? row.unitPrice.toLocaleString()
                      : "-"}
                  </EmrTableCellText>
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  <EmrTableCellText mode="one-line">
                    {lineTotal !== undefined ? lineTotal.toLocaleString() : "-"}
                  </EmrTableCellText>
                </TableCell>
                <TableCell className="overflow-hidden">
                  <EmrTableCellText mode="one-line" fullText={requestedByName}>
                    {requestedByName}
                  </EmrTableCellText>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      className="bg-card"
                      onClick={() =>
                        onUnavailableAction("order-history", order.displayName)
                      }
                    >
                      이력
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      className="bg-card"
                      onClick={() =>
                        onUnavailableAction("order-request", order.displayName)
                      }
                    >
                      요청
                    </Button>
                    <Button
                      aria-label={`${order.displayName} 오더 삭제`}
                      variant="outline"
                      size="icon-xs"
                      className="bg-card text-destructive"
                      disabled={!hasCommittedRows}
                      title={
                        hasCommittedRows
                          ? `${order.displayName} 오더 삭제`
                          : "마지막 오더는 삭제할 수 없습니다."
                      }
                      onClick={() => onDeleteOrder(order.id)}
                    >
                      <CdsActionsTrash2Icon data-icon="inline-start" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {!rows.length ? (
            <TableRow className="border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] hover:bg-[var(--emr-surface-panel)]">
              <TableCell
                colSpan={11}
                className="h-28 text-center emr-text-dense text-muted-foreground"
              >
                <span className="grid gap-1">
                  <span className="font-semibold text-foreground">
                    표시할 오더가 없습니다.
                  </span>
                  <span>
                    현재 선택한 분류 또는 필터에 해당하는 오더가 없어요.
                  </span>
                </span>
              </TableCell>
            </TableRow>
          ) : null}
          <TableRow className="h-10 border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] hover:bg-[var(--emr-surface-panel)]">
            <TableCell />
            <TableCell colSpan={10}>
              <Button
                variant="ghost"
                size="sm"
                className="w-fit justify-start"
                onClick={onAddOrder}
              >
                + Order 추가하기
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

type OrderActionDialogType = "bill" | "confirm";
type ChartUnavailableAction =
  | "chart-share"
  | "order-history"
  | "order-print"
  | "order-request";

const chartUnavailableActionCopy = {
  "chart-share": {
    title: "차트 공유는 아직 연결되지 않았어",
    body: "실제 공유, 이메일, 카카오톡, 외부 문서 전송은 이번 MVP 범위 밖이야. 현재 화면에서 차트 상태를 확인해.",
  },
  "order-history": {
    title: "Order 이력 상세는 아직 연결되지 않았어",
    body: "선택 오더의 상세 이력 화면은 후속 상세 화면 범위야. 현재 테이블의 상태와 갱신 시간을 기준으로 확인해.",
  },
  "order-print": {
    title: "Order 출력은 아직 연결되지 않았어",
    body: "실제 문서 생성, 프린트, PDF 출력 연동은 이번 MVP 범위 밖이야. 화면의 오더 목록을 기준으로 데모를 진행해.",
  },
  "order-request": {
    title: "Order 요청 흐름은 아직 연결되지 않았어",
    body: "검사실, 영상실, 처치실 같은 외부/부서 요청 전송은 후속 연동 범위야. 현재는 차트 내부 상태만 저장해.",
  },
} as const satisfies Record<
  ChartUnavailableAction,
  { body: string; title: string }
>;

function ChartUnavailableAlert({
  action,
  className,
  targetName,
  onDismiss,
}: {
  action: ChartUnavailableAction;
  className?: string;
  onDismiss: () => void;
  targetName?: string;
}) {
  const copy = chartUnavailableActionCopy[action];

  return (
    <EmrInlineAlert
      severity="info"
      title={copy.title}
      className={cn("emr-text-metadata", className)}
      action={
        <Button size="sm" variant="outline" onClick={onDismiss}>
          확인
        </Button>
      }
      testId="chart-unavailable-action-alert"
    >
      {targetName ? `${targetName}: ` : null}
      {copy.body}
    </EmrInlineAlert>
  );
}

function mapCatalogCategoryToOrderType(
  category: ChartOrderCatalogSearchRow["categoryGroup"],
): EmrOrderType {
  if (category === "lab") return "lab";
  if (category === "imaging") return "imaging";
  if (category === "medication") return "dispensing";

  return "treatment";
}

function getCatalogCandidateInstruction(row: ChartOrderCatalogSearchRow) {
  if (row.rowType === "set")
    return "Order set 후보. 확정 snapshot 단계에서 개별 오더 확장 정책을 적용합니다.";

  return orderTypeMeta[mapCatalogCategoryToOrderType(row.categoryGroup)]
    .handoff;
}

function isCatalogCandidateTargetingPatient(
  row: ChartOrderCatalogSearchRow,
  patientSpecies: ChartBundle["patient"]["species"],
) {
  const normalizedSpecies =
    patientSpecies === "dog" || patientSpecies === "cat"
      ? patientSpecies
      : "other";

  return row.targetSpecies.includes(normalizedSpecies);
}

function buildChartOrderDraftRowFromCatalog({
  bundle,
  row,
  sortOrder,
}: {
  bundle: ChartBundle;
  row: ChartOrderCatalogSearchRow;
  sortOrder: number;
}): ChartOrderDraftRow {
  const orderType = mapCatalogCategoryToOrderType(row.categoryGroup);
  const now = new Date().toISOString();
  const order: EmrOrder = {
    id: createChartOrderDraftId(),
    workspaceId: bundle.encounter.workspaceId,
    encounterId: bundle.encounter.id,
    serviceItemId: row.sourcePresetId,
    orderType,
    displayName: row.displayName,
    status: "requested",
    workStatus: "pending",
    priority: "normal",
    requestedByUserId: bundle.encounter.primaryVeterinarianId ?? "user-vet",
    requestedAt: now,
    instruction: getCatalogCandidateInstruction(row),
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
  const quantityInput = "1";

  return {
    billingName: row.billingName,
    catalogSearchRow: row,
    committedBillingName: "",
    committedQuantityInput: "",
    groupTitle: row.rowType === "set" ? "Order 세트" : "Workspace catalog",
    order,
    quantityInput,
    unitPrice: row.appliedSnapshot.appliedPriceKrw,
  };
}

function createChartOrderDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "10000000-0000-4000-8000-".concat(
    Math.random().toString(16).slice(2, 14).padEnd(12, "0"),
  );
}

function ChartOrderCatalogDialog({
  bundle,
  candidates,
  selectedCatalogSourceKeys,
  loading,
  open,
  query,
  statusText,
  onAdd,
  onOpenChange,
  onQueryChange,
  onRetry,
}: {
  bundle: ChartBundle;
  candidates: ChartOrderCatalogSearchRow[];
  selectedCatalogSourceKeys: Set<string>;
  loading: boolean;
  open: boolean;
  query: string;
  statusText: string;
  onAdd: (row: ChartOrderCatalogSearchRow) => void;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (query: string) => void;
  onRetry: () => void;
}) {
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCandidates = candidates
    .filter((row) =>
      isCatalogCandidateTargetingPatient(row, bundle.patient.species),
    )
    .filter((row) => {
      if (!normalizedQuery) return true;

      return [
        row.displayName,
        row.billingName,
        row.sourcePresetId,
        row.categoryGroup,
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Workspace catalog에서 Order 추가</DialogTitle>
          <DialogDescription>
            현재 병원의 active catalog와 order set만 신규 차트 오더 후보로
            표시됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 p-5">
          <div className="flex min-h-9 items-center gap-2 rounded-[var(--emr-radius-control)] border bg-card px-2.5">
            <CdsActionsSearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <Input
              aria-label="카탈로그 Order 검색"
              className="h-8 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
              placeholder="Order명, 청구명, preset id 검색"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
          <div
            className="emr-text-metadata text-muted-foreground"
            data-testid="chart-order-catalog-search-status"
          >
            {statusText}
          </div>
          <ScrollArea className="h-[420px] rounded-[var(--emr-radius-control)] border">
            <div className="grid divide-y">
              {visibleCandidates.map((row) => {
                const sourceKey = getChartCatalogSourceKey(row);
                const alreadySelected =
                  selectedCatalogSourceKeys.has(sourceKey);
                const orderType = mapCatalogCategoryToOrderType(
                  row.categoryGroup,
                );

                return (
                  <div
                    key={`${row.rowType}-${row.sourcePresetId}`}
                    className="grid gap-2 bg-card p-3 md:grid-cols-[minmax(0,1fr)_auto]"
                    data-testid={`chart-order-catalog-candidate-${row.sourcePresetId}`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            row.rowType === "set" ? "secondary" : "outline"
                          }
                        >
                          {row.rowType === "set"
                            ? "세트"
                            : orderTypeMeta[orderType].label}
                        </Badge>
                        <span className="font-semibold">{row.displayName}</span>
                        <span className="emr-text-metadata text-muted-foreground">
                          {row.appliedSnapshot.appliedPriceKrw.toLocaleString()}
                          원
                        </span>
                      </div>
                      <div className="mt-1 emr-text-metadata text-muted-foreground">
                        청구서명 {row.billingName} · 대상{" "}
                        {row.targetSpecies.join(", ")} · source{" "}
                        {row.sourcePresetId}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={alreadySelected}
                      onClick={() => onAdd(row)}
                    >
                      {alreadySelected ? "추가됨" : "추가"}
                    </Button>
                  </div>
                );
              })}
              {!visibleCandidates.length ? (
                <div className="grid min-h-32 place-items-center bg-card p-6 text-center emr-text-dense text-muted-foreground">
                  {loading
                    ? "불러오는 중"
                    : "조건에 맞는 active catalog 후보가 없습니다."}
                </div>
              ) : null}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onRetry}>
              다시 불러오기
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              닫기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderArea({
  actorHeaders,
  bundle,
  orderGroups,
}: {
  actorHeaders?: Record<string, string>;
  bundle: ChartBundle;
  orderGroups: ChartOrderGroup[];
}) {
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const initialDraftRows = useMemo(
    () => getChartOrderDraftRows(orderGroups),
    [orderGroups],
  );
  const [committedRows, setCommittedRows] =
    useState<ChartOrderDraftRow[]>(initialDraftRows);
  const [draftRows, setDraftRows] =
    useState<ChartOrderDraftRow[]>(initialDraftRows);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [orderActionDialog, setOrderActionDialog] =
    useState<OrderActionDialogType | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogRows, setCatalogRows] = useState<ChartOrderCatalogSearchRow[]>(
    [],
  );
  const [catalogSearchStatus, setCatalogSearchStatus] = useState<
    "idle" | "loading" | "ready" | "denied" | "error"
  >("idle");
  const [unavailableAction, setUnavailableAction] = useState<{
    action: ChartUnavailableAction;
    targetName?: string;
  } | null>(null);
  const [orderFilterOpen, setOrderFilterOpen] = useState(false);
  const [orderTableFilterModel, setOrderTableFilterModel] = useState(() =>
    createInitialEmrTableFilterBuilderModel(
      "chart-order-filter",
      "chart-order-filter-rule-1",
    ),
  );
  const [orderSortState, setOrderSortState] =
    useState<ChartOrderSortState>(null);
  const [orderDraftSaveState, setOrderDraftSaveState] = useState<
    "idle" | "loading" | "saving" | "saved" | "error"
  >("idle");
  const draftTouchedRef = useRef(false);
  const allOrders = useMemo(
    () => draftRows.map(({ order }) => order),
    [draftRows],
  );
  const draftCatalogSourceKeys = useMemo(
    () =>
      new Set(
        draftRows
          .map((row) => getChartDraftRowCatalogSourceKey(row))
          .filter((sourceKey): sourceKey is string => Boolean(sourceKey)),
      ),
    [draftRows],
  );
  const orderCountByType = allOrders.reduce<Record<EmrOrderType, number>>(
    (counts, order) => ({
      ...counts,
      [order.orderType]: counts[order.orderType] + 1,
    }),
    { dispensing: 0, imaging: 0, lab: 0, treatment: 0 },
  );
  const orderTabItems = chartOrderTabs.map((tab) => ({
    ...tab,
    count:
      tab.value === "all"
        ? allOrders.length
        : tab.value === "billing"
          ? 0
          : orderCountByType[tab.value],
  }));
  const filteredOrderRows = draftRows.filter(
    ({ order }) =>
      orderFilter !== "billing" &&
      (orderFilter === "all" || order.orderType === orderFilter),
  );
  const requestedByOptions = useMemo(() => {
    const optionByUserId = new Map<string, { label: string; value: string }>();

    draftRows.forEach(({ order }) => {
      optionByUserId.set(order.requestedByUserId, {
        label: getChartStaffName(order.requestedByUserId) ?? "미정",
        value: order.requestedByUserId,
      });
    });

    return Array.from(optionByUserId.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "ko-KR", {
        numeric: true,
        sensitivity: "base",
      }),
    );
  }, [draftRows]);
  const chartOrderFilterFields = useMemo<
    Array<EmrTableFilterBuilderField<ChartOrderDraftRow>>
  >(
    () => [
      {
        getValue: (row) => row.order.status,
        id: "status",
        label: "상태",
        operators: [{ id: "is", label: "Is" }],
        options: chartOrderStatusOrder.map((status) => ({
          label: orderStatusLabel[status],
          value: status,
        })),
        valuePlaceholder: "상태 선택",
      },
      {
        getValue: (row) => row.order.requestedByUserId,
        id: "requestedBy",
        label: "수의사",
        operators: [{ id: "is", label: "Is" }],
        options: requestedByOptions,
        valuePlaceholder: "수의사 선택",
      },
    ],
    [requestedByOptions],
  );
  const activeOrderFilterCount = getEmrTableFilterBuilderActiveCount(
    orderTableFilterModel,
    chartOrderFilterFields,
  );
  const visibleOrderRows = useMemo(
    () =>
      sortChartOrderRows(
        filterRowsByEmrTableFilterBuilder(
          filteredOrderRows,
          orderTableFilterModel,
          chartOrderFilterFields,
        ),
        orderSortState,
      ),
    [
      chartOrderFilterFields,
      filteredOrderRows,
      orderSortState,
      orderTableFilterModel,
    ],
  );
  const totalAmount = draftRows.reduce(
    (sum, row) => sum + (getDraftLineTotal(row) ?? 0),
    0,
  );
  const selectedAmount = draftRows.reduce((sum, row) => {
    if (!selectedOrderIds.has(row.order.id)) return sum;

    return sum + (getDraftLineTotal(row) ?? 0);
  }, 0);
  const selectedOrderRows = draftRows.filter(({ order }) =>
    selectedOrderIds.has(order.id),
  );
  const selectedOrders = selectedOrderRows.map(({ order }) => order);
  const selectedIncompleteBillingRows = selectedOrderRows.filter(
    isChartOrderIncompleteForBilling,
  );
  const recheckOrderCount = allOrders.filter(
    (order) => order.status === "re_requested",
  ).length;
  const selectedRecheckOrderCount = selectedOrders.filter(
    (order) => order.status === "re_requested",
  ).length;
  const actionableSelectedOrderCount = selectedOrders.filter(
    (order) => order.status !== "cancelled",
  ).length;
  const visibleOrderIds = visibleOrderRows.map(({ order }) => order.id);
  const selectedVisibleOrderCount = visibleOrderIds.filter((orderId) =>
    selectedOrderIds.has(orderId),
  ).length;
  const allVisibleSelected =
    visibleOrderIds.length > 0 &&
    selectedVisibleOrderCount === visibleOrderIds.length;
  const someVisibleSelected =
    selectedVisibleOrderCount > 0 && !allVisibleSelected;
  const committedRowIds = new Set(committedRows.map(({ order }) => order.id));
  const deletedDraftOrderCount = committedRows.filter(({ order }) =>
    draftRows.every((row) => row.order.id !== order.id),
  ).length;
  const changedDraftOrderCount =
    draftRows.filter((row) => {
      const committedRow = committedRows.find(
        ({ order }) => order.id === row.order.id,
      );

      return committedRow
        ? row.billingName !== committedRow.billingName ||
            row.quantityInput !== committedRow.quantityInput
        : true;
    }).length + deletedDraftOrderCount;
  const invalidOrderIds = new Set(
    draftRows
      .filter((row) => getDraftQuantity(row.quantityInput) === null)
      .map(({ order }) => order.id),
  );
  const hasDraftChanges = changedDraftOrderCount > 0;
  const canUpdateOrders = hasDraftChanges && invalidOrderIds.size === 0;
  const deleteTargetOrder = draftRows.find(
    ({ order }) => order.id === deleteOrderId,
  )?.order;
  const [orderTableDensity, setOrderTableDensity] =
    useState<EmrTableDensity>("compact");
  const handleOrderSort = (key: ChartOrderSortKey) => {
    setOrderSortState((current) => {
      if (current?.key !== key) return { direction: "asc", key };
      if (current.direction === "asc") return { direction: "desc", key };

      return null;
    });
  };
  const toggleAllVisibleOrders = (checked: boolean) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);

      visibleOrderIds.forEach((orderId) => {
        if (checked) {
          next.add(orderId);
        } else {
          next.delete(orderId);
        }
      });

      return next;
    });
  };
  const updateDraftRow = (
    orderId: string,
    nextFields: Partial<
      Pick<ChartOrderDraftRow, "billingName" | "quantityInput">
    >,
  ) => {
    draftTouchedRef.current = true;
    setDraftRows((currentRows) =>
      currentRows.map((row) =>
        row.order.id === orderId
          ? {
              ...row,
              ...nextFields,
            }
          : row,
      ),
    );
  };
  const loadCatalogRows = async () => {
    setCatalogSearchStatus("loading");
    const result = await loadChartOrderCatalog({
      actorHeaders,
      workspaceId: bundle.encounter.workspaceId,
    });

    if (!result.ok) {
      setCatalogSearchStatus(
        result.status === 401 || result.status === 403 ? "denied" : "error",
      );
      return;
    }

    setCatalogRows(result.rows);
    setCatalogSearchStatus("ready");
  };
  const openCatalogDialog = () => {
    setCatalogDialogOpen(true);
    if (catalogSearchStatus === "idle" || catalogSearchStatus === "error") {
      void loadCatalogRows();
    }
  };
  const addCatalogOrderToDraft = (row: ChartOrderCatalogSearchRow) => {
    const sourceKey = getChartCatalogSourceKey(row);
    if (
      draftRows.some(
        (draftRow) => getChartDraftRowCatalogSourceKey(draftRow) === sourceKey,
      )
    ) {
      return;
    }

    draftTouchedRef.current = true;
    setDraftRows((currentRows) => [
      ...currentRows,
      buildChartOrderDraftRowFromCatalog({
        bundle,
        row,
        sortOrder: (currentRows.length + 1) * 10,
      }),
    ]);
    toast.success(`${row.displayName} Order를 추가했어요.`);
  };
  const resetDraftRows = () => {
    draftTouchedRef.current = false;
    setDraftRows(committedRows);
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      const committedOrderIds = new Set(
        committedRows.map(({ order }) => order.id),
      );

      next.forEach((orderId) => {
        if (!committedOrderIds.has(orderId)) {
          next.delete(orderId);
        }
      });

      return next;
    });
  };
  useEffect(() => {
    let cancelled = false;

    async function loadPersistedOrderDrafts() {
      draftTouchedRef.current = false;
      setOrderDraftSaveState("loading");

      const result = await loadChartOrderDraft({
        actorHeaders,
        encounterId: bundle.encounter.id,
        workspaceId: bundle.encounter.workspaceId,
      });

      if (cancelled) return;

      if (result.ok) {
        let nextRows = applyPersistedOrderDrafts(
          initialDraftRows,
          result.orderDrafts,
        );
        const actionResult = await loadChartOrderActions({
          actorHeaders,
          encounterId: bundle.encounter.id,
          workspaceId: bundle.encounter.workspaceId,
        });

        if (actionResult.ok) {
          nextRows = applyPersistedOrderActions(
            nextRows,
            actionResult.orderActions,
            bundle.encounter.workspaceId,
          );
        }
        const lifecycleResult = await loadChartOrderLifecycles({
          actorHeaders,
          encounterId: bundle.encounter.id,
          workspaceId: bundle.encounter.workspaceId,
        });

        if (lifecycleResult.ok) {
          nextRows = applyPersistedOrderLifecycles(
            nextRows,
            lifecycleResult.lifecycles,
          );
        }
        const billingCandidateResult = await loadChartBillingCandidates({
          actorHeaders,
          encounterId: bundle.encounter.id,
          workspaceId: bundle.encounter.workspaceId,
        });

        if (billingCandidateResult.ok) {
          nextRows = applyBillingCandidatesToOrderRows(
            nextRows,
            billingCandidateResult.candidates,
          );
        }

        if (cancelled) return;

        setCommittedRows(nextRows);
        if (!draftTouchedRef.current) {
          setDraftRows(nextRows);
        }
        setOrderDraftSaveState("idle");
        return;
      }

      setOrderDraftSaveState("error");
    }

    void loadPersistedOrderDrafts();

    return () => {
      cancelled = true;
    };
  }, [
    actorHeaders,
    bundle.encounter.id,
    bundle.encounter.workspaceId,
    initialDraftRows,
  ]);
  const commitDraftRows = async () => {
    const preparedDraft = prepareChartOrderDraftRowsForPersistence(draftRows);
    if (preparedDraft.orderIdMap.size > 0) {
      setDraftRows(preparedDraft.rows);
      setSelectedOrderIds((current) =>
        remapChartOrderIdSet(current, preparedDraft.orderIdMap),
      );
    }

    setOrderDraftSaveState("saving");
    const result = await saveChartOrderDraftRoute({
      actorHeaders,
      encounterId: bundle.encounter.id,
      rows: preparedDraft.rows,
      workspaceId: bundle.encounter.workspaceId,
    });

    if (!result.ok) {
      setOrderDraftSaveState("error");
      toast.error(
        result.denialReason === "permission_missing"
          ? "오더 수정 권한이 없어 저장하지 못했어요."
          : "오더 변경을 저장하지 못했어요.",
      );
      return;
    }

    const nextCommittedRows = applyPersistedOrderDrafts(
      preparedDraft.rows,
      result.orderDrafts,
      { preserveMissingRows: true },
    );
    draftTouchedRef.current = false;
    setCommittedRows(nextCommittedRows);
    setDraftRows(nextCommittedRows);
    setOrderDraftSaveState("saved");
    toast.success("Order 업데이트를 저장했어요.");
  };
  const commitOrderAction = async (action: ChartOrderActionKind) => {
    if (action === "bill") {
      const orderIds = Array.from(selectedOrderIds);
      const persistedOrderIds = new Set(
        committedRows.map((row) => row.order.id),
      );
      const actionOrderIds = orderIds.filter((orderId) =>
        persistedOrderIds.has(orderId),
      );

      if (actionOrderIds.length !== orderIds.length) {
        setSelectedOrderIds(new Set(actionOrderIds));
        setOrderDraftSaveState("error");
        toast.error("저장되지 않은 오더는 Order 업데이트 후 청구할 수 있어요.");
        return;
      }

      const selectedRowByOrderId = new Map(
        draftRows.map((row) => [row.order.id, row]),
      );
      const committedRowByOrderId = new Map(
        committedRows.map((row) => [row.order.id, row]),
      );
      const hasSelectedDraftChanges = actionOrderIds.some((orderId) => {
        const row = selectedRowByOrderId.get(orderId);
        const committedRow = committedRowByOrderId.get(orderId);

        return (
          !row ||
          !committedRow ||
          row.billingName !== committedRow.billingName ||
          row.quantityInput !== committedRow.quantityInput
        );
      });

      if (hasSelectedDraftChanges) {
        setOrderDraftSaveState("error");
        toast.error("변경사항 저장 후 Order 청구를 진행해 주세요.");
        return;
      }

      setOrderDraftSaveState("saving");
      const result = await saveChartOrderActionRoute({
        action,
        actorHeaders,
        catalogSelections: [],
        encounterId: bundle.encounter.id,
        orderIds: actionOrderIds,
        workspaceId: bundle.encounter.workspaceId,
      });

      if (!result.ok) {
        setOrderDraftSaveState("error");
        toast.error(
          result.denialReason === "permission_missing"
            ? "오더 작업 권한이 없어 저장하지 못했어요."
            : "오더 작업 상태를 저장하지 못했어요.",
        );
        return;
      }

      setCommittedRows((currentRows) =>
        applyBillingCandidatesToOrderRows(
          applyPersistedOrderActions(
            currentRows,
            result.orderActions,
            bundle.encounter.workspaceId,
          ),
          result.billingCandidates ?? [],
        ),
      );
      setDraftRows((currentRows) =>
        applyBillingCandidatesToOrderRows(
          applyPersistedOrderActions(
            currentRows,
            result.orderActions,
            bundle.encounter.workspaceId,
          ),
          result.billingCandidates ?? [],
        ),
      );
      setOrderActionDialog(null);
      setOrderDraftSaveState("saved");
      toast.success("Order 청구 후보를 저장했어요.");
      return;
    }

    const preparedDraft = prepareChartOrderDraftRowsForPersistence(draftRows);
    const nextSelectedOrderIds = remapChartOrderIdSet(
      selectedOrderIds,
      preparedDraft.orderIdMap,
    );
    if (preparedDraft.orderIdMap.size > 0) {
      setDraftRows(preparedDraft.rows);
      setSelectedOrderIds(nextSelectedOrderIds);
    }
    const orderIds = Array.from(nextSelectedOrderIds);

    setOrderDraftSaveState("saving");
    const draftResult = await saveChartOrderDraftRoute({
      actorHeaders,
      encounterId: bundle.encounter.id,
      rows: preparedDraft.rows,
      workspaceId: bundle.encounter.workspaceId,
    });

    if (!draftResult.ok) {
      setOrderDraftSaveState("error");
      toast.error(
        draftResult.denialReason === "permission_missing"
          ? "오더 수정 권한이 없어 저장하지 못했어요."
          : "오더 확정 전 draft를 저장하지 못했어요.",
      );
      return;
    }

    const savedDraftRows = applyPersistedOrderDrafts(
      preparedDraft.rows,
      draftResult.orderDrafts,
      { preserveMissingRows: true },
    );
    const persistedOrderIds = new Set(
      draftResult.orderDrafts.map((row) => row.orderId),
    );
    const actionOrderIds = orderIds.filter((orderId) =>
      persistedOrderIds.has(orderId),
    );

    if (actionOrderIds.length !== orderIds.length) {
      setOrderDraftSaveState("error");
      setCommittedRows(savedDraftRows);
      setDraftRows(savedDraftRows);
      setSelectedOrderIds(new Set(actionOrderIds));
      toast.error("선택한 오더를 서버 draft에 저장하지 못했어요.");
      return;
    }

    draftTouchedRef.current = false;
    setCommittedRows(savedDraftRows);
    setDraftRows(savedDraftRows);
    setOrderDraftSaveState("saved");

    const catalogSelections = savedDraftRows
      .filter(
        (row) =>
          actionOrderIds.includes(row.order.id) &&
          row.catalogSearchRow !== undefined,
      )
      .map((row) => ({
        billingDisplayName: row.billingName,
        guardianName: bundle.primaryGuardian?.name,
        orderId: row.order.id,
        patientName: bundle.patient.name,
        quantity: getDraftQuantity(row.quantityInput) ?? 1,
        rowType: row.catalogSearchRow?.rowType ?? "individual",
        sourcePresetId:
          row.catalogSearchRow?.sourcePresetId ??
          row.order.serviceItemId ??
          row.order.id,
      }));
    const result = await saveChartOrderActionRoute({
      action,
      actorHeaders,
      catalogSelections,
      encounterId: bundle.encounter.id,
      orderIds: actionOrderIds,
      workspaceId: bundle.encounter.workspaceId,
    });

    if (!result.ok) {
      toast.error(
        result.denialReason === "permission_missing"
          ? "오더 작업 권한이 없어 저장하지 못했어요."
          : "오더 작업 상태를 저장하지 못했어요.",
      );
      return;
    }

    setCommittedRows((currentRows) =>
      applyPersistedOrderActions(
        currentRows,
        result.orderActions,
        bundle.encounter.workspaceId,
      ),
    );
    setDraftRows((currentRows) =>
      applyPersistedOrderActions(
        currentRows,
        result.orderActions,
        bundle.encounter.workspaceId,
      ),
    );
    setOrderActionDialog(null);
    toast.success(
      action === "confirm"
        ? "Order 확정 상태를 저장했어요."
        : "Order 청구 후보를 저장했어요.",
    );
  };
  const confirmDeleteOrder = () => {
    if (!deleteOrderId) return;

    draftTouchedRef.current = true;
    setDraftRows((currentRows) =>
      currentRows.filter(({ order }) => order.id !== deleteOrderId),
    );
    setSelectedOrderIds((current) => {
      const next = new Set(current);

      next.delete(deleteOrderId);

      return next;
    });
    setDeleteOrderId(null);
  };
  const toggleOrder = (orderId: string, checked: boolean) => {
    setSelectedOrderIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(orderId);
      } else {
        next.delete(orderId);
      }

      return next;
    });
  };
  const hasSelectedOrders = selectedOrderIds.size > 0;
  const orderActionLabel =
    orderActionDialog === "bill" ? "Order 청구" : "Order 확정";
  const guardianName = bundle.primaryGuardian?.name ?? "보호자 미지정";
  const draftStatusText = hasDraftChanges
    ? ` · 변경 대기 ${changedDraftOrderCount}건${invalidOrderIds.size ? ` · 수량 확인 필요 ${invalidOrderIds.size}건` : ""}`
    : orderDraftSaveState === "saving"
      ? " · 저장 중"
      : orderDraftSaveState === "saved"
        ? " · 저장됨"
        : orderDraftSaveState === "error"
          ? " · 저장 실패"
          : "";
  const catalogStatusText =
    catalogSearchStatus === "loading"
      ? "Workspace catalog 후보를 불러오는 중"
      : catalogSearchStatus === "ready"
        ? `Workspace catalog active 후보 ${catalogRows.length}건`
        : catalogSearchStatus === "denied"
          ? "Workspace catalog 검색 권한이 없습니다"
          : catalogSearchStatus === "error"
            ? "Workspace catalog 후보를 불러오지 못했습니다"
            : "Workspace catalog 검색 대기";

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] shadow-[var(--clair-shadow-xs)]">
      <div className="flex min-h-12 shrink-0 items-stretch justify-between gap-3 border-b border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4">
        <ChartLineTabGroup
          aria-label="처방/오더 분류"
          items={orderTabItems}
          value={orderFilter}
          onValueChange={setOrderFilter}
        />
        <div className="flex items-center gap-2 py-2">
          <EmrTableDensitySelector
            value={orderTableDensity}
            onValueChange={setOrderTableDensity}
          />
          <Popover open={orderFilterOpen} onOpenChange={setOrderFilterOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant={activeOrderFilterCount > 0 ? "secondary" : "outline"}
                  size="sm"
                  className={cn(
                    "bg-card",
                    activeOrderFilterCount > 0 &&
                      "border-[var(--emr-state-selected-border)] bg-[var(--emr-state-selected)] text-[var(--emr-text-primary)]",
                  )}
                  aria-label={
                    activeOrderFilterCount > 0
                      ? `오더 필터 ${activeOrderFilterCount}개 설정`
                      : "오더 필터 설정"
                  }
                />
              }
            >
              <CdsActionsListFilterIcon
                aria-hidden="true"
                className="size-3.5"
              />
              Filter
              {activeOrderFilterCount > 0 ? ` ${activeOrderFilterCount}` : ""}
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(860px,calc(100vw-32px))] gap-3 p-3"
              initialFocus={false}
            >
              <EmrTableFilterBuilder
                clearAllLabel="초기화"
                description="오더 필터는 현재 분류 탭 결과 안에서 완성된 조건만 AND로 적용됩니다."
                fields={chartOrderFilterFields}
                model={orderTableFilterModel}
                title="Filters"
                onClose={() => setOrderFilterOpen(false)}
                onModelChange={setOrderTableFilterModel}
              />
            </PopoverContent>
          </Popover>
          <Button
            variant="outline"
            size="sm"
            className="bg-card"
            onClick={() => setUnavailableAction({ action: "order-print" })}
          >
            Order 출력
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-card"
            onClick={openCatalogDialog}
          >
            + Order
          </Button>
        </div>
      </div>
      {unavailableAction ? (
        <ChartUnavailableAlert
          action={unavailableAction.action}
          targetName={unavailableAction.targetName}
          className="mx-3 mt-2 shrink-0"
          onDismiss={() => setUnavailableAction(null)}
        />
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--emr-surface-panel)] px-3 pt-2 pb-0">
        <ChartOrderTable
          allVisibleSelected={allVisibleSelected}
          density={orderTableDensity}
          hasCommittedRows={committedRowIds.size > 1}
          invalidOrderIds={invalidOrderIds}
          onAddOrder={openCatalogDialog}
          onDeleteOrder={setDeleteOrderId}
          onSort={handleOrderSort}
          onToggleAll={toggleAllVisibleOrders}
          onToggleOrder={toggleOrder}
          onUnavailableAction={(action, targetName) =>
            setUnavailableAction({ action, targetName })
          }
          onUpdateBillingName={(orderId, billingName) =>
            updateDraftRow(orderId, { billingName })
          }
          onUpdateQuantity={(orderId, quantityInput) =>
            updateDraftRow(orderId, { quantityInput })
          }
          rows={visibleOrderRows}
          selectedOrderIds={selectedOrderIds}
          someVisibleSelected={someVisibleSelected}
          sortState={orderSortState}
        />
      </div>
      <ChartOrderCatalogDialog
        bundle={bundle}
        candidates={catalogRows}
        selectedCatalogSourceKeys={draftCatalogSourceKeys}
        loading={catalogSearchStatus === "loading"}
        open={catalogDialogOpen}
        query={catalogQuery}
        statusText={catalogStatusText}
        onAdd={addCatalogOrderToDraft}
        onOpenChange={setCatalogDialogOpen}
        onQueryChange={setCatalogQuery}
        onRetry={() => void loadCatalogRows()}
      />
      <div className="grid min-h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] px-4 py-2 emr-text-metadata">
        <div className="min-w-0 text-muted-foreground">
          <div className="truncate">
            선택 오더 {selectedOrderIds.size}건 · 확정 대상{" "}
            {actionableSelectedOrderCount}건 · 재확인 필요 {recheckOrderCount}건
            <span className="font-medium text-[var(--emr-status-info-text)]">
              {draftStatusText}
            </span>
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2 text-muted-foreground">
          <span className="whitespace-nowrap">
            선택 오더 합계: {selectedAmount.toLocaleString()}
          </span>
          <span className="whitespace-nowrap">Order 별 할인/할증 합계: 0</span>
          <Input
            readOnly
            value="0%"
            className="h-7 w-[72px] bg-[var(--emr-surface-panel)] text-right"
          />
        </div>
        <div className="min-w-0 truncate font-semibold text-foreground">
          청구 예상 총액: {totalAmount.toLocaleString()}
        </div>
        <div className="flex shrink-0 justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-card"
            disabled={!hasDraftChanges}
            onClick={resetDraftRows}
          >
            <CdsActionsRotateCcwIcon data-icon="inline-start" />
            변경 취소
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-card"
            disabled={!canUpdateOrders}
            onClick={() => void commitDraftRows()}
          >
            <CdsActionsSaveIcon data-icon="inline-start" />
            Order 업데이트
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-card"
            disabled={!hasSelectedOrders}
            onClick={() => setOrderActionDialog("bill")}
          >
            Order 청구
          </Button>
          <Button
            size="sm"
            disabled={!hasSelectedOrders}
            onClick={() => setOrderActionDialog("confirm")}
          >
            Order 확정
          </Button>
        </div>
      </div>
      <Dialog
        open={orderActionDialog !== null}
        onOpenChange={(open) => !open && setOrderActionDialog(null)}
      >
        <EmrConfirmDialogContent
          title={`${orderActionLabel} 확인`}
          description={
            <span className="grid gap-3">
              <span>
                {orderActionDialog === "bill"
                  ? selectedIncompleteBillingRows.length > 0
                    ? "아직 완료되지 않은 오더가 있습니다. 수납을 진행할까요?"
                    : "현재 환자와 선택 오더를 확인한 뒤 수납 후보로 넘깁니다."
                  : "현재 환자와 선택 오더를 확인한 뒤 서버 draft 상태에 저장합니다."}
              </span>
              {orderActionDialog === "bill" &&
              selectedIncompleteBillingRows.length > 0 ? (
                <span className="grid gap-1 rounded-[var(--emr-radius-control)] border border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] p-3 text-foreground">
                  {selectedIncompleteBillingRows.map((row) => (
                    <span
                      key={row.order.id}
                      className="flex min-w-0 items-center justify-between gap-2"
                    >
                      <span className="min-w-0 truncate font-medium">
                        {row.order.displayName}
                      </span>
                      <Badge
                        variant="outline"
                        className="shrink-0 bg-[var(--emr-surface-panel)]"
                      >
                        {orderStatusLabel[row.order.status]}
                      </Badge>
                    </span>
                  ))}
                </span>
              ) : null}
              <span className="grid gap-1 rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] p-3 emr-text-dense text-foreground">
                <span>
                  환자: {bundle.patient.name} · 보호자 {guardianName}
                </span>
                <span>차트번호: {bundle.encounter.encounterNo}</span>
                <span>
                  선택 오더: {selectedOrderIds.size}건 · 선택 금액{" "}
                  {selectedAmount.toLocaleString()}
                </span>
                <span>
                  재요청 포함:{" "}
                  {selectedRecheckOrderCount
                    ? `${selectedRecheckOrderCount}건`
                    : "없음"}
                </span>
              </span>
            </span>
          }
          cancelLabel="다시 확인"
          confirmLabel={orderActionLabel}
          onCancel={() => setOrderActionDialog(null)}
          onConfirm={() =>
            orderActionDialog && void commitOrderAction(orderActionDialog)
          }
        />
      </Dialog>
      <Dialog
        open={deleteOrderId !== null}
        onOpenChange={(open) => !open && setDeleteOrderId(null)}
      >
        {deleteTargetOrder ? (
          <EmrConfirmDialogContent
            title="오더를 삭제할까요?"
            description={
              <span className="grid gap-3">
                <span>
                  {deleteTargetOrder.displayName} 오더를 현재 차트의 draft에서
                  제외합니다. 저장 시 서버 draft에도 반영됩니다.
                </span>
                <span className="rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] p-3 emr-text-dense text-foreground">
                  삭제 후 `Order 업데이트`를 눌러 현재 세션 변경으로 확정할 수
                  있습니다.
                </span>
              </span>
            }
            cancelLabel="취소"
            confirmLabel="삭제"
            confirmButtonVariant="destructive"
            closeAriaLabel="오더 삭제 확인 닫기"
            onCancel={() => setDeleteOrderId(null)}
            onConfirm={confirmDeleteOrder}
          />
        ) : null}
      </Dialog>
    </section>
  );
}

function ChartInstructionInfo({
  bundle,
  latestSoap,
  queueEntry,
}: {
  bundle: ChartBundle;
  latestSoap?: SoapNote;
  queueEntry?: WaitingQueueEntry;
}) {
  const veterinarianName = getChartBundleVeterinarianName(bundle);
  const infoItems: Array<{ label: string; value: ReactNode }> = [
    {
      label: "접수 일시",
      value: getShortDateTime(
        bundle.encounter.checkedInAt ?? bundle.encounter.createdAt,
      ),
    },
    {
      label: "환자 정보",
      value: `${bundle.patient.name}(${getPatientDisplayAge(bundle.patient)}) · 보호자 ${bundle.primaryGuardian?.name ?? "미지정"} · ${bundle.patient.breed ?? getSpeciesLabel(bundle.patient)}`,
    },
    { label: "담당 수의사", value: veterinarianName },
    {
      label: "차트 상태",
      value: (
        <span className="grid gap-0.5">
          <span
            data-testid="chart-completion-status"
            className="emr-text-dense font-semibold text-[var(--emr-status-info-text)]"
          >
            {getConsultationWorkflowStatusText(bundle.encounter, queueEntry)}
          </span>
          <span
            data-testid="chart-soap-status"
            className="emr-text-metadata font-medium text-muted-foreground"
          >
            {getSoapStatusText(latestSoap)}
          </span>
        </span>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-4 rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4 py-3">
      {infoItems.map(({ label, value }) => (
        <div
          key={label}
          className="border-r border-[var(--emr-line-hairline)] px-3 last:border-r-0"
        >
          <div className="emr-text-metadata font-medium text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 flex min-h-6 items-center emr-text-dense font-medium text-foreground">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartPreflightLine({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3 emr-text-metadata">
      <span className="text-[var(--emr-text-tertiary)]">{label}</span>
      <span
        className={cn("text-right font-medium", emphasis && "text-primary")}
      >
        {value}
      </span>
    </div>
  );
}

function ChartPreflightField({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon: ReactNode;
  label: string;
}) {
  return (
    <div className="grid min-h-9 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3">
      <label className="emr-control-text flex h-9 min-w-0 items-center gap-2 font-medium text-muted-foreground">
        <span className="flex size-4 shrink-0 items-center justify-center text-[var(--emr-text-tertiary)] [&_svg]:size-4">
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </label>
      {children}
    </div>
  );
}

function ChartReadonlyField({ value }: { value: string }) {
  return (
    <div className="emr-control-text flex h-9 w-full items-center rounded-[var(--emr-radius-control)] border border-input bg-card px-3 text-left text-foreground">
      <span className="w-full truncate text-left font-medium">{value}</span>
    </div>
  );
}

const callRoomPreferenceStoragePrefix = "clair.chart.callRoomPreference.v1";

function getCallRoomPreferenceStorageKey({
  actorUserId,
  workspaceId,
}: {
  actorUserId?: string;
  workspaceId?: string;
}) {
  if (!actorUserId || !workspaceId) return null;
  return `${callRoomPreferenceStoragePrefix}:${workspaceId}:${actorUserId}`;
}

function readCallRoomPreference({
  actorUserId,
  roomIds,
  workspaceId,
}: {
  actorUserId?: string;
  roomIds: Set<string>;
  workspaceId?: string;
}) {
  if (typeof window === "undefined") return "";
  const key = getCallRoomPreferenceStorageKey({ actorUserId, workspaceId });
  if (!key) return "";

  const storedRoomId = window.localStorage.getItem(key);
  return storedRoomId && roomIds.has(storedRoomId) ? storedRoomId : "";
}

function writeCallRoomPreference({
  actorUserId,
  roomId,
  shouldSave,
  workspaceId,
}: {
  actorUserId?: string;
  roomId: string;
  shouldSave: boolean;
  workspaceId?: string;
}) {
  if (typeof window === "undefined") return;
  const key = getCallRoomPreferenceStorageKey({ actorUserId, workspaceId });
  if (!key) return;

  if (shouldSave) {
    window.localStorage.setItem(key, roomId);
    return;
  }

  window.localStorage.removeItem(key);
}

function ChartStartLockedState({
  queueStatus,
}: {
  queueStatus?: WaitingQueueEntry["status"];
}) {
  const isCalled = queueStatus === "called";

  return (
    <div className="mt-2 flex min-h-0 flex-1 items-center justify-center border-t border-[var(--emr-line-hairline)] pt-2">
      <div
        className="w-full max-w-xl rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-card p-5 text-center shadow-sm"
        data-testid="chart-start-locked-state"
      >
        <div className="emr-text-section font-semibold text-foreground">
          진료 시작 전입니다
        </div>
        <p className="mt-2 emr-text-dense text-muted-foreground">
          {isCalled
            ? "환자가 입실하면 진료 시작을 눌러 차트 입력과 오더 작업을 시작할 수 있습니다."
            : "진료실을 선택해 환자를 호출한 뒤, 환자가 입실하면 진료 시작을 눌러 차트 입력과 오더 작업을 시작할 수 있습니다."}
        </p>
      </div>
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-full items-center justify-center emr-text-dense text-muted-foreground">
      진료 대기열에서 환자를 선택해 주세요.
    </div>
  );
}

export function ChartContent({ workspaceId }: ShellComponentProps) {
  useScenarioEncounterSync();

  const selectedEncounterId = useChartStore(
    (state) => state.selectedEncounterId,
  );
  const pendingConsultationCallEncounterId = useChartStore(
    (state) => state.pendingConsultationCallEncounterId,
  );
  const clearPendingConsultationCall = useChartStore(
    (state) => state.clearPendingConsultationCall,
  );
  const liveQueueRecords = useChartStore((state) => state.liveQueueRecords);
  const updateLiveQueueRecord = useChartStore((state) => state.updateLiveQueueRecord);
  const allowStoreMockFallback = useChartStore(
    (state) => state.liveQueueStatus === "idle",
  );
  const demoScenarioEncounterId = useDemoScenarioChartEncounterId();
  const allowMockFallback =
    isLegacySalesDemoWorkspace(workspaceId) &&
    (allowStoreMockFallback ||
      selectedEncounterId === demoScenarioEncounterId);
  const { contentAsideOpen, setContentAsideOpen } = useLayoutStore();
  const {
    hydrated: authHydrated,
    session: authSession,
    hydrate: hydrateAuthSession,
  } = useAuthClient();
  const chartWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const resizingPointerIdRef = useRef<number | null>(null);
  const bundle = getSelectedBundle(selectedEncounterId, liveQueueRecords, {
    allowMockFallback,
  });
  const selectedLiveQueueRecord = liveQueueRecords.find(
    (record) => record.encounter.id === selectedEncounterId,
  );
  const latestSoap = bundle?.soapNotes.at(-1);
  const activeEncounterId = bundle?.encounter.id;
  const activeWorkspaceId = bundle?.encounter.workspaceId;
  const actorHeaders = useMemo(
    () => getDemoActorHeader(authSession),
    [authSession],
  );
  const [persistedSoapState, setPersistedSoapState] = useState<{
    encounterId?: string;
    soapNote?: SoapNote | null;
  }>({});
  const [chartCompletionState, setChartCompletionState] = useState<{
    completion?: ChartCompletionSnapshot | null;
    encounterId?: string;
    status: "idle" | "loading" | "saving" | "saved" | "error";
  }>({ status: "idle" });
  const effectiveLatestSoap =
    persistedSoapState.encounterId === activeEncounterId &&
    persistedSoapState.soapNote
      ? persistedSoapState.soapNote
      : latestSoap;
  const effectiveEncounter =
    bundle &&
    chartCompletionState.encounterId === activeEncounterId &&
    chartCompletionState.completion
      ? {
          ...bundle.encounter,
          status: chartCompletionState.completion.status,
          chartCompletedAt: chartCompletionState.completion.chartCompletedAt,
          chartCompletedByUserId:
            chartCompletionState.completion.chartCompletedByUserId,
          updatedAt: chartCompletionState.completion.updatedAt,
        }
      : bundle?.encounter;
  const effectiveBundle =
    bundle && effectiveEncounter
      ? { ...bundle, encounter: effectiveEncounter }
      : bundle;
  const [chartTopPercent, setChartTopPercent] = useState(
    CHART_TOP_DEFAULT_PERCENT,
  );
  const [isChartResizing, setIsChartResizing] = useState(false);
  const [chartCompleteDialogOpen, setChartCompleteDialogOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [selectedCallRoomId, setSelectedCallRoomId] = useState("");
  const [saveCallRoomPreference, setSaveCallRoomPreference] = useState(false);
  const [preferredCallRoomId, setPreferredCallRoomId] = useState("");
  const [consultationFlowState, setConsultationFlowState] = useState<{
    action?: "call" | "start";
    status: "idle" | "saving" | "error";
  }>({ status: "idle" });
  const [chartUnavailableAction, setChartUnavailableAction] =
    useState<ChartUnavailableAction | null>(null);
  const [diagnosisState, setDiagnosisState] = useState<{
    encounterId?: string;
    rows: EditableDiagnosis[];
  }>(() => ({
    encounterId: bundle?.encounter.id,
    rows: bundle ? bundle.diagnoses.map(toEditableDiagnosis) : [],
  }));
  const [diagnosisPersistenceState, setDiagnosisPersistenceState] = useState<{
    encounterId?: string;
    status: "idle" | "loading" | "saving" | "saved" | "error";
  }>({ status: "idle" });

  if (diagnosisState.encounterId !== activeEncounterId) {
    setDiagnosisState({
      encounterId: activeEncounterId,
      rows: bundle ? bundle.diagnoses.map(toEditableDiagnosis) : [],
    });
  }

  const diagnosisRows = diagnosisState.rows;
  const setDiagnosisRows: Dispatch<SetStateAction<EditableDiagnosis[]>> = (
    nextRows,
  ) => {
    setDiagnosisState((current) => {
      const rows =
        typeof nextRows === "function"
          ? (
              nextRows as (
                currentRows: EditableDiagnosis[],
              ) => EditableDiagnosis[]
            )(current.rows)
          : nextRows;

      return {
        ...current,
        rows,
      };
    });
  };
  const bundleEncounterId = bundle?.encounter.id;
  const orderGroups = useMemo(
    () => (bundleEncounterId ? getChartOrderGroups(bundleEncounterId) : []),
    [bundleEncounterId],
  );
  const allOrders = useMemo(
    () => orderGroups.flatMap(({ orders }) => orders),
    [orderGroups],
  );
  const effectiveQueueEntry =
    selectedLiveQueueRecord?.queueEntry ??
    (bundle?.encounter.id === selectedEncounterId
      ? selectedLiveQueueRecord?.queueEntry
      : undefined);
  const getChartSplitBounds = () => {
    const workspace = chartWorkspaceRef.current;
    const availableHeight = workspace
      ? workspace.getBoundingClientRect().height - CHART_RESIZER_HEIGHT_PX
      : 0;

    if (availableHeight <= CHART_TOP_MIN_PX + CHART_ORDER_MIN_PX) {
      return { min: 35, max: 65 };
    }

    return {
      min: (CHART_TOP_MIN_PX / availableHeight) * 100,
      max: ((availableHeight - CHART_ORDER_MIN_PX) / availableHeight) * 100,
    };
  };
  const setClampedChartTopPercent = (nextPercent: number) => {
    const { min, max } = getChartSplitBounds();

    setChartTopPercent(clampNumber(nextPercent, min, max));
  };
  const resizeChartWorkspace = (clientY: number) => {
    const workspace = chartWorkspaceRef.current;

    if (!workspace) return;

    const rect = workspace.getBoundingClientRect();
    const availableHeight = rect.height - CHART_RESIZER_HEIGHT_PX;

    if (availableHeight <= 0) return;

    const topHeight = clientY - rect.top;

    setClampedChartTopPercent((topHeight / availableHeight) * 100);
  };
  const handleChartResizePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    resizingPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsChartResizing(true);
    resizeChartWorkspace(event.clientY);
  };
  const handleChartResizePointerMove = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (!isChartResizing || resizingPointerIdRef.current !== event.pointerId)
      return;

    if (event.buttons !== 1) {
      resizingPointerIdRef.current = null;
      setIsChartResizing(false);
      return;
    }

    resizeChartWorkspace(event.clientY);
  };
  const stopChartResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (
      resizingPointerIdRef.current !== null &&
      resizingPointerIdRef.current !== event.pointerId
    )
      return;

    resizingPointerIdRef.current = null;
    setIsChartResizing(false);
  };
  const handleChartResizeKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setClampedChartTopPercent(chartTopPercent - CHART_RESIZER_STEP_PERCENT);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setClampedChartTopPercent(chartTopPercent + CHART_RESIZER_STEP_PERCENT);
    } else if (event.key === "Home") {
      event.preventDefault();
      setClampedChartTopPercent(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setClampedChartTopPercent(100);
    }
  };
  const handleChartCompletionConfirm = async () => {
    if (chartCompletionState.status === "saving") return;
    if (!activeEncounterId || !activeWorkspaceId) {
      toast.error("진료 차트를 먼저 선택해 주세요.");
      return;
    }

    setChartCompletionState((current) => ({
      completion:
        current.encounterId === activeEncounterId ? current.completion : null,
      encounterId: activeEncounterId,
      status: "saving",
    }));

    const result = await completeChartRoute({
      actorHeaders,
      encounterId: activeEncounterId,
      workspaceId: activeWorkspaceId,
    });

    if (!result.ok) {
      setChartCompletionState((current) => ({
        completion:
          current.encounterId === activeEncounterId ? current.completion : null,
        encounterId: activeEncounterId,
        status: "error",
      }));
      toast.error(
        result.denialReason === "permission_missing"
          ? "차트 작성완료 권한이 없어 저장하지 못했어요."
          : "차트 작성완료 상태를 저장하지 못했어요.",
      );
      return;
    }

    setChartCompletionState({
      completion: result.completion,
      encounterId: activeEncounterId,
      status: "saved",
    });
    setChartCompleteDialogOpen(false);
    toast.success("차트 작성완료 상태를 저장했어요.");
  };
  const handleConsultationFlowMutation = async (action: "call" | "start") => {
    if (consultationFlowState.status === "saving") return;
    if (!activeEncounterId || !activeWorkspaceId || !selectedLiveQueueRecord) {
      toast.error("진료 대기열에서 환자를 먼저 선택해 주세요.");
      return;
    }
    if (action === "call" && !selectedCallRoomId) {
      toast.error("진료실을 선택해 주세요.");
      return;
    }

    setConsultationFlowState({ action, status: "saving" });
    const result = await mutateConsultationFlowRoute({
      action,
      actorHeaders,
      encounterId: activeEncounterId,
      roomId: action === "call" ? selectedCallRoomId : undefined,
      workspaceId: activeWorkspaceId,
    });

    if (!result.ok) {
      setConsultationFlowState({ action, status: "error" });
      toast.error(
        result.denialReason === "permission_missing"
          ? "진료 흐름 변경 권한이 없어 저장하지 못했어요."
          : action === "call"
            ? "호출 상태를 저장하지 못했어요."
            : "진료 시작 상태를 저장하지 못했어요.",
      );
      return;
    }

    updateLiveQueueRecord({
      ...selectedLiveQueueRecord,
      encounter: result.flow.encounter,
      queueEntry: result.flow.queueEntry,
    });
    saveChartLiveEncounterHandoff({
      encounter: result.flow.encounter,
      patient: selectedLiveQueueRecord.patient,
      primaryGuardian: selectedLiveQueueRecord.primaryGuardian,
      veterinarianName: selectedLiveQueueRecord.veterinarianName,
    });
    if (action === "call") {
      writeCallRoomPreference({
        actorUserId: authSession?.id,
        roomId: selectedCallRoomId,
        shouldSave: saveCallRoomPreference,
        workspaceId: activeWorkspaceId,
      });
      setPreferredCallRoomId(saveCallRoomPreference ? selectedCallRoomId : "");
    }
    setConsultationFlowState({ action, status: "idle" });
    setCallDialogOpen(false);
    setSelectedCallRoomId("");
    setSaveCallRoomPreference(false);
    toast.success(action === "call" ? "호출 상태로 전환했어요." : "진료를 시작했어요.");
  };
  const handleDiagnosisRowsChange = async (nextRows: EditableDiagnosis[]) => {
    if (!activeEncounterId || !activeWorkspaceId) {
      toast.error("진료 차트를 먼저 선택해 주세요.");
      return;
    }

    setDiagnosisPersistenceState({
      encounterId: activeEncounterId,
      status: "saving",
    });

    const result = await saveChartDiagnosesRoute({
      actorHeaders,
      diagnoses: nextRows,
      encounterId: activeEncounterId,
      workspaceId: activeWorkspaceId,
    });

    if (!result.ok) {
      setDiagnosisPersistenceState({
        encounterId: activeEncounterId,
        status: "error",
      });
      toast.error(
        result.denialReason === "permission_missing"
          ? "진단명 저장 권한이 없어 저장하지 못했어요."
          : "진단명을 저장하지 못했어요.",
      );
      return;
    }

    setDiagnosisState({
      encounterId: activeEncounterId,
      rows: result.diagnoses.map(toEditableDiagnosis),
    });
    setDiagnosisPersistenceState({
      encounterId: activeEncounterId,
      status: "saved",
    });
  };

  useEffect(() => {
    hydrateAuthSession();
  }, [hydrateAuthSession]);

  const handleOpenCallDialog = () => {
    const roomIds = new Set(getConsultationCallRooms().map((room) => room.id));
    const storedRoomId = readCallRoomPreference({
      actorUserId: authSession?.id,
      roomIds,
      workspaceId: activeWorkspaceId,
    });

    setPreferredCallRoomId(storedRoomId);
    setSaveCallRoomPreference(Boolean(storedRoomId));
    setSelectedCallRoomId(storedRoomId);
    setCallDialogOpen(true);
  };

  useEffect(() => {
    if (
      !pendingConsultationCallEncounterId ||
      pendingConsultationCallEncounterId !== activeEncounterId ||
      !bundle?.encounter.status
    ) {
      return;
    }

    if (
      bundle.encounter.status !== "waiting" ||
      effectiveQueueEntry?.status !== "waiting"
    ) {
      clearPendingConsultationCall();
      return;
    }

    const timer = window.setTimeout(() => {
      const roomIds = new Set(getConsultationCallRooms().map((room) => room.id));
      const storedRoomId = readCallRoomPreference({
        actorUserId: authSession?.id,
        roomIds,
        workspaceId: activeWorkspaceId,
      });

      setPreferredCallRoomId(storedRoomId);
      setSaveCallRoomPreference(Boolean(storedRoomId));
      setSelectedCallRoomId(storedRoomId);
      setCallDialogOpen(true);
      clearPendingConsultationCall();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [
    activeEncounterId,
    activeWorkspaceId,
    authSession?.id,
    bundle?.encounter.status,
    clearPendingConsultationCall,
    effectiveQueueEntry?.status,
    pendingConsultationCallEncounterId,
  ]);

  useEffect(() => {
    if (!authHydrated || !activeEncounterId || !activeWorkspaceId) return;

    let cancelled = false;

    async function loadPersistedSoap() {
      const result = await loadChartSoapNote({
        actorHeaders,
        encounterId: activeEncounterId!,
        workspaceId: activeWorkspaceId!,
      });

      if (cancelled) return;

      setPersistedSoapState({
        encounterId: activeEncounterId,
        soapNote: result.ok ? result.soapNote : null,
      });
    }

    void loadPersistedSoap();

    return () => {
      cancelled = true;
    };
  }, [activeEncounterId, activeWorkspaceId, actorHeaders, authHydrated]);

  useEffect(() => {
    if (!authHydrated || !activeEncounterId || !activeWorkspaceId) return;

    let cancelled = false;

    async function loadPersistedDiagnoses() {
      setDiagnosisPersistenceState({
        encounterId: activeEncounterId!,
        status: "loading",
      });

      const result = await loadChartDiagnoses({
        actorHeaders,
        encounterId: activeEncounterId!,
        workspaceId: activeWorkspaceId!,
      });

      if (cancelled) return;

      if (result.ok) {
        setDiagnosisState({
          encounterId: activeEncounterId,
          rows: result.diagnoses.map(toEditableDiagnosis),
        });
        setDiagnosisPersistenceState({
          encounterId: activeEncounterId,
          status: "idle",
        });
        return;
      }

      setDiagnosisPersistenceState({
        encounterId: activeEncounterId,
        status: "error",
      });
    }

    void loadPersistedDiagnoses();

    return () => {
      cancelled = true;
    };
  }, [activeEncounterId, activeWorkspaceId, actorHeaders, authHydrated]);

  useEffect(() => {
    if (!authHydrated || !activeEncounterId || !activeWorkspaceId) return;

    let cancelled = false;

    async function loadPersistedCompletion() {
      setChartCompletionState((current) => ({
        completion:
          current.encounterId === activeEncounterId ? current.completion : null,
        encounterId: activeEncounterId!,
        status: "loading",
      }));

      const result = await loadChartCompletion({
        actorHeaders,
        encounterId: activeEncounterId!,
        workspaceId: activeWorkspaceId!,
      });

      if (cancelled) return;

      setChartCompletionState({
        completion: result.ok ? result.completion : null,
        encounterId: activeEncounterId,
        status: result.ok ? "idle" : "error",
      });
    }

    void loadPersistedCompletion();

    return () => {
      cancelled = true;
    };
  }, [activeEncounterId, activeWorkspaceId, actorHeaders, authHydrated]);

  useEffect(() => {
    if (!isChartResizing) return;

    const stopResize = () => {
      resizingPointerIdRef.current = null;
      setIsChartResizing(false);
    };
    const stopPointerResize = (event: globalThis.PointerEvent) => {
      if (
        resizingPointerIdRef.current !== null &&
        resizingPointerIdRef.current !== event.pointerId
      )
        return;

      stopResize();
    };

    window.addEventListener("pointerup", stopPointerResize);
    window.addEventListener("pointercancel", stopPointerResize);
    window.addEventListener("blur", stopResize);

    return () => {
      window.removeEventListener("pointerup", stopPointerResize);
      window.removeEventListener("pointercancel", stopPointerResize);
      window.removeEventListener("blur", stopResize);
    };
  }, [isChartResizing]);

  if (!bundle || !effectiveBundle) return <EmptyChartState />;

  const currentBundle = effectiveBundle;
  const consultationCallRooms = getConsultationCallRooms();
  const selectedCallRoom = consultationCallRooms.find(
    (room) => room.id === selectedCallRoomId,
  );
  const chartCompletionStatusText = getConsultationWorkflowStatusText(
    currentBundle.encounter,
    effectiveQueueEntry,
  );
  const canCompleteCurrentChart = canCompleteChartFromWorkflow(
    currentBundle.encounter,
    effectiveQueueEntry,
  );
  const primaryAction =
    currentBundle.encounter.status === "waiting" && effectiveQueueEntry?.status === "waiting"
      ? "call"
      : currentBundle.encounter.status === "waiting" && effectiveQueueEntry?.status === "called"
        ? "start"
        : canCompleteCurrentChart
          ? "complete"
          : null;
  const primaryActionBusy =
    consultationFlowState.status === "saving" ||
    chartCompletionState.status === "saving";
  const chartStartLocked =
    currentBundle.encounter.status === "waiting" &&
    (effectiveQueueEntry?.status === "waiting" || effectiveQueueEntry?.status === "called");
  const callDialogTitle = `${currentBundle.patient.name}/${currentBundle.primaryGuardian?.name ?? "보호자 미지정"}을 호출하시겠습니까?`;
  const diagnosisSaveStatusText =
    diagnosisPersistenceState.encounterId === activeEncounterId
      ? diagnosisPersistenceState.status === "saving"
        ? "저장 중"
        : diagnosisPersistenceState.status === "saved"
          ? "저장됨"
          : diagnosisPersistenceState.status === "error"
            ? "저장 실패"
            : "저장 대기"
      : "저장 대기";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-workspace)] px-4 py-3">
      <EmrInstructionHeaderStack
        titleBar={
          <EmrInstructionTitleBar
            title="진료 차트"
            icon={
              <EmrInstructionHistoryToggle
                ariaLabelPrefix="차트 이력"
                controls="chart-content-aside"
                expanded={contentAsideOpen}
                tooltipLabel="과거 이력 보기"
                onClick={() => setContentAsideOpen(!contentAsideOpen)}
              />
            }
            badge={
              <Badge
                variant="secondary"
                className="h-5 rounded-md px-2 emr-text-micro text-muted-foreground"
              >
                {currentBundle.encounter.encounterNo}
              </Badge>
            }
            actions={
              <>
                <Button
                  variant="outline"
                  className="bg-card"
                  onClick={() => setChartUnavailableAction("chart-share")}
                >
                  차트 공유
                </Button>
                {primaryAction === "call" ? (
                  <Button
                    disabled={primaryActionBusy}
                    onClick={handleOpenCallDialog}
                  >
                    호출하기
                  </Button>
                ) : null}
                {primaryAction === "start" ? (
                  <Button
                    disabled={primaryActionBusy}
                    onClick={() => void handleConsultationFlowMutation("start")}
                  >
                    진료 시작
                  </Button>
                ) : null}
                {primaryAction === "complete" ? (
                  <Button
                    disabled={primaryActionBusy}
                    onClick={() => setChartCompleteDialogOpen(true)}
                  >
                    차트 작성완료
                  </Button>
                ) : null}
              </>
            }
          />
        }
        orderInfo={
          <ChartInstructionInfo
            bundle={currentBundle}
            latestSoap={effectiveLatestSoap}
            queueEntry={effectiveQueueEntry}
          />
        }
      />
      <Dialog
        open={callDialogOpen}
        onOpenChange={(open) => {
          setCallDialogOpen(open);
          if (!open) {
            setSelectedCallRoomId("");
            setSaveCallRoomPreference(false);
          }
        }}
      >
        <EmrDialogShell
          variant="confirm"
          title={callDialogTitle}
          description="진료실을 선택한 뒤 환자를 호출해 주세요. 진료 시작 전에는 차트 입력과 오더 작업을 할 수 없습니다."
          primaryAction={
            <Button
              size="sm"
              disabled={
                consultationFlowState.status === "saving" ||
                !selectedCallRoomId
              }
              onClick={() => void handleConsultationFlowMutation("call")}
            >
              {consultationFlowState.status === "saving" &&
              consultationFlowState.action === "call"
                ? "호출 중"
                : "호출하기"}
            </Button>
          }
          secondaryAction={
            <Button
              size="sm"
              variant="outline"
              disabled={consultationFlowState.status === "saving"}
              onClick={() => setCallDialogOpen(false)}
            >
              취소
            </Button>
          }
        >
          <div className="grid gap-2 emr-text-dense text-foreground">
            <ChartPreflightField
              icon={<UsersIcon aria-hidden="true" />}
              label="환자 / 보호자"
            >
              <ChartReadonlyField
                value={`${currentBundle.patient.name} / ${currentBundle.primaryGuardian?.name ?? "보호자 미지정"}`}
              />
            </ChartPreflightField>
            <ChartPreflightField
              icon={<ClockIcon aria-hidden="true" />}
              label="접수 시각"
            >
              <ChartReadonlyField
                value={getShortDateTime(
                  currentBundle.encounter.checkedInAt ??
                    currentBundle.encounter.createdAt,
                )}
              />
            </ChartPreflightField>
            <ChartPreflightField
              icon={<StethoscopeIcon aria-hidden="true" />}
              label="담당 수의사"
            >
              <ChartReadonlyField
                value={getChartBundleVeterinarianName(currentBundle)}
              />
            </ChartPreflightField>
            <ChartPreflightField
              icon={<BuildingIcon aria-hidden="true" />}
              label="진료실"
            >
              <Select
                value={selectedCallRoomId}
                onValueChange={(value) => {
                  const nextRoomId = value ?? "";
                  setSelectedCallRoomId(nextRoomId);
                  if (preferredCallRoomId && nextRoomId === preferredCallRoomId) {
                    setSaveCallRoomPreference(true);
                  }
                }}
                disabled={consultationFlowState.status === "saving"}
              >
                <SelectTrigger
                  aria-label="호출 진료실"
                  className="h-9 w-full bg-card"
                >
                  <span className="flex flex-1 truncate text-left">
                    {selectedCallRoom?.name ?? "진료실 선택"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {consultationCallRooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ChartPreflightField>
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 emr-text-metadata">
              <span aria-hidden="true" />
              <label className="flex min-h-7 items-center gap-2 text-[var(--emr-text-secondary)]">
                <EmrTableCheckbox
                  aria-label="이 진료실을 내 기본 진료실로 저장"
                  checked={saveCallRoomPreference}
                  disabled={
                    consultationFlowState.status === "saving" ||
                    !selectedCallRoomId
                  }
                  onCheckedChange={(checked) =>
                    setSaveCallRoomPreference(Boolean(checked))
                  }
                />
                <span>이 진료실을 내 기본 진료실로 저장</span>
              </label>
            </div>
          </div>
          {consultationFlowState.status === "error" &&
          consultationFlowState.action === "call" ? (
            <EmrInlineAlert
              severity="error"
              title="호출 상태가 저장되지 않았어"
              className="mt-3 emr-text-metadata"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleConsultationFlowMutation("call")}
                >
                  다시 시도
                </Button>
              }
            >
              호출 상태를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.
            </EmrInlineAlert>
          ) : null}
        </EmrDialogShell>
      </Dialog>
      <Dialog
        open={chartCompleteDialogOpen}
        onOpenChange={setChartCompleteDialogOpen}
      >
        <EmrDialogShell
          variant="confirm"
          title="차트 작성완료 확인"
          description="진료 기록, 진단명, 오더를 같은 환자 차트 기준으로 확인하고 작성완료 상태를 저장해."
          footerMeta="작성완료는 local-first/server route 저장 상태만 바꾸며 외부 전송이나 청구 확정은 별도 흐름이야."
          primaryAction={
            <Button
              size="sm"
              disabled={chartCompletionState.status === "saving"}
              onClick={() => void handleChartCompletionConfirm()}
            >
              {chartCompletionState.status === "saving"
                ? "저장 중"
                : "작성완료 저장"}
            </Button>
          }
          secondaryAction={
            <Button
              size="sm"
              variant="outline"
              disabled={chartCompletionState.status === "saving"}
              onClick={() => setChartCompleteDialogOpen(false)}
            >
              계속 작성
            </Button>
          }
        >
          <div className="grid gap-1 rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] p-3 emr-text-dense text-foreground">
            <ChartPreflightLine
              label="환자 / 보호자"
              value={`${currentBundle.patient.name} / ${currentBundle.primaryGuardian?.name ?? "보호자 미지정"}`}
            />
            <ChartPreflightLine
              label="차트번호"
              value={currentBundle.encounter.encounterNo}
            />
            <ChartPreflightLine
              label="진단명 / 오더"
              value={`${diagnosisRows.length}건 / ${allOrders.length}건`}
            />
            <ChartPreflightLine
              label="차트 상태"
              value={chartCompletionStatusText}
              emphasis
            />
            <ChartPreflightLine
              label="SOAP 상태"
              value={getSoapStatusText(effectiveLatestSoap)}
            />
          </div>
          {chartCompletionState.status === "error" ? (
            <EmrInlineAlert
              severity="error"
              title="차트 작성완료가 저장되지 않았어"
              className="mt-3 emr-text-metadata"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleChartCompletionConfirm()}
                >
                  작성완료 다시 시도
                </Button>
              }
              testId="chart-completion-error-alert"
            >
              현재 차트 내용은 화면에 남아 있지만 작성완료 상태는 확정되지
              않았어. 권한 또는 서버 저장 상태를 확인한 뒤 다시 시도해.
            </EmrInlineAlert>
          ) : null}
        </EmrDialogShell>
      </Dialog>
      {chartUnavailableAction ? (
        <ChartUnavailableAlert
          action={chartUnavailableAction}
          className="mt-2 shrink-0"
          onDismiss={() => setChartUnavailableAction(null)}
        />
      ) : null}
      {chartStartLocked ? (
        <ChartStartLockedState queueStatus={effectiveQueueEntry?.status} />
      ) : (
        <div
          ref={chartWorkspaceRef}
          data-slot="chart-workspace"
          className={cn(
            "mt-2 grid min-h-0 flex-1 border-t border-[var(--emr-line-hairline)] pt-2",
            isChartResizing && "select-none",
          )}
          style={{
            gridTemplateRows: `minmax(${CHART_TOP_MIN_PX}px, ${chartTopPercent}fr) ${CHART_RESIZER_HEIGHT_PX}px minmax(${CHART_ORDER_MIN_PX}px, ${100 - chartTopPercent}fr)`,
          }}
        >
          <div
            data-testid="chart-soap-diagnosis-grid"
            className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 [&>*]:min-w-0"
          >
            <SoapPanel
              key={`chart-soap-${effectiveLatestSoap?.id ?? selectedEncounterId}-${effectiveLatestSoap?.updatedAt ?? "initial"}`}
              actorHeaders={actorHeaders}
              diagnoses={diagnosisRows}
              encounterId={bundle.encounter.id}
              onPersistedSoapNote={(soapNote) =>
                setPersistedSoapState({
                  encounterId: bundle.encounter.id,
                  soapNote,
                })
              }
              soapNote={effectiveLatestSoap}
              workspaceId={bundle.encounter.workspaceId}
            />
            <AssessmentPanel
              key={`chart-assessment-${bundle.encounter.id}`}
              diagnosisRows={diagnosisRows}
              onDiagnosisRowsChange={handleDiagnosisRowsChange}
              saveStatusText={diagnosisSaveStatusText}
              setDiagnosisRows={setDiagnosisRows}
              soapNote={effectiveLatestSoap}
            />
          </div>
          <button
            type="button"
            role="separator"
            aria-orientation="horizontal"
            aria-label="진료 기록과 처방/오더 영역 높이 조절"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(chartTopPercent)}
            className={cn(
              "group relative -mx-1 flex cursor-row-resize items-center justify-center rounded-md outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              isChartResizing && "bg-[var(--emr-state-hover)]",
            )}
            onKeyDown={handleChartResizeKeyDown}
            onLostPointerCapture={stopChartResize}
            onPointerCancel={stopChartResize}
            onPointerDown={handleChartResizePointerDown}
            onPointerMove={handleChartResizePointerMove}
            onPointerUp={stopChartResize}
          >
            <span className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-[var(--emr-line-hairline)]" />
            <span className="relative h-1.5 w-10 rounded-full bg-[var(--emr-line-strong)] transition-colors group-hover:bg-[var(--emr-state-drag)]" />
          </button>
          <div className="min-h-0 min-w-0">
            <OrderArea
              key={bundle.encounter.id}
              actorHeaders={actorHeaders}
              bundle={bundle}
              orderGroups={orderGroups}
            />
          </div>
        </div>
      )}
    </div>
  );
}
