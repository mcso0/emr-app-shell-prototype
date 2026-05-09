"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import {
  CdsActionsListFilterIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsContentBoldIcon,
  CdsContentItalicIcon,
  CdsContentLink2Icon,
} from "@/components/cds-icons/content-and-editor";
import { CdsFilesDocumentAltFillIcon } from "@/components/cds-icons/files-and-layout";
import { CdsNavigationChevronsLeftIcon } from "@/components/cds-icons/navigation";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrInstructionHeaderStack, EmrInstructionTitleBar } from "@/components/emr/instruction-header-stack";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrListItem,
} from "@/components/emr/subpanel";
import { EmrOrderQueueSidePanel } from "@/components/emr/order-queue-side-panel";
import { EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LineTabs } from "@/components/ui/line-tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
const CHART_RESIZER_HEIGHT_PX = 18;
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
  if (!status) return "작성중";
  const statusLabel =
    status === "autosaved"
      ? "자동저장됨"
      : status === "draft"
        ? "초안 작성중"
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
      title="진료(차트)"
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
  const { contentAsideOpen, rightPanelOpen, setContentAsideOpen, setRightPanelOpen } = useLayoutStore();
  const bundle = getSelectedBundle(selectedEncounterId);

  if (!bundle) return null;

  const veterinarianName = getChartStaffName(bundle.encounter.primaryVeterinarianId) ?? "담당 미정";

  return (
    <EmrPatientContextBar
      historyButton={{
        controls: "chart-content-aside",
        expanded: contentAsideOpen,
        label: "차트이력",
        onClick: () => setContentAsideOpen(!contentAsideOpen),
      }}
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
      rightPanelToggleLabel="진단 이력"
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

  return (
    <div
      id="chart-content-aside"
      className="flex h-full w-full flex-col gap-2 bg-[var(--clair-color-atomic-neutral-50)] px-4 pt-4"
    >
      <EmrListHeader
        className="mx-0 h-6 border-y-0"
        count={historyRows.length}
        label="차트이력"
        leadingAction={
          <EmrListHeaderIconButton ariaLabel="차트 이력 패널 접기" iconSize="md" onClick={() => setContentAsideOpen(false)}>
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
      <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 pb-3">
          {historyGroups.map((group) => (
            <section key={group.date} className="flex flex-col gap-1 rounded-[10px]">
              <button
                type="button"
                className="flex h-8 w-full items-center justify-between rounded-md px-1 py-1 text-left outline-none transition-colors hover:bg-[var(--clair-color-atomic-black-alpha-8)] focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-expanded="true"
              >
                <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium leading-[18px] tracking-[0.019em]">
                  <span className="truncate text-[var(--clair-color-label-alternative)]">{group.date}</span>
                  <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">{group.rows.length}</span>
                </div>
              </button>
              <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
              {group.rows.map((row) => (
                <ChartHistoryItem
                  key={row.encounter.id}
                  row={row}
                  selected={row.encounter.id === selectedEncounterId}
                  onSelect={() => selectEncounter(row.encounter.id)}
                />
              ))}
            </section>
          ))}
        </div>
      </ScrollArea>
      <div className="flex shrink-0 gap-2 border-t bg-[var(--clair-color-atomic-neutral-50)] py-3">
        <Button variant="outline" size="sm" className="bg-card">
          수술 차트
        </Button>
        <Button size="sm">외래 차트 추가</Button>
      </div>
    </div>
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
    <>
      <EmrListItem
        selected={selected}
        testId={`chart-history-item-${row.encounter.id}`}
        title={primaryDiagnosis ?? row.encounter.encounterNo}
        itemBadge={
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
      <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
    </>
  );
}

const soapTemplateRows = [
  { label: "주관적", valueKey: "subjective" },
  { label: "객관적", valueKey: "objective" },
  { label: "평가", valueKey: "assessment" },
  { label: "계획", valueKey: "plan" },
] as const;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function ChartSectionTitle({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <h2 className="flex min-w-0 items-baseline gap-2.5">
      <span className="shrink-0 text-[16px] font-semibold text-foreground">{title}</span>
      <span className="min-w-0 truncate text-[13px] font-medium text-[var(--clair-color-atomic-gray-400)]">{subtitle}</span>
    </h2>
  );
}

function buildSoapEditorContent(soapNote?: SoapNote) {
  return soapTemplateRows
    .map(({ label, valueKey }) => {
      const value = soapNote?.[valueKey] ?? "여기에 입력하세요.";

      return `<p><strong>${label}</strong><br />: ${escapeHtml(value)}</p>`;
    })
    .join("");
}

function SoapPanel({ diagnoses, soapNote }: { diagnoses: Diagnosis[]; soapNote?: SoapNote }) {
  const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [extraSections, setExtraSections] = useState<Array<{ id: string; title: string }>>([]);
  const diagnosisSystemSections = useMemo(() => {
    const labels = diagnoses.map(getDiagnosisSystemLabel);
    const uniqueLabels = Array.from(new Set(labels));

    return uniqueLabels.length ? uniqueLabels : ["기본"];
  }, [diagnoses]);
  const soapSections = [
    ...diagnosisSystemSections.map((title, index) => ({
      id: `diagnosis-${title}`,
      initialContent: buildSoapEditorContent(index === 0 ? soapNote : undefined),
      status: soapNote?.status,
      statusAt: soapNote?.signedAt ?? soapNote?.updatedAt,
      title: `${title} SOAP`,
    })),
    ...extraSections.map((section) => ({
      id: section.id,
      initialContent: buildSoapEditorContent(),
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
  const addAttachmentToActiveSection = () => {
    const sectionId = activeSectionId ?? soapSections[0]?.id;

    if (!sectionId) return;

    setAttachmentCounts((current) => ({
      ...current,
      [sectionId]: (current[sectionId] ?? 0) + 1,
    }));
  };
  const setLink = () => {
    if (!activeEditor) return;

    const previousUrl = activeEditor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL을 입력하세요.", previousUrl ?? "https://");

    if (url === null) return;
    if (!url) {
      activeEditor.chain().focus().unsetLink().run();
      return;
    }

    activeEditor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="relative z-10 flex min-h-12 shrink-0 items-center justify-between gap-3 border-b bg-card px-4 py-2">
        <ChartSectionTitle title="진료 기록" subtitle="진단계통별 SOAP 작성" />
        <div className="flex items-center gap-1.5">
          <EditorToolbarButton
            active={activeEditor?.isActive("bold") ?? false}
            disabled={!activeEditor}
            label="굵게"
            onClick={() => activeEditor?.chain().focus().toggleBold().run()}
          >
            <CdsContentBoldIcon className="size-4" />
          </EditorToolbarButton>
          <EditorToolbarButton
            active={activeEditor?.isActive("italic") ?? false}
            disabled={!activeEditor}
            label="기울임"
            onClick={() => activeEditor?.chain().focus().toggleItalic().run()}
          >
            <CdsContentItalicIcon className="size-4" />
          </EditorToolbarButton>
          <EditorToolbarButton
            active={activeEditor?.isActive("underline") ?? false}
            disabled={!activeEditor}
            label="밑줄"
            onClick={() => activeEditor?.chain().focus().toggleUnderline().run()}
          >
            U
          </EditorToolbarButton>
          <EditorToolbarButton
            active={activeEditor?.isActive("link") ?? false}
            disabled={!activeEditor}
            label="링크"
            onClick={setLink}
          >
            <CdsContentLink2Icon className="size-4" />
          </EditorToolbarButton>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="bg-card"
            onClick={addAttachmentToActiveSection}
          >
            첨부
          </Button>
          <Button type="button" variant="outline" size="sm" className="bg-card" onClick={addSoapSection}>
            SOAP 추가
          </Button>
          <Button size="sm">초안 저장</Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-3">
          {soapSections.map((section) => (
            <div key={section.id} className="overflow-hidden rounded-md border bg-card">
              <div className="relative z-10 flex min-h-9 items-center justify-between gap-2 border-b bg-[var(--clair-color-background-surface)] px-3">
                <span className="text-[13px] font-semibold">{section.title}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-medium text-[var(--clair-color-atomic-gray-400)]">
                    {getSoapSectionStatusText(section.status, section.statusAt)}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    aria-label={`${section.title} 첨부 추가`}
                    className="bg-card"
                    onClick={() =>
                      setAttachmentCounts((current) => ({
                        ...current,
                        [section.id]: (current[section.id] ?? 0) + 1,
                      }))
                    }
                  >
                    첨부
                  </Button>
                </div>
              </div>
              <SoapRichTextEditor
                key={`${soapNote?.id ?? "empty"}-${section.id}`}
                initialContent={section.initialContent}
                label={section.title}
                onFocusEditor={(editor) => {
                  setActiveSectionId(section.id);
                  setActiveEditor(editor);
                }}
              />
              <div className="flex min-h-9 items-center justify-between border-t px-3 text-[12px] text-muted-foreground">
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
      className={cn("bg-card aria-pressed:border-ring aria-pressed:bg-background", active && "ring-2 ring-ring/30")}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function SoapRichTextEditor({
  initialContent,
  label,
  onFocusEditor,
}: {
  initialContent: string;
  label: string;
  onFocusEditor: (editor: Editor) => void;
}) {
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
        placeholder: "주관적\n: 여기에 입력하세요.\n객관적\n: 여기에 입력하세요.\n평가\n: 여기에 입력하세요.\n계획\n: 여기에 입력하세요.",
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        "aria-label": `${label} 기록`,
        class:
          "min-h-36 px-3 py-2 text-[13px] leading-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_p]:my-1.5 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:whitespace-pre-line [&_p.is-editor-empty:first-child::before]:text-[var(--clair-color-label-assistive)]",
      },
    },
    immediatelyRender: false,
    onFocus: ({ editor: focusedEditor }) => onFocusEditor(focusedEditor),
  });

  return (
    <EditorContent editor={editor} />
  );
}

function AssessmentPanel({
  diagnoses,
  soapNote,
}: {
  diagnoses: Diagnosis[];
  soapNote?: SoapNote;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b px-4 py-2">
        <ChartSectionTitle title="진단명" subtitle="진단 목록 · 코멘트 · 계획" />
        <Button variant="outline" size="sm" className="bg-card">
          분류검색
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-2">
            <Input
              readOnly
              value="한글, 영문, 약자, 연관검색어로 진단명 검색"
              className="h-9 bg-card text-[13px]"
            />
            <Button variant="outline" size="sm" className="h-9 bg-card px-0">
              검색
            </Button>
          </div>
          <div className="overflow-hidden rounded-md border">
            <div className="grid grid-cols-[86px_minmax(0,1fr)_56px_56px_72px] bg-[var(--clair-color-background-surface)] px-3 py-2 text-[12px] font-semibold text-muted-foreground">
              <span>계통분류</span>
              <span>진단명</span>
              <span>확진</span>
              <span>중점</span>
              <span>수의사</span>
            </div>
            {diagnoses.map((diagnosis) => (
              <div
                key={diagnosis.id}
                className="grid grid-cols-[86px_minmax(0,1fr)_56px_56px_72px] items-center border-t px-3 py-3 text-[13px]"
              >
                <Badge variant="outline">{getDiagnosisSystemLabel(diagnosis)}</Badge>
                <span className="truncate font-medium">{diagnosis.diagnosisText}</span>
                <span>{diagnosis.diagnosisType === "confirmed" ? "✓" : "-"}</span>
                <span>{diagnosis.diagnosisType === "suspected" ? "-" : "✓"}</span>
                <span className="truncate">{getChartStaffName(diagnosis.createdByUserId) ?? "미정"}</span>
              </div>
            ))}
            {!diagnoses.length ? (
              <div className="border-t px-3 py-6 text-center text-[13px] text-muted-foreground">
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
    <div className="overflow-hidden rounded-md border">
      <div className="flex h-8 items-center justify-between bg-[var(--clair-color-background-surface)] px-3 text-[12px] font-semibold text-muted-foreground">
        <span>{label}</span>
        <span>{textValue.length}/500자</span>
      </div>
      <Textarea
        aria-label={label}
        value={textValue}
        maxLength={500}
        className="min-h-24 resize-y rounded-none border-0 bg-card p-3 text-[13px] leading-5 shadow-none focus-visible:ring-0"
        onChange={(event) => setTextValue(event.target.value)}
      />
    </div>
  );
}

function AssessmentHistory({ historyRows }: { historyRows: ChartHistoryRow[] }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold">진단 이력</h2>
        <Badge variant="outline">{historyRows.length}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {historyRows.map((row) => (
          <div key={row.encounter.id} className="rounded-md border bg-[var(--clair-color-background-surface)] p-3">
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
  const bundle = getSelectedBundle(selectedEncounterId);
  const historyRows = useMemo(
    () => (bundle ? getChartHistoryRows(bundle.patient.id) : []),
    [bundle]
  );

  if (!bundle) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 flex-col justify-center border-b px-3">
        <div className="text-sm font-semibold">환자 사이드 패널</div>
        <div className="text-[11px] text-muted-foreground">환자 컨텍스트와 진단 이력</div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          <AssessmentHistory historyRows={historyRows} />
          <section className="rounded-md border bg-card p-3">
            <div className="font-semibold">보호자 메모</div>
            <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
              {bundle.primaryGuardian?.memo ?? "물 섭취 후 재구토, 검사 비용 설명을 먼저 요청."}
            </p>
          </section>
          <section className="rounded-md border bg-card p-3">
            <div className="font-semibold">환자 메모</div>
            <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
              {bundle.patient.specialNote ?? "진료대에서 긴장도가 높아 보호자 동석 권장."}
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

function ChartOrderTable({
  allVisibleSelected,
  onToggleAll,
  onToggleOrder,
  rows,
  selectedOrderIds,
  someVisibleSelected,
}: {
  allVisibleSelected: boolean;
  onToggleAll: (checked: boolean) => void;
  onToggleOrder: (orderId: string, checked: boolean) => void;
  rows: ChartOrderTableRow[];
  selectedOrderIds: Set<string>;
  someVisibleSelected: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-md border bg-[var(--clair-color-atomic-common-100)]">
      <div className="min-w-[1080px]">
        <div className="grid grid-cols-[32px_minmax(120px,0.8fr)_68px_72px_minmax(200px,1.4fr)_minmax(180px,1fr)_64px_80px_88px_80px_116px] bg-[var(--clair-color-atomic-gray-50)] px-3 py-2 text-[12px] font-semibold text-muted-foreground">
          <Checkbox
            aria-label="오더 전체 선택"
            checked={allVisibleSelected}
            indeterminate={someVisibleSelected}
            onCheckedChange={(checked) => onToggleAll(Boolean(checked))}
          />
          <span>그룹</span>
          <span>분류</span>
          <span>상태</span>
          <span>Order명</span>
          <span>청구서명</span>
          <span>수량</span>
          <span>단가</span>
          <span>청구금액</span>
          <span>수의사</span>
          <span className="text-right">작업</span>
        </div>
        {rows.map(({ groupTitle, order }) => {
          const invoiceLine = getChartInvoiceLineByOrderId(order.id);

          return (
            <div
              key={order.id}
              className="grid min-h-10 grid-cols-[32px_minmax(120px,0.8fr)_68px_72px_minmax(200px,1.4fr)_minmax(180px,1fr)_64px_80px_88px_80px_116px] items-center border-t bg-[var(--clair-color-atomic-common-100)] px-3 py-1.5 text-[13px]"
            >
              <Checkbox
                aria-label={`${order.displayName} 선택`}
                checked={selectedOrderIds.has(order.id)}
                onCheckedChange={(checked) => onToggleOrder(order.id, Boolean(checked))}
              />
              <span className="truncate text-[12px] font-medium text-muted-foreground">{groupTitle}</span>
              <Badge variant="outline">{orderTypeMeta[order.orderType].label}</Badge>
              <EmrStatusBadge label={orderStatusLabel[order.status]} marker="none" />
              <div className="min-w-0">
                <div className="truncate font-medium">{order.displayName}</div>
                <div className="truncate text-[12px] text-muted-foreground">{order.instruction ?? orderTypeMeta[order.orderType].handoff}</div>
              </div>
              <span className="truncate">{invoiceLine?.description ?? order.displayName}</span>
              <span>{invoiceLine?.quantity ?? 1}</span>
              <span>{invoiceLine ? invoiceLine.unitPrice.toLocaleString() : "-"}</span>
              <span>{invoiceLine ? invoiceLine.lineTotal.toLocaleString() : "-"}</span>
              <span className="truncate">{getChartStaffName(order.requestedByUserId) ?? "미정"}</span>
              <div className="flex justify-end gap-1.5">
                <Button variant="outline" size="xs" className="bg-card">
                  이력
                </Button>
                <Button variant="outline" size="xs" className="bg-card">
                  요청
                </Button>
              </div>
            </div>
          );
        })}
        {!rows.length ? (
          <div className="border-t bg-[var(--clair-color-atomic-common-100)] px-3 py-8 text-center text-[13px] text-muted-foreground">
            표시할 오더가 없습니다.
          </div>
        ) : null}
        <div className="grid min-h-10 grid-cols-[32px_minmax(120px,0.8fr)_68px_72px_minmax(200px,1.4fr)_minmax(180px,1fr)_64px_80px_88px_80px_116px] items-center border-t bg-[var(--clair-color-atomic-common-100)] px-3 py-1.5">
          <span aria-hidden="true" />
          <Button variant="ghost" size="sm" className="col-span-10 w-fit justify-start">
            + Order 추가하기
          </Button>
        </div>
      </div>
    </div>
  );
}

type OrderActionDialogType = "bill" | "confirm";

function OrderArea({ bundle, orderGroups }: { bundle: ChartBundle; orderGroups: ChartOrderGroup[] }) {
  const [orderFilter, setOrderFilter] = useState<OrderFilter>("all");
  const allOrders = useMemo(() => orderGroups.flatMap(({ orders }) => orders), [orderGroups]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => new Set());
  const [orderActionDialog, setOrderActionDialog] = useState<OrderActionDialogType | null>(null);
  const orderCountByType = allOrders.reduce<Record<EmrOrderType, number>>(
    (counts, order) => ({
      ...counts,
      [order.orderType]: counts[order.orderType] + 1,
    }),
    { dispensing: 0, imaging: 0, lab: 0, treatment: 0 }
  );
  const filteredOrderRows = orderGroups.flatMap(({ group, orders }) =>
    orders
      .filter((order) => orderFilter === "all" || order.orderType === orderFilter)
      .map((order) => ({
        groupTitle: group?.title ?? "개별 오더",
        order,
      }))
  );
  const totalAmount = allOrders.reduce((sum, order) => {
    const line = getChartInvoiceLineByOrderId(order.id);

    return sum + (line?.lineTotal ?? 0);
  }, 0);
  const selectedAmount = allOrders.reduce((sum, order) => {
    if (!selectedOrderIds.has(order.id)) return sum;

    const line = getChartInvoiceLineByOrderId(order.id);

    return sum + (line?.lineTotal ?? 0);
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
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex min-h-12 shrink-0 items-center justify-between gap-3 px-4 py-2">
        <ChartSectionTitle title="처방/오더" subtitle="처방 · 처치 · 검사 · 영상 오더" />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-card">
            Order 출력
          </Button>
          <Button size="sm">+ Order</Button>
        </div>
      </div>
      <div className="shrink-0 px-4 pt-3">
        <LineTabs
          aria-label="차트 오더 필터"
          className="w-full"
          items={tabItems}
          size="default"
          value={orderFilter}
          onValueChange={setOrderFilter}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--clair-color-atomic-gray-50)] p-4">
        <ChartOrderTable
          allVisibleSelected={allVisibleSelected}
          onToggleAll={toggleAllVisibleOrders}
          onToggleOrder={toggleOrder}
          rows={filteredOrderRows}
          selectedOrderIds={selectedOrderIds}
          someVisibleSelected={someVisibleSelected}
        />
      </div>
      <div className="grid min-h-16 shrink-0 grid-cols-[minmax(220px,1fr)_minmax(360px,1.5fr)_auto] items-center gap-4 border-t border-[var(--clair-color-line-normal)] bg-card px-4 py-3 text-[13px] shadow-[0_-2px_8px_rgba(15,23,42,0.04)]">
        <div className="text-muted-foreground">
          <div>선택 오더 {selectedOrderIds.size}건 · 확정 대상 {actionableSelectedOrderCount}건 · 재확인 필요 {recheckOrderCount}건</div>
          <div className="mt-1 font-semibold text-foreground">청구 예상 총액: {totalAmount.toLocaleString()}</div>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_88px] items-center gap-3 text-muted-foreground">
          <div className="text-right">
            <div>선택 오더 합계: {selectedAmount.toLocaleString()}</div>
            <div className="mt-1">Order 별 할인/할증 합계: 0</div>
          </div>
          <Input readOnly value="0%" className="h-9 bg-[var(--clair-color-atomic-gray-50)] text-right" />
        </div>
        <div className="flex justify-end gap-2">
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
              <span className="grid gap-1 rounded-md border bg-[var(--clair-color-atomic-gray-50)] p-3 text-[13px] text-[var(--clair-color-label-normal)]">
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
    <div className="grid grid-cols-4 rounded-lg border border-border bg-card px-4 py-3">
      {infoItems.map(({ label, value }) => (
        <div key={label} className="border-r border-border px-3 last:border-r-0">
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
  const chartWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const resizingPointerIdRef = useRef<number | null>(null);
  const bundle = getSelectedBundle(selectedEncounterId);
  const latestSoap = bundle?.soapNotes.at(-1);
  const [chartTopPercent, setChartTopPercent] = useState(CHART_TOP_DEFAULT_PERCENT);
  const [isChartResizing, setIsChartResizing] = useState(false);
  const [chartCompleteDialogOpen, setChartCompleteDialogOpen] = useState(false);
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
    <div className="flex h-full min-h-0 flex-col bg-[var(--clair-color-background-normal)] px-4 py-3">
      <EmrInstructionHeaderStack
        titleBar={
          <EmrInstructionTitleBar
            title="진료 차트"
            icon={
              <CdsFilesDocumentAltFillIcon
                className="size-5 shrink-0 text-[var(--clair-color-atomic-gray-300)]"
                aria-hidden="true"
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
              <span className="grid gap-1 rounded-md border bg-[var(--clair-color-atomic-gray-50)] p-3 text-[13px] text-[var(--clair-color-label-normal)]">
                <span>환자: {bundle.patient.name} · 보호자 {bundle.primaryGuardian?.name ?? "보호자 미지정"}</span>
                <span>차트번호: {bundle.encounter.encounterNo}</span>
                <span>진단명: {bundle.diagnoses.length}건 · 오더: {allOrders.length}건</span>
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
          "mt-4 grid min-h-0 flex-1 border-t border-[var(--clair-color-line-normal)] pt-4",
          isChartResizing && "select-none"
        )}
        style={{
          gridTemplateRows: `minmax(${CHART_TOP_MIN_PX}px, ${chartTopPercent}fr) ${CHART_RESIZER_HEIGHT_PX}px minmax(${CHART_ORDER_MIN_PX}px, ${100 - chartTopPercent}fr)`,
        }}
      >
        <div className="grid min-h-0 grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-4">
          <SoapPanel diagnoses={bundle.diagnoses} soapNote={latestSoap} />
          <AssessmentPanel diagnoses={bundle.diagnoses} soapNote={latestSoap} />
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
          <span className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-[var(--clair-color-line-normal)]" />
          <span className="relative h-1.5 w-10 rounded-full bg-[var(--clair-color-atomic-gray-300)] transition-colors group-hover:bg-[var(--clair-color-atomic-gray-500)]" />
        </button>
        <div className="min-h-0">
          <OrderArea key={bundle.encounter.id} bundle={bundle} orderGroups={orderGroups} />
        </div>
      </div>
    </div>
  );
}

export { ChartRightPanel };
