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
  CdsNavigationSidebarIcon,
} from "@/components/cds-icons/navigation";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrContentAsidePanel } from "@/components/emr/content-aside-panel";
import { EmrContentHistoryGroup, EmrContentHistoryItem } from "@/components/emr/content-history-list";
import {
  EmrInstructionHeaderStack,
  EmrInstructionHistoryToggle,
  EmrInstructionTitleBar,
} from "@/components/emr/instruction-header-stack";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
} from "@/components/emr/subpanel";
import { EmrOrderQueueSidePanel } from "@/components/emr/order-queue-side-panel";
import { EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { EmrTableCheckbox } from "@/components/emr/table-checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getChartEncounter,
  getChartHistoryRows,
  getChartInvoiceLineByOrderId,
  getChartOrderGroups,
  getChartQueueItems,
  getChartQueueStatuses,
  getChartStaffName,
  type ChartHistoryRow,
  type ChartOrderGroup,
} from "@/features/chart/data";
import { useAuthClient, type AuthSession } from "@/features/auth/auth-client";
import { ChartLineTabGroup } from "@/features/chart/components/chart-line-tab-group";
import { ChartSectionTitle } from "@/features/chart/components/chart-section-title";
import { SoapRichTextEditor } from "@/features/chart/components/soap-rich-text-editor";
import { useChartStore } from "@/features/chart/store";
import {
  getPatientDisplayAge,
  getPatientSexLabel,
  getSpeciesLabel,
} from "@/features/reception/data";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";
import type {
  Diagnosis,
  DiagnosisType,
  EmrOrder,
  EmrOrderStatus,
  EmrOrderType,
  Encounter,
  SoapNote,
} from "@/types/emr-domain";

type ChartBundle = NonNullable<ReturnType<typeof getChartEncounter>>;
type OrderFilter = "all" | EmrOrderType | "billing";
type SoapSaveState = "idle" | "loading" | "saving" | "saved" | "error";
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
type ChartOrderActionSnapshot = {
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

const CHART_TOP_DEFAULT_PERCENT = 50;
const CHART_TOP_MIN_PX = 180;
const CHART_ORDER_MIN_PX = 170;
const CHART_RESIZER_HEIGHT_PX = 16;
const CHART_RESIZER_STEP_PERCENT = 5;

const chartQueueFilterItems = [
  { value: "all", label: "전체" },
  { value: "appointment", label: "예약" },
  { value: "walk-in", label: "외래" },
];

const orderTypeMeta: Record<EmrOrderType, { handoff: string; label: string }> = {
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

const chartOrderTabs: Array<{ value: OrderFilter; label: string }> = [
  { value: "all", label: "전체오더" },
  { value: "lab", label: "임상" },
  { value: "imaging", label: "영상" },
  { value: "dispensing", label: "조제" },
  { value: "treatment", label: "처치" },
  { value: "billing", label: "수납" },
];

const getShortDateTime = (dateTime?: string) =>
  dateTime ? dateTime.slice(2, 16).replace("T", " ") : "-";

const getShortClockTime = (dateTime?: string) => (dateTime ? dateTime.slice(11, 16) : "-");

const clampNumber = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getDiagnosisLabel = (diagnoses: Diagnosis[]) =>
  diagnoses.length ? diagnoses.map((diagnosis) => diagnosis.diagnosisText).join(", ") : "진단 미입력";

const getSoapSectionStatusText = (status?: SoapNote["status"], statusAt?: string) => {
  if (!status) return "자동저장 대기";
  const statusLabel =
    status === "autosaved"
      ? "자동저장됨"
      : status === "draft"
        ? "작성중"
        : getStatusLabel("soap", status);

  return statusAt ? `${statusLabel} · ${getShortClockTime(statusAt)}` : statusLabel;
};

const getSoapStatusText = (soapNote?: SoapNote) =>
  soapNote
    ? getSoapSectionStatusText(soapNote.status, soapNote.signedAt ?? soapNote.autosavedAt ?? soapNote.updatedAt)
    : "차트 대기";

const isChartReadyForBilling = (encounter: Pick<Encounter, "chartCompletedAt" | "status">) =>
  Boolean(encounter.chartCompletedAt) || encounter.status === "ready_for_billing";

const getChartCompletionStatusText = (encounter: Pick<Encounter, "chartCompletedAt" | "status">) => {
  if (isChartReadyForBilling(encounter)) {
    return `작성완료 · ${getShortClockTime(encounter.chartCompletedAt)}`;
  }

  if (encounter.status === "completed") return "수납완료";
  if (encounter.status === "ordered") return "오더 진행중";
  if (encounter.status === "in_consultation") return "진료중";
  if (encounter.status === "waiting") return "차트 대기";

  return getStatusLabel("encounter", encounter.status);
};

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
    synonyms: ["acute gastroenteritis", "AGE", "구토", "설사", "식욕저하", "위장염"],
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

const normalizeDiagnosisQuery = (value: string) => value.trim().toLocaleLowerCase("ko-KR");

const buildDiagnosisSearchText = (item: DiagnosisCatalogItem) =>
  [item.name, item.systemLabel, item.hint, ...item.synonyms].join(" ").toLocaleLowerCase("ko-KR");

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
    return diagnosisCatalog.filter((item) => buildDiagnosisSearchText(item).includes(normalizedQuery)).slice(0, 6);
  }

  if (/(구토|위장|식욕|탈수|복부)/.test(contextText)) {
    return diagnosisCatalog.slice(0, 5);
  }

  return diagnosisCatalog.slice(0, 4);
};

const toEditableDiagnosis = (diagnosis: Diagnosis, index: number): EditableDiagnosis => ({
  ...diagnosis,
  catalogMatched: Boolean(diagnosis.diagnosisCatalogId) || diagnosisCatalog.some((item) => item.name === diagnosis.diagnosisText),
  isPrimary: index === 0,
  systemLabel: getDiagnosisSystemLabel(diagnosis),
});

function getSelectedBundle(selectedEncounterId: string) {
  return getChartEncounter(selectedEncounterId) ?? getChartEncounter("encounter-coco-260501");
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
  const selectedEncounterId = useChartStore((state) => state.selectedEncounterId);
  const selectEncounter = useChartStore((state) => state.selectEncounter);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryEncounterId = searchParams.get("encounterId") ?? scenario?.encounterId ?? null;
  const queryEncounterBundle = queryEncounterId ? getChartEncounter(queryEncounterId) : null;
  const hasValidQueryEncounter = queryEncounterId !== null && queryEncounterBundle !== null;

  useEffect(() => {
    if (!queryEncounterId || !hasValidQueryEncounter) return;
    if (lastAppliedQueryEncounterId.current === queryEncounterId) return;

    lastAppliedQueryEncounterId.current = queryEncounterId;
    if (selectedEncounterId !== queryEncounterId) {
      selectEncounter(queryEncounterId);
    }
  }, [hasValidQueryEncounter, queryEncounterId, selectEncounter, selectedEncounterId]);
}

export function ChartSidePanel() {
  const selectedEncounterId = useChartStore((state) => state.selectedEncounterId);
  const selectEncounter = useChartStore((state) => state.selectEncounter);
  const { setModulePanelOpen, setSelectedQueueItem } = useLayoutStore();
  const items = useMemo(() => getChartQueueItems(), []);

  return (
    <EmrOrderQueueSidePanel
      dateLabel="26.05.05 (화)"
      filterAriaLabel="진료 대기 유형 필터"
      filterItems={chartQueueFilterItems}
      getFilterValue={(item) => (item.receptionType === "예약" ? "appointment" : "walk-in")}
      items={items}
      listLabel="진료 대기열"
      selectedItemId={selectedEncounterId}
      statuses={getChartQueueStatuses()}
      title="진료/차트"
      onCollapse={() => setModulePanelOpen(false)}
      onSelectItem={(itemId) => {
        selectEncounter(itemId);
        setSelectedQueueItem("treatment", itemId);
      }}
    />
  );
}

export function ChartHeader({ hasRightPanel }: ShellComponentProps) {
  const selectedEncounterId = useChartStore((state) => state.selectedEncounterId);
  const { rightPanelOpen, setRightPanelOpen } = useLayoutStore();
  const bundle = getSelectedBundle(selectedEncounterId);

  if (!bundle) return null;

  const veterinarianName = getChartStaffName(bundle.encounter.primaryVeterinarianId) ?? "담당 미정";

  return (
    <EmrPatientContextBar
      patientItems={[
        { label: "차트번호", value: bundle.encounter.encounterNo },
        {
          label: "환자",
          value: `${bundle.patient.name} · 보호자 ${bundle.primaryGuardian?.name ?? "미지정"}`,
        },
        { label: "품종", value: bundle.patient.breed ?? getSpeciesLabel(bundle.patient) },
        { label: "나이", value: getPatientDisplayAge(bundle.patient) },
        { label: "성별", value: getPatientSexLabel(bundle.patient) },
      ]}
      vitalItems={getChartVitals(bundle)}
      memoActions={[
        { label: "방문목적" },
        { label: "보호자메모", locked: true },
        { label: "수납메모", disabled: true },
      ]}
      rightPanelToggleLabel="환자 정보"
      rightPanelToggleIcon={<CdsNavigationSidebarIcon className="-scale-x-100" aria-hidden="true" />}
      rightPanelToggleTooltipLabel={`환자 정보 ${rightPanelOpen ? "접기" : "보기"}`}
      trailingItems={[{ label: "담당 수의사", value: veterinarianName }]}
      onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
      rightPanelDisabled={!hasRightPanel}
      rightPanelOpen={rightPanelOpen}
    />
  );
}

export function ChartContentAside() {
  const selectedEncounterId = useChartStore((state) => state.selectedEncounterId);
  const selectEncounter = useChartStore((state) => state.selectEncounter);
  const setContentAsideOpen = useLayoutStore((state) => state.setContentAsideOpen);
  const [collapsedHistoryGroups, setCollapsedHistoryGroups] = useState<Set<string>>(() => new Set());
  const bundle = getSelectedBundle(selectedEncounterId);
  const historyRows = useMemo(
    () => (bundle ? getChartHistoryRows(bundle.patient.id) : []),
    [bundle]
  );
  const historyGroups = useMemo(
    () =>
      historyRows.reduce<Array<{ date: string; rows: ChartHistoryRow[] }>>((groups, row) => {
        const date = getShortDateTime(row.encounter.checkedInAt ?? row.encounter.createdAt).slice(0, 8);
        const group = groups.find((item) => item.date === date);

        if (group) {
          group.rows.push(row);
        } else {
          groups.push({ date, rows: [row] });
        }

        return groups;
      }, []),
    [historyRows]
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

  return (
    <EmrContentAsidePanel id="chart-content-aside">
      <EmrListHeader
        className="mx-0 h-6 border-y-0"
        count={historyRows.length}
        label="차트이력"
        leadingAction={
          <EmrListHeaderIconButton ariaLabel="차트 이력 목록 접기" iconSize="md" onClick={() => setContentAsideOpen(false)}>
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
  onSelect,
  row,
  selected,
}: {
  onSelect: () => void;
  row: ChartHistoryRow;
  selected: boolean;
}) {
  const primaryDiagnosis = row.diagnoses[0]?.diagnosisText;
  const summary = row.soapNote?.assessment ?? primaryDiagnosis ?? row.encounter.chiefComplaint ?? "진료 기록 없음";
  const category = row.encounter.visitPurpose ?? "외래";
  const statusLabel = getStatusLabel("encounter", row.encounter.status);

  return (
    <EmrContentHistoryItem
      selected={selected}
      testId={`chart-history-item-${row.encounter.id}`}
      title={primaryDiagnosis ?? row.encounter.encounterNo}
      badge={
        <Badge variant="outline" className="h-5 shrink-0 rounded-md px-1.5 text-[11px]">
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
          <span className="truncate">담당 {getChartStaffName(row.encounter.primaryVeterinarianId) ?? "미정"}</span>
          <span className="truncate">{row.encounter.encounterNo}</span>
          <span className="shrink-0">{getShortDateTime(row.encounter.checkedInAt ?? row.encounter.createdAt)}</span>
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

const soapDefaultTemplate: Record<(typeof soapTemplateRows)[number]["valueKey"], string> = {
  subjective: "보호자 진술:",
  objective: "신체검사 소견:",
  assessment: "평가:",
  plan: "계획:",
};

const soapSystemOptions = ["소화기", "호흡기", "피부", "전신", "예방", "검사", "기타"] as const;
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

function buildSoapEditorFields(soapNote?: SoapNote, useDefaultTemplate = true): SoapEditorField[] {
  return soapTemplateRows.map(({ label, valueKey }) => ({
    id: valueKey,
    label,
    value: soapNote?.[valueKey] ?? (useDefaultTemplate ? soapDefaultTemplate[valueKey] : ""),
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

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, "").replaceAll("&nbsp;", " ").trim();

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
  const templateValue = stripHtml(buildSoapDocumentHtml(buildSoapEditorFields()));
  return Boolean(plainValue && plainValue !== templateValue);
};

function getDemoActorHeader(session: AuthSession | null) {
  return session && (!("provider" in session) || session.provider !== "supabase")
    ? { "x-clair-demo-session-user-id": session.id }
    : undefined;
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
    soapTemplateRows.map(({ label, valueKey }) => [label, valueKey])
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
      }
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
  mode,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  content: string;
  encounterId: string;
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
          mode,
          ...extractSoapFieldsFromHtml(content),
        }),
      }
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
      }
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
      }
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
      }
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
      }
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
          })),
        }),
      }
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
      }
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
      }
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

async function saveChartOrderActionRoute({
  action,
  actorHeaders,
  encounterId,
  orderIds,
  workspaceId,
}: {
  action: ChartOrderActionKind;
  actorHeaders?: Record<string, string>;
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
          encounterId,
          orderIds,
        }),
      }
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
      }
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
  const defaultSection = useMemo<SoapSectionState>(
    () => {
      const fields = buildSoapEditorFields(soapNote);

      return {
        id: "default",
        title: "기본 SOAP",
        fields,
        content: buildSoapDocumentHtml(fields),
        status: soapNote?.status,
        statusAt: soapNote?.signedAt ?? soapNote?.autosavedAt ?? soapNote?.updatedAt,
        attachmentCount: 0,
        deletable: false,
        version: 0,
      };
    },
    [soapNote]
  );
  const [sectionOverrides, setSectionOverrides] = useState<Record<string, SoapSectionState>>({});
  const [manualSystemLabels, setManualSystemLabels] = useState<string[]>([]);
  const [deletedSystemLabels, setDeletedSystemLabels] = useState<string[]>([]);
  const [activeSoapId, setActiveSoapId] = useState("default");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteSoapId, setDeleteSoapId] = useState<string | null>(null);
  const [resetSoapId, setResetSoapId] = useState<string | null>(null);
  const [pendingDefaultContent, setPendingDefaultContent] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SoapSaveState>("idle");
  const latestDefaultContentRef = useRef(defaultSection.content);

  const diagnosisSystemSections = useMemo(() => {
    const labels = diagnoses.map(getSoapSystemLabel).filter(Boolean);
    return Array.from(new Set(labels));
  }, [diagnoses]);

  const systemLabels = useMemo(() => {
    const labels = [
      ...diagnosisSystemSections.filter((systemLabel) => !deletedSystemLabels.includes(systemLabel)),
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
    [defaultSection, sectionOverrides, systemLabels]
  );
  const resolvedActiveSoapId = soapSections.some((section) => section.id === activeSoapId) ? activeSoapId : "default";
  const activeSection = soapSections.find((section) => section.id === resolvedActiveSoapId) ?? soapSections[0];
  const addedSystemLabels = new Set(
    soapSections
      .map((section) => section.systemLabel)
      .filter((systemLabel): systemLabel is string => typeof systemLabel === "string")
  );
  const systemSections = soapSections.filter((section) => section.id !== "default");
  const visibleSystemSections = systemSections.slice(0, SOAP_VISIBLE_SYSTEM_TAB_COUNT);
  const overflowSystemSections = systemSections.slice(SOAP_VISIBLE_SYSTEM_TAB_COUNT);
  const activeInOverflow = overflowSystemSections.some((section) => section.id === resolvedActiveSoapId);
  const deleteTarget = soapSections.find((section) => section.id === deleteSoapId);
  const resetTarget = soapSections.find((section) => section.id === resetSoapId);

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

  const persistDefaultSoapContent = async (content: string, mode: "autosave" | "manual_save") => {
    setSaveState("saving");
    const result = await saveChartSoapNote({
      actorHeaders,
      content,
      encounterId,
      mode,
      workspaceId,
    });

    if (!result.ok || !result.soapNote) {
      setSaveState("error");
      return;
    }

    setSaveState("saved");
    latestDefaultContentRef.current = content;
    onPersistedSoapNote(result.soapNote);
    updateSectionOverride({
      ...defaultSection,
      content,
      status: result.soapNote.status,
      statusAt: result.soapNote.signedAt ?? result.soapNote.autosavedAt ?? result.soapNote.updatedAt,
      version: defaultSection.version + 1,
    });
  };

  useEffect(() => {
    latestDefaultContentRef.current = defaultSection.content;
  }, [defaultSection.content]);

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
    setDeletedSystemLabels((currentLabels) => currentLabels.filter((label) => label !== systemLabel));
    setManualSystemLabels((currentLabels) => {
      if (currentLabels.includes(systemLabel) || diagnosisSystemSections.includes(systemLabel)) return currentLabels;
      return [...currentLabels, systemLabel];
    });
    setSectionOverrides((currentOverrides) =>
      currentOverrides[nextSection.id]
        ? currentOverrides
        : {
            ...currentOverrides,
            [nextSection.id]: nextSection,
          }
    );
    if (shouldActivate) {
      setActiveSoapId(nextSection.id);
    }
  };

  const confirmDeleteSoap = () => {
    if (!deleteTarget?.deletable) return;

    const sectionToRestore = deleteTarget;
    const targetIndex = soapSections.findIndex((section) => section.id === deleteTarget.id);
    const nextActiveId = targetIndex > 0 ? (soapSections[targetIndex - 1]?.id ?? "default") : "default";

    if (deleteTarget.systemLabel) {
      setDeletedSystemLabels((currentLabels) =>
        currentLabels.includes(deleteTarget.systemLabel!)
          ? currentLabels
          : [...currentLabels, deleteTarget.systemLabel!]
      );
      setManualSystemLabels((currentLabels) => currentLabels.filter((label) => label !== deleteTarget.systemLabel));
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
              currentLabels.filter((label) => label !== sectionToRestore.systemLabel)
            );
            setManualSystemLabels((currentLabels) =>
              currentLabels.includes(sectionToRestore.systemLabel!)
                ? currentLabels
                : [...currentLabels, sectionToRestore.systemLabel!]
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

    toast.success(`${previousSection.title} 내용을 기본 템플릿으로 초기화했습니다.`, {
      action: {
        label: "되돌리기",
        onClick: () => {
          updateSectionOverride(previousSection);
          setActiveSoapId(previousSection.id);
        },
      },
    });
  };

  const soapTabItems = [
    { value: "default", label: "기본 SOAP" },
    ...visibleSystemSections.map((section) => ({ value: section.id, label: section.title })),
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
              "inline-flex h-full shrink-0 items-center gap-1 px-2 text-[length:var(--clair-typography-body-2-normal-font-size)] font-semibold leading-[var(--clair-typography-body-2-normal-line-height)] outline-none transition-colors hover:bg-[var(--emr-state-hover)] focus-visible:ring-3 focus-visible:ring-ring/50",
              activeInOverflow ? "text-foreground" : "text-muted-foreground"
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
        : saveState === "error"
          ? "저장 실패"
          : getSoapSectionStatusText(activeSection?.status, activeSection?.statusAt);

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
                  updateSectionOverride({ ...activeSection, attachmentCount: activeSection.attachmentCount + 1 });
                }}
              >
                첨부{activeSection.attachmentCount ? ` ${activeSection.attachmentCount}` : ""}
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
      <div className="flex min-h-0 flex-1 flex-col bg-[var(--emr-surface-panel)]">
        {activeSection ? (
          <div className="flex min-h-0 flex-1 flex-col bg-[var(--emr-surface-panel)]">
            <SoapRichTextEditor
              key={`${soapNote?.id ?? "empty"}-${soapNote?.updatedAt ?? "initial"}-${activeSection.id}-${activeSection.version}`}
              initialContent={activeSection.content}
              label={activeSection.title}
              onContentChange={updateActiveSoapContent}
            />
            <div className="flex min-h-9 items-center justify-between border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 text-[12px] text-muted-foreground">
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
                  onClick={() => void persistDefaultSoapContent(latestDefaultContentRef.current, "manual_save")}
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
            <DialogDescription className="text-[13px]">
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
                  className="flex min-h-11 items-center justify-between rounded-md px-3 text-left text-[13px] transition-colors hover:bg-[var(--emr-state-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => {
                    addSystemSoap(systemLabel, true);
                    setAddDialogOpen(false);
                  }}
                >
                  <span className="font-semibold text-foreground">{systemLabel}</span>
                  {alreadyAdded ? <Badge variant="outline">이미 추가됨</Badge> : null}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteSoapId !== null} onOpenChange={(open) => !open && setDeleteSoapId(null)}>
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
      <Dialog open={resetSoapId !== null} onOpenChange={(open) => !open && setResetSoapId(null)}>
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
    [searchQuery, soapNote]
  );
  const normalizedSearchQuery = normalizeDiagnosisQuery(searchQuery);
  const canAddFreeText =
    normalizedSearchQuery.length > 0 &&
    !diagnosisCatalog.some((item) => normalizeDiagnosisQuery(item.name) === normalizedSearchQuery);
  const resultModeLabel = normalizedSearchQuery ? "검색 결과" : "SOAP/주호소 기반 추천";
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

    if (diagnosisRows.some((row) => normalizeDiagnosisQuery(row.diagnosisText) === normalizedSearchQuery)) {
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
          ? { ...row, diagnosisType: row.diagnosisType === "confirmed" ? "suspected" : "confirmed" }
          : row
      )
    );
  };

  const togglePrimaryDiagnosis = (diagnosisId: string) => {
    commitDiagnosisRows(
      diagnosisRows.map((row) => (row.id === diagnosisId ? { ...row, isPrimary: !row.isPrimary } : row))
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
          <span data-testid="chart-diagnosis-save-status" className="text-[12px] font-medium text-muted-foreground">
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
              <PopoverTrigger nativeButton={false} render={<div className="relative min-w-0" />}>
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
                  className="h-9 bg-[var(--emr-surface-panel)] pl-9 text-[13px]"
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
                <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                  {resultModeLabel}
                </div>
                <div role="listbox" aria-label="진단명 검색 결과" className="grid gap-1">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={diagnosisRows.some((row) => row.diagnosisText === item.name)}
                      className="grid gap-1 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[var(--emr-state-hover)] aria-selected:bg-[var(--emr-state-selected)]"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addDiagnosisFromCatalog(item)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className="shrink-0">
                          {item.systemLabel}
                        </Badge>
                        <span className="truncate text-[13px] font-semibold text-foreground">
                          {item.name}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {diagnosisTypeLabel[item.defaultType]}
                        </span>
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">{item.hint}</span>
                    </button>
                  ))}
                  {canAddFreeText ? (
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      className="rounded-md border border-dashed border-[var(--emr-line-hairline)] px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[var(--emr-state-hover)]"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={addFreeTextDiagnosis}
                    >
                      <span className="font-semibold">‘{searchQuery.trim()}’ 직접 추가</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        카탈로그 미연결 진단명으로 이 차트에만 표시
                      </span>
                    </button>
                  ) : null}
                  {!searchResults.length && !canAddFreeText ? (
                    <div className="px-2.5 py-3 text-[12px] text-muted-foreground">
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
            <div className="grid grid-cols-[86px_minmax(0,1fr)_56px_56px_72px] bg-[var(--emr-surface-muted)] px-3 py-2 text-[12px] font-semibold text-muted-foreground">
              <span>계통분류</span>
              <span>진단명</span>
              <span>확진</span>
              <span>중점</span>
              <span>수의사</span>
            </div>
            {diagnosisRows.map((diagnosis) => (
              <div
                key={diagnosis.id}
                className="grid grid-cols-[86px_minmax(0,1fr)_56px_56px_72px] items-center border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 py-2 text-[13px]"
              >
                <Badge variant="outline">{diagnosis.systemLabel}</Badge>
                <span className="min-w-0 truncate font-medium">
                  {diagnosis.diagnosisText}
                </span>
                <button
                  type="button"
                  aria-label={`${diagnosis.diagnosisText} 확진 토글`}
                  aria-pressed={diagnosis.diagnosisType === "confirmed"}
                  className="w-fit rounded-md px-2 py-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-[var(--emr-state-hover)] aria-pressed:bg-[var(--emr-state-selected)] aria-pressed:text-foreground"
                  onClick={() => toggleConfirmedDiagnosis(diagnosis.id)}
                >
                  {diagnosis.diagnosisType === "confirmed" ? "✓" : "-"}
                </button>
                <button
                  type="button"
                  aria-label={`${diagnosis.diagnosisText} 중점 진단 표시`}
                  aria-pressed={diagnosis.isPrimary}
                  className="w-fit rounded-md px-2 py-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-[var(--emr-state-hover)] aria-pressed:bg-[var(--emr-state-selected)] aria-pressed:text-foreground"
                  onClick={() => togglePrimaryDiagnosis(diagnosis.id)}
                >
                  {diagnosis.isPrimary ? "✓" : "-"}
                </button>
                <span className="flex min-w-0 items-center justify-between gap-1">
                  <span className="truncate">{getChartStaffName(diagnosis.createdByUserId) ?? "미정"}</span>
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
              <div className="border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 py-6 text-center text-[13px] text-muted-foreground">
                진단 입력 전입니다.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function AssessmentHistory({ historyRows }: { historyRows: ChartHistoryRow[] }) {
  return (
    <section className="rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold">진단 이력</h2>
        <Badge variant="outline">{historyRows.length}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {historyRows.map((row) => (
          <div key={row.encounter.id} className="rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{getShortDateTime(row.encounter.checkedInAt ?? row.encounter.createdAt)}</span>
              <Badge variant="outline">{getStatusLabel("encounter", row.encounter.status)}</Badge>
            </div>
            <p className="mt-2 text-[13px] leading-5">
              {row.soapNote?.assessment ?? getDiagnosisLabel(row.diagnoses)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChartRightPanel() {
  const selectedEncounterId = useChartStore((state) => state.selectedEncounterId);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
  const bundle = getSelectedBundle(selectedEncounterId);
  const historyRows = useMemo(
    () => (bundle ? getChartHistoryRows(bundle.patient.id) : []),
    [bundle]
  );

  if (!bundle) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 items-center border-b border-[var(--emr-line-hairline)] px-3">
        <div className="flex min-w-0 flex-1 items-center">
          <div className="flex min-w-0 max-w-full items-center gap-1">
            <h2 className="min-w-0 truncate text-sm font-semibold">환자 정보</h2>
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
            <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
              보호자 메모: {bundle.primaryGuardian?.memo ?? "물 섭취 후 재구토, 검사 비용 설명을 먼저 요청."}
            </p>
          </section>
          <section className="rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] p-3">
            <div className="font-semibold">부가 정보</div>
            <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
              환자 메모: {bundle.patient.specialNote ?? "진료대에서 긴장도가 높아 보호자 동석 권장."}
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
  billingName: string;
  committedBillingName: string;
  committedQuantityInput: string;
  quantityInput: string;
  unitPrice?: number;
};

const getChartOrderDraftRows = (orderGroups: ChartOrderGroup[]): ChartOrderDraftRow[] =>
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
    })
  );

const applyPersistedOrderDrafts = (
  rows: ChartOrderDraftRow[],
  snapshots: ChartOrderDraftSnapshot[]
): ChartOrderDraftRow[] => {
  const snapshotByOrderId = new Map(snapshots.map((snapshot) => [snapshot.orderId, snapshot]));

  return rows
    .filter((row) => snapshotByOrderId.has(row.order.id))
    .map((row) => {
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

const applyPersistedOrderActions = (
  rows: ChartOrderDraftRow[],
  snapshots: ChartOrderActionSnapshot[]
): ChartOrderDraftRow[] => {
  const snapshotByOrderId = new Map(snapshots.map((snapshot) => [snapshot.orderId, snapshot]));

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

const applyPersistedOrderLifecycles = (
  rows: ChartOrderDraftRow[],
  snapshots: ChartOrderLifecycleSnapshot[]
): ChartOrderDraftRow[] => {
  const snapshotByOrderId = new Map(snapshots.map((snapshot) => [snapshot.orderId, snapshot]));

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

function ChartOrderTable({
  allVisibleSelected,
  hasCommittedRows,
  invalidOrderIds,
  onDeleteOrder,
  onToggleAll,
  onToggleOrder,
  onUpdateBillingName,
  onUpdateQuantity,
  rows,
  selectedOrderIds,
  someVisibleSelected,
}: {
  allVisibleSelected: boolean;
  hasCommittedRows: boolean;
  invalidOrderIds: Set<string>;
  onDeleteOrder: (orderId: string) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleOrder: (orderId: string, checked: boolean) => void;
  onUpdateBillingName: (orderId: string, billingName: string) => void;
  onUpdateQuantity: (orderId: string, quantityInput: string) => void;
  rows: ChartOrderDraftRow[];
  selectedOrderIds: Set<string>;
  someVisibleSelected: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]">
      <Table className="min-w-[1160px] table-fixed bg-[var(--emr-surface-panel)] text-[13px]">
        <TableHeader className="sticky top-0 z-10 bg-[var(--emr-surface-muted)]">
          <TableRow className="border-[var(--emr-line-hairline)] hover:bg-transparent">
            <TableHead className="w-10 px-3 text-muted-foreground">
              <EmrTableCheckbox
                aria-label="오더 전체 선택"
                checked={allVisibleSelected}
                indeterminate={someVisibleSelected}
                disabled={!rows.length}
                onCheckedChange={(checked) => onToggleAll(Boolean(checked))}
              />
            </TableHead>
            <TableHead className="w-[132px] text-[12px] text-muted-foreground">그룹</TableHead>
            <TableHead className="w-[72px] text-[12px] text-muted-foreground">분류</TableHead>
            <TableHead className="w-[76px] text-[12px] text-muted-foreground">상태</TableHead>
            <TableHead className="w-[260px] text-[12px] text-muted-foreground">Order명</TableHead>
            <TableHead className="w-[220px] text-[12px] text-muted-foreground">청구서명</TableHead>
            <TableHead className="w-[68px] text-right text-[12px] text-muted-foreground">수량</TableHead>
            <TableHead className="w-[84px] text-right text-[12px] text-muted-foreground">단가</TableHead>
            <TableHead className="w-[96px] text-right text-[12px] text-muted-foreground">청구금액</TableHead>
            <TableHead className="w-[76px] text-[12px] text-muted-foreground">수의사</TableHead>
            <TableHead className="w-[116px] text-right text-[12px] text-muted-foreground">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const { groupTitle, order } = row;
            const dirty = isChartOrderDraftRowDirty(row);
            const invalidQuantity = invalidOrderIds.has(order.id);
            const lineTotal = getDraftLineTotal(row);
            const selected = selectedOrderIds.has(order.id);

            return (
              <TableRow
                key={order.id}
                data-dirty={dirty ? "true" : undefined}
                data-state={selected ? "selected" : undefined}
                className="h-11 border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] hover:bg-[var(--emr-state-hover)] data-[dirty=true]:bg-[var(--emr-accent-subtle)]/40 data-[state=selected]:bg-[var(--emr-state-selected)]"
              >
                <TableCell className="px-3">
                  <EmrTableCheckbox
                    aria-label={`${order.displayName} 선택`}
                    checked={selected}
                    onCheckedChange={(checked) => onToggleOrder(order.id, Boolean(checked))}
                  />
                </TableCell>
                <TableCell className="truncate text-[12px] font-medium text-muted-foreground" title={groupTitle}>
                  {groupTitle}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="max-w-full truncate">
                    {orderTypeMeta[order.orderType].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <EmrStatusBadge label={orderStatusLabel[order.status]} marker="none" />
                </TableCell>
                <TableCell className="min-w-0 whitespace-normal py-2">
                  <div className="truncate font-medium" title={order.displayName}>
                    {order.displayName}
                  </div>
                  <div
                    className="truncate text-[12px] text-muted-foreground"
                    title={order.instruction ?? orderTypeMeta[order.orderType].handoff}
                  >
                    {order.instruction ?? orderTypeMeta[order.orderType].handoff}
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`${order.displayName} 청구서명 수정`}
                    value={row.billingName}
                    className="h-7 min-w-0 bg-[var(--emr-surface-panel)] px-2 text-[12px]"
                    onChange={(event) => onUpdateBillingName(order.id, event.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`${order.displayName} 수량 수정`}
                    aria-invalid={invalidQuantity}
                    inputMode="decimal"
                    title={invalidQuantity ? "수량은 숫자로 입력해 주세요." : undefined}
                    value={row.quantityInput}
                    className={cn(
                      "h-7 min-w-0 bg-[var(--emr-surface-panel)] px-2 text-right text-[12px] tabular-nums",
                      invalidQuantity && "border-[var(--emr-status-danger-border)]"
                    )}
                    onChange={(event) => onUpdateQuantity(order.id, event.target.value)}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.unitPrice !== undefined ? row.unitPrice.toLocaleString() : "-"}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {lineTotal !== undefined ? lineTotal.toLocaleString() : "-"}
                </TableCell>
                <TableCell className="truncate" title={getChartStaffName(order.requestedByUserId) ?? "미정"}>
                  {getChartStaffName(order.requestedByUserId) ?? "미정"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="outline"
                      size="xs"
                      className="bg-card"
                      onClick={() => toast.info(`${order.displayName} 이력은 후속 상세 화면에서 연결됩니다.`)}
                    >
                      이력
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      className="bg-card"
                      onClick={() => toast.info(`${order.displayName} 요청 흐름은 후속 작업에서 연결됩니다.`)}
                    >
                      요청
                    </Button>
                    <Button
                      aria-label={`${order.displayName} 오더 삭제`}
                      variant="outline"
                      size="icon-xs"
                      className="bg-card text-destructive"
                      disabled={!hasCommittedRows}
                      title={hasCommittedRows ? `${order.displayName} 오더 삭제` : "마지막 오더는 삭제할 수 없습니다."}
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
              <TableCell colSpan={11} className="h-28 text-center text-[13px] text-muted-foreground">
                <span className="grid gap-1">
                  <span className="font-semibold text-foreground">표시할 오더가 없습니다.</span>
                  <span>현재 선택한 분류에 해당하는 오더가 없어요.</span>
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
                onClick={() => toast.info("Order 추가는 오더 카탈로그 연결 범위에서 제공됩니다.")}
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
  const initialDraftRows = useMemo(() => getChartOrderDraftRows(orderGroups), [orderGroups]);
  const [committedRows, setCommittedRows] = useState<ChartOrderDraftRow[]>(initialDraftRows);
  const [draftRows, setDraftRows] = useState<ChartOrderDraftRow[]>(initialDraftRows);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => new Set());
  const [orderActionDialog, setOrderActionDialog] = useState<OrderActionDialogType | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [orderDraftSaveState, setOrderDraftSaveState] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle");
  const draftTouchedRef = useRef(false);
  const allOrders = useMemo(() => draftRows.map(({ order }) => order), [draftRows]);
  const orderCountByType = allOrders.reduce<Record<EmrOrderType, number>>(
    (counts, order) => ({
      ...counts,
      [order.orderType]: counts[order.orderType] + 1,
    }),
    { dispensing: 0, imaging: 0, lab: 0, treatment: 0 }
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
    ({ order }) => orderFilter !== "billing" && (orderFilter === "all" || order.orderType === orderFilter)
  );
  const totalAmount = draftRows.reduce((sum, row) => sum + (getDraftLineTotal(row) ?? 0), 0);
  const selectedAmount = draftRows.reduce((sum, row) => {
    if (!selectedOrderIds.has(row.order.id)) return sum;

    return sum + (getDraftLineTotal(row) ?? 0);
  }, 0);
  const selectedOrders = allOrders.filter((order) => selectedOrderIds.has(order.id));
  const recheckOrderCount = allOrders.filter((order) => order.status === "re_requested").length;
  const selectedRecheckOrderCount = selectedOrders.filter((order) => order.status === "re_requested").length;
  const actionableSelectedOrderCount = selectedOrders.filter((order) => order.status !== "cancelled").length;
  const visibleOrderIds = filteredOrderRows.map(({ order }) => order.id);
  const selectedVisibleOrderCount = visibleOrderIds.filter((orderId) => selectedOrderIds.has(orderId)).length;
  const allVisibleSelected = visibleOrderIds.length > 0 && selectedVisibleOrderCount === visibleOrderIds.length;
  const someVisibleSelected = selectedVisibleOrderCount > 0 && !allVisibleSelected;
  const committedRowIds = new Set(committedRows.map(({ order }) => order.id));
  const deletedDraftOrderCount = committedRows.filter(({ order }) =>
    draftRows.every((row) => row.order.id !== order.id)
  ).length;
  const changedDraftOrderCount =
    draftRows.filter((row) => {
      const committedRow = committedRows.find(({ order }) => order.id === row.order.id);

      return committedRow
        ? row.billingName !== committedRow.billingName ||
            row.quantityInput !== committedRow.quantityInput
        : true;
    }).length + deletedDraftOrderCount;
  const invalidOrderIds = new Set(
    draftRows
      .filter((row) => getDraftQuantity(row.quantityInput) === null)
      .map(({ order }) => order.id)
  );
  const hasDraftChanges = changedDraftOrderCount > 0;
  const canUpdateOrders = hasDraftChanges && invalidOrderIds.size === 0;
  const deleteTargetOrder = draftRows.find(({ order }) => order.id === deleteOrderId)?.order;
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
  const updateDraftRow = (orderId: string, nextFields: Partial<Pick<ChartOrderDraftRow, "billingName" | "quantityInput">>) => {
    draftTouchedRef.current = true;
    setDraftRows((currentRows) =>
      currentRows.map((row) =>
        row.order.id === orderId
          ? {
              ...row,
              ...nextFields,
            }
          : row
      )
    );
  };
  const resetDraftRows = () => {
    draftTouchedRef.current = false;
    setDraftRows(committedRows);
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      const committedOrderIds = new Set(committedRows.map(({ order }) => order.id));

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
    draftTouchedRef.current = false;
    setOrderDraftSaveState("loading");

    async function loadPersistedOrderDrafts() {
      const result = await loadChartOrderDraft({
        actorHeaders,
        encounterId: bundle.encounter.id,
        workspaceId: bundle.encounter.workspaceId,
      });

      if (cancelled) return;

      if (result.ok) {
        let nextRows = applyPersistedOrderDrafts(initialDraftRows, result.orderDrafts);
        const actionResult = await loadChartOrderActions({
          actorHeaders,
          encounterId: bundle.encounter.id,
          workspaceId: bundle.encounter.workspaceId,
        });

        if (actionResult.ok) {
          nextRows = applyPersistedOrderActions(nextRows, actionResult.orderActions);
        }
        const lifecycleResult = await loadChartOrderLifecycles({
          actorHeaders,
          encounterId: bundle.encounter.id,
          workspaceId: bundle.encounter.workspaceId,
        });

        if (lifecycleResult.ok) {
          nextRows = applyPersistedOrderLifecycles(nextRows, lifecycleResult.lifecycles);
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
  }, [actorHeaders, bundle.encounter.id, bundle.encounter.workspaceId, initialDraftRows]);
  const commitDraftRows = async () => {
    setOrderDraftSaveState("saving");
    const result = await saveChartOrderDraftRoute({
      actorHeaders,
      encounterId: bundle.encounter.id,
      rows: draftRows,
      workspaceId: bundle.encounter.workspaceId,
    });

    if (!result.ok) {
      setOrderDraftSaveState("error");
      toast.error(
        result.denialReason === "permission_missing"
          ? "오더 수정 권한이 없어 저장하지 못했어요."
          : "오더 변경을 저장하지 못했어요."
      );
      return;
    }

    const nextCommittedRows = applyPersistedOrderDrafts(draftRows, result.orderDrafts);
    draftTouchedRef.current = false;
    setCommittedRows(nextCommittedRows);
    setDraftRows(nextCommittedRows);
    setOrderDraftSaveState("saved");
    toast.success("Order 업데이트를 저장했어요.");
  };
  const commitOrderAction = async (action: ChartOrderActionKind) => {
    const orderIds = Array.from(selectedOrderIds);
    const result = await saveChartOrderActionRoute({
      action,
      actorHeaders,
      encounterId: bundle.encounter.id,
      orderIds,
      workspaceId: bundle.encounter.workspaceId,
    });

    if (!result.ok) {
      toast.error(
        result.denialReason === "permission_missing"
          ? "오더 작업 권한이 없어 저장하지 못했어요."
          : "오더 작업 상태를 저장하지 못했어요."
      );
      return;
    }

    setCommittedRows((currentRows) => applyPersistedOrderActions(currentRows, result.orderActions));
    setDraftRows((currentRows) => applyPersistedOrderActions(currentRows, result.orderActions));
    setOrderActionDialog(null);
    toast.success(action === "confirm" ? "Order 확정 상태를 저장했어요." : "Order 청구 후보를 저장했어요.");
  };
  const confirmDeleteOrder = () => {
    if (!deleteOrderId) return;

    draftTouchedRef.current = true;
    setDraftRows((currentRows) => currentRows.filter(({ order }) => order.id !== deleteOrderId));
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
  const orderActionLabel = orderActionDialog === "bill" ? "Order 청구" : "Order 확정";
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
          <Button
            variant="outline"
            size="sm"
            className="bg-card"
            onClick={() => toast.info("Order 출력은 문서/프린트 연결 범위에서 제공됩니다.")}
          >
            Order 출력
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-card"
            onClick={() => toast.info("Order 추가는 오더 카탈로그 연결 범위에서 제공됩니다.")}
          >
            + Order
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--emr-surface-panel)] px-3 pt-2 pb-0">
        <ChartOrderTable
          allVisibleSelected={allVisibleSelected}
          hasCommittedRows={committedRowIds.size > 1}
          invalidOrderIds={invalidOrderIds}
          onDeleteOrder={setDeleteOrderId}
          onToggleAll={toggleAllVisibleOrders}
          onToggleOrder={toggleOrder}
          onUpdateBillingName={(orderId, billingName) => updateDraftRow(orderId, { billingName })}
          onUpdateQuantity={(orderId, quantityInput) => updateDraftRow(orderId, { quantityInput })}
          rows={filteredOrderRows}
          selectedOrderIds={selectedOrderIds}
          someVisibleSelected={someVisibleSelected}
        />
      </div>
      <div className="grid min-h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] px-4 py-2 text-[12px]">
        <div className="min-w-0 text-muted-foreground">
          <div className="truncate">
            선택 오더 {selectedOrderIds.size}건 · 확정 대상 {actionableSelectedOrderCount}건 · 재확인 필요 {recheckOrderCount}건
            <span className="font-medium text-[var(--emr-status-info-text)]">{draftStatusText}</span>
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2 text-muted-foreground">
          <span className="whitespace-nowrap">선택 오더 합계: {selectedAmount.toLocaleString()}</span>
          <span className="whitespace-nowrap">Order 별 할인/할증 합계: 0</span>
          <Input readOnly value="0%" className="h-7 w-[72px] bg-[var(--emr-surface-panel)] text-right" />
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
          <Button size="sm" disabled={!hasSelectedOrders} onClick={() => setOrderActionDialog("confirm")}>
            Order 확정
          </Button>
        </div>
      </div>
      <Dialog open={orderActionDialog !== null} onOpenChange={(open) => !open && setOrderActionDialog(null)}>
        <EmrConfirmDialogContent
          title={`${orderActionLabel} 확인`}
          description={
            <span className="grid gap-3">
              <span>현재 환자와 선택 오더를 확인한 뒤 서버 draft 상태에 저장합니다.</span>
              <span className="grid gap-1 rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] p-3 text-[13px] text-foreground">
                <span>환자: {bundle.patient.name} · 보호자 {guardianName}</span>
                <span>차트번호: {bundle.encounter.encounterNo}</span>
                <span>선택 오더: {selectedOrderIds.size}건 · 선택 금액 {selectedAmount.toLocaleString()}</span>
                <span>재요청 포함: {selectedRecheckOrderCount ? `${selectedRecheckOrderCount}건` : "없음"}</span>
              </span>
            </span>
          }
          cancelLabel="다시 확인"
          confirmLabel={orderActionLabel}
          onCancel={() => setOrderActionDialog(null)}
          onConfirm={() => orderActionDialog && void commitOrderAction(orderActionDialog)}
        />
      </Dialog>
      <Dialog open={deleteOrderId !== null} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
        {deleteTargetOrder ? (
          <EmrConfirmDialogContent
            title="오더를 삭제할까요?"
            description={
              <span className="grid gap-3">
                <span>
                  {deleteTargetOrder.displayName} 오더를 현재 차트의 draft에서 제외합니다. 저장 시 서버 draft에도 반영됩니다.
                </span>
                <span className="rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] p-3 text-[13px] text-foreground">
                  삭제 후 `Order 업데이트`를 눌러 현재 세션 변경으로 확정할 수 있습니다.
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
}: {
  bundle: ChartBundle;
  latestSoap?: SoapNote;
}) {
  const veterinarianName = getChartStaffName(bundle.encounter.primaryVeterinarianId) ?? "담당 미정";
  const infoItems: Array<{ label: string; value: ReactNode }> = [
    {
      label: "접수 일시",
      value: getShortDateTime(bundle.encounter.checkedInAt ?? bundle.encounter.createdAt),
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
            className="text-[13px] font-semibold text-[var(--emr-status-info-text)]"
          >
            {getChartCompletionStatusText(bundle.encounter)}
          </span>
          <span data-testid="chart-soap-status" className="text-[12px] font-medium text-muted-foreground">
            {getSoapStatusText(latestSoap)}
          </span>
        </span>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-4 rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4 py-3">
      {infoItems.map(({ label, value }) => (
        <div key={label} className="border-r border-[var(--emr-line-hairline)] px-3 last:border-r-0">
          <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
          <div className="mt-1 flex min-h-6 items-center text-[13px] font-medium text-foreground">{value}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
      진료 대기열에서 환자를 선택해 주세요.
    </div>
  );
}

export function ChartContent() {
  useScenarioEncounterSync();

  const selectedEncounterId = useChartStore((state) => state.selectedEncounterId);
  const { contentAsideOpen, setContentAsideOpen } = useLayoutStore();
  const { hydrated: authHydrated, session: authSession, hydrate: hydrateAuthSession } = useAuthClient();
  const chartWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const resizingPointerIdRef = useRef<number | null>(null);
  const bundle = getSelectedBundle(selectedEncounterId);
  const latestSoap = bundle?.soapNotes.at(-1);
  const activeEncounterId = bundle?.encounter.id;
  const activeWorkspaceId = bundle?.encounter.workspaceId;
  const actorHeaders = useMemo(() => getDemoActorHeader(authSession), [authSession]);
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
    persistedSoapState.encounterId === activeEncounterId && persistedSoapState.soapNote
      ? persistedSoapState.soapNote
      : latestSoap;
  const effectiveEncounter =
    bundle && chartCompletionState.encounterId === activeEncounterId && chartCompletionState.completion
      ? {
          ...bundle.encounter,
          status: chartCompletionState.completion.status,
          chartCompletedAt: chartCompletionState.completion.chartCompletedAt,
          chartCompletedByUserId: chartCompletionState.completion.chartCompletedByUserId,
          updatedAt: chartCompletionState.completion.updatedAt,
        }
      : bundle?.encounter;
  const effectiveBundle = bundle && effectiveEncounter ? { ...bundle, encounter: effectiveEncounter } : bundle;
  const [chartTopPercent, setChartTopPercent] = useState(CHART_TOP_DEFAULT_PERCENT);
  const [isChartResizing, setIsChartResizing] = useState(false);
  const [chartCompleteDialogOpen, setChartCompleteDialogOpen] = useState(false);
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
  const setDiagnosisRows: Dispatch<SetStateAction<EditableDiagnosis[]>> = (nextRows) => {
    setDiagnosisState((current) => {
      const rows =
        typeof nextRows === "function"
          ? (nextRows as (currentRows: EditableDiagnosis[]) => EditableDiagnosis[])(current.rows)
          : nextRows;

      return {
        ...current,
        rows,
      };
    });
  };
  const orderGroups = useMemo(
    () => (bundle ? getChartOrderGroups(bundle.encounter.id) : []),
    [bundle?.encounter.id]
  );
  const allOrders = useMemo(() => orderGroups.flatMap(({ orders }) => orders), [orderGroups]);
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
  const handleChartResizePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    resizingPointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsChartResizing(true);
    resizeChartWorkspace(event.clientY);
  };
  const handleChartResizePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!isChartResizing || resizingPointerIdRef.current !== event.pointerId) return;

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

    if (resizingPointerIdRef.current !== null && resizingPointerIdRef.current !== event.pointerId) return;

    resizingPointerIdRef.current = null;
    setIsChartResizing(false);
  };
  const handleChartResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
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
      completion: current.encounterId === activeEncounterId ? current.completion : null,
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
        completion: current.encounterId === activeEncounterId ? current.completion : null,
        encounterId: activeEncounterId,
        status: "error",
      }));
      toast.error(
        result.denialReason === "permission_missing"
          ? "차트 작성완료 권한이 없어 저장하지 못했어요."
          : "차트 작성완료 상태를 저장하지 못했어요."
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
          : "진단명을 저장하지 못했어요."
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
    setDiagnosisPersistenceState({
      encounterId: activeEncounterId,
      status: "loading",
    });

    async function loadPersistedDiagnoses() {
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
    setChartCompletionState((current) => ({
      completion: current.encounterId === activeEncounterId ? current.completion : null,
      encounterId: activeEncounterId,
      status: "loading",
    }));

    async function loadPersistedCompletion() {
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
      if (resizingPointerIdRef.current !== null && resizingPointerIdRef.current !== event.pointerId) return;

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
  const chartCompletionStatusText = getChartCompletionStatusText(currentBundle.encounter);
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
              <Badge variant="secondary" className="h-5 rounded-md px-2 text-[11px] text-muted-foreground">
                {currentBundle.encounter.encounterNo}
              </Badge>
            }
            actions={
              <>
                <Button variant="outline" className="bg-card">
                  차트 공유
                </Button>
                <Button onClick={() => setChartCompleteDialogOpen(true)}>
                  차트 작성완료
                </Button>
              </>
            }
          />
        }
        orderInfo={<ChartInstructionInfo bundle={currentBundle} latestSoap={effectiveLatestSoap} />}
      />
      <Dialog open={chartCompleteDialogOpen} onOpenChange={setChartCompleteDialogOpen}>
        <EmrConfirmDialogContent
          title="차트 작성완료 확인"
          description={
            <span className="grid gap-3">
              <span>
                진료 기록, 진단명, 오더를 같은 환자 차트 기준으로 확인하고 작성완료 상태를 저장합니다.
              </span>
              <span className="grid gap-1 rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] p-3 text-[13px] text-foreground">
                <span>환자: {currentBundle.patient.name} · 보호자 {currentBundle.primaryGuardian?.name ?? "보호자 미지정"}</span>
                <span>차트번호: {currentBundle.encounter.encounterNo}</span>
                <span>진단명: {diagnosisRows.length}건 · 오더: {allOrders.length}건</span>
                <span>차트 상태: {chartCompletionStatusText}</span>
                <span>SOAP 상태: {getSoapStatusText(effectiveLatestSoap)}</span>
              </span>
            </span>
          }
          cancelLabel="계속 작성"
          confirmLabel={chartCompletionState.status === "saving" ? "저장 중" : "작성완료 확인"}
          onCancel={() => setChartCompleteDialogOpen(false)}
          onConfirm={handleChartCompletionConfirm}
        />
      </Dialog>
      <div
        ref={chartWorkspaceRef}
        data-slot="chart-workspace"
        className={cn(
          "mt-2 grid min-h-0 flex-1 border-t border-[var(--emr-line-hairline)] pt-2",
          isChartResizing && "select-none"
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
              setPersistedSoapState({ encounterId: bundle.encounter.id, soapNote })
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
            isChartResizing && "bg-[var(--emr-state-hover)]"
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
    </div>
  );
}

export { ChartRightPanel };
