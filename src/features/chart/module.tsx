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
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  CdsActionsRotateCcwIcon,
  CdsActionsSaveIcon,
  CdsActionsTrash2Icon,
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsContentBoldIcon,
  CdsContentItalicIcon,
  CdsContentListIcon,
  CdsContentLink2Icon,
} from "@/components/cds-icons/content-and-editor";
import {
  CdsNavigationChevronsLeftIcon,
  CdsNavigationChevronsRightIcon,
  CdsNavigationSidebarIcon,
} from "@/components/cds-icons/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
  SoapNote,
} from "@/types/emr-domain";

type ChartBundle = NonNullable<ReturnType<typeof getChartEncounter>>;
type OrderFilter = "all" | EmrOrderType;

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
  completed: "완료",
  in_progress: "진행중",
  re_requested: "재요청",
  requested: "요청",
};

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
  soapNote ? getSoapSectionStatusText(soapNote.status, soapNote.signedAt ?? soapNote.updatedAt) : "차트 대기";

const getDiagnosisSystemLabel = (diagnosis: Diagnosis) => {
  const text = diagnosis.diagnosisText;

  if (/(위장|구토|식욕|설사|소화)/.test(text)) return "소화기";
  if (/(피부|가려움|발진|재진)/.test(text)) return "피부";
  if (/(예방|접종|건강검진)/.test(text)) return "예방";
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
      <div className="flex shrink-0 gap-2 border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-app)] py-3">
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

type SoapEditorField = {
  id: (typeof soapTemplateRows)[number]["valueKey"];
  label: string;
  value: string;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function ChartSectionTitle({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2.5">
      <h2 className="shrink-0 text-[length:var(--clair-typography-body-2-normal-font-size)] font-semibold leading-[var(--clair-typography-body-2-normal-line-height)] text-foreground">
        {title}
      </h2>
      <span className="min-w-0 truncate text-[14px] font-medium text-[var(--clair-color-atomic-gray-400)]">{subtitle}</span>
    </div>
  );
}

function buildSoapEditorFields(soapNote?: SoapNote): SoapEditorField[] {
  return soapTemplateRows.map(({ label, valueKey }) => ({
    id: valueKey,
    label,
    value: soapNote?.[valueKey] ?? "",
  }));
}

function normalizeEditorLinkHref(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) return "";
  if (/^(https?:|mailto:|tel:)/i.test(trimmedValue)) return trimmedValue;

  return `https://${trimmedValue}`;
}

function SoapPanel({ diagnoses, soapNote }: { diagnoses: Diagnosis[]; soapNote?: SoapNote }) {
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [extraSections, setExtraSections] = useState<Array<{ id: string; title: string }>>([]);
  const diagnosisSystemSections = useMemo(() => {
    const labels = diagnoses.map(getSoapSystemLabel);
    return Array.from(new Set(labels));
  }, [diagnoses]);
  const soapSections = [
    {
      id: "default",
      initialFields: buildSoapEditorFields(soapNote),
      status: soapNote?.status,
      statusAt: soapNote?.signedAt ?? soapNote?.updatedAt,
      title: "기본 SOAP",
    },
    ...diagnosisSystemSections.map((title) => ({
      id: `diagnosis-${title}`,
      initialFields: buildSoapEditorFields(),
      status: undefined,
      statusAt: undefined,
      title: `${title} SOAP`,
    })),
    ...extraSections.map((section) => ({
      id: section.id,
      initialFields: buildSoapEditorFields(),
      status: "draft" as const,
      statusAt: undefined,
      title: section.title,
    })),
  ];
  const addSoapSection = () => {
    setExtraSections((current) => [
      ...current,
      {
        id: `extra-${current.length + 1}`,
        title: `추가 계통 SOAP ${current.length + 1}`,
      },
    ]);
  };
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]">
      <div className="relative z-10 flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4 py-2">
        <ChartSectionTitle title="진료 기록" subtitle="진단계통별 SOAP 작성" />
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" className="bg-card" onClick={addSoapSection}>
            SOAP 추가
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--emr-surface-panel)] p-4">
        <div className="grid gap-3">
          {soapSections.map((section) => (
            <div key={section.id} className="overflow-hidden rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]">
              <div className="relative z-10 flex min-h-9 items-center justify-between gap-2 border-b border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] px-3">
                <span className="text-[13px] font-semibold">{section.title}</span>
                <span className="text-[12px] font-medium text-[var(--clair-color-atomic-gray-400)]">
                  {getSoapSectionStatusText(section.status, section.statusAt)}
                </span>
              </div>
              <SoapRichTextEditor
                key={`${soapNote?.id ?? "empty"}-${section.id}`}
                initialFields={section.initialFields}
                label={section.title}
                attachmentCount={attachmentCounts[section.id] ?? 0}
                onAddAttachment={() => {
                  setAttachmentCounts((current) => ({
                    ...current,
                    [section.id]: (current[section.id] ?? 0) + 1,
                  }));
                }}
              />
              <div className="flex min-h-9 items-center justify-between border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 text-[12px] text-muted-foreground">
                <span>첨부 자료</span>
                <Badge variant="outline">{attachmentCounts[section.id] ? `${attachmentCounts[section.id]}개` : "없음"}</Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const editorToolbarButtonClassName =
  "bg-card aria-pressed:border-ring aria-pressed:bg-background aria-pressed:text-[var(--clair-color-primary-normal)]";

function EditorToolbarButton({
  active,
  children,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      className={cn(editorToolbarButtonClassName, active && "ring-2 ring-ring/30")}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function SoapRichTextEditor({
  attachmentCount,
  initialFields,
  label,
  onAddAttachment,
}: {
  attachmentCount: number;
  initialFields: SoapEditorField[];
  label: string;
  onAddAttachment: () => void;
}) {
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [activeFieldId, setActiveFieldId] = useState<SoapEditorField["id"]>("subjective");
  const [toolbarVersion, setToolbarVersion] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  useEffect(() => {
    if (!activeEditor) return;

    const refreshToolbar = () => setToolbarVersion((current) => current + 1);

    activeEditor.on("selectionUpdate", refreshToolbar);
    activeEditor.on("transaction", refreshToolbar);
    activeEditor.on("update", refreshToolbar);

    return () => {
      activeEditor.off("selectionUpdate", refreshToolbar);
      activeEditor.off("transaction", refreshToolbar);
      activeEditor.off("update", refreshToolbar);
    };
  }, [activeEditor]);

  const activateFieldEditor = (fieldId: SoapEditorField["id"], editor: Editor | null) => {
    if (!editor) return;

    setActiveFieldId(fieldId);
    setActiveEditor(editor);
  };
  const runEditorCommand = (command: (editor: Editor) => void) => {
    if (!activeEditor) return;

    command(activeEditor);
    setToolbarVersion((current) => current + 1);
  };
  const openLinkEditor = () => {
    if (!activeEditor) return;

    setLinkValue((activeEditor.getAttributes("link").href as string | undefined) ?? "");
    setLinkOpen(true);
  };
  const applyLink = () => {
    if (!activeEditor) return;

    const href = normalizeEditorLinkHref(linkValue);

    if (!href) {
      runEditorCommand((currentEditor) => currentEditor.chain().focus().unsetLink().run());
    } else {
      runEditorCommand((currentEditor) =>
        currentEditor.chain().focus().extendMarkRange("link").setLink({ href }).run()
      );
    }

    setLinkOpen(false);
  };
  const removeLink = () => {
    runEditorCommand((currentEditor) => currentEditor.chain().focus().unsetLink().run());
    setLinkValue("");
    setLinkOpen(false);
  };
  const activeFieldLabel =
    initialFields.find((field) => field.id === activeFieldId)?.label ?? initialFields[0]?.label ?? "SOAP";
  void toolbarVersion;

  return (
    <>
      <div className="flex min-h-10 items-center justify-between gap-2 border-b border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-[var(--clair-radius-sm)] bg-[var(--emr-surface-muted)] px-2 py-1 text-[11px] font-semibold text-[var(--clair-color-label-neutral)]">
            {activeFieldLabel}
          </span>
          <div className="flex items-center gap-1" aria-label={`${label} 서식 도구`}>
            <EditorToolbarButton
              active={false}
              disabled={!activeEditor}
              label={`${label} 실행 취소`}
              onClick={() => runEditorCommand((currentEditor) => currentEditor.chain().focus().undo().run())}
            >
              ↶
            </EditorToolbarButton>
            <EditorToolbarButton
              active={false}
              disabled={!activeEditor}
              label={`${label} 다시 실행`}
              onClick={() => runEditorCommand((currentEditor) => currentEditor.chain().focus().redo().run())}
            >
              ↷
            </EditorToolbarButton>
            <EditorToolbarButton
              active={activeEditor?.isActive("bold") ?? false}
              disabled={!activeEditor}
              label={`${label} 굵게`}
              onClick={() => runEditorCommand((currentEditor) => currentEditor.chain().focus().toggleBold().run())}
            >
              <CdsContentBoldIcon className="size-4" />
            </EditorToolbarButton>
            <EditorToolbarButton
              active={activeEditor?.isActive("italic") ?? false}
              disabled={!activeEditor}
              label={`${label} 기울임`}
              onClick={() => runEditorCommand((currentEditor) => currentEditor.chain().focus().toggleItalic().run())}
            >
              <CdsContentItalicIcon className="size-4" />
            </EditorToolbarButton>
            <EditorToolbarButton
              active={activeEditor?.isActive("underline") ?? false}
              disabled={!activeEditor}
              label={`${label} 밑줄`}
              onClick={() => runEditorCommand((currentEditor) => currentEditor.chain().focus().toggleUnderline().run())}
            >
              U
            </EditorToolbarButton>
            <EditorToolbarButton
              active={activeEditor?.isActive("bulletList") ?? false}
              disabled={!activeEditor}
              label={`${label} 글머리 목록`}
              onClick={() => runEditorCommand((currentEditor) => currentEditor.chain().focus().toggleBulletList().run())}
            >
              <CdsContentListIcon className="size-4" />
            </EditorToolbarButton>
            <EditorToolbarButton
              active={activeEditor?.isActive("orderedList") ?? false}
              disabled={!activeEditor}
              label={`${label} 번호 목록`}
              onClick={() => runEditorCommand((currentEditor) => currentEditor.chain().focus().toggleOrderedList().run())}
            >
              1.
            </EditorToolbarButton>
            <Popover open={linkOpen} onOpenChange={setLinkOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`${label} 링크`}
                    aria-pressed={activeEditor?.isActive("link") ?? false}
                    className={cn(
                      editorToolbarButtonClassName,
                      activeEditor?.isActive("link") && "ring-2 ring-ring/30"
                    )}
                    disabled={!activeEditor}
                    onClick={openLinkEditor}
                  >
                    <CdsContentLink2Icon className="size-4" />
                  </Button>
                }
              />
              <PopoverContent align="start" className="w-72 gap-2 p-3" initialFocus={false}>
                <div className="grid gap-1.5">
                  <div className="text-[12px] font-semibold text-[var(--clair-color-label-strong)]">링크 추가</div>
                  <Input
                    aria-label="링크 URL"
                    value={linkValue}
                    placeholder="https://example.com"
                    onChange={(event) => setLinkValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyLink();
                      }
                    }}
                  />
                </div>
                <div className="flex justify-end gap-1.5">
                  <Button type="button" variant="ghost" size="xs" onClick={removeLink}>
                    해제
                  </Button>
                  <Button type="button" size="xs" onClick={applyLink}>
                    적용
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="xs"
          aria-label={`${label} 첨부 추가`}
          className="bg-card"
          onClick={onAddAttachment}
        >
          첨부{attachmentCount ? ` ${attachmentCount}` : ""}
        </Button>
      </div>
      <div className="divide-y divide-[var(--emr-line-hairline)]">
        {initialFields.map((field) => (
          <SoapFieldEditor
            key={field.id}
            active={activeFieldId === field.id}
            field={field}
            sectionLabel={label}
            onActivate={activateFieldEditor}
          />
        ))}
      </div>
    </>
  );
}

function SoapFieldEditor({
  active,
  field,
  onActivate,
  sectionLabel,
}: {
  active: boolean;
  field: SoapEditorField;
  onActivate: (fieldId: SoapEditorField["id"], editor: Editor | null) => void;
  sectionLabel: string;
}) {
  const initialContent = field.value ? `<p>${escapeHtml(field.value)}</p>` : "";
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-[var(--clair-color-primary-normal)] underline underline-offset-2",
        },
      }),
      Placeholder.configure({
        placeholder: `${field.label} 내용을 입력하세요.`,
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        "aria-label": `${sectionLabel} ${field.label} 기록`,
        class:
          "min-h-[64px] px-3 py-2 text-[13px] leading-5 outline-none [&_ol]:my-1.5 [&_ol]:pl-5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_p]:my-1.5 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-[var(--clair-color-label-assistive)]",
      },
    },
    immediatelyRender: false,
  });

  return (
    <div
      className={cn(
        "grid min-h-[84px] grid-cols-[76px_minmax(0,1fr)] bg-[var(--emr-surface-panel)] transition-colors",
        active && "bg-[var(--clair-color-atomic-sky-50)]/45"
      )}
      onFocusCapture={() => onActivate(field.id, editor)}
    >
      <div className="border-r border-[var(--emr-line-hairline)] px-3 py-3">
        <div className="text-[12px] font-semibold text-[var(--clair-color-label-neutral)]">{field.label}</div>
        <div className="mt-1 text-[11px] text-[var(--clair-color-label-assistive)]">SOAP</div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function AssessmentPanel({
  diagnosisRows,
  setDiagnosisRows,
  soapNote,
}: {
  diagnosisRows: EditableDiagnosis[];
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

  const addDiagnosisFromCatalog = (item: DiagnosisCatalogItem) => {
    setDiagnosisRows((currentRows) => {
      if (currentRows.some((row) => row.diagnosisText === item.name)) return currentRows;

      return [
        ...currentRows,
        {
          catalogMatched: true,
          createdAt: new Date().toISOString(),
          createdByUserId: "user-vet-suji",
          diagnosisCatalogId: item.id,
          diagnosisText: item.name,
          diagnosisType: item.defaultType,
          encounterId: soapNote?.encounterId ?? "session-only-encounter",
          id: `diagnosis-session-${item.id}`,
          isPrimary: currentRows.length === 0,
          systemLabel: item.systemLabel,
        },
      ];
    });
    setSearchQuery("");
    setSearchOpen(false);
  };

  const addFreeTextDiagnosis = () => {
    const diagnosisText = searchQuery.trim();
    if (!diagnosisText) return;

    setDiagnosisRows((currentRows) => {
      if (currentRows.some((row) => normalizeDiagnosisQuery(row.diagnosisText) === normalizedSearchQuery)) {
        return currentRows;
      }

      return [
        ...currentRows,
        {
          catalogMatched: false,
          createdAt: new Date().toISOString(),
          createdByUserId: "user-vet-suji",
          diagnosisText,
          diagnosisType: "suspected",
          encounterId: soapNote?.encounterId ?? "session-only-encounter",
          id: `diagnosis-session-free-${normalizedSearchQuery.replace(/\s+/g, "-")}`,
          isPrimary: currentRows.length === 0,
          systemLabel: getDiagnosisSystemLabel({
            createdAt: "",
            createdByUserId: "",
            diagnosisText,
            diagnosisType: "suspected",
            encounterId: "",
            id: "",
          }),
        },
      ];
    });
    setSearchQuery("");
    setSearchOpen(false);
  };

  const toggleConfirmedDiagnosis = (diagnosisId: string) => {
    setDiagnosisRows((currentRows) =>
      currentRows.map((row) =>
        row.id === diagnosisId
          ? { ...row, diagnosisType: row.diagnosisType === "confirmed" ? "suspected" : "confirmed" }
          : row
      )
    );
  };

  const togglePrimaryDiagnosis = (diagnosisId: string) => {
    setDiagnosisRows((currentRows) =>
      currentRows.map((row) => (row.id === diagnosisId ? { ...row, isPrimary: !row.isPrimary } : row))
    );
  };

  const removeDiagnosis = (diagnosisId: string) => {
    setDiagnosisRows((currentRows) => currentRows.filter((row) => row.id !== diagnosisId));
  };

  return (
    <section
      aria-label="진단명 관리"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]"
    >
      <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4 py-2">
        <ChartSectionTitle title="진단명" subtitle="진단 목록 · 코멘트 · 계획" />
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
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--clair-color-atomic-gray-500)]"
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
                      className="grid gap-1 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[var(--clair-color-background-surface)] aria-selected:bg-[var(--clair-color-atomic-sky-50)]"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addDiagnosisFromCatalog(item)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className="shrink-0">
                          {item.systemLabel}
                        </Badge>
                        <span className="truncate text-[13px] font-semibold text-[var(--clair-color-label-normal)]">
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
                      className="rounded-md border border-dashed border-[var(--emr-line-hairline)] px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[var(--clair-color-background-surface)]"
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
                className="grid grid-cols-[86px_minmax(0,1fr)_56px_56px_72px] items-center border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 py-3 text-[13px]"
              >
                <Badge variant="outline">{diagnosis.systemLabel}</Badge>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{diagnosis.diagnosisText}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {diagnosis.catalogMatched ? "사전 연결" : "직접 입력"} · {diagnosisTypeLabel[diagnosis.diagnosisType]}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`${diagnosis.diagnosisText} 확진 토글`}
                  aria-pressed={diagnosis.diagnosisType === "confirmed"}
                  className="w-fit rounded-md px-2 py-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-[var(--clair-color-background-surface)] aria-pressed:bg-[var(--clair-color-atomic-sky-50)] aria-pressed:text-[var(--clair-color-primary-normal)]"
                  onClick={() => toggleConfirmedDiagnosis(diagnosis.id)}
                >
                  {diagnosis.diagnosisType === "confirmed" ? "✓" : "-"}
                </button>
                <button
                  type="button"
                  aria-label={`${diagnosis.diagnosisText} 중점 진단 표시`}
                  aria-pressed={diagnosis.isPrimary}
                  className="w-fit rounded-md px-2 py-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-[var(--clair-color-background-surface)] aria-pressed:bg-[var(--clair-color-atomic-sky-50)] aria-pressed:text-[var(--clair-color-primary-normal)]"
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
          <AssessmentTextBox
            key={`assessment-${soapNote?.id ?? "empty"}`}
            label="진단 코멘트"
            value={soapNote?.assessment ?? "평가 메모 없음"}
          />
          <AssessmentTextBox
            key={`plan-${soapNote?.id ?? "empty"}`}
            label="Plan"
            value={soapNote?.plan ?? "계획 기록 대기"}
          />
        </div>
      </div>
    </section>
  );
}

function AssessmentTextBox({ label, value }: { label: string; value: string }) {
  const [textValue, setTextValue] = useState(value);

  return (
    <div className="overflow-hidden rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]">
      <div className="flex h-8 items-center justify-between bg-[var(--emr-surface-muted)] px-3 text-[12px] font-semibold text-muted-foreground">
        <span>{label}</span>
        <span>{textValue.length}/500자</span>
      </div>
      <Textarea
        aria-label={label}
        value={textValue}
        maxLength={500}
        className="min-h-24 resize-y rounded-none border-0 bg-[var(--emr-surface-panel)] p-3 text-[13px] leading-5 shadow-none focus-visible:ring-0"
        onChange={(event) => setTextValue(event.target.value)}
      />
    </div>
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
    <div className="overflow-x-auto rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]">
      <Table className="min-w-[1180px] table-fixed bg-[var(--emr-surface-panel)] text-[13px]">
        <TableHeader className="bg-[var(--emr-surface-muted)]">
          <TableRow className="border-[var(--emr-line-hairline)] hover:bg-transparent">
            <TableHead className="w-10 px-3 text-muted-foreground">
              <Checkbox
                aria-label="오더 전체 선택"
                checked={allVisibleSelected}
                indeterminate={someVisibleSelected}
                disabled={!rows.length}
                onCheckedChange={(checked) => onToggleAll(Boolean(checked))}
              />
            </TableHead>
            <TableHead className="w-[140px] text-[12px] text-muted-foreground">그룹</TableHead>
            <TableHead className="w-[68px] text-[12px] text-muted-foreground">분류</TableHead>
            <TableHead className="w-[72px] text-[12px] text-muted-foreground">상태</TableHead>
            <TableHead className="w-[240px] text-[12px] text-muted-foreground">Order명</TableHead>
            <TableHead className="w-[220px] text-[12px] text-muted-foreground">청구서명</TableHead>
            <TableHead className="w-16 text-[12px] text-muted-foreground">수량</TableHead>
            <TableHead className="w-20 text-[12px] text-muted-foreground">단가</TableHead>
            <TableHead className="w-[88px] text-[12px] text-muted-foreground">청구금액</TableHead>
            <TableHead className="w-20 text-[12px] text-muted-foreground">수의사</TableHead>
            <TableHead className="w-[132px] text-right text-[12px] text-muted-foreground">작업</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const { groupTitle, order } = row;
            const dirty = isChartOrderDraftRowDirty(row);
            const invalidQuantity = invalidOrderIds.has(order.id);
            const lineTotal = getDraftLineTotal(row);

            return (
              <TableRow
                key={order.id}
                data-dirty={dirty ? "true" : undefined}
                className="h-10 border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] hover:bg-[var(--emr-surface-panel)] data-[dirty=true]:bg-[var(--emr-accent-subtle)]/40"
              >
                <TableCell className="px-3">
                  <Checkbox
                    aria-label={`${order.displayName} 선택`}
                    checked={selectedOrderIds.has(order.id)}
                    onCheckedChange={(checked) => onToggleOrder(order.id, Boolean(checked))}
                  />
                </TableCell>
                <TableCell className="truncate text-[12px] font-medium text-muted-foreground">{groupTitle}</TableCell>
                <TableCell><Badge variant="outline">{orderTypeMeta[order.orderType].label}</Badge></TableCell>
                <TableCell><EmrStatusBadge label={orderStatusLabel[order.status]} marker="none" /></TableCell>
                <TableCell className="min-w-0">
                  <div className="truncate font-medium">{order.displayName}</div>
                  <div className="truncate text-[12px] text-muted-foreground">{order.instruction ?? orderTypeMeta[order.orderType].handoff}</div>
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`${order.displayName} 청구서명 수정`}
                    value={row.billingName}
                    className="h-7 bg-[var(--emr-surface-panel)] px-2 text-[12px]"
                    onChange={(event) => onUpdateBillingName(order.id, event.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={`${order.displayName} 수량 수정`}
                    aria-invalid={invalidQuantity}
                    inputMode="decimal"
                    value={row.quantityInput}
                    className={cn(
                      "h-7 bg-[var(--emr-surface-panel)] px-2 text-right text-[12px]",
                      invalidQuantity && "border-[var(--clair-color-atomic-red-400)]"
                    )}
                    onChange={(event) => onUpdateQuantity(order.id, event.target.value)}
                  />
                </TableCell>
                <TableCell>{row.unitPrice !== undefined ? row.unitPrice.toLocaleString() : "-"}</TableCell>
                <TableCell>{lineTotal !== undefined ? lineTotal.toLocaleString() : "-"}</TableCell>
                <TableCell className="truncate">{getChartStaffName(order.requestedByUserId) ?? "미정"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <Button variant="outline" size="xs" className="bg-card">
                      이력
                    </Button>
                    <Button variant="outline" size="xs" className="bg-card">
                      요청
                    </Button>
                    <Button
                      aria-label={`${order.displayName} 오더 삭제`}
                      variant="outline"
                      size="icon-xs"
                      className="bg-card text-[var(--clair-color-atomic-red-700)]"
                      disabled={!hasCommittedRows}
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
              <TableCell colSpan={11} className="h-24 text-center text-[13px] text-muted-foreground">
                표시할 오더가 없습니다.
              </TableCell>
            </TableRow>
          ) : null}
          <TableRow className="h-10 border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] hover:bg-[var(--emr-surface-panel)]">
            <TableCell />
            <TableCell colSpan={10}>
              <Button variant="ghost" size="sm" className="w-fit justify-start">
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

function OrderArea({ bundle, orderGroups }: { bundle: ChartBundle; orderGroups: ChartOrderGroup[] }) {
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const initialDraftRows = useMemo(() => getChartOrderDraftRows(orderGroups), [orderGroups]);
  const [committedRows, setCommittedRows] = useState<ChartOrderDraftRow[]>(initialDraftRows);
  const [draftRows, setDraftRows] = useState<ChartOrderDraftRow[]>(initialDraftRows);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => new Set());
  const [orderActionDialog, setOrderActionDialog] = useState<OrderActionDialogType | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const allOrders = useMemo(() => draftRows.map(({ order }) => order), [draftRows]);
  const orderCountByType = allOrders.reduce<Record<EmrOrderType, number>>(
    (counts, order) => ({
      ...counts,
      [order.orderType]: counts[order.orderType] + 1,
    }),
    { dispensing: 0, imaging: 0, lab: 0, treatment: 0 }
  );
  const filteredOrderRows = draftRows.filter(
    ({ order }) => orderFilter === "all" || order.orderType === orderFilter
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
  const tabItems = [
    { value: "all" as const, label: "전체", count: allOrders.length },
    { value: "dispensing" as const, label: "경구제", count: orderCountByType.dispensing },
    { value: "lab" as const, label: "원내 검사", count: orderCountByType.lab },
    { value: "imaging" as const, label: "영상", count: orderCountByType.imaging },
    { value: "treatment" as const, label: "치료", count: orderCountByType.treatment },
  ];
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
  const commitDraftRows = () => {
    const nextCommittedRows = draftRows.map((row) => ({
      ...row,
      committedBillingName: row.billingName,
      committedQuantityInput: row.quantityInput,
    }));

    setCommittedRows(nextCommittedRows);
    setDraftRows(nextCommittedRows);
  };
  const confirmDeleteOrder = () => {
    if (!deleteOrderId) return;

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

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]">
      <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 bg-[var(--emr-surface-panel)] px-4 py-2">
        <ChartSectionTitle title="처방/오더" subtitle="처방 · 처치 · 검사 · 영상 오더" />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-card">
            Order 출력
          </Button>
          <Button size="sm">+ Order</Button>
        </div>
      </div>
      <div className="flex min-h-8 shrink-0 items-start border-b border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4 pb-2 pt-0">
        <SegmentedControl
          aria-label="차트 오더 필터"
          items={tabItems}
          variant="pill"
          value={orderFilter}
          className="w-fit gap-1.5"
          itemClassName="h-6 min-h-6 rounded-full px-2 text-[12px] font-semibold leading-4"
          onValueChange={setOrderFilter}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--emr-surface-panel)] p-3">
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
      <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-4 gap-y-3 border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] px-4 py-3 text-[13px]">
        <div className="min-w-[240px] flex-1 text-muted-foreground">
          <div>선택 오더 {selectedOrderIds.size}건 · 확정 대상 {actionableSelectedOrderCount}건 · 재확인 필요 {recheckOrderCount}건</div>
          <div className="mt-1 font-semibold text-foreground">청구 예상 총액: {totalAmount.toLocaleString()}</div>
          {hasDraftChanges ? (
            <div className="mt-1 font-medium text-[var(--clair-color-primary-normal)]">
              변경 대기 {changedDraftOrderCount}건
              {invalidOrderIds.size ? ` · 수량 확인 필요 ${invalidOrderIds.size}건` : ""}
            </div>
          ) : null}
        </div>
        <div className="grid min-w-[280px] flex-[1_1_320px] grid-cols-[minmax(0,1fr)_88px] items-center gap-3 text-muted-foreground">
          <div className="text-right">
            <div>선택 오더 합계: {selectedAmount.toLocaleString()}</div>
            <div className="mt-1">Order 별 할인/할증 합계: 0</div>
          </div>
          <Input readOnly value="0%" className="h-9 bg-[var(--emr-surface-panel)] text-right" />
        </div>
        <div className="ml-auto flex shrink-0 justify-end gap-2">
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
            onClick={commitDraftRows}
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
              <span>
                현재 환자와 선택 오더를 확인한 뒤 진행합니다. 이 prototype에서는 실제 청구/확정 상태를 변경하지 않습니다.
              </span>
              <span className="grid gap-1 rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] p-3 text-[13px] text-[var(--clair-color-label-normal)]">
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
          onConfirm={() => setOrderActionDialog(null)}
        />
      </Dialog>
      <Dialog open={deleteOrderId !== null} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
        {deleteTargetOrder ? (
          <EmrConfirmDialogContent
            title="오더를 삭제할까요?"
            description={
              <span className="grid gap-3">
                <span>
                  {deleteTargetOrder.displayName} 오더를 현재 차트의 session draft에서 제외합니다. 실제 서버 데이터는 변경하지 않습니다.
                </span>
                <span className="rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] p-3 text-[13px] text-[var(--clair-color-label-normal)]">
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
        <span data-testid="chart-soap-status" className="text-[13px] font-semibold text-[var(--clair-color-primary-normal)]">
          {getSoapStatusText(latestSoap)}
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
  const chartWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const resizingPointerIdRef = useRef<number | null>(null);
  const bundle = getSelectedBundle(selectedEncounterId);
  const latestSoap = bundle?.soapNotes.at(-1);
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
  const activeEncounterId = bundle?.encounter.id;

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
    [bundle]
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

  if (!bundle) return <EmptyChartState />;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--emr-surface-app)] px-4 py-3">
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
                {bundle.encounter.encounterNo}
              </Badge>
            }
            actions={
              <>
                <Button variant="outline" size="sm" className="bg-card">
                  차트 공유
                </Button>
                <Button size="sm" onClick={() => setChartCompleteDialogOpen(true)}>
                  차트 작성완료
                </Button>
              </>
            }
          />
        }
        orderInfo={<ChartInstructionInfo bundle={bundle} latestSoap={latestSoap} />}
      />
      <Dialog open={chartCompleteDialogOpen} onOpenChange={setChartCompleteDialogOpen}>
        <EmrConfirmDialogContent
          title="차트 작성완료 확인"
          description={
            <span className="grid gap-3">
              <span>
                진료 기록, 진단명, 오더를 같은 환자 차트 기준으로 확인합니다. 이 prototype에서는 실제 차트 상태를 변경하지 않습니다.
              </span>
              <span className="grid gap-1 rounded-[var(--emr-radius-control)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] p-3 text-[13px] text-[var(--clair-color-label-normal)]">
                <span>환자: {bundle.patient.name} · 보호자 {bundle.primaryGuardian?.name ?? "보호자 미지정"}</span>
                <span>차트번호: {bundle.encounter.encounterNo}</span>
                <span>진단명: {diagnosisRows.length}건 · 오더: {allOrders.length}건</span>
                <span>차트 상태: {getSoapStatusText(latestSoap)}</span>
              </span>
            </span>
          }
          cancelLabel="계속 작성"
          confirmLabel="작성완료 확인"
          onCancel={() => setChartCompleteDialogOpen(false)}
          onConfirm={() => setChartCompleteDialogOpen(false)}
        />
      </Dialog>
      <div
        ref={chartWorkspaceRef}
        data-slot="chart-workspace"
        className={cn(
          "mt-4 grid min-h-0 flex-1 border-t border-[var(--emr-line-hairline)] pt-4",
          isChartResizing && "select-none"
        )}
        style={{
          gridTemplateRows: `minmax(${CHART_TOP_MIN_PX}px, ${chartTopPercent}fr) ${CHART_RESIZER_HEIGHT_PX}px minmax(${CHART_ORDER_MIN_PX}px, ${100 - chartTopPercent}fr)`,
        }}
      >
        <div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-4 [&>*]:min-w-0">
          <SoapPanel diagnoses={diagnosisRows} soapNote={latestSoap} />
          <AssessmentPanel
            key={bundle.encounter.id}
            diagnosisRows={diagnosisRows}
            setDiagnosisRows={setDiagnosisRows}
            soapNote={latestSoap}
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
            isChartResizing && "bg-[var(--clair-color-atomic-black-alpha-4)]"
          )}
          onKeyDown={handleChartResizeKeyDown}
          onLostPointerCapture={stopChartResize}
          onPointerCancel={stopChartResize}
          onPointerDown={handleChartResizePointerDown}
          onPointerMove={handleChartResizePointerMove}
          onPointerUp={stopChartResize}
        >
          <span className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-[var(--emr-line-hairline)]" />
          <span className="relative h-1.5 w-10 rounded-full bg-[var(--emr-line-strong)] transition-colors group-hover:bg-[var(--clair-color-atomic-gray-500)]" />
        </button>
        <div className="min-h-0 min-w-0">
          <OrderArea key={bundle.encounter.id} bundle={bundle} orderGroups={orderGroups} />
        </div>
      </div>
    </div>
  );
}

export { ChartRightPanel };
