"use client";

import { type ReactNode, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { CdsActionsListFilterIcon } from "@/components/cds-icons/actions-and-controls";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrListItem,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";
import type {
  EmrAttachment,
  Encounter,
  EquipmentReceipt,
  ImagingStudy,
  LabResult,
  LabResultRow,
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

const formatLabFinding = (row: LabResultRow) => {
  const value = [row.value, row.unit].filter(Boolean).join(" ");
  const judgment = getStatusLabel("labJudgment", row.judgment);

  return [row.analyteName, value, judgment, row.note].filter(Boolean).join(" · ");
};

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
  return (
    <div data-testid={`lab-queue-item-${item.result.id}`}>
      <EmrListItem
        selected={selected}
        variant="outline"
        title={`${item.patient.name} · ${item.patient.patientNo}`}
        subtitle={`${item.primaryGuardian?.name ?? "보호자 미지정"} · ${item.order?.displayName ?? item.result.resultName}`}
        meta={item.encounter.chiefComplaint ?? item.encounter.visitPurpose}
        itemBadge={<Badge variant="outline">{getStatusLabel("labResult", item.result.status)}</Badge>}
        footer={
          <>
            <span>{formatShortDateTime(item.result.receivedAt ?? item.result.collectedAt)}</span>
            <span>{item.technicianName ?? "담당 미정"}</span>
          </>
        }
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

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title={moduleLabel}
        collapseLabel="사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
      />
      <EmrListHeader label="검사 대기열" count={items.length} headerActions={<QueueActions />} />
      <EmrSubpanelBody>
        {items.map((item) => (
          <LabQueueItem
            key={item.result.id}
            item={item}
            selected={item.result.id === selectedLabResultId}
            onSelect={() => selectLabResult(item.result.id)}
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

function LabResultFlowPanel({ detail }: { detail: LabDetail }) {
  const actionableRows = getActionableLabRows(detail.result);
  const keyFinding =
    actionableRows.length > 0
      ? actionableRows.map(formatLabFinding).join(" / ")
      : `${detail.result.resultName} · ${getStatusLabel("labResult", detail.result.status)}`;

  return (
    <ResultFlowPanel
      steps={[
        [
          "차트 오더",
          `${detail.order?.displayName ?? detail.result.resultName} · ${getVisitContext(detail.encounter) ?? detail.encounter.encounterNo}`,
        ],
        ["결과 확인", keyFinding],
        [
          "수의사/수납 연결",
          `입력 ${formatShortDateTime(detail.result.enteredAt ?? detail.result.receivedAt)} · 진료 판단과 청구 확인`,
        ],
      ]}
    />
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

function ResultInputTable({ result }: { result: LabResult }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex h-11 items-center justify-between border-b px-4">
        <h2 className="text-[14px] font-semibold">결과 입력</h2>
        <Button size="sm" variant="outline">저장</Button>
      </div>
      <Table>
        <TableHeader className="bg-[var(--clair-color-atomic-neutral-50)]">
          <TableRow>
            <TableHead>항목</TableHead>
            <TableHead>결과값</TableHead>
            <TableHead>단위</TableHead>
            <TableHead>참고치</TableHead>
            <TableHead>판정</TableHead>
            <TableHead>메모</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.analyteName}</TableCell>
              <TableCell>
                <Input aria-label={`${row.analyteName} 결과값`} defaultValue={row.value} className="h-8 w-24" />
              </TableCell>
              <TableCell>{row.unit ?? "-"}</TableCell>
              <TableCell>{row.referenceRange ?? "-"}</TableCell>
              <TableCell>
                <Badge variant="outline">{getStatusLabel("labJudgment", row.judgment)}</Badge>
              </TableCell>
              <TableCell className="max-w-[220px] truncate">{row.note ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

function EquipmentReceiptsPanel({ receipts }: { receipts: EquipmentReceipt[] }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex h-11 items-center justify-between border-b px-4">
        <h2 className="text-[14px] font-semibold">장비 수신 내역</h2>
        <Badge variant="secondary">{receipts.length}</Badge>
      </div>
      <div className="divide-y">
        {receipts.map((receipt) => (
          <div key={receipt.id} className="grid grid-cols-[160px_150px_90px_1fr] gap-3 px-4 py-3 text-[13px]">
            <div className="font-medium">{receipt.equipmentName}</div>
            <div className="text-muted-foreground">{receipt.externalResultId}</div>
            <div>
              <Badge variant="outline">{getStatusLabel("equipmentReceipt", receipt.status)}</Badge>
            </div>
            <div className="min-w-0 truncate">{receipt.payloadSummary}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AttachmentStrip({ attachments }: { attachments: EmrAttachment[] }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex h-11 items-center justify-between border-b px-4">
        <h2 className="text-[14px] font-semibold">첨부자료</h2>
        <Badge variant="secondary">{attachments.length}</Badge>
      </div>
      <div className="flex flex-wrap gap-3 p-4">
        {attachments.map((attachment) => (
          <div key={attachment.id} className="min-w-[220px] rounded-md border bg-[var(--clair-color-background-surface)] p-3">
            <div className="truncate text-[13px] font-medium">{attachment.fileName}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              {attachment.mimeType} · {formatFileSize(attachment.fileSizeBytes)}
            </div>
          </div>
        ))}
        {!attachments.length ? (
          <div className="rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
            첨부자료 없음
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function LabContent() {
  const searchParams = useSearchParams();
  const selectedLabResultId = useLabImagingStore((state) => state.selectedLabResultId);
  const selectLabResult = useLabImagingStore((state) => state.selectLabResult);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryLabResultId = searchParams.get("labResultId") ?? scenario?.labResultId;
  const effectiveLabResultId = queryLabResultId ?? selectedLabResultId;
  const detail = getLabDetail(effectiveLabResultId) ?? getLabDetail("lab-result-coco-cbc");

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
    <div className="flex h-full min-h-0 flex-col bg-[var(--clair-color-background-normal)]">
      <PatientHeader
        encounter={detail.encounter}
        patient={detail.patient}
        primaryGuardianName={detail.primaryGuardian?.name}
        statusLabel={getStatusLabel("labResult", detail.result.status)}
        title="임상병리 검사"
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 p-5">
          <SummaryGrid
            items={[
              ["검사명", detail.result.resultName],
              ["오더", detail.order?.displayName],
              ["채혈", formatShortDateTime(detail.result.collectedAt)],
              ["수신", formatShortDateTime(detail.result.receivedAt)],
            ]}
          />
          <LabResultFlowPanel detail={detail} />
          <ResultInputTable result={detail.result} />
          <EquipmentReceiptsPanel receipts={detail.equipmentReceipts} />
          <AttachmentStrip attachments={detail.attachments} />
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
