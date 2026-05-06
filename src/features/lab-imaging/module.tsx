"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CdsActionsListFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsFilesDocumentAltFillIcon,
  CdsFilesFileIcon,
  CdsFilesImageIcon,
} from "@/components/cds-icons/files-and-layout";
import { CdsNavigationChevronsLeftIcon } from "@/components/cds-icons/navigation";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  DownloadIcon,
  PrinterIcon,
} from "@/components/icons";
import {
  EmrInstructionHeaderStack,
  EmrInstructionTitleBar,
} from "@/components/emr/instruction-header-stack";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import {
  EmrDateNavigator,
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrListItem,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import { EmrOrderGroupSection } from "@/components/emr/order-group-section";
import { EmrPatientContextBar } from "@/components/emr/patient-context-bar";
import {
  EMR_SIDE_PANEL_COLLAPSE_EASE,
  EMR_SIDE_PANEL_COLLAPSE_EXIT_EASE,
  EmrSidePanelCollapsibleGroup,
} from "@/components/emr/side-panel-collapsible-group";
import {
  EmrSidePanelCard,
  EmrSidePanelCardAction,
  EmrSidePanelMetaBadge,
  EmrSidePanelTypeBadge,
} from "@/components/emr/side-panel-card";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { LineTabs } from "@/components/ui/line-tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { useLabImagingStore } from "@/features/lab-imaging/store";
import {
  getPatientDisplayAge,
  getPatientSexLabel,
  getSpeciesLabel,
} from "@/features/reception/data";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";
import type {
  EmrAttachment,
  Encounter,
  EquipmentReceipt,
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

const getVisitContext = (encounter: Encounter) => encounter.chiefComplaint ?? encounter.visitPurpose;
const getReceptionTypeLabel = (encounter: Encounter) => encounter.appointmentId ? "예약" : "외래";

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
const LAB_HISTORY_GROUP_EASE = [0.16, 1, 0.3, 1] as const;
const LAB_HISTORY_GROUP_EXIT_EASE = [0.32, 0, 0.67, 0] as const;

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
    markerClassName: "bg-[var(--clair-color-atomic-red-500)] fill-[var(--clair-color-atomic-red-500)]",
  },
  high: {
    label: "초과",
    markerClassName: "bg-[var(--clair-color-atomic-orange-500)] fill-[var(--clair-color-atomic-orange-500)]",
  },
  low: {
    label: "미달",
    markerClassName: "bg-[var(--clair-color-atomic-blue-500)] fill-[var(--clair-color-atomic-blue-500)]",
  },
  normal: {
    label: "정상",
    markerClassName: "bg-[var(--clair-color-atomic-green-500)] fill-[var(--clair-color-atomic-green-500)]",
  },
};

const judgmentBadgeClassName: Record<LabResultRow["judgment"], string> = {
  critical:
    "border-[var(--clair-color-atomic-red-200)] bg-[var(--clair-color-atomic-red-50)] text-[var(--clair-color-atomic-red-700)]",
  high:
    "border-[var(--clair-color-atomic-orange-200)] bg-[var(--clair-color-atomic-orange-50)] text-[var(--clair-color-atomic-orange-700)]",
  low:
    "border-[var(--clair-color-atomic-blue-200)] bg-[var(--clair-color-atomic-blue-50)] text-[var(--clair-color-atomic-blue-700)]",
  normal:
    "border-[var(--clair-color-atomic-green-200)] bg-[var(--clair-color-atomic-green-50)] text-[var(--clair-color-atomic-green-700)]",
  not_judged:
    "border-[var(--clair-color-atomic-gray-200)] bg-[var(--clair-color-atomic-gray-50)] text-[var(--clair-color-atomic-gray-600)]",
};

const labStatusOrder: LabResult["status"][] = ["pending", "received", "entered", "completed", "reviewed"];

const labStatusGroupLabel: Record<LabResult["status"], string> = {
  pending: "검사대기",
  received: "수신",
  entered: "결과입력",
  completed: "완료",
  reviewed: "확인",
};

type LabResultTab = "all" | "cbc" | "chemistry";
type LabQueueView = "order" | "chart";

const labResultTabItems = [
  { value: "all" as const, label: "전체" },
  { value: "cbc" as const, label: "CBC" },
  { value: "chemistry" as const, label: "혈청화학" },
];

const labQueueViewItems = [
  { value: "order" as const, label: "오더별" },
  { value: "chart" as const, label: "차트별" },
];

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
  selectedLabResultId: string
) {
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryLabResultId = searchParams.get("labResultId") ?? scenario?.labResultId;
  const effectiveLabResultId = queryLabResultId ?? selectedLabResultId;

  return {
    detail: getLabDetail(effectiveLabResultId) ?? getLabDetail("lab-result-coco-cbc"),
    queryLabResultId,
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

function QueueActions() {
  return (
    <>
      <EmrListHeaderIconButton ariaLabel="정렬">
        <CdsUtilitiesSortIcon className="size-4" />
      </EmrListHeaderIconButton>
      <EmrListHeaderIconButton ariaLabel="필터">
        <CdsActionsListFilterIcon className="size-4" />
      </EmrListHeaderIconButton>
    </>
  );
}

function LabQueueViewTabs({
  onValueChange,
  value,
}: {
  onValueChange: (value: LabQueueView) => void;
  value: LabQueueView;
}) {
  return (
    <div
      role="tablist"
      aria-label="임상병리검사 목록 보기"
      className="grid grid-cols-2 rounded-md bg-[var(--clair-color-atomic-gray-50)] p-0.5"
    >
      {labQueueViewItems.map((item) => {
        const selected = item.value === value;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "h-7 min-w-12 rounded-[6px] px-2 text-[12px] font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              selected
                ? "bg-card text-[var(--clair-color-atomic-gray-900)] shadow-xs"
                : "text-[var(--clair-color-atomic-gray-500)] hover:text-[var(--clair-color-atomic-gray-900)]"
            )}
            onClick={() => onValueChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
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
      dataTestId={`lab-queue-status-${status}`}
      indicatorClassName="bg-[var(--clair-color-atomic-orange-400)]"
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
  const statusLabel = getStatusLabel("labResult", item.result.status);
  const receptionTypeLabel = getReceptionTypeLabel(item.encounter);

  return (
    <div data-testid={`lab-queue-item-${item.result.id}`}>
      <EmrSidePanelCard
        selected={selected}
        onSelect={onSelect}
        testId={`lab-queue-card-${item.result.id}`}
      >
        <div className="flex min-h-6 items-center gap-1.5 overflow-hidden">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-gray-700)]">
            <span className="truncate">{item.patient.name}</span>
            <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">·</span>
            <span className="truncate">{item.primaryGuardian?.name ?? "보호자 미지정"}</span>
            <EmrSidePanelTypeBadge label={receptionTypeLabel} />
          </div>
          <EmrSidePanelCardAction
            ariaLabel={`${item.patient.name} ${item.result.resultName} 더보기`}
            testId={`lab-queue-item-action-${item.result.id}`}
          />
        </div>
        <div className="mt-0.5 flex h-[18px] min-w-0 items-center gap-1 text-[13px] font-medium leading-[18px] tracking-[0.247px] text-[var(--clair-color-atomic-gray-500)]">
          <span className="min-w-0 flex-1 truncate">{item.order?.displayName ?? item.result.resultName}</span>
        </div>
        <div className="my-1.5 h-px w-full bg-[var(--clair-color-line-subtle)]" />
        <div className="flex h-5 min-w-0 items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            <EmrSidePanelMetaBadge label="요청" value={getStaffName(item.order?.requestedByUserId) ?? "이수지"} />
            {item.technicianName ? <EmrSidePanelMetaBadge label="담당" value={item.technicianName} /> : null}
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-500)]">
            <ClockIcon className="size-3.5 text-[var(--clair-color-atomic-gray-400)]" aria-hidden="true" />
            <span>{formatShortDateTime(item.result.receivedAt ?? item.result.collectedAt).slice(9)}</span>
            <span>{statusLabel}</span>
          </span>
        </div>
      </EmrSidePanelCard>
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
  const latestItem = group.items[0];
  const orderNames = group.items
    .map((item) => item.order?.displayName ?? item.result.resultName)
    .join(", ");
  const abnormalCount = group.items.reduce(
    (total, item) => total + getActionableLabRows(item.result).length,
    0
  );
  const statusSummary = Array.from(
    new Set(group.items.map((item) => getStatusLabel("labResult", item.result.status)))
  ).join("/");

  return (
    <div data-testid={`lab-chart-group-${group.encounter.id}`}>
      <EmrSidePanelCard
        selected={selected}
        onSelect={onSelect}
        testId={`lab-chart-card-${group.encounter.id}`}
      >
        <div className="flex min-h-6 items-center gap-1.5 overflow-hidden">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-gray-700)]">
            <span className="truncate">{group.patient.name}</span>
            <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">·</span>
            <span className="truncate">{group.primaryGuardianName ?? "보호자 미지정"}</span>
            <EmrSidePanelTypeBadge label={`${group.items.length}건`} />
          </div>
          <EmrSidePanelCardAction
            ariaLabel={`${group.patient.name} 임상병리검사 차트 더보기`}
            testId={`lab-chart-item-action-${group.encounter.id}`}
          />
        </div>
        <div className="mt-0.5 flex h-[18px] min-w-0 items-center gap-1 text-[13px] font-medium leading-[18px] tracking-[0.247px] text-[var(--clair-color-atomic-gray-500)]">
          <span className="shrink-0 truncate">{group.encounter.encounterNo}</span>
          <span className="shrink-0 text-[var(--clair-color-atomic-gray-400)]">·</span>
          <span className="min-w-0 flex-1 truncate">{getVisitContext(group.encounter) ?? "내원 사유 미입력"}</span>
        </div>
        <div className="my-1.5 h-px w-full bg-[var(--clair-color-line-subtle)]" />
        <div className="flex min-h-5 min-w-0 items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px] tracking-[0.247px] text-[var(--clair-color-atomic-gray-600)]">
            {orderNames}
          </span>
          {abnormalCount > 0 ? (
            <span className="shrink-0 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-red-500)]">
              비정상 {abnormalCount}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex h-5 min-w-0 items-center justify-between gap-3 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-500)]">
          <span className="truncate">{statusSummary}</span>
          <span className="flex shrink-0 items-center gap-1">
            <ClockIcon className="size-3.5 text-[var(--clair-color-atomic-gray-400)]" aria-hidden="true" />
            {formatShortDateTime(latestItem?.result.receivedAt ?? latestItem?.result.collectedAt).slice(9)}
          </span>
        </div>
      </EmrSidePanelCard>
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
      <EmrListItem
        selected={selected}
        variant="outline"
        title={`${item.patient.name} · ${item.patient.patientNo}`}
        subtitle={`${item.primaryGuardian?.name ?? "보호자 미지정"} · ${item.order?.displayName ?? item.study.modality}`}
        meta={`${item.study.modality} · ${item.study.bodyPart}`}
        itemBadge={<Badge variant="outline">{getStatusLabel("imagingStudy", item.study.status)}</Badge>}
        footer={
          <>
            <span>{formatShortDateTime(item.study.capturedAt ?? item.study.requestedAt)}</span>
            <span>{item.radiologistName ?? "판독 미지정"}</span>
          </>
        }
        onSelect={onSelect}
      />
    </div>
  );
}

export function LabSidePanel() {
  const selectedLabResultId = useLabImagingStore((state) => state.selectedLabResultId);
  const selectLabResult = useLabImagingStore((state) => state.selectLabResult);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const [queueView, setQueueView] = useState<LabQueueView>("order");
  const [collapsedStatusIds, setCollapsedStatusIds] = useState<Set<LabResult["status"]>>(() => new Set());
  const items = useMemo(() => getLabWorkItems(), []);
  const latestLabDate = items[0]?.result.receivedAt ?? items[0]?.result.collectedAt;
  const dateLabel = latestLabDate ? `${latestLabDate.slice(2, 10).replaceAll("-", ".")} (금)` : "-";
  const chartGroups = useMemo(() => getLabChartGroups(items), [items]);
  const groups = useMemo(
    () =>
      labStatusOrder
        .map((status) => ({
          status,
          items: items.filter((item) => item.result.status === status),
        }))
        .filter((group) => group.items.length > 0),
    [items]
  );
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
        tabs={<LabQueueViewTabs value={queueView} onValueChange={setQueueView} />}
      />
      <EmrDateNavigator dateLabel={dateLabel} todayLabel="오늘" />
      <EmrListHeader
        label={queueView === "order" ? "검사 대기열" : "차트별 검사"}
        count={queueView === "order" ? items.length : chartGroups.length}
        headerActions={<QueueActions />}
      />
      <EmrSubpanelBody>
        {queueView === "order"
          ? groups.map((group) => (
              <LabQueueGroup
                key={group.status}
                collapsed={collapsedStatusIds.has(group.status)}
                items={group.items}
                onSelectItem={selectLabResult}
                onToggle={() => toggleStatus(group.status)}
                selectedLabResultId={selectedLabResultId}
                status={group.status}
              />
            ))
          : chartGroups.map((group) => (
              <LabChartQueueItem
                key={group.encounter.id}
                group={group}
                selected={group.items.some((item) => item.result.id === selectedLabResultId)}
                onSelect={() => {
                  const firstResultId = group.items[0]?.result.id;

                  if (firstResultId) {
                    selectLabResult(firstResultId);
                  }
                }}
              />
            ))}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

export function ImagingSidePanel({ moduleLabel }: ShellComponentProps) {
  const selectedImagingStudyId = useLabImagingStore((state) => state.selectedImagingStudyId);
  const selectImagingStudy = useLabImagingStore((state) => state.selectImagingStudy);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const items = useMemo(() => getImagingWorkItems(), []);

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title={moduleLabel}
        collapseLabel="사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
      />
      <EmrListHeader label="영상 대기열" count={items.length} headerActions={<QueueActions />} />
      <EmrSubpanelBody>
        {items.map((item) => (
          <ImagingQueueItem
            key={item.study.id}
            item={item}
            selected={item.study.id === selectedImagingStudyId}
            onSelect={() => selectImagingStudy(item.study.id)}
          />
        ))}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

function PatientHeader({
  encounter,
  patient,
  primaryGuardianName,
  statusLabel,
  title,
}: {
  encounter: Encounter;
  patient: Patient;
  primaryGuardianName?: string;
  statusLabel: string;
  title: string;
}) {
  return (
    <section className="border-b bg-card px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-semibold leading-7">{title}</h1>
            <Badge>{statusLabel}</Badge>
          </div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            {patient.name} · {patient.patientNo} · {getSpeciesLabel(patient)} ·{" "}
            {patient.breed ?? "품종 미상"} · {getPatientDisplayAge(patient)} ·{" "}
            {getPatientSexLabel(patient)}
          </div>
          {getVisitContext(encounter) ? (
            <div className="mt-2 text-[13px] font-medium text-foreground">
              내원 사유: {getVisitContext(encounter)}
            </div>
          ) : null}
        </div>
        <div className="text-right text-[13px] text-muted-foreground">
          <div>{primaryGuardianName ?? "보호자 미지정"}</div>
          <div>{encounter.encounterNo}</div>
        </div>
      </div>
    </section>
  );
}

function ResultFlowPanel({
  children,
  steps,
}: {
  children?: ReactNode;
  steps: Array<[string, string]>;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-[14px] font-semibold">데모 결과 흐름</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          검사/영상 담당자가 결과를 확인한 뒤 진료 판단과 수납 항목으로 이어지는 연결 상태입니다.
        </p>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        {steps.map(([label, value], index) => (
          <div key={label} className="min-w-0">
            <div className="text-[12px] font-medium text-muted-foreground">
              {index + 1}. {label}
            </div>
            <div className="mt-1 text-[13px] font-semibold leading-5">{value}</div>
          </div>
        ))}
      </div>
      {children ? <div className="border-t px-4 py-3">{children}</div> : null}
    </section>
  );
}

function ImagingResultFlowPanel({ detail }: { detail: ImagingDetail }) {
  return (
    <ResultFlowPanel
      steps={[
        [
          "차트 오더",
          `${detail.order?.displayName ?? `${detail.study.modality} ${detail.study.bodyPart}`} · ${getVisitContext(detail.encounter) ?? detail.encounter.encounterNo}`,
        ],
        ["판독 확인", `${detail.study.modality} ${detail.study.bodyPart} · ${getStatusLabel("imagingStudy", detail.study.status)}`],
        ["수의사/수납 연결", "종합소견 확인 후 영상 항목 청구 확인"],
      ]}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-muted-foreground">판독 요약</div>
          <p className="mt-1 text-[13px] leading-5">{detail.study.reading ?? "-"}</p>
        </div>
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-muted-foreground">종합소견</div>
          <p className="mt-1 text-[13px] leading-5">{detail.study.impression ?? "-"}</p>
        </div>
      </div>
    </ResultFlowPanel>
  );
}

function SummaryGrid({ items }: { items: Array<[string, string | undefined]> }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border bg-card p-3">
          <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 truncate text-[14px] font-semibold">{value ?? "-"}</div>
        </div>
      ))}
    </div>
  );
}

function LabResultInputSection({ assigneeName, result }: { assigneeName: string; result: LabResult }) {
  const [collapsed, setCollapsed] = useState(false);
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

  return (
    <EmrOrderGroupSection
      title={`${result.resultName} 세트`}
      count={rows.length}
      meta={
        abnormalRows.length > 0 ? (
          <span className="text-[12px] font-medium text-[var(--clair-color-atomic-red-500)]">
            비정상 {abnormalRows.length}
          </span>
        ) : (
          <span className="text-[12px] font-medium text-[var(--clair-color-label-alternative)]">
            정상 범위
          </span>
        )
      }
      actions={
        <>
          <Button variant="outline" size="xs" className="bg-card">
            판정적용
          </Button>
          <Button size="xs">저장</Button>
        </>
      }
      collapsed={collapsed}
      onToggle={() => setCollapsed((current) => !current)}
    >
      <Table className="table-fixed text-[14px] leading-5 tracking-[0.014em]">
        <colgroup>
          <col className="w-[32%]" />
          <col className="w-[14%]" />
          <col className="w-[8%]" />
          <col className="w-[26%]" />
          <col className="w-[10%]" />
          <col className="w-[10%]" />
        </colgroup>
        <TableHeader className="bg-[var(--clair-color-atomic-neutral-50)]">
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="relative h-10 bg-[var(--clair-color-atomic-neutral-50)] px-1 py-1 text-[14px] font-medium text-[var(--clair-color-label-alternative)]">
              <div className="flex h-6 min-w-0 items-center px-1">항목</div>
            </TableHead>
            <TableHead className="relative h-10 bg-[var(--clair-color-atomic-neutral-50)] px-1 py-1 text-[14px] font-medium text-[var(--clair-color-label-alternative)]">
              <div className="flex h-6 min-w-0 items-center px-1">결과값</div>
            </TableHead>
            <TableHead className="relative h-10 bg-[var(--clair-color-atomic-neutral-50)] px-1 py-1 text-[14px] font-medium text-[var(--clair-color-label-alternative)]">
              <div className="flex h-6 min-w-0 items-center px-1">단위</div>
            </TableHead>
            <TableHead className="relative h-10 bg-[var(--clair-color-atomic-neutral-50)] px-1 py-1 text-[14px] font-medium text-[var(--clair-color-label-alternative)]">
              <div className="flex h-6 min-w-0 items-center justify-center px-1 text-center">정상범위</div>
            </TableHead>
            <TableHead className="relative h-10 bg-[var(--clair-color-atomic-neutral-50)] px-1 py-1 text-[14px] font-medium text-[var(--clair-color-label-alternative)]">
              <div className="flex h-6 min-w-0 items-center px-1">판정</div>
            </TableHead>
            <TableHead className="relative h-10 bg-[var(--clair-color-atomic-neutral-50)] px-1 py-1 text-[14px] font-medium text-[var(--clair-color-label-alternative)]">
              <div className="flex h-6 min-w-0 items-center px-1">담당자</div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              className="h-11 border-border bg-card text-[var(--clair-color-label-normal)] hover:!bg-[var(--clair-color-fill-alternative)]"
            >
              <TableCell className="h-11 px-1 py-2 font-medium whitespace-normal">
                <div className="flex min-h-6 min-w-0 items-center px-1 leading-5">{row.analyteName}</div>
              </TableCell>
              <TableCell className="h-11 px-1 py-2 font-medium">
                <div className="flex h-6 min-w-0 items-center px-1">
                  <Input
                    aria-label={`${row.analyteName} 결과값`}
                    className="h-8 w-24"
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
                  <span className="truncate text-[13px] text-[var(--clair-color-label-normal)]">{assigneeName}</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </EmrOrderGroupSection>
  );
}

function NormalRangeCell({ row }: { row: LabResultRow }) {
  const range = parseReferenceRange(row.referenceRange);
  const scale = getRangeScale(row);
  const rangeState = rangeStateByJudgment[row.judgment] ?? {
    label: "미판정",
    markerClassName: "bg-[var(--clair-color-atomic-gray-500)] fill-[var(--clair-color-atomic-gray-500)]",
  };

  return (
    <div
      className="w-full max-w-[300px]"
      aria-label={`${row.analyteName} 정상범위 ${row.referenceRange ?? "-"} 결과 ${row.value} ${rangeState.label}`}
    >
      {range ? (
        <div className="relative mb-1 h-4 text-[12px] font-medium text-foreground">
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
        <div className="mb-1 h-4 text-[12px] font-medium text-foreground">-</div>
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
          stroke="var(--clair-color-atomic-blue-100)"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <line
          x1={scale.normalStart}
          x2={scale.normalEnd}
          y1="6"
          y2="6"
          stroke="var(--clair-color-atomic-green-100)"
          strokeWidth="3"
        />
        <line
          x1={scale.normalEnd}
          x2={scale.upperEnd}
          y1="6"
          y2="6"
          stroke="var(--clair-color-atomic-orange-100)"
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
          <h2 className="text-[14px] font-semibold">검사결과 종합소견</h2>
          <Badge variant="secondary">담당자 코멘트</Badge>
        </div>
      </div>
      <div className="p-4">
        <Textarea
          aria-label="검사결과 종합소견"
          className="min-h-24 resize-y bg-background text-[13px] leading-5"
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
          <h2 className="text-[14px] font-semibold">첨부자료</h2>
          <Badge variant="secondary">{displayAttachments.length}</Badge>
        </div>
        <Button size="xs" variant="outline" className="bg-card" aria-label="첨부자료 추가">
          <CdsActionsPlusIcon data-icon="inline-start" />
          추가
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 p-4">
        {displayAttachments.map((attachment) => (
          <div key={attachment.id} className="min-w-[220px] overflow-hidden rounded-md border bg-[var(--clair-color-background-surface)]">
            {attachment.previewKind === "image" ? (
              <div className="flex h-24 items-center justify-center bg-[linear-gradient(135deg,var(--clair-color-atomic-sky-50),var(--clair-color-atomic-green-100))]">
                <div className="flex size-12 items-center justify-center rounded-full bg-card/80 text-[var(--clair-color-atomic-blue-600)] shadow-sm">
                  <CdsFilesImageIcon className="size-6" aria-hidden="true" />
                </div>
              </div>
            ) : (
              <div className="flex h-10 items-center px-3 pt-3 text-[var(--clair-color-atomic-gray-500)]">
                <CdsFilesFileIcon className="size-5" aria-hidden="true" />
              </div>
            )}
            <div className="p-3 pt-2">
              <div className="truncate text-[13px] font-medium">{attachment.fileName}</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                {attachment.mimeType} · {formatFileSize(attachment.fileSizeBytes)}
              </div>
            </div>
          </div>
        ))}
        {!displayAttachments.length ? (
          <div className="rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
            첨부자료 없음
          </div>
        ) : null}
      </div>
    </section>
  );
}

function useCurrentLabDetail() {
  const searchParams = useSearchParams();
  const selectedLabResultId = useLabImagingStore((state) => state.selectedLabResultId);

  return getLabDetailFromSearchParams(searchParams, selectedLabResultId);
}

export function LabHeader({ hasRightPanel }: ShellComponentProps) {
  const { detail } = useCurrentLabDetail();
  const contentAsideOpen = useLayoutStore((state) => state.contentAsideOpen);
  const rightPanelOpen = useLayoutStore((state) => state.rightPanelOpen);
  const setContentAsideOpen = useLayoutStore((state) => state.setContentAsideOpen);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);

  if (!detail) return null;

  return (
    <EmrPatientContextBar
      historyButton={{
        controls: "lab-content-aside",
        expanded: contentAsideOpen,
        label: "검사이력",
        onClick: () => setContentAsideOpen(!contentAsideOpen),
      }}
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
        { label: "방문목적" },
        { label: "보호자메모", locked: true },
        { label: "환자메모" },
        { label: "수납메모", disabled: true },
      ]}
      trailingItems={[
        { label: "검사", value: detail.result.resultName },
        { label: "상태", value: getStatusLabel("labResult", detail.result.status) },
      ]}
      onToggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)}
      rightPanelBadgeCount={detail.equipmentReceipts.filter((receipt) => receipt.orderId === detail.order?.id).length}
      rightPanelDisabled={!hasRightPanel}
      rightPanelOpen={rightPanelOpen}
      rightPanelToggleLabel="장비결과내역"
    />
  );
}

export function LabContentAside() {
  const { detail } = useCurrentLabDetail();
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
    <div
      id="lab-content-aside"
      className="flex h-full w-full flex-col gap-2 bg-[var(--clair-color-atomic-neutral-50)] px-4 pt-4"
    >
      <EmrListHeader
        className="mx-0 h-6 border-y-0"
        count={totalHistoryCount}
        label="검사이력"
        leadingAction={
          <EmrListHeaderIconButton ariaLabel="검사이력 패널 접기" iconSize="md" onClick={() => setContentAsideOpen(false)}>
            <CdsNavigationChevronsLeftIcon className="size-4" />
          </EmrListHeaderIconButton>
        }
        headerActions={<QueueActions />}
      />
      <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1">
          {groups.map((group) => {
            const collapsed = collapsedHistoryGroups.has(group.date);

            return (
              <LabHistoryGroup
                key={group.date}
                collapsed={collapsed}
                group={group}
                onToggle={() => toggleHistoryGroup(group.date)}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function LabHistoryGroup({
  collapsed,
  group,
  onToggle,
}: {
  collapsed: boolean;
  group: LabHistoryGroup;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const contentTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.24, ease: LAB_HISTORY_GROUP_EASE },
        opacity: { duration: 0.14, ease: "easeOut" },
        y: { duration: 0.2, ease: LAB_HISTORY_GROUP_EASE },
      };
  const contentExitTransition = reduceMotion
    ? { duration: 0 }
    : {
        height: { duration: 0.18, ease: LAB_HISTORY_GROUP_EXIT_EASE },
        opacity: { duration: 0.12, ease: "easeIn" },
        y: { duration: 0.16, ease: LAB_HISTORY_GROUP_EXIT_EASE },
      };

  return (
    <section className="flex flex-col gap-1 rounded-[10px]" data-testid={`lab-history-group-${group.date}`}>
      <button
        type="button"
        className="flex h-8 w-full items-center justify-between rounded-md px-1 py-1 text-left outline-none transition-colors hover:bg-(--clair-color-atomic-black-alpha-8) focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium leading-[18px] tracking-[0.019em]">
          <span className="truncate text-[var(--clair-color-label-alternative)]">{group.date}</span>
          <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">{group.count}</span>
        </div>
        <motion.span
          className="flex size-4 shrink-0 items-center justify-center text-[var(--clair-color-label-alternative)]"
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: LAB_HISTORY_GROUP_EASE }}
        >
          <ChevronDownIcon className="size-4 shrink-0 text-[var(--clair-color-label-alternative)]" />
        </motion.span>
      </button>
      <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
      <AnimatePresence initial={false}>
        {collapsed ? null : (
          <motion.div
            key={`${group.date}-items`}
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0, transition: contentTransition }}
            exit={{ height: 0, opacity: 0, y: -4, transition: contentExitTransition }}
          >
            {group.items.map((item) => (
              <div key={`${group.date}-${item.title}`} className="border-b border-[var(--clair-color-line-subtle)] py-2">
                <div className="truncate text-[14px] font-medium leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-gray-700)]">
                  {item.title}
                </div>
                <div className="mt-1 truncate text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-500)]">
                  {item.description}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function LabRightPanel() {
  const { detail } = useCurrentLabDetail();
  const [expandedReceiptIds, setExpandedReceiptIds] = useState<Set<string> | null>(null);
  const [receiptToPaste, setReceiptToPaste] = useState<EquipmentReceipt | null>(null);
  const labWorkItems = useMemo(() => getLabWorkItems(), []);
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
  const dateLabel = latestReceiptDate ? `${latestReceiptDate.slice(2, 10).replaceAll("-", ".")} (금)` : "-";
  const defaultExpandedReceiptId = visibleReceipts[0]?.id;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="lab-receipt-panel">
      <div className="flex h-14 items-center px-4">
        <h2 className="min-w-0 truncate text-sm font-semibold">검사결과 수신내역</h2>
      </div>
      <EmrDateNavigator
        className="px-3"
        dateLabel={dateLabel}
        todayLabel="오늘"
      />
      <EmrListHeader
        className="mx-3"
        count={visibleReceipts.length}
        label="검사 결과"
        headerActions={
          <>
            <EmrListHeaderIconButton ariaLabel="수신내역 정렬">
              <CdsUtilitiesSortIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="수신내역 필터">
              <CdsActionsListFilterIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="수신내역 검색">
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
            <section className="rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
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
          "flex w-full items-start gap-3 px-4 text-left outline-none transition-colors hover:bg-[var(--clair-color-atomic-black-alpha-4)] focus-visible:ring-3 focus-visible:ring-ring/50",
          expanded ? "pb-1 pt-3" : "py-3"
        )}
        aria-expanded={expanded}
        aria-label={`${receipt.equipmentName} 수신결과 ${expanded ? "접기" : "펼치기"}`}
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold leading-5 tracking-[0.196px] text-[var(--clair-color-atomic-gray-900)]">
              {receipt.equipmentName}
            </span>
            <span className="shrink-0 rounded border border-[var(--clair-color-atomic-black-alpha-8)] px-1.5 py-0.5 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-700)]">
              {receivedTime} 수신
            </span>
          </div>
          <div className="mt-1 truncate text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-gray-500)]">
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
              <div className="mb-2 h-px w-full bg-[var(--clair-color-line-subtle)]" />
              <div className="flex h-8 items-center justify-between gap-2">
                <h3 className="text-[13px] font-semibold text-[var(--clair-color-atomic-gray-600)]">검사 결과</h3>
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
                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(52px,1fr)_minmax(48px,1fr)] bg-[var(--clair-color-atomic-neutral-50)] px-2 py-2 text-[12px] font-medium text-[var(--clair-color-atomic-gray-700)]">
                    <span>검사 항목명</span>
                    <span>수치</span>
                    <span>단위</span>
                  </div>
                  {previewRows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[minmax(0,2fr)_minmax(52px,1fr)_minmax(48px,1fr)] border-t px-2 py-2 text-[12px] leading-5"
                    >
                      <span className="truncate text-[var(--clair-color-atomic-gray-700)]">{row.analyteName}</span>
                      <span className="text-foreground">{row.value}</span>
                      <span className="truncate text-muted-foreground">{row.unit ?? "-"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 rounded-md border border-dashed p-3 text-[12px] text-muted-foreground">
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

function LabStatusAction({
  onCancelAssignment,
  onComplete,
  onStart,
  status,
}: {
  onCancelAssignment: () => void;
  onComplete: () => void;
  onStart: () => void;
  status: LabAssignmentStatus;
}) {
  if (status === "completed") {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled
        className="border-[var(--clair-color-atomic-sky-100)] bg-card text-[var(--clair-color-primary-normal)]"
      >
        <CheckIcon data-icon="inline-start" />
        검사완료
      </Button>
    );
  }

  if (status === "in_progress") {
    return (
      <div className="inline-flex items-center">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-r-none border-[var(--clair-color-atomic-sky-100)] bg-[var(--clair-color-atomic-sky-50)] text-[var(--clair-color-primary-normal)]"
        >
          검사중
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="검사 상태 액션"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-sm" }),
              "-ml-px rounded-l-none border-[var(--clair-color-atomic-sky-100)] bg-[var(--clair-color-atomic-sky-50)] text-[var(--clair-color-primary-normal)]"
            )}
          >
            <ChevronDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem className="h-8 cursor-pointer" onClick={onComplete}>
              <CheckIcon className="size-3" />
              검사완료
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="h-8 cursor-pointer" onClick={onCancelAssignment}>
              담당취소
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <Button type="button" size="sm" onClick={onStart}>
      담당하기
      <ChevronDownIcon data-icon="inline-end" />
    </Button>
  );
}

export function LabContent() {
  const searchParams = useSearchParams();
  const selectedLabResultId = useLabImagingStore((state) => state.selectedLabResultId);
  const selectLabResult = useLabImagingStore((state) => state.selectLabResult);
  const { detail, queryLabResultId } = getLabDetailFromSearchParams(searchParams, selectedLabResultId);
  const [resultTab, setResultTab] = useState<LabResultTab>("all");
  const initialAssignment = {
    assigneeName: detail?.technicianName ?? "미지정",
    resultId: detail?.result.id ?? "",
    status: "requested" as LabAssignmentStatus,
  };
  const [assignmentState, setAssignmentState] = useState(initialAssignment);
  const assignment = assignmentState.resultId === initialAssignment.resultId ? assignmentState : initialAssignment;
  const startAssignment = () =>
    setAssignmentState({
      assigneeName: currentLabAssignee.name,
      resultId: initialAssignment.resultId,
      status: "in_progress",
    });
  const completeAssignment = () =>
    setAssignmentState((current) => ({
      assigneeName:
        current.resultId === initialAssignment.resultId ? current.assigneeName : currentLabAssignee.name,
      resultId: initialAssignment.resultId,
      status: "completed",
    }));
  const cancelAssignment = () =>
    setAssignmentState({
      assigneeName: "미지정",
      resultId: initialAssignment.resultId,
      status: "requested",
    });

  useEffect(() => {
    if (queryLabResultId && queryLabResultId !== selectedLabResultId) {
      selectLabResult(queryLabResultId);
    }
  }, [queryLabResultId, selectLabResult, selectedLabResultId]);

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        검사 대기열에서 항목을 선택해 주세요.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-3">
      <EmrInstructionHeaderStack
        titleBar={
          <EmrInstructionTitleBar
            title="임상병리 검사결과지"
            icon={
              <CdsFilesDocumentAltFillIcon
                className="size-5 shrink-0 text-[var(--clair-color-atomic-gray-300)]"
                aria-hidden="true"
              />
            }
            badge={
              <Badge variant="secondary" className="h-5 rounded-md px-2 text-[11px] text-muted-foreground">
                {getLabResultDocumentId(detail.result)}
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
                <LabStatusAction
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
                  <span>{formatShortDateTime(detail.result.collectedAt)}</span>
                  <EmrStatusBadge
                    label={getStatusLabel("labResult", detail.result.status)}
                    marker="none"
                    testId="lab-result-status-label"
                  />
                </span>,
              ],
              [
                "환자 정보",
                `${detail.patient.name}(${getPatientDisplayAge(detail.patient)}) · ${detail.patient.breed ?? getSpeciesLabel(detail.patient)}`,
              ],
              ["요청 수의사", getStaffName(detail.order?.requestedByUserId) ?? "이수지"],
              ["검사 담당", <span key="lab-assignee" aria-live="polite">{assignment.assigneeName}</span>],
              [
                "수신 장비",
                detail.equipmentReceipts.find((receipt) => receipt.status === "matched")?.equipmentName ?? "미수신",
              ],
            ].map(([label, value]) => (
              <div key={label as string} className="min-w-0 border-r border-border px-3 last:border-r-0">
                <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
                <div className="mt-1 flex min-h-6 min-w-0 items-center text-[13px] font-medium text-foreground">{value}</div>
              </div>
            ))}
          </div>
        }
        filters={
          <LineTabs
            aria-label="검사 결과 필터"
            className="w-full border-b border-[var(--clair-color-line-normal)]"
            value={resultTab}
            items={labResultTabItems.map((item) => ({
              ...item,
              count: item.value === "all" ? detail.result.rows.length : item.value === "cbc" ? detail.result.rows.length : 0,
              disabled: item.value === "chemistry",
            }))}
            onValueChange={setResultTab}
          />
        }
      />

      <ScrollArea data-slot="lab-result-scroll-area" className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 pb-10 pt-4">
          <LabResultInputSection assigneeName={assignment.assigneeName} result={detail.result} />
          <LabResultCommentSection result={detail.result} />
          <AttachmentStrip attachments={detail.attachments} showImageExample />
        </div>
      </ScrollArea>
    </div>
  );
}

function ImagingReadingPanel({ study }: { study: ImagingStudy }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex h-11 items-center justify-between border-b px-4">
        <h2 className="text-[14px] font-semibold">영상 판독</h2>
        <Button size="sm" variant="outline">판독 저장</Button>
      </div>
      <div className="grid gap-4 p-4">
        <div>
          <div className="text-[12px] font-medium text-muted-foreground">판독 내용</div>
          <textarea
            aria-label="영상 판독 내용"
            className="mt-2 min-h-24 w-full rounded-md border bg-background p-3 text-[13px] leading-5 outline-none focus:ring-3 focus:ring-ring/50"
            defaultValue={study.reading}
          />
        </div>
        <Separator />
        <div>
          <div className="text-[12px] font-medium text-muted-foreground">종합소견</div>
          <textarea
            aria-label="영상 종합소견"
            className="mt-2 min-h-20 w-full rounded-md border bg-background p-3 text-[13px] leading-5 outline-none focus:ring-3 focus:ring-ring/50"
            defaultValue={study.impression}
          />
        </div>
      </div>
    </section>
  );
}

export function ImagingContent() {
  const searchParams = useSearchParams();
  const selectedImagingStudyId = useLabImagingStore((state) => state.selectedImagingStudyId);
  const selectImagingStudy = useLabImagingStore((state) => state.selectImagingStudy);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryImagingStudyId = searchParams.get("imagingStudyId") ?? scenario?.imagingStudyId;
  const effectiveImagingStudyId = queryImagingStudyId ?? selectedImagingStudyId;
  const detail = getImagingDetail(effectiveImagingStudyId) ?? getImagingDetail("imaging-coco-thorax");

  useEffect(() => {
    if (queryImagingStudyId && queryImagingStudyId !== selectedImagingStudyId) {
      selectImagingStudy(queryImagingStudyId);
    }
  }, [queryImagingStudyId, selectImagingStudy, selectedImagingStudyId]);

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        영상 대기열에서 항목을 선택해 주세요.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--clair-color-background-normal)]">
      <PatientHeader
        encounter={detail.encounter}
        patient={detail.patient}
        primaryGuardianName={detail.primaryGuardian?.name}
        statusLabel={getStatusLabel("imagingStudy", detail.study.status)}
        title="영상검사"
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 p-5">
          <SummaryGrid
            items={[
              ["검사", detail.order?.displayName],
              ["촬영 부위", detail.study.bodyPart],
              ["촬영", formatShortDateTime(detail.study.capturedAt)],
              ["판독", detail.radiologistName ?? "판독 미지정"],
            ]}
          />
          <ImagingResultFlowPanel detail={detail} />
          <ImagingReadingPanel study={detail.study} />
          <AttachmentStrip attachments={detail.attachments} />
        </div>
      </ScrollArea>
    </div>
  );
}
