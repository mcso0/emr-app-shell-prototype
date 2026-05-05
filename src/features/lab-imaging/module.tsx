"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CdsActionsListFilterIcon,
  CdsActionsPlusIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsFilesDocumentAltFillIcon,
  CdsFilesFileIcon,
  CdsFilesImageIcon,
} from "@/components/cds-icons/files-and-layout";
import { CdsNavigationChevronsLeftIcon } from "@/components/cds-icons/navigation";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  ChevronDownIcon,
  ClockIcon,
  DownloadIcon,
  PrinterIcon,
} from "@/components/icons";
import {
  EmrInstructionHeaderStack,
  EmrInstructionTitleBar,
} from "@/components/emr/instruction-header-stack";
import {
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
  EmrSidePanelCard,
  EmrSidePanelCardAction,
  EmrSidePanelMetaBadge,
  EmrSidePanelTypeBadge,
} from "@/components/emr/side-panel-card";
import { EmrStatusBadge } from "@/components/emr/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  dateTime ? dateTime.slice(2, 16).replace("T", " ") : "-";

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "-";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;

  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

const getVisitContext = (encounter: Encounter) => encounter.chiefComplaint ?? encounter.visitPurpose;

const getActionableLabRows = (result: LabResult) =>
  result.rows.filter((row) => row.judgment !== "normal" && row.judgment !== "not_judged");

type LabResultRow = LabResult["rows"][number];

const parseReferenceRange = (referenceRange?: string) => {
  if (!referenceRange) return null;

  const match = referenceRange.match(/(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  const min = Number(match[1]);
  const max = Number(match[2]);

  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return null;

  return { min, max };
};

const getRangeMarkerPercent = (row: LabResultRow) => {
  const range = parseReferenceRange(row.referenceRange);
  const value = Number(row.value);

  if (!range || !Number.isFinite(value)) return 50;

  const span = range.max - range.min;
  const lowerBound = range.min - span * 0.35;
  const upperBound = range.max + span * 0.35;
  const rawPercent = ((value - lowerBound) / (upperBound - lowerBound)) * 100;

  return Math.min(96, Math.max(4, rawPercent));
};

const rangeStateByJudgment: Partial<Record<LabResultRow["judgment"], { label: string; markerClassName: string }>> = {
  critical: {
    label: "초과",
    markerClassName: "border-[var(--clair-color-atomic-red-500)] bg-[var(--clair-color-atomic-red-500)]",
  },
  high: {
    label: "초과",
    markerClassName: "border-[var(--clair-color-atomic-orange-500)] bg-[var(--clair-color-atomic-orange-500)]",
  },
  low: {
    label: "미달",
    markerClassName: "border-[var(--clair-color-atomic-blue-500)] bg-[var(--clair-color-atomic-blue-500)]",
  },
  normal: {
    label: "정상",
    markerClassName: "border-[var(--clair-color-atomic-green-500)] bg-[var(--clair-color-atomic-green-500)]",
  },
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
type LabReceiptView = "linked" | "all";

const labResultTabItems = [
  { value: "all" as const, label: "전체" },
  { value: "cbc" as const, label: "CBC" },
  { value: "chemistry" as const, label: "혈청화학" },
];

const labReceiptViewItems = [
  { value: "linked" as const, label: "오더 연결" },
  { value: "all" as const, label: "전체 장비결과" },
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

function getLabHistoryGroups(detail: LabDetail) {
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
            <EmrSidePanelTypeBadge label={statusLabel} />
          </div>
          <EmrSidePanelCardAction
            ariaLabel={`${item.patient.name} ${item.result.resultName} 더보기`}
            testId={`lab-queue-item-action-${item.result.id}`}
          />
        </div>
        <div className="mt-0.5 flex h-[18px] min-w-0 items-center gap-1 text-[13px] font-medium leading-[18px] tracking-[0.247px] text-[var(--clair-color-atomic-gray-500)]">
          <span className="shrink-0 truncate">검사</span>
          <span className="shrink-0 text-[var(--clair-color-atomic-gray-400)]">·</span>
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

export function LabSidePanel({ moduleLabel }: ShellComponentProps) {
  const selectedLabResultId = useLabImagingStore((state) => state.selectedLabResultId);
  const selectLabResult = useLabImagingStore((state) => state.selectLabResult);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const items = useMemo(() => getLabWorkItems(), []);
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

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title={moduleLabel}
        collapseLabel="사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
      />
      <EmrListHeader label="검사 대기열" count={items.length} headerActions={<QueueActions />} />
      <EmrSubpanelBody>
        {groups.map((group) => (
          <section key={group.status} className="flex flex-col gap-2">
            <div className="flex h-7 items-center justify-between border-l-2 border-[var(--clair-color-atomic-orange-400)] pl-2 text-[13px] font-medium text-[var(--clair-color-label-alternative)]">
              <span>{labStatusGroupLabel[group.status]}</span>
              <span>{group.items.length}</span>
            </div>
            {group.items.map((item) => (
              <LabQueueItem
                key={item.result.id}
                item={item}
                selected={item.result.id === selectedLabResultId}
                onSelect={() => selectLabResult(item.result.id)}
              />
            ))}
          </section>
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

function LabResultInputSection({ result }: { result: LabResult }) {
  const [collapsed, setCollapsed] = useState(false);
  const abnormalRows = getActionableLabRows(result);

  return (
    <EmrOrderGroupSection
      title={`${result.resultName} 세트`}
      count={result.rows.length}
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
      <Table>
        <TableHeader className="bg-[var(--clair-color-atomic-neutral-50)]">
          <TableRow>
            <TableHead>항목</TableHead>
            <TableHead>결과값</TableHead>
            <TableHead>단위</TableHead>
            <TableHead>정상범위</TableHead>
            <TableHead>판정</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-card">
            <TableCell colSpan={5} className="h-9 font-semibold">
              ■ 혈구 검사
            </TableCell>
          </TableRow>
          {result.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.analyteName}</TableCell>
              <TableCell>
                <Input aria-label={`${row.analyteName} 결과값`} defaultValue={row.value} className="h-8 w-24" />
              </TableCell>
              <TableCell>{row.unit ?? "-"}</TableCell>
              <TableCell>
                <NormalRangeCell row={row} />
              </TableCell>
              <TableCell>
                <Badge variant="outline">{getStatusLabel("labJudgment", row.judgment)}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </EmrOrderGroupSection>
  );
}

function NormalRangeCell({ row }: { row: LabResultRow }) {
  const markerPercent = getRangeMarkerPercent(row);
  const rangeState = rangeStateByJudgment[row.judgment] ?? {
    label: "미판정",
    markerClassName: "border-[var(--clair-color-atomic-gray-500)] bg-[var(--clair-color-atomic-gray-500)]",
  };

  return (
    <div
      className="min-w-[180px]"
      aria-label={`${row.analyteName} 정상범위 ${row.referenceRange ?? "-"} 결과 ${row.value} ${rangeState.label}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-foreground">{row.referenceRange ?? "-"}</span>
        <span className="text-[11px] font-medium text-muted-foreground">{rangeState.label}</span>
      </div>
      <div className="relative h-3 rounded-full bg-[var(--clair-color-atomic-gray-100)]">
        <div className="absolute inset-y-0 left-0 w-[28%] rounded-l-full bg-[var(--clair-color-atomic-blue-100)]" />
        <div className="absolute inset-y-0 left-[28%] w-[44%] bg-[var(--clair-color-atomic-green-100)]" />
        <div className="absolute inset-y-0 right-0 w-[28%] rounded-r-full bg-[var(--clair-color-atomic-orange-100)]" />
        <span
          className={cn(
            "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card shadow-sm",
            rangeState.markerClassName
          )}
          style={{ left: `${markerPercent}%` }}
          aria-hidden="true"
        />
      </div>
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
        <Button size="xs" variant="outline" className="bg-card">
          코멘트 저장
        </Button>
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
              <section key={group.date} className="flex flex-col gap-1 rounded-[10px]" data-testid={`lab-history-group-${group.date}`}>
                <button
                  type="button"
                  className="flex h-8 w-full items-center justify-between rounded-md px-1 py-1 text-left outline-none transition-colors hover:bg-(--clair-color-atomic-black-alpha-8) focus-visible:ring-3 focus-visible:ring-ring/50"
                  aria-expanded={!collapsed}
                  onClick={() => toggleHistoryGroup(group.date)}
                >
                  <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium leading-[18px] tracking-[0.019em]">
                    <span className="truncate text-[var(--clair-color-label-alternative)]">{group.date}</span>
                    <span className="shrink-0 text-[var(--clair-color-atomic-gray-500)]">{group.count}</span>
                  </div>
                  <ChevronDownIcon className="size-4 shrink-0 text-[var(--clair-color-label-alternative)]" />
                </button>
                <div className="h-px w-full shrink-0 bg-[var(--clair-color-line-subtle)]" />
                {collapsed ? null : (
                  <div>
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
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export function LabRightPanel() {
  const { detail } = useCurrentLabDetail();
  const [receiptView, setReceiptView] = useState<LabReceiptView>("linked");
  const [receiptToPaste, setReceiptToPaste] = useState<EquipmentReceipt | null>(null);
  const linkedReceipts = useMemo(() => {
    if (!detail) return [];

    return detail.allEquipmentReceipts.filter((receipt) => receipt.orderId === detail.order?.id);
  }, [detail]);
  const allReceipts = detail?.allEquipmentReceipts ?? [];
  const visibleReceipts = receiptView === "linked" ? linkedReceipts : allReceipts;
  const hasEnteredRows = Boolean(detail?.result.rows.some((row) => row.value));

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="lab-receipt-panel">
      <div className="flex h-14 items-center border-b px-4">
        <h2 className="text-sm font-semibold">검사결과 수신내역</h2>
      </div>
      <div className="border-b px-3 py-2">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1" role="tablist" aria-label="검사결과 수신내역 보기">
          {labReceiptViewItems.map((item) => {
            const selected = receiptView === item.value;
            const count = item.value === "linked" ? linkedReceipts.length : allReceipts.length;

            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  "h-7 rounded-sm px-2 text-[12px] font-medium text-muted-foreground transition-colors",
                  selected ? "bg-card text-foreground shadow-xs" : "hover:text-foreground"
                )}
                onClick={() => setReceiptView(item.value)}
              >
                {item.label} {count}
              </button>
            );
          })}
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-3">
          {visibleReceipts.map((receipt) => (
            <LabReceiptCard
              key={receipt.id}
              linkedToCurrentOrder={receipt.orderId === detail?.order?.id}
              receipt={receipt}
              onPaste={() => setReceiptToPaste(receipt)}
            />
          ))}
          {!visibleReceipts.length ? (
            <section className="rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
              {receiptView === "linked" ? "현재 오더와 연결된 장비결과가 없습니다." : "수신내역 없음"}
            </section>
          ) : null}
        </div>
      </ScrollArea>
      <Dialog open={Boolean(receiptToPaste)} onOpenChange={(open) => !open && setReceiptToPaste(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>검사결과를 붙여넣을까요?</DialogTitle>
            <DialogDescription>
              {receiptToPaste?.equipmentName} 수신값을 현재 검사결과지에 입력합니다.
              {hasEnteredRows ? " 이전에 입력된 수치가 있으면 장비 수신값으로 덮어씁니다." : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>취소</DialogClose>
            <Button onClick={() => setReceiptToPaste(null)}>붙여넣기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LabReceiptCard({
  linkedToCurrentOrder,
  onPaste,
  receipt,
}: {
  linkedToCurrentOrder: boolean;
  onPaste: () => void;
  receipt: EquipmentReceipt;
}) {
  const actionLabel = linkedToCurrentOrder
    ? "검사결과 붙여넣기"
    : receipt.status === "matched"
      ? "다른 오더 연결"
      : "수동 매칭 필요";

  return (
    <section className="rounded-md border bg-card p-3" data-testid={`lab-receipt-${receipt.id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{receipt.equipmentName}</div>
        <Badge variant="secondary" className="h-6 rounded-md px-2 text-[11px]">
          {formatShortDateTime(receipt.receivedAt)}
        </Badge>
      </div>
      <div className="mt-1 text-[12px] text-muted-foreground">{receipt.externalResultId}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="outline">{getStatusLabel("equipmentReceipt", receipt.status)}</Badge>
        {linkedToCurrentOrder ? <Badge variant="secondary">현재 오더</Badge> : null}
      </div>
      <p className="mt-3 text-[12px] leading-5 text-muted-foreground">{receipt.payloadSummary}</p>
      <Button
        size="xs"
        variant="outline"
        className="mt-3 w-full bg-card"
        disabled={!linkedToCurrentOrder}
        onClick={onPaste}
      >
        {actionLabel}
      </Button>
    </section>
  );
}

export function LabContent() {
  const searchParams = useSearchParams();
  const selectedLabResultId = useLabImagingStore((state) => state.selectedLabResultId);
  const selectLabResult = useLabImagingStore((state) => state.selectLabResult);
  const { detail, queryLabResultId } = getLabDetailFromSearchParams(searchParams, selectedLabResultId);
  const [resultTab, setResultTab] = useState<LabResultTab>("all");

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
                <Button size="sm">
                  담당하기
                  <ChevronDownIcon data-icon="inline-end" />
                </Button>
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
              ["검사 담당", detail.technicianName ?? "미지정"],
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
          <LabResultInputSection result={detail.result} />
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
