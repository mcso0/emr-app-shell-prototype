"use client";

import { useEffect, useMemo, useRef } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  getChartEncounter,
  getChartHistoryRows,
  getChartOrderGroups,
  getChartQueueRows,
  type ChartHistoryRow,
  type ChartOrderGroup,
  type ChartQueueRow,
} from "@/features/chart/data";
import { useChartStore } from "@/features/chart/store";
import {
  getPatientDisplayAge,
  getPatientSexLabel,
  getSpeciesLabel,
} from "@/features/reception/data";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
import { useLayoutStore } from "@/stores/layout-store";
import type { ShellComponentProps } from "@/types/emr";
import type { Diagnosis, EmrOrderType, Encounter, SoapNote } from "@/types/emr-domain";

const getShortDateTime = (dateTime?: string) =>
  dateTime ? dateTime.slice(2, 16).replace("T", " ") : "-";

const getDiagnosisLabel = (diagnoses: Diagnosis[]) =>
  diagnoses.length ? diagnoses.map((diagnosis) => diagnosis.diagnosisText).join(", ") : "진단 미입력";

const orderTypeNarrative: Record<EmrOrderType, { handoff: string; label: string }> = {
  dispensing: { label: "조제", handoff: "조제 대기열 → 수납 청구" },
  imaging: { label: "영상", handoff: "영상 판독 → 수납 청구" },
  lab: { label: "검사", handoff: "검사 결과 → 수납 청구" },
  treatment: { label: "처치", handoff: "처치 진행 → 수납 청구" },
};

function ChartQueueItem({
  row,
  selected,
  onSelect,
}: {
  onSelect: () => void;
  row: ChartQueueRow;
  selected: boolean;
}) {
  return (
    <div data-testid={`chart-queue-item-${row.encounter.id}`}>
      <EmrListItem
        selected={selected}
        variant="outline"
        title={`${row.patient.name} · ${row.patient.patientNo}`}
        subtitle={`${row.primaryGuardian?.name ?? "보호자 미지정"} · ${row.patient.breed ?? "품종 미상"}`}
        meta={row.encounter.chiefComplaint ?? row.encounter.visitPurpose}
        itemBadge={<Badge variant="outline">{getStatusLabel("encounter", row.encounter.status)}</Badge>}
        footer={
          <>
            <span>{getShortDateTime(row.queueEntry.enteredAt)}</span>
            <span>{row.veterinarianName ?? "담당 미정"}</span>
          </>
        }
        onSelect={onSelect}
      />
    </div>
  );
}

export function ChartSidePanel({ moduleLabel }: ShellComponentProps) {
  const selectedEncounterId = useChartStore((state) => state.selectedEncounterId);
  const selectEncounter = useChartStore((state) => state.selectEncounter);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const rows = useMemo(() => getChartQueueRows(), []);

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title={moduleLabel}
        collapseLabel="사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
      />
      <EmrListHeader
        label="진료 대기열"
        count={rows.length}
        headerActions={
          <>
            <EmrListHeaderIconButton ariaLabel="정렬">
              <CdsUtilitiesSortIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="필터">
              <CdsActionsListFilterIcon className="size-4" />
            </EmrListHeaderIconButton>
          </>
        }
      />
      <EmrSubpanelBody>
        {rows.map((row) => (
          <ChartQueueItem
            key={row.encounter.id}
            row={row}
            selected={row.encounter.id === selectedEncounterId}
            onSelect={() => selectEncounter(row.encounter.id)}
          />
        ))}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

function HistoryList({
  historyRows,
  selectedEncounterId,
  onSelectEncounter,
}: {
  historyRows: ChartHistoryRow[];
  onSelectEncounter: (encounterId: string) => void;
  selectedEncounterId: string;
}) {
  return (
    <aside className="flex min-h-0 w-[280px] shrink-0 flex-col border-r bg-[var(--clair-color-background-normal)]">
      <div className="flex h-12 items-center justify-between border-b px-4">
        <div className="text-[14px] font-semibold">과거 진료 이력</div>
        <Badge variant="secondary">{historyRows.length}</Badge>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-2 p-3">
          {historyRows.map((row) => (
            <button
              key={row.encounter.id}
              type="button"
              className={[
                "rounded-lg border bg-card p-3 text-left transition-colors",
                row.encounter.id === selectedEncounterId
                  ? "border-[var(--clair-color-atomic-sky-300)] bg-[var(--clair-color-atomic-sky-50)]"
                  : "hover:bg-[var(--clair-color-background-surface)]",
              ].join(" ")}
              onClick={() => onSelectEncounter(row.encounter.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold">{row.encounter.encounterNo}</span>
                <Badge variant="outline">{getStatusLabel("encounter", row.encounter.status)}</Badge>
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                {getShortDateTime(row.encounter.checkedInAt ?? row.encounter.createdAt)}
              </div>
              <div className="mt-2 line-clamp-2 text-[12px]">
                {row.soapNote?.assessment ?? row.encounter.chiefComplaint ?? "진료 기록 없음"}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

function PatientHeader({
  encounter,
  patient,
  primaryGuardianName,
}: {
  encounter: Encounter;
  patient: NonNullable<ReturnType<typeof getChartEncounter>>["patient"];
  primaryGuardianName?: string;
}) {
  return (
    <section className="border-b bg-card px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-semibold leading-7">{patient.name}</h1>
            <Badge>{getStatusLabel("encounter", encounter.status)}</Badge>
          </div>
          <div className="mt-1 text-[13px] text-muted-foreground">
            {patient.patientNo} · {getSpeciesLabel(patient)} · {patient.breed ?? "품종 미상"} ·{" "}
            {getPatientDisplayAge(patient)} · {getPatientSexLabel(patient)}
          </div>
        </div>
        <div className="text-right text-[13px] text-muted-foreground">
          <div>{primaryGuardianName ?? "보호자 미지정"}</div>
          <div>{encounter.encounterNo}</div>
        </div>
      </div>
    </section>
  );
}

function EncounterNarrative({
  encounter,
  primaryGuardianName,
  soapNote,
}: {
  encounter: Encounter;
  primaryGuardianName?: string;
  soapNote?: SoapNote;
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-muted-foreground">오늘 진료 흐름</div>
          <p className="mt-1 text-[14px] font-semibold leading-5">
            {primaryGuardianName ?? "보호자"} 보호자가 {encounter.chiefComplaint ?? encounter.visitPurpose}로 내원했습니다.
          </p>
        </div>
        <Badge variant="outline">{encounter.encounterNo}</Badge>
      </div>
      <div className="mt-3 grid gap-2 text-[13px] leading-5 md:grid-cols-3">
        <div className="rounded-md border bg-[var(--clair-color-background-surface)] p-3">
          <div className="text-[12px] font-medium text-muted-foreground">SOAP 핵심</div>
          <p className="mt-1">{soapNote?.subjective ?? "주관 기록 대기"}</p>
        </div>
        <div className="rounded-md border bg-[var(--clair-color-background-surface)] p-3">
          <div className="text-[12px] font-medium text-muted-foreground">Assessment</div>
          <p className="mt-1">{soapNote?.assessment ?? "평가 기록 대기"}</p>
        </div>
        <div className="rounded-md border bg-[var(--clair-color-background-surface)] p-3">
          <div className="text-[12px] font-medium text-muted-foreground">Plan / 다음 업무</div>
          <p className="mt-1">{soapNote?.plan ?? "계획 기록 대기"}</p>
        </div>
      </div>
    </section>
  );
}

function SoapPanel({ soapNote }: { soapNote?: SoapNote }) {
  const soapFields = [
    ["S 주관", soapNote?.subjective],
    ["O 객관", soapNote?.objective],
    ["A 평가", soapNote?.assessment],
    ["P 계획", soapNote?.plan],
  ];

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex h-11 items-center justify-between border-b px-4">
        <h2 className="text-[14px] font-semibold">SOAP</h2>
        {soapNote ? <Badge variant="outline">{getStatusLabel("soap", soapNote.status)}</Badge> : null}
      </div>
      <div className="grid grid-cols-2 gap-3 p-4">
        {soapFields.map(([label, value]) => (
          <div key={label} className="rounded-md border bg-[var(--clair-color-background-surface)] p-3">
            <div className="text-[12px] font-medium text-muted-foreground">{label}</div>
            <p className="mt-2 min-h-12 text-[13px] leading-5">{value ?? "미입력"}</p>
          </div>
        ))}
      </div>
    </section>
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
    <section className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold">Assessment</h2>
        <Badge variant="secondary">{diagnoses.length}건</Badge>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {diagnoses.map((diagnosis) => (
          <div key={diagnosis.id} className="rounded-md border bg-[var(--clair-color-background-surface)] p-3">
            <div className="font-medium">{diagnosis.diagnosisText}</div>
            <div className="mt-1 text-[12px] text-muted-foreground">{diagnosis.diagnosisType}</div>
          </div>
        ))}
        {!diagnoses.length ? (
          <div className="rounded-md border border-dashed p-3 text-[13px] text-muted-foreground">
            진단 입력 전입니다.
          </div>
        ) : null}
      </div>
      <Separator className="my-4" />
      <div className="text-[12px] font-medium text-muted-foreground">현재 평가 메모</div>
      <p className="mt-2 text-[13px] leading-5">{soapNote?.assessment ?? "평가 메모 없음"}</p>
    </section>
  );
}

function AssessmentHistory({ historyRows }: { historyRows: ChartHistoryRow[] }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold">Assessment History</h2>
        <Badge variant="outline">{historyRows.length}</Badge>
      </div>
      <div className="flex flex-col gap-2">
        {historyRows.map((row) => (
          <div key={row.encounter.id} className="rounded-md border bg-[var(--clair-color-background-surface)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{row.encounter.encounterNo}</span>
              <span className="text-[12px] text-muted-foreground">
                {getShortDateTime(row.encounter.checkedInAt ?? row.encounter.createdAt)}
              </span>
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

function OrderArea({ orderGroups }: { orderGroups: ChartOrderGroup[] }) {
  const orderCount = orderGroups.reduce((total, group) => total + group.orders.length, 0);
  const orderedTypes = Array.from(
    new Set(orderGroups.flatMap(({ orders }) => orders.map((order) => order.orderType)))
  );

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <div>
          <h2 className="text-[14px] font-semibold">Order</h2>
          <div className="mt-1 flex flex-wrap gap-1">
            {orderedTypes.map((orderType) => (
              <Badge key={orderType} variant="outline">
                {orderTypeNarrative[orderType].label}
              </Badge>
            ))}
            {orderCount ? <Badge variant="outline">수납 청구</Badge> : null}
          </div>
        </div>
        <Badge variant="secondary">{orderCount}</Badge>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {orderGroups.map(({ group, orders }) => (
          <div key={group?.id ?? "ungrouped-orders"} className="rounded-lg border bg-[var(--clair-color-background-surface)]">
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
              <div>
                <div className="font-medium">{group?.title ?? "개별 오더"}</div>
                <div className="text-[12px] text-muted-foreground">{group?.label ?? "그룹 미지정"}</div>
              </div>
              {group ? (
                <Badge variant="outline">{getStatusLabel("orderGroup", group.status)}</Badge>
              ) : null}
            </div>
            <div className="divide-y">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="grid grid-cols-[minmax(0,1fr)_64px_80px_150px] gap-3 px-3 py-2 text-[13px]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{order.displayName}</div>
                    <div className="truncate text-[12px] text-muted-foreground">{order.instruction ?? "지시 없음"}</div>
                  </div>
                  <div>
                    <Badge variant="outline">{orderTypeNarrative[order.orderType].label}</Badge>
                  </div>
                  <div>{getStatusLabel("order", order.status)}</div>
                  <div className="text-[12px] text-muted-foreground">{orderTypeNarrative[order.orderType].handoff}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ChartContent() {
  const searchParams = useSearchParams();
  const lastAppliedQueryEncounterId = useRef<string | null>(null);
  const selectedEncounterId = useChartStore((state) => state.selectedEncounterId);
  const selectEncounter = useChartStore((state) => state.selectEncounter);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryEncounterId = searchParams.get("encounterId") ?? scenario?.encounterId ?? null;
  const queryEncounterBundle = queryEncounterId ? getChartEncounter(queryEncounterId) : null;
  const hasValidQueryEncounter = queryEncounterId !== null && queryEncounterBundle !== null;
  const bundle = getChartEncounter(selectedEncounterId) ?? getChartEncounter("encounter-coco-260501");
  const historyRows = useMemo(
    () => (bundle ? getChartHistoryRows(bundle.patient.id) : []),
    [bundle]
  );
  const orderGroups = useMemo(
    () => (bundle ? getChartOrderGroups(bundle.encounter.id) : []),
    [bundle]
  );

  useEffect(() => {
    if (!queryEncounterId || !hasValidQueryEncounter) return;
    if (lastAppliedQueryEncounterId.current === queryEncounterId) return;

    lastAppliedQueryEncounterId.current = queryEncounterId;
    if (selectedEncounterId !== queryEncounterId) {
      selectEncounter(queryEncounterId);
    }
  }, [hasValidQueryEncounter, queryEncounterId, selectEncounter, selectedEncounterId]);

  if (!bundle) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        진료 대기열에서 환자를 선택해 주세요.
      </div>
    );
  }

  const latestSoap = bundle.soapNotes.at(-1);

  return (
    <div className="flex h-full min-h-0 bg-[var(--clair-color-background-normal)]">
      <HistoryList
        historyRows={historyRows}
        selectedEncounterId={bundle.encounter.id}
        onSelectEncounter={selectEncounter}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <PatientHeader
          encounter={bundle.encounter}
          patient={bundle.patient}
          primaryGuardianName={bundle.primaryGuardian?.name}
        />
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-4 p-5">
            <EncounterNarrative
              encounter={bundle.encounter}
              primaryGuardianName={bundle.primaryGuardian?.name}
              soapNote={latestSoap}
            />
            <SoapPanel soapNote={latestSoap} />
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)] gap-4">
              <AssessmentPanel diagnoses={bundle.diagnoses} soapNote={latestSoap} />
              <AssessmentHistory historyRows={historyRows} />
            </div>
            <OrderArea orderGroups={orderGroups} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
