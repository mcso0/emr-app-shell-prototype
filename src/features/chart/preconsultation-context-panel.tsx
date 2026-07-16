"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CdsActionsRefreshCcwIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsFilesCalendarIcon, CdsFilesClockIcon } from "@/components/cds-icons/files-and-layout";
import { CdsGnbMedicalGnbIcon, CdsGnbPetGnbIcon } from "@/components/cds-icons/gnb";
import {
  CdsMedicalHeartPulseIcon,
  CdsMedicalPawPrintIcon,
  CdsMedicalStethoscopeIcon,
  CdsMedicalThermometerIcon,
  CdsMedicalWeightIcon,
  CdsMedicalWindIcon,
} from "@/components/cds-icons/medical-and-domain";
import {
  CdsNavigationChevronDownIcon,
  CdsNavigationChevronUpIcon,
} from "@/components/cds-icons/navigation";
import { CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
import { CdsUtilitiesCircleIcon } from "@/components/cds-icons/utilities-and-misc";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  ChartPreconsultationContext,
  ChartPreconsultationContextResponse,
  ChartPreconsultationHistoryEntry,
  ChartPreconsultationVitalMeasurement,
} from "@/features/chart/preconsultation-context";
import { cn } from "@/lib/utils";

type ContextState =
  | { status: "loading" }
  | { status: "error"; reason?: string }
  | { status: "ready"; context: ChartPreconsultationContext };

export function ChartPreconsultationContextPanel({
  actorHeaders,
  encounterId,
  onRequestCall,
  primaryActionBusy,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  onRequestCall: () => void;
  primaryActionBusy: boolean;
  workspaceId: string;
}) {
  const [contextState, setContextState] = useState<ContextState>({ status: "loading" });
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [patientInformationOpen, setPatientInformationOpen] = useState(false);

  const loadContext = useCallback(async () => {
    setContextState({ status: "loading" });
    const result = await loadChartPreconsultationContext({
      actorHeaders,
      encounterId,
      workspaceId,
    });
    setContextState(
      result.ok
        ? { status: "ready", context: result.context }
        : {
            status: "error",
            reason: result.denialReason ?? result.error,
          },
    );
  }, [actorHeaders, encounterId, workspaceId]);

  useEffect(() => {
    let cancelled = false;

    void loadChartPreconsultationContext({ actorHeaders, encounterId, workspaceId }).then(
      (result) => {
        if (cancelled) return;
        setContextState(
          result.ok
            ? { status: "ready", context: result.context }
            : {
                status: "error",
                reason: result.denialReason ?? result.error,
              },
        );
      },
    );

    return () => {
      cancelled = true;
    };
  }, [actorHeaders, encounterId, workspaceId]);

  if (contextState.status === "loading") {
    return (
      <div className="flex min-h-[480px] flex-1 items-center justify-center px-6 py-10">
        <EmrEmptyState
          kind="upstream-pending"
          priority="supporting"
          surface="content"
          title="진료 전 정보를 불러오는 중입니다"
          description="환자, 접수, 바이탈, 과거 진료 이력을 확인하고 있습니다."
        />
      </div>
    );
  }

  if (contextState.status === "error") {
    return (
      <div className="flex min-h-[480px] flex-1 items-center justify-center px-6 py-10">
        <EmrEmptyState
          kind="no-data"
          priority="local-recovery"
          surface="content"
          title="진료 전 정보를 불러오지 못했습니다"
          description={getContextErrorDescription(contextState.reason)}
          primaryAction={
            <Button variant="outline" className="bg-card" onClick={() => void loadContext()}>
              <CdsActionsRefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
              다시 시도
            </Button>
          }
        />
      </div>
    );
  }

  const { context } = contextState;
  return (
    <div
      className="min-h-0 flex-1 overflow-auto"
      data-testid="chart-start-locked-state"
    >
      <div className="mx-auto w-full max-w-[1440px] px-4 py-4 xl:px-6 xl:py-6">
        <PreconsultationHeader
          context={context}
          primaryActionBusy={primaryActionBusy}
          onOpenPatientInformation={() => setPatientInformationOpen(true)}
          onRequestCall={onRequestCall}
        />
        <Separator className="my-6" />
        <div className="grid min-w-0 grid-cols-1 gap-6 min-[1180px]:grid-cols-[minmax(0,1fr)_288px] min-[1320px]:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-8">
            <VisitPurpose context={context} />
            <ReceptionSummary context={context} />
            <VitalSection context={context} />
            <HistorySection
              context={context}
              expanded={historyExpanded}
              onToggle={() => setHistoryExpanded((current) => !current)}
            />
          </div>
          <PatientSummary context={context} />
        </div>
      </div>
      <PatientInformationSheet
        context={context}
        open={patientInformationOpen}
        onOpenChange={setPatientInformationOpen}
      />
    </div>
  );
}

async function loadChartPreconsultationContext({
  actorHeaders,
  encounterId,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  workspaceId: string;
}): Promise<ChartPreconsultationContextResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/preconsultation-context?encounterId=${encodeURIComponent(encounterId)}`,
      { cache: "no-store", headers: actorHeaders },
    );
    const body = (await response.json()) as ChartPreconsultationContextResponse;
    if (!response.ok || !body.ok) {
      return body.ok
        ? { ok: false, status: response.status, error: "db_read_failed" }
        : { ...body, status: response.status };
    }
    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

function PreconsultationHeader({
  context,
  onOpenPatientInformation,
  onRequestCall,
  primaryActionBusy,
}: {
  context: ChartPreconsultationContext;
  onOpenPatientInformation: () => void;
  onRequestCall: () => void;
  primaryActionBusy: boolean;
}) {
  return (
    <header className="min-w-0" aria-labelledby="preconsultation-patient-heading">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="h-6 border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] px-2 text-[var(--emr-status-info-text)]"
        >
          <CdsUtilitiesCircleIcon className="size-3" aria-hidden="true" />
          진료 시작 전
        </Badge>
        <Badge
          variant="secondary"
          className="h-6 px-2 text-[var(--emr-text-secondary)]"
        >
          차트번호 {context.encounter.encounterNo}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <PatientIdentity context={context} size="large" />
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <Button variant="outline" size="lg" onClick={onOpenPatientInformation}>
            환자 정보
          </Button>
          <Button size="lg" disabled={primaryActionBusy} onClick={onRequestCall}>
            <CdsGnbMedicalGnbIcon data-icon="inline-start" aria-hidden="true" />
            호출하기
          </Button>
        </div>
      </div>
    </header>
  );
}

function PatientIdentity({
  context,
  size,
}: {
  context: ChartPreconsultationContext;
  size: "large" | "medium";
}) {
  const metadata = getPatientMetadata(context);
  return (
    <div className="flex min-w-0 items-center gap-4">
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[12px] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] text-[var(--emr-text-tertiary)]",
          size === "large" ? "size-16" : "size-14",
        )}
        role="img"
        aria-label={`${context.patient.name} 환자 프로필 기본 이미지`}
      >
        <CdsGnbPetGnbIcon
          className={size === "large" ? "size-8" : "size-7"}
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1
            id={size === "large" ? "preconsultation-patient-heading" : undefined}
            className={cn(
              "font-semibold tracking-[-0.025em] text-[var(--emr-text-primary)]",
              size === "large" ? "text-2xl leading-7" : "text-lg leading-6",
            )}
          >
            {context.patient.name}
          </h1>
          <p className="text-base leading-6 text-muted-foreground">
            보호자{" "}
            <span className="font-semibold text-[var(--emr-text-secondary)]">
              {context.guardian?.name ?? "미지정"}
            </span>
          </p>
        </div>
        <p className="mt-2 text-sm font-medium text-[var(--emr-text-tertiary)]">
          {metadata.join(" · ")}
        </p>
      </div>
    </div>
  );
}

function VisitPurpose({ context }: { context: ChartPreconsultationContext }) {
  const purpose = context.encounter.visitPurpose ?? context.encounter.chiefComplaint;
  return (
    <section aria-labelledby="preconsultation-visit-purpose">
      <SectionTitle id="preconsultation-visit-purpose">방문 목적</SectionTitle>
      <div className="mt-3 flex min-w-0 flex-wrap items-center gap-3 rounded-[var(--clair-radius-atomic-8)] bg-[var(--emr-surface-muted)] px-4 py-3">
        <Badge variant="outline" className="h-5 bg-[var(--emr-surface-panel)] px-2">
          {getVisitType(context)}
        </Badge>
        <p className="min-w-0 text-base font-semibold leading-6 tracking-[-0.01em]">
          {purpose ?? "방문 목적 미입력"}
        </p>
      </div>
    </section>
  );
}

function ReceptionSummary({ context }: { context: ChartPreconsultationContext }) {
  return (
    <section aria-labelledby="preconsultation-reception-summary">
      <SectionTitle id="preconsultation-reception-summary">접수 정보</SectionTitle>
      <div className="mt-3 rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] p-4">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-[repeat(3,minmax(96px,1fr))_minmax(200px,2fr)]">
          <SummaryItem label="접수 시각" value={`${formatTime(context.encounter.checkedInAt)} 접수`} />
          <SummaryItem label="접수 유형" value={getReceptionTypeLabel(context.encounter.receptionType)} />
          <SummaryItem label="담당 수의사" value={context.veterinarian?.displayName ?? "미지정"} />
          <SummaryItem label="접수 메모" value={context.encounter.receptionMemo ?? "접수 메모 미입력"} multiline />
        </dl>
      </div>
    </section>
  );
}

function VitalSection({ context }: { context: ChartPreconsultationContext }) {
  const current = context.vitals[0];
  const previous = context.vitals[1];
  return (
    <section aria-labelledby="preconsultation-vitals">
      <SectionTitle id="preconsultation-vitals">환자 바이탈</SectionTitle>
      {current ? (
        <VitalComparison current={current} previous={previous} encounterAt={context.encounter.checkedInAt} />
      ) : (
        <div className="mt-3 rounded-[var(--emr-radius-panel)] border border-dashed border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4 py-6 text-center text-sm text-muted-foreground">
          기록된 바이탈이 없습니다.
        </div>
      )}
    </section>
  );
}

type VitalDefinition = {
  key: "weightKg" | "temperatureC" | "respiratoryRateRpm" | "bloodPressureSystolicMmhg";
  label: string;
  icon: ReactNode;
  format: (measurement: ChartPreconsultationVitalMeasurement) => string;
  delta: (current: ChartPreconsultationVitalMeasurement, previous: ChartPreconsultationVitalMeasurement) => string | null;
};

const vitalDefinitions: VitalDefinition[] = [
  {
    key: "weightKg",
    label: "체중",
    icon: <CdsMedicalWeightIcon className="size-4" aria-hidden="true" />,
    format: (value) => formatOptionalNumber(value.weightKg, "kg", 2),
    delta: (current, previous) => formatDelta(current.weightKg, previous.weightKg, 2),
  },
  {
    key: "temperatureC",
    label: "체온",
    icon: <CdsMedicalThermometerIcon className="size-4" aria-hidden="true" />,
    format: (value) => formatOptionalNumber(value.temperatureC, "°C", 1),
    delta: (current, previous) => formatDelta(current.temperatureC, previous.temperatureC, 1),
  },
  {
    key: "respiratoryRateRpm",
    label: "호흡",
    icon: <CdsMedicalWindIcon className="size-4" aria-hidden="true" />,
    format: (value) => formatOptionalNumber(value.respiratoryRateRpm, "rpm", 0),
    delta: (current, previous) => formatDelta(current.respiratoryRateRpm, previous.respiratoryRateRpm, 0),
  },
  {
    key: "bloodPressureSystolicMmhg",
    label: "혈압",
    icon: <CdsMedicalHeartPulseIcon className="size-4" aria-hidden="true" />,
    format: (value) => formatBloodPressure(value),
    delta: (current, previous) => formatDelta(current.bloodPressureSystolicMmhg, previous.bloodPressureSystolicMmhg, 0),
  },
];

function VitalComparison({
  current,
  encounterAt,
  previous,
}: {
  current: ChartPreconsultationVitalMeasurement;
  encounterAt: string;
  previous?: ChartPreconsultationVitalMeasurement;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-[var(--emr-radius-panel)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]">
      <div className="grid min-w-[680px] grid-cols-[112px_repeat(4,minmax(120px,1fr))]">
        <div className="border-r border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)]" aria-hidden="true" />
        {vitalDefinitions.map((vital) => (
          <div key={vital.key} className="flex items-center gap-2 border-r border-[var(--emr-line-hairline)] px-3 py-2 text-sm font-medium text-muted-foreground last:border-r-0">
            {vital.icon}{vital.label}
          </div>
        ))}
        <VitalDateCell value={`${formatMonthDay(current.measuredAt)}${sameDate(current.measuredAt, encounterAt) ? "(오늘)" : ""}`} />
        {vitalDefinitions.map((vital) => {
          const delta = previous ? vital.delta(current, previous) : null;
          return (
            <div key={`current-${vital.key}`} className="flex min-h-12 items-center justify-between gap-2 border-r border-t border-[var(--emr-line-hairline)] px-3 py-2 text-sm last:border-r-0">
              <span className="font-medium text-[var(--emr-text-secondary)]">{vital.format(current)}</span>
              {delta ? <span className="shrink-0 font-medium text-[var(--emr-status-info-text)]">{delta}</span> : null}
            </div>
          );
        })}
        {previous ? (
          <>
            <VitalDateCell value={`${formatMonthDay(previous.measuredAt)} 이전 방문`} />
            {vitalDefinitions.map((vital) => (
              <div key={`previous-${vital.key}`} className="flex min-h-12 items-center border-r border-t border-[var(--emr-line-hairline)] px-3 py-2 text-sm last:border-r-0">
                <span className="font-medium text-[var(--emr-text-secondary)]">{vital.format(previous)}</span>
              </div>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

function VitalDateCell({ value }: { value: string }) {
  return (
    <div className="flex min-h-12 items-center border-r border-t border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] px-3 py-2 text-sm font-medium text-[var(--emr-text-secondary)]">
      {value}
    </div>
  );
}

function HistorySection({
  context,
  expanded,
  onToggle,
}: {
  context: ChartPreconsultationContext;
  expanded: boolean;
  onToggle: () => void;
}) {
  const entries = expanded ? context.history : context.history.slice(0, 3);
  return (
    <section aria-labelledby="preconsultation-history">
      <SectionTitle id="preconsultation-history">과거 진료 이력</SectionTitle>
      {entries.length > 0 ? (
        <>
          <div className="relative">
            <HistoryTimeline entries={entries} currentEncounterId={context.encounter.id} />
            {!expanded && context.history.length > entries.length ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-b from-transparent to-[#ffffff]" aria-hidden="true" />
            ) : null}
          </div>
          {context.history.length > 3 ? (
            <div className="mt-2 flex justify-center">
              <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={onToggle}>
                {expanded ? "진료 이력 접기" : "전체 진료 이력 보기"}
                {expanded ? <CdsNavigationChevronUpIcon data-icon="inline-end" /> : <CdsNavigationChevronDownIcon data-icon="inline-end" />}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-3 rounded-[var(--emr-radius-panel)] border border-dashed border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4 py-6 text-center text-sm text-muted-foreground">
          기록된 진료 이력이 없습니다.
        </div>
      )}
    </section>
  );
}

function HistoryTimeline({
  currentEncounterId,
  entries,
}: {
  currentEncounterId: string;
  entries: ChartPreconsultationHistoryEntry[];
}) {
  return (
    <ol className="mt-3" aria-label="과거 진료 이력">
      {entries.map((entry, index) => {
        const current = entry.encounterId === currentEncounterId;
        const summary = entry.primaryDiagnosis ?? entry.visitPurpose ?? entry.chiefComplaint ?? "진료 요약 미입력";
        const detail = entry.assessment ?? entry.plan ?? entry.subjective ?? entry.receptionMemo ?? "세부 기록 없음";
        return (
          <li key={entry.encounterId} className="grid grid-cols-[136px_minmax(0,1fr)] gap-5">
            <div className="relative min-h-[112px] border-r border-[var(--emr-line-hairline)] pr-5">
              <span className={cn("absolute -right-[9px] top-0 flex size-[18px] items-center justify-center rounded-full bg-[var(--emr-surface-workspace)]", current ? "text-[var(--emr-status-info-text)]" : "text-[var(--emr-text-tertiary)]")}>
                <CdsUtilitiesCircleIcon className="size-[18px]" aria-hidden="true" />
              </span>
              <p className={cn("text-sm font-semibold leading-5", current ? "text-[var(--emr-status-info-text)]" : "text-muted-foreground")}>
                {formatHistoryDate(entry.checkedInAt, current)}
              </p>
            </div>
            <div className={cn("min-w-0 pb-5", index === entries.length - 1 && "pb-2")}>
              <h3 className="text-base font-semibold leading-5">{summary}</h3>
              <div className="mt-2 rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-3 py-2.5">
                <p className="text-[11px] font-semibold text-muted-foreground">{current ? "이번 내원 기록" : "진료 요약"}</p>
                <p className="mt-0.5 text-sm font-medium text-[var(--emr-text-secondary)]">{detail}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PatientSummary({ context }: { context: ChartPreconsultationContext }) {
  return (
    <aside className="min-w-0 border-t border-[var(--emr-line-hairline)] pt-6 min-[1180px]:border-l min-[1180px]:border-t-0 min-[1180px]:pl-6 min-[1180px]:pt-0 [&>section:first-child]:mt-0 [&>section:first-child]:border-t-0 [&>section:first-child]:pt-0" aria-label="환자 요약">
      <SideSection title="환자 정보">
        <SideRow icon={<CdsMedicalPawPrintIcon />} label="종류" value={getSpeciesLabel(context.patient.species)} />
        <SideRow icon={<CdsGnbPetGnbIcon />} label="품종" value={context.patient.breed ?? "미입력"} />
        <SideRow icon={<CdsFilesCalendarIcon />} label="나이" value={getPatientAge(context)} />
        <SideRow icon={<CdsPeopleUserIcon />} label="성별" value={getSexLabel(context.patient.sex, context.patient.neutered)} />
        <SideRow icon={<CdsMedicalStethoscopeIcon />} label="내원 유형" value={getVisitType(context)} />
        <SideRow icon={<CdsActionsRefreshCcwIcon />} label="재진 횟수" value={`${context.priorEncounterCount}회`} />
      </SideSection>
      <SideSection title="진료 전 주의">
        <p className="text-sm font-medium leading-5 text-[var(--emr-status-warning-text)]">{context.patient.handlingCautionNote ?? "등록된 주의사항 없음"}</p>
      </SideSection>
      <SideSection title="보호자 메모">
        <p className="text-sm font-medium leading-5 text-[var(--emr-text-secondary)]">{context.guardian?.memo ?? "등록된 보호자 메모 없음"}</p>
      </SideSection>
      <SideSection title="이번 내원">
        <SideRow icon={<CdsMedicalStethoscopeIcon />} label="내원 유형" value={getVisitType(context)} />
        <SideRow icon={<CdsFilesClockIcon />} label="접수 시각" value={`${formatTime(context.encounter.checkedInAt)} 접수`} />
      </SideSection>
    </aside>
  );
}

function PatientInformationSheet({
  context,
  onOpenChange,
  open,
}: {
  context: ChartPreconsultationContext;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full data-[side=right]:sm:max-w-[440px]">
        <SheetHeader className="border-b border-[var(--emr-line-hairline)] pr-12">
          <SheetTitle>환자 정보</SheetTitle>
          <SheetDescription>진료 전 필요한 환자와 보호자 정보를 확인합니다.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-4 pb-6">
            <div className="rounded-[var(--clair-radius-atomic-12)] bg-[var(--emr-surface-muted)] p-4">
              <PatientIdentity context={context} size="medium" />
              <p className="mt-2 pl-[72px] text-xs text-muted-foreground">차트번호 {context.encounter.encounterNo}</p>
            </div>
            <DrawerSection title="기본 정보">
              <DetailRow label="차트번호" value={context.encounter.encounterNo} />
              <DetailRow label="종류" value={getSpeciesLabel(context.patient.species)} />
              <DetailRow label="품종" value={context.patient.breed ?? "미입력"} />
              <DetailRow label="나이 · 성별" value={`${getPatientAge(context)} · ${getSexLabel(context.patient.sex, context.patient.neutered)}`} />
              <DetailRow label="내원 유형" value={getVisitType(context)} />
              <DetailRow label="재진 횟수" value={`${context.priorEncounterCount}회`} />
            </DrawerSection>
            <DrawerSection title="보호자 정보">
              <DetailRow label="보호자명" value={context.guardian?.name ?? "미지정"} />
              <DetailRow label="보호자 메모" value={context.guardian?.memo ?? "등록된 메모 없음"} />
            </DrawerSection>
            <DrawerSection title="진료 전 확인">
              <DetailRow label="주의사항" value={context.patient.handlingCautionNote ?? "등록된 주의사항 없음"} priority />
              <DetailRow label="알레르기" value={context.patient.allergyNote ?? "등록된 알레르기 없음"} />
              <DetailRow label="환자 메모" value={context.patient.specialNote ?? "등록된 환자 메모 없음"} />
            </DrawerSection>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({ children, id }: { children: ReactNode; id: string }) {
  return <h2 id={id} className="text-base font-semibold tracking-[-0.01em]">{children}</h2>;
}

function SummaryItem({ label, multiline, value }: { label: string; multiline?: boolean; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-muted-foreground">{label}</dt><dd className={cn("mt-1 text-sm font-semibold text-[var(--emr-text-secondary)]", multiline ? "leading-5" : "truncate")}>{value}</dd></div>;
}

function SideSection({ children, title }: { children: ReactNode; title: string }) {
  return <section className="mt-6 border-t border-[var(--emr-line-hairline)] pt-6"><h2 className="text-sm font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

function SideRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="grid min-h-8 grid-cols-[1fr_2fr] items-center gap-4 text-left text-sm"><span className="flex min-w-0 items-center gap-1 whitespace-nowrap text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0">{icon}<span>{label}</span></span><span className="min-w-0 text-left font-medium text-[var(--emr-text-secondary)]">{value}</span></div>;
}

function DrawerSection({ children, title }: { children: ReactNode; title: string }) {
  return <section><h3 className="text-sm font-semibold">{title}</h3><dl className="mt-3 border-t border-[var(--emr-line-hairline)]">{children}</dl></section>;
}

function DetailRow({ label, priority, value }: { label: string; priority?: boolean; value: string }) {
  return <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 border-b border-[var(--emr-line-hairline)] py-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className={cn("m-0 font-medium text-[var(--emr-text-secondary)]", priority && "text-[var(--emr-status-warning-text)]")}>{value}</dd></div>;
}

function getPatientMetadata(context: ChartPreconsultationContext) {
  return [
    getSpeciesLabel(context.patient.species),
    context.patient.breed ?? "품종 미입력",
    getPatientAge(context),
    getSexLabel(context.patient.sex, context.patient.neutered),
  ];
}

function getPatientAge(context: ChartPreconsultationContext) {
  if (context.patient.estimatedAgeText) return context.patient.estimatedAgeText;
  if (!context.patient.birthDate) return "나이 미입력";
  const birth = new Date(`${context.patient.birthDate}T00:00:00`);
  const at = new Date(context.encounter.checkedInAt);
  let years = at.getFullYear() - birth.getFullYear();
  if (at.getMonth() < birth.getMonth() || (at.getMonth() === birth.getMonth() && at.getDate() < birth.getDate())) years -= 1;
  return `${Math.max(0, years)}세`;
}

function getVisitType(context: ChartPreconsultationContext) {
  return context.priorEncounterCount > 0 ? "재진" : "초진";
}

function getSpeciesLabel(species: string) {
  return ({ dog: "개", cat: "고양이", other: "기타" } as Record<string, string>)[species] ?? species;
}

function getSexLabel(sex: string, neutered?: boolean) {
  const label = ({ male: "수컷", female: "암컷", unknown: "미상" } as Record<string, string>)[sex] ?? sex;
  return neutered === true ? `중성화 ${label}` : label;
}

function getReceptionTypeLabel(value: "appointment" | "walk_in") {
  return value === "appointment" ? "예약" : "외래";
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(new Date(value));
}

function formatMonthDay(value: string) {
  const parts = new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" }).formatToParts(new Date(value));
  return `${parts.find((part) => part.type === "month")?.value}.${parts.find((part) => part.type === "day")?.value}`;
}

function formatHistoryDate(value: string, current: boolean) {
  const parts = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" }).formatToParts(new Date(value));
  const formatted = `${parts.find((part) => part.type === "year")?.value}.${parts.find((part) => part.type === "month")?.value}.${parts.find((part) => part.type === "day")?.value}`;
  return current ? `${formatted}(오늘)` : formatted;
}

function sameDate(a: string, b: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" });
  return formatter.format(new Date(a)) === formatter.format(new Date(b));
}

function formatOptionalNumber(value: number | undefined, unit: string, precision: number) {
  return value === undefined ? "—" : `${value.toFixed(precision)} ${unit}`;
}

function formatBloodPressure(value: ChartPreconsultationVitalMeasurement) {
  if (value.bloodPressureSystolicMmhg === undefined) return "—";
  const diastolic = value.bloodPressureDiastolicMmhg;
  return `${value.bloodPressureSystolicMmhg}${diastolic === undefined ? "" : `/${diastolic}`} mmHg`;
}

function formatDelta(current: number | undefined, previous: number | undefined, precision: number) {
  if (current === undefined || previous === undefined) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 10 ** -precision / 2) return "—";
  return `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(precision)}`;
}

function getContextErrorDescription(reason?: string) {
  if (reason === "permission_missing") return "진료 차트 조회 권한을 확인해 주세요.";
  if (reason === "encounter_unavailable") return "선택한 진료 업무를 찾을 수 없습니다.";
  return "잠시 후 다시 시도해 주세요.";
}
