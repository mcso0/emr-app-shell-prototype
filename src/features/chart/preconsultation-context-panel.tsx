"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CdsActionsRefreshCcwIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsAlertsBellIcon } from "@/components/cds-icons/alerts-and-status";
import { CdsFilesCalendarIcon, CdsFilesClockIcon } from "@/components/cds-icons/files-and-layout";
import {
  CdsMedicalActivityIcon,
  CdsMedicalClipboardCheckIcon,
  CdsMedicalHeartPulseIcon,
  CdsMedicalNotebookTextIcon,
  CdsMedicalThermometerIcon,
  CdsMedicalWeightIcon,
  CdsMedicalWindIcon,
} from "@/components/cds-icons/medical-and-domain";
import {
  CdsNavigationArrowDownIcon,
  CdsNavigationArrowUpIcon,
  CdsNavigationChevronDownIcon,
  CdsNavigationChevronUpIcon,
} from "@/components/cds-icons/navigation";
import { CdsPeopleUserIcon } from "@/components/cds-icons/people-and-places";
import { CdsUtilitiesCircleIcon, CdsUtilitiesHistoryIcon } from "@/components/cds-icons/utilities-and-misc";
import { CdsGnbPetGnbIcon } from "@/components/cds-icons/gnb";
import { AnimalPatientAvatar } from "@/components/emr/animal-patient-avatar";
import { EmrDialogShell } from "@/components/emr/dialog-shell";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupDivider,
  ButtonGroupIconButton,
  ButtonGroupPrimaryButton,
} from "@/components/ui/button-group";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  buildBloodPressureDelta,
  buildSingleVitalDelta,
  type VitalDelta,
} from "@/features/chart/vital-comparison-delta";
import {
  emptyPatientVitalWriteInput,
  hasPatientVitalValue,
  toPatientVitalWriteInput,
  type PatientVitalWriteInput,
} from "@/features/patient-vitals/patient-vital-types";
import {
  fromCanonicalVitalValue,
  getEnabledWorkspaceVitalSettings,
  toCanonicalVitalValue,
  type WorkspaceVitalKey,
  type WorkspaceVitalSettingsSnapshot,
} from "@/features/patient-vitals/workspace-vital-settings";
import { useWorkspaceVitalSettings } from "@/features/patient-vitals/use-workspace-vital-settings";
import { cn } from "@/lib/utils";

type ContextState =
  | { status: "loading" }
  | { status: "error"; reason?: string }
  | { status: "ready"; context: ChartPreconsultationContext; canWriteVitals: boolean };

type VitalDialogDraft = Record<keyof PatientVitalWriteInput, string>;
type VitalSaveResult =
  | { ok: true }
  | {
      ok: false;
      error?: string;
      fieldErrors?: Partial<Record<keyof PatientVitalWriteInput | "vitals", string>>;
    };

export function ChartPreconsultationContextPanel({
  actorHeaders,
  encounterId,
  onRequestCall,
  onReturnToQueue,
  primaryActionBusy,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  onRequestCall: () => void;
  onReturnToQueue: () => void;
  primaryActionBusy: boolean;
  workspaceId: string;
}) {
  const { snapshot: vitalSettings } = useWorkspaceVitalSettings({ actorHeaders, workspaceId });
  const [contextState, setContextState] = useState<ContextState>({ status: "loading" });
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [guardianInformationOpen, setGuardianInformationOpen] = useState(false);
  const [patientInformationOpen, setPatientInformationOpen] = useState(false);
  const [vitalDialogOpen, setVitalDialogOpen] = useState(false);
  const [vitalDialogDraft, setVitalDialogDraft] = useState<VitalDialogDraft>(() =>
    createVitalDialogDraft(undefined, vitalSettings),
  );
  const [vitalFieldErrors, setVitalFieldErrors] = useState<
    Partial<Record<keyof PatientVitalWriteInput | "vitals", string>>
  >({});
  const [vitalSaving, setVitalSaving] = useState(false);

  const loadContext = useCallback(async () => {
    setContextState({ status: "loading" });
    const result = await loadChartPreconsultationContext({
      actorHeaders,
      encounterId,
      workspaceId,
    });
    setContextState(
      result.ok
        ? { status: "ready", context: result.context, canWriteVitals: result.canWriteVitals }
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
            ? { status: "ready", context: result.context, canWriteVitals: result.canWriteVitals }
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
    return <PreconsultationLoadingState />;
  }

  if (contextState.status === "error") {
    const permissionError = isPermissionError(contextState.reason);
    return (
      <div className="flex min-h-[640px] flex-1 items-center justify-center px-6 py-10">
        <EmrEmptyState
          kind={permissionError ? "no-permission" : "read-error"}
          priority="local-recovery"
          size="lg"
          surface="content"
          title={
            permissionError
              ? "차트 정보를 볼 권한이 없어요"
              : "접수 정보를 불러오지 못했어요"
          }
          description={
            permissionError
              ? getContextErrorDescription(contextState.reason)
              : "네트워크 상태를 확인한 뒤 다시 시도해 주세요. 대기 목록의 접수 정보는 변경되지 않았어요."
          }
          secondaryAction={
            permissionError ? undefined : (
              <Button variant="outline" className="bg-card" onClick={onReturnToQueue}>
                대기 목록으로
              </Button>
            )
          }
          primaryAction={
            permissionError ? (
              <Button onClick={onReturnToQueue}>대기 목록으로</Button>
            ) : (
              <Button onClick={() => void loadContext()}>
                <CdsActionsRefreshCcwIcon data-icon="inline-start" aria-hidden="true" />
                다시 시도
              </Button>
            )
          }
          testId="preconsultation-feedback-state"
        />
      </div>
    );
  }

  const { canWriteVitals, context } = contextState;
  const currentVital = context.vitals.find(
    (measurement) => measurement.encounterId === context.encounter.id,
  );
  const openVitalDialog = () => {
    setVitalDialogDraft(createVitalDialogDraft(currentVital, vitalSettings));
    setVitalFieldErrors({});
    setVitalDialogOpen(true);
  };
  const saveVital = async () => {
    const parsed = parseVitalDialogDraft(vitalDialogDraft, vitalSettings);
    if (!parsed.ok) {
      setVitalFieldErrors(parsed.fieldErrors);
      return;
    }
    if (!currentVital && !hasPatientVitalValue(parsed.values)) {
      setVitalFieldErrors({ vitals: "새 바이탈은 한 가지 이상 입력해 주세요." });
      return;
    }

    setVitalSaving(true);
    setVitalFieldErrors({});
    const result = await saveChartPreconsultationVital({
      actorHeaders,
      encounterId,
      values: parsed.values,
      workspaceId,
    });
    setVitalSaving(false);
    if (!result.ok) {
      setVitalFieldErrors(result.fieldErrors ?? { vitals: getVitalSaveErrorMessage(result.error) });
      return;
    }

    setVitalDialogOpen(false);
    await loadContext();
  };
  return (
    <div
      className="min-h-0 flex-1 overflow-auto"
      data-testid="chart-start-locked-state"
    >
      <div className="mx-auto w-full max-w-[1024px] bg-[var(--emr-surface-panel)]">
        <PreconsultationHeader
          context={context}
          primaryActionBusy={primaryActionBusy}
          onOpenGuardianInformation={() => setGuardianInformationOpen(true)}
          onOpenPatientInformation={() => setPatientInformationOpen(true)}
          onRequestCall={onRequestCall}
        />
        <Separator className="mx-6 w-auto" />
        <main className="px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex min-w-0 flex-col gap-6">
            <ReceptionSummary context={context} />
            <SectionDivider />
            <VisitPurpose context={context} />
            <SectionDivider />
            <MemoSection context={context} />
            <SectionDivider />
            <VitalSection
              canWrite={canWriteVitals}
              context={context}
              onOpenVitalDialog={openVitalDialog}
              vitalSettings={vitalSettings}
            />
            <SectionDivider />
            <HistorySection
              context={context}
              expanded={historyExpanded}
              onToggle={() => setHistoryExpanded((current) => !current)}
            />
          </div>
        </main>
      </div>
      <PatientInformationSheet
        context={context}
        open={patientInformationOpen}
        onOpenChange={setPatientInformationOpen}
      />
      <GuardianInformationSheet
        context={context}
        open={guardianInformationOpen}
        onOpenChange={setGuardianInformationOpen}
      />
      <Dialog
        open={vitalDialogOpen}
        onOpenChange={(open) => {
          if (!vitalSaving) setVitalDialogOpen(open);
        }}
      >
        <EmrDialogShell
          variant="form"
          title={currentVital ? "오늘 바이탈 수정" : "오늘 바이탈 입력"}
          description="대기 중인 오늘 접수에만 저장됩니다. 이전 내원 값은 바뀌지 않습니다."
          footerMeta={
            currentVital
              ? "모든 값을 비우면 오늘 바이탈 행은 유지되고 값만 미표시로 바뀝니다."
              : "병원에서 사용하는 바이탈 중 실제로 측정한 항목만 입력해 주세요."
          }
          secondaryAction={
            <Button type="button" variant="outline" disabled={vitalSaving} onClick={() => setVitalDialogOpen(false)}>
              취소
            </Button>
          }
          primaryAction={
            <Button type="button" disabled={vitalSaving} onClick={() => void saveVital()}>
              {vitalSaving ? "저장 중" : "저장"}
            </Button>
          }
        >
          <VitalEntryFields
            draft={vitalDialogDraft}
            errors={vitalFieldErrors}
            onChange={(key, value) => {
              setVitalDialogDraft((current) => ({ ...current, [key]: value }));
              setVitalFieldErrors((current) => ({ ...current, [key]: undefined, vitals: undefined }));
            }}
            vitalSettings={vitalSettings}
          />
        </EmrDialogShell>
      </Dialog>
    </div>
  );
}

async function saveChartPreconsultationVital({
  actorHeaders,
  encounterId,
  values,
  workspaceId,
}: {
  actorHeaders?: Record<string, string>;
  encounterId: string;
  values: PatientVitalWriteInput;
  workspaceId: string;
}): Promise<VitalSaveResult> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/preconsultation-vitals`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", ...actorHeaders },
        body: JSON.stringify({ encounterId, vitals: values }),
      },
    );
    const body = (await response.json()) as {
      ok?: boolean;
      error?: string;
      fieldErrors?: Partial<Record<keyof PatientVitalWriteInput | "vitals", string>>;
      denialReason?: string;
    };
    if (!response.ok || !body.ok) {
      return {
        ok: false,
        error: body.denialReason ?? body.error,
        fieldErrors: body.fieldErrors,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "db_write_failed" };
  }
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

function PreconsultationLoadingState() {
  return (
    <div
      className="min-h-0 flex-1 overflow-auto"
      aria-busy="true"
      aria-label="환자 정보 불러오는 중"
      data-testid="preconsultation-loading-state"
    >
      <div className="mx-auto w-full max-w-[1024px] bg-[var(--emr-surface-panel)]">
        <div className="min-h-[204px] px-5 py-6 sm:px-6 sm:py-8">
          <Skeleton className="h-7 w-[138px] rounded-full" />
          <div className="mt-6 flex items-center gap-5 sm:mt-8">
            <Skeleton className="size-16 shrink-0 rounded-[10px] sm:size-20" />
            <div className="flex min-w-0 flex-col gap-2.5">
              <Skeleton className="h-7 w-[210px] max-w-full" />
              <Skeleton className="h-5 w-[330px] max-w-full" />
            </div>
          </div>
        </div>
        <Separator className="mx-6 w-auto" />
        <div className="flex flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8">
          {[80, 56, 56, 154, 180].map((height, index) => (
            <div className="flex flex-col gap-3.5" key={`${height}-${index}`}>
              <Skeleton className="h-[22px] w-[130px]" />
              <Skeleton className="w-full" style={{ height }} />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only" role="status">
        환자와 접수 정보를 불러오고 있어요.
      </span>
    </div>
  );
}

function PreconsultationHeader({
  context,
  onOpenGuardianInformation,
  onOpenPatientInformation,
  onRequestCall,
  primaryActionBusy,
}: {
  context: ChartPreconsultationContext;
  onOpenGuardianInformation: () => void;
  onOpenPatientInformation: () => void;
  onRequestCall: () => void;
  primaryActionBusy: boolean;
}) {
  return (
    <header
      className="min-w-0 px-5 py-6 sm:px-6 sm:py-8"
      aria-labelledby="preconsultation-patient-heading"
    >
      <div className="flex min-h-7 flex-wrap items-center gap-2.5">
        <Badge
          variant="outline"
          className="h-7 gap-1.5 rounded-full bg-[var(--emr-surface-muted)] pl-2.5 pr-3 text-sm text-[var(--emr-text-secondary)]"
        >
          <CdsUtilitiesCircleIcon className="size-[10px]" aria-hidden="true" />
          진료 대기
        </Badge>
        <Badge
          variant="outline"
          className="h-7 gap-1.5 rounded-full bg-[var(--emr-surface-muted)] px-3 text-sm text-[var(--emr-text-tertiary)]"
        >
          <span>차트번호 </span>
          <strong className="font-medium text-[var(--emr-text-secondary)]">
            {context.encounter.encounterNo}
          </strong>
        </Badge>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-5 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6">
        <PatientIdentity context={context} size="large" />
        <div className="flex shrink-0 flex-wrap items-center gap-3 lg:flex-nowrap lg:justify-end">
          <Button
            className="h-8 min-w-0 gap-1 rounded-[var(--clair-radius-atomic-8)] px-3 text-sm font-medium leading-5 tracking-[0.014em] has-data-[icon=inline-start]:!pl-3 sm:flex-none"
            variant="outline"
            size="default"
            onClick={onOpenPatientInformation}
          >
            <CdsGnbPetGnbIcon data-icon="inline-start" aria-hidden="true" />
            환자 정보
          </Button>
          <Button
            className="h-8 min-w-0 gap-1 rounded-[var(--clair-radius-atomic-8)] px-3 text-sm font-medium leading-5 tracking-[0.014em] has-data-[icon=inline-start]:!pl-3 sm:flex-none"
            variant="outline"
            size="default"
            onClick={onOpenGuardianInformation}
          >
            <CdsPeopleUserIcon data-icon="inline-start" aria-hidden="true" />
            보호자 정보
          </Button>
          <span
            aria-hidden="true"
            className="hidden h-6 w-px shrink-0 bg-[var(--clair-color-atomic-neutral-300)] lg:block"
          />
          <ButtonGroup className="ml-auto lg:ml-0">
            <ButtonGroupPrimaryButton
              className="h-8 gap-1 px-3 text-sm font-medium leading-5 tracking-[0.014em] has-data-[icon=inline-start]:!pl-3"
              disabled={primaryActionBusy}
              onClick={onRequestCall}
              type="button"
            >
              <CdsAlertsBellIcon data-icon="inline-start" aria-hidden="true" />
              호출하기
            </ButtonGroupPrimaryButton>
            <ButtonGroupDivider className="bg-white/20" />
            <ButtonGroupIconButton
              aria-label="호출하기"
              className="size-8"
              disabled={primaryActionBusy}
              onClick={onRequestCall}
              type="button"
            >
              <CdsNavigationChevronDownIcon aria-hidden="true" />
            </ButtonGroupIconButton>
          </ButtonGroup>
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
    <div className="flex min-w-0 items-center gap-4 sm:gap-6">
      <AnimalPatientAvatar
        alt={`${context.patient.name} 동물 환자 프로필`}
        className={
          size === "large"
            ? "sm:!size-[72px] sm:!border-[var(--clair-color-atomic-neutral-300)] sm:[&_svg]:!size-9"
            : undefined
        }
        size="md"
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:flex-nowrap sm:gap-y-0">
          <h1
            id={size === "large" ? "preconsultation-patient-heading" : undefined}
            className={cn(
              "font-semibold tracking-[-0.025em] text-[var(--emr-text-primary)]",
              size === "large"
                ? "text-[21px] leading-7 sm:text-[28px] sm:font-bold sm:leading-[38px] sm:tracking-[-0.024em] sm:text-[var(--clair-color-atomic-neutral-900)]"
                : "text-lg leading-6",
            )}
          >
            {context.patient.name}
          </h1>
          <span
            className={cn(
              "text-base leading-6 text-[var(--emr-text-placeholder)] sm:text-2xl sm:leading-8",
              size === "large" && "sm:font-bold sm:tracking-[-0.023em] sm:text-[var(--clair-color-atomic-neutral-400)]",
            )}
          >
            /
          </span>
          <p
            className={cn(
              "inline-flex items-baseline gap-2 text-sm font-semibold leading-5 text-[var(--emr-text-placeholder)] sm:text-2xl sm:leading-8",
              size === "large" && "sm:font-bold sm:tracking-[-0.023em] sm:text-[var(--clair-color-atomic-neutral-600)]",
            )}
          >
            {`${context.guardian?.name ?? "미지정"} 보호자`}
          </p>
        </div>
        {size === "large" ? (
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1 gap-y-0 text-sm text-[var(--emr-text-tertiary)] sm:mt-1.5 sm:text-base sm:font-semibold sm:leading-6 sm:whitespace-nowrap">
            {metadata.map((item, index) => (
              <span key={`${item}-${index}`} className="inline-flex items-baseline gap-1">
                {index > 0 ? (
                  <span className="sm:text-[var(--clair-color-atomic-neutral-400)]">·</span>
                ) : null}
                <span className="sm:text-[var(--clair-color-atomic-neutral-500)]">{item}</span>
              </span>
            ))}
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--emr-text-tertiary)] sm:mt-3 sm:text-lg sm:leading-[26px]">
            {metadata.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

function VisitPurpose({ context }: { context: ChartPreconsultationContext }) {
  const purpose = context.encounter.visitPurpose ?? context.encounter.chiefComplaint;
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-labelledby="preconsultation-visit-purpose">
      <SectionTitle id="preconsultation-visit-purpose" icon={<CdsMedicalClipboardCheckIcon />}>
        방문 목적
      </SectionTitle>
      <div className="flex min-h-[52px] min-w-0 items-center rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-line-hairline)] bg-[var(--clair-color-atomic-neutral-50)] px-4 py-3 sm:px-6 sm:py-4">
        <p className="min-w-0 text-sm font-medium leading-5 tracking-[0.014em]">
          {purpose ?? "방문 목적 미입력"}
        </p>
      </div>
    </section>
  );
}

function ReceptionSummary({ context }: { context: ChartPreconsultationContext }) {
  const items = [
    { label: "재진 여부", value: getVisitType(context), badge: "primary" as const },
    {
      label: "접수 유형",
      value: getReceptionTypeLabel(context.encounter.receptionType),
      badge: "neutral" as const,
    },
    { label: "접수 시각", value: `${formatTime(context.encounter.checkedInAt)} 접수`, icon: "clock" as const },
    { label: "예상 소요시간", value: "미입력", icon: "clock" as const },
    { label: "담당 수의사", value: context.veterinarian?.displayName ?? "미지정", avatar: true },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-labelledby="preconsultation-reception-summary">
      <SectionTitle id="preconsultation-reception-summary" icon={<CdsMedicalNotebookTextIcon />}>
        접수 정보
      </SectionTitle>
      <dl
        className="grid min-w-0 grid-cols-2 overflow-hidden rounded-[var(--clair-radius-atomic-12)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] sm:grid-cols-5"
        data-testid="preconsultation-reception-summary-grid"
      >
        {items.map((item, index) => (
          <div
            key={item.label}
            className={cn(
              "relative min-w-0 px-3 py-3.5 sm:px-6 sm:py-4",
              index === items.length - 1 && "col-span-2 sm:col-span-1",
            )}
          >
            <dt className="text-sm font-medium leading-5 text-[var(--emr-text-tertiary)]">
              {item.label}
            </dt>
            <dd className="mt-2 flex min-h-[22px] min-w-0 items-center gap-1.5 text-sm font-medium text-[var(--emr-text-primary)]">
              {item.icon ? <CdsFilesClockIcon className="size-3.5 shrink-0 text-[var(--emr-text-tertiary)]" aria-hidden="true" /> : null}
              {item.avatar ? <VeterinarianAvatar name={item.value} /> : null}
              <span
                className={cn(
                  "min-w-0 truncate",
                  item.badge && "inline-flex min-h-[22px] items-center rounded-[var(--clair-radius-atomic-6)] border px-2 py-0.5 text-xs leading-4",
                  item.badge === "primary" && "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]",
                  item.badge === "neutral" && "border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] text-[var(--emr-text-secondary)]",
                )}
              >
                {item.value}
              </span>
            </dd>
            {index < items.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute top-1/2 right-0 h-[40px] w-px -translate-y-1/2 bg-[var(--emr-line-hairline)]",
                  index % 2 === 0 ? "block" : "hidden sm:block",
                )}
                data-testid="preconsultation-reception-divider"
              />
            ) : null}
          </div>
        ))}
      </dl>
    </section>
  );
}

function MemoSection({ context }: { context: ChartPreconsultationContext }) {
  const patientMemo =
    context.patient.handlingCautionNote ??
    context.patient.specialNote ??
    context.patient.allergyNote ??
    context.encounter.receptionMemo;
  const patientCaution = Boolean(context.patient.handlingCautionNote);

  return (
    <section className="flex min-w-0 flex-col gap-4" aria-labelledby="preconsultation-memo">
      <SectionTitle id="preconsultation-memo" icon={<CdsMedicalNotebookTextIcon />}>
        환자/보호자 메모
      </SectionTitle>
      <div className="flex min-w-0 flex-col gap-3">
        <MemoCard
          caution={patientCaution}
          label="환자"
          value={patientMemo ?? "기록된 환자 주의사항이 없어요."}
        />
        <MemoCard
          label="보호자"
          value={context.guardian?.memo ?? "기록된 보호자 메모가 없어요."}
        />
      </div>
    </section>
  );
}

function MemoCard({
  caution = false,
  label,
  value,
}: {
  caution?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[54px] min-w-0 items-start gap-2.5 rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] px-4 py-3.5 sm:items-center sm:px-5 sm:py-4",
        caution &&
          "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)]",
      )}
    >
      <Badge
        className={cn(
          "h-[22px] shrink-0 rounded-[var(--clair-radius-atomic-6)] border-0 bg-[var(--clair-color-atomic-black-alpha-4)] px-2 text-xs text-[var(--emr-text-primary)]",
          caution && "bg-[var(--emr-surface-panel)] text-[var(--emr-status-warning-text)]",
        )}
        variant="secondary"
      >
        {label}
      </Badge>
      <p className="min-w-0 text-sm font-medium leading-5 tracking-[0.014em] sm:truncate">
        {value}
      </p>
    </div>
  );
}

function VitalSection({
  canWrite,
  context,
  onOpenVitalDialog,
  vitalSettings,
}: {
  canWrite: boolean;
  context: ChartPreconsultationContext;
  onOpenVitalDialog: () => void;
  vitalSettings: WorkspaceVitalSettingsSnapshot;
}) {
  const current = context.vitals.find(
    (measurement) => measurement.encounterId === context.encounter.id,
  );
  const previous = current
    ? context.vitals.find(
        (measurement) => measurement.encounterId !== context.encounter.id,
      )
    : undefined;
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-labelledby="preconsultation-vitals">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <SectionTitle id="preconsultation-vitals" icon={<CdsMedicalActivityIcon />}>
          바이탈 정보
        </SectionTitle>
        {canWrite ? (
          <Button type="button" variant="outline" size="sm" onClick={onOpenVitalDialog}>
            {current ? "오늘 바이탈 수정" : "오늘 바이탈 입력"}
          </Button>
        ) : null}
      </div>
      {current ? (
        <VitalComparison current={current} previous={previous} vitalSettings={vitalSettings} />
      ) : (
        <div className="flex min-h-[88px] items-center justify-center gap-3 rounded-[var(--clair-radius-atomic-8)] border border-dashed border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] px-4 py-4 text-sm text-muted-foreground">
          <CdsMedicalActivityIcon className="size-6 shrink-0 text-[var(--emr-text-placeholder)]" aria-hidden="true" />
          <div>
            <strong className="block text-[var(--emr-text-secondary)]">오늘 기록된 바이탈이 없어요</strong>
            <p className="mt-0.5 text-xs">오늘 접수에서 측정하면 직전 방문 값과 비교해요.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function VitalEntryFields({
  draft,
  errors,
  onChange,
  vitalSettings,
}: {
  draft: VitalDialogDraft;
  errors: Partial<Record<keyof PatientVitalWriteInput | "vitals", string>>;
  onChange: (key: keyof PatientVitalWriteInput, value: string) => void;
  vitalSettings: WorkspaceVitalSettingsSnapshot;
}) {
  const enabledSettings = getEnabledWorkspaceVitalSettings(vitalSettings);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-5 text-[var(--emr-text-tertiary)]">
        실제로 측정한 값만 입력해 주세요. 입력하지 않은 값은 표에서 미표시로 보여요.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {enabledSettings.flatMap((setting) => {
          const preset = vitalSettings.presets.find((item) => item.key === setting.key);
          if (!preset) return [];
          if (setting.key === "blood_pressure") {
            return ([
              <VitalDialogInput
                draft={draft}
                errors={errors}
                inputMode="numeric"
                inputKey="bloodPressureSystolicMmhg"
                key="bloodPressureSystolicMmhg"
                label="수축기 혈압"
                onChange={onChange}
                unit={setting.displayUnit}
              />,
              <VitalDialogInput
                draft={draft}
                errors={errors}
                inputMode="numeric"
                inputKey="bloodPressureDiastolicMmhg"
                key="bloodPressureDiastolicMmhg"
                label="이완기 혈압 (선택)"
                onChange={onChange}
                unit={setting.displayUnit}
              />,
            ]);
          }
          const inputKey = inputKeyByVitalKey[setting.key];
          if (!inputKey) return [];
          return [
            <VitalDialogInput
              draft={draft}
              errors={errors}
              inputMode={setting.key === "weight" || setting.key === "temperature" ? "decimal" : "numeric"}
              inputKey={inputKey}
              key={setting.key}
              label={preset.label}
              onChange={onChange}
              unit={setting.displayUnit}
            />,
          ];
        })}
      </div>
      {errors.vitals ? (
        <p role="alert" className="text-sm text-[var(--emr-status-danger-text)]">
          {errors.vitals}
        </p>
      ) : null}
    </div>
  );
}

function VitalDialogInput({
  draft,
  errors,
  inputKey,
  inputMode,
  label,
  onChange,
  unit,
}: {
  draft: VitalDialogDraft;
  errors: Partial<Record<keyof PatientVitalWriteInput | "vitals", string>>;
  inputKey: keyof PatientVitalWriteInput;
  inputMode: "decimal" | "numeric";
  label: string;
  onChange: (key: keyof PatientVitalWriteInput, value: string) => void;
  unit: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`preconsultation-vital-${inputKey}`}>{label}</Label>
      <div className="relative">
        <Input
          id={`preconsultation-vital-${inputKey}`}
          aria-describedby={errors[inputKey] ? `preconsultation-vital-${inputKey}-error` : undefined}
          aria-invalid={Boolean(errors[inputKey])}
          inputMode={inputMode}
          placeholder="미입력"
          value={draft[inputKey]}
          onChange={(event) => onChange(inputKey, event.target.value)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-[var(--emr-text-tertiary)]">
          {unit}
        </span>
      </div>
      {errors[inputKey] ? (
        <p id={`preconsultation-vital-${inputKey}-error`} className="text-xs text-[var(--emr-status-danger-text)]">
          {errors[inputKey]}
        </p>
      ) : null}
    </div>
  );
}

const inputKeyByVitalKey: Partial<Record<WorkspaceVitalKey, keyof PatientVitalWriteInput>> = {
  weight: "weightKg",
  temperature: "temperatureC",
  heart_rate: "heartRateBpm",
  respiratory_rate: "respiratoryRateRpm",
};

function getVitalDefinitions(settings: WorkspaceVitalSettingsSnapshot): VitalDefinition[] {
  return getEnabledWorkspaceVitalSettings(settings).flatMap<VitalDefinition>((setting) => {
    const preset = settings.presets.find((item) => item.key === setting.key);
    const label = preset?.label ?? setting.key;
    if (setting.key === "weight") {
      const convert = (value: number | undefined) => value === undefined
        ? undefined
        : fromCanonicalVitalValue("weight", value, setting.displayUnit);
      return [{
        key: setting.key,
        label,
        icon: <CdsMedicalWeightIcon className="size-4" aria-hidden="true" />,
        format: (value) => formatOptionalNumber(convert(value.weightKg), setting.displayUnit, setting.displayUnit === "g" ? 0 : 2),
        delta: (current, previous) => buildSingleVitalDelta({
          current: convert(current.weightKg),
          previous: convert(previous.weightKg),
          precision: setting.displayUnit === "g" ? 0 : 2,
          label,
        }),
      }];
    }
    if (setting.key === "temperature") {
      const convert = (value: number | undefined) => value === undefined
        ? undefined
        : fromCanonicalVitalValue("temperature", value, setting.displayUnit);
      return [{
        key: setting.key,
        label,
        icon: <CdsMedicalThermometerIcon className="size-4" aria-hidden="true" />,
        format: (value) => formatOptionalNumber(convert(value.temperatureC), setting.displayUnit, 1),
        delta: (current, previous) => buildSingleVitalDelta({
          current: convert(current.temperatureC),
          previous: convert(previous.temperatureC),
          precision: 1,
          label,
        }),
      }];
    }
    if (setting.key === "heart_rate") {
      return [{
        key: setting.key,
        label,
        icon: <CdsMedicalHeartPulseIcon className="size-4" aria-hidden="true" />,
        format: (value) => formatOptionalNumber(value.heartRateBpm, setting.displayUnit, 0),
        delta: (current, previous) => buildSingleVitalDelta({
          current: current.heartRateBpm,
          previous: previous.heartRateBpm,
          precision: 0,
          label,
        }),
      }];
    }
    if (setting.key === "respiratory_rate") {
      return [{
        key: setting.key,
        label,
        icon: <CdsMedicalWindIcon className="size-4" aria-hidden="true" />,
        format: (value) => formatOptionalNumber(value.respiratoryRateRpm, setting.displayUnit, 0),
        delta: (current, previous) => buildSingleVitalDelta({
          current: current.respiratoryRateRpm,
          previous: previous.respiratoryRateRpm,
          precision: 0,
          label,
        }),
      }];
    }
    return [{
      key: setting.key,
      label,
      icon: <CdsMedicalHeartPulseIcon className="size-4" aria-hidden="true" />,
      format: formatBloodPressure,
      delta: (current, previous) => buildBloodPressureDelta({
        current: {
          systolic: current.bloodPressureSystolicMmhg,
          diastolic: current.bloodPressureDiastolicMmhg,
        },
        previous: {
          systolic: previous.bloodPressureSystolicMmhg,
          diastolic: previous.bloodPressureDiastolicMmhg,
        },
      }),
    }];
  });
}

type VitalDefinition = {
  key: WorkspaceVitalKey;
  label: string;
  icon: ReactNode;
  format: (measurement: ChartPreconsultationVitalMeasurement) => string;
  delta: (
    current: ChartPreconsultationVitalMeasurement,
    previous: ChartPreconsultationVitalMeasurement,
  ) => VitalDelta | null;
};

function VitalComparison({
  current,
  previous,
  vitalSettings,
}: {
  current: ChartPreconsultationVitalMeasurement;
  previous?: ChartPreconsultationVitalMeasurement;
  vitalSettings: WorkspaceVitalSettingsSnapshot;
}) {
  const vitalDefinitions = getVitalDefinitions(vitalSettings);
  return (
    <div
      className="max-w-full overflow-x-auto rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)]"
      tabIndex={0}
      aria-label="환자 바이탈 표, 좁은 화면에서는 가로로 스크롤할 수 있습니다"
    >
      <table className="w-full min-w-[960px] table-fixed border-separate border-spacing-0">
        <caption className="sr-only">오늘 및 직전 방문 바이탈 비교</caption>
        <colgroup>
          <col className="w-[148px]" />
          {vitalDefinitions.map((vital) => <col key={vital.key} />)}
        </colgroup>
        <thead>
          <tr>
            <VitalHeaderCell first icon={<CdsFilesCalendarIcon />}>일자</VitalHeaderCell>
            {vitalDefinitions.map((vital) => (
              <VitalHeaderCell key={vital.key} icon={vital.icon}>
                {vital.label}
              </VitalHeaderCell>
            ))}
          </tr>
        </thead>
        <tbody>
          <VitalRow
            current
            isLast={!previous}
            measurement={current}
            previous={previous}
            vitalDefinitions={vitalDefinitions}
          />
          {previous ? (
            <VitalRow
              isLast
              measurement={previous}
              vitalDefinitions={vitalDefinitions}
            />
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function VitalHeaderCell({ children, first = false, icon }: { children: ReactNode; first?: boolean; icon: ReactNode }) {
  return (
    <th className={cn(
      "h-11 border-r border-b border-[var(--emr-line-hairline)] bg-[var(--clair-color-atomic-neutral-50)] px-4 py-2.5 text-left text-sm font-medium text-[var(--emr-text-tertiary)] last:border-r-0",
      first && "px-6",
    )}>
      <span className="inline-flex items-center gap-1.5 [&_svg]:size-3.5">{icon}{children}</span>
    </th>
  );
}

function VitalRow({
  current = false,
  isLast = false,
  measurement,
  previous,
  vitalDefinitions,
}: {
  current?: boolean;
  isLast?: boolean;
  measurement: ChartPreconsultationVitalMeasurement;
  previous?: ChartPreconsultationVitalMeasurement;
  vitalDefinitions: VitalDefinition[];
}) {
  const dateLabel = current ? "오늘" : formatFullDate(measurement.measuredAt);
  const dateDetail = current ? `(${formatShortDate(measurement.measuredAt)})` : null;

  return (
    <tr>
      <th
        className={cn(
          "h-[52px] border-r border-b border-[var(--clair-color-atomic-neutral-200)] bg-[var(--clair-color-atomic-common-100)] px-6 py-0 text-left text-sm font-medium leading-5 tracking-[0.014em] text-[var(--clair-color-atomic-neutral-800)]",
          isLast && "border-b-0",
        )}
      >
        <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
          <span>{dateLabel}</span>
          {dateDetail ? <span className="text-[var(--clair-color-atomic-neutral-500)]">{dateDetail}</span> : null}
        </span>
      </th>
      {vitalDefinitions.map((vital) => {
        const delta = current && previous ? vital.delta(measurement, previous) : null;
        return (
          <td
            key={vital.key}
            className={cn(
              "h-[52px] border-r border-b border-[var(--clair-color-atomic-neutral-200)] px-4 py-0 text-sm font-medium leading-5 tracking-[0.014em] last:border-r-0",
              isLast && "border-b-0",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span>{vital.format(measurement)}</span>
              {delta ? <VitalDeltaIndicator delta={delta} /> : null}
            </div>
          </td>
        );
      })}
    </tr>
  );
}

function VitalDeltaIndicator({ delta }: { delta: VitalDelta }) {
  return (
    <span
      role="img"
      aria-label={delta.accessibleLabel}
      className="shrink-0 text-sm"
    >
      <span
        aria-hidden="true"
        className="inline-flex items-center gap-0.5 text-[var(--emr-text-tertiary)]"
      >
        <span>(</span>
        {delta.parts.map((part, index) => (
          <span
            key={`${index}-${part.direction}`}
            className="inline-flex items-center gap-0.5"
          >
            {index > 0 ? <span>/</span> : null}
            <span
              data-direction={part.direction}
              className={cn(
                "inline-flex items-center gap-0.5",
                part.direction === "increase"
                  ? "text-[var(--emr-status-danger-text)]"
                  : part.direction === "decrease"
                    ? "text-[var(--emr-status-info-text)]"
                    : "text-[var(--emr-text-tertiary)]",
              )}
            >
              {part.direction === "increase" ? (
                <CdsNavigationArrowUpIcon className="size-3" />
              ) : part.direction === "decrease" ? (
                <CdsNavigationArrowDownIcon className="size-3" />
              ) : null}
              <span>{part.value}</span>
            </span>
          </span>
        ))}
        <span>)</span>
      </span>
    </span>
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
  const priorEntries = context.history.filter(
    (entry) => entry.encounterId !== context.encounter.id,
  );
  const hasMoreHistory = priorEntries.length > 3;
  const entries = expanded ? priorEntries : priorEntries.slice(0, 3);
  return (
    <section
      className="flex min-w-0 flex-col gap-4"
      aria-labelledby="preconsultation-history"
      data-testid="preconsultation-history"
    >
      <SectionTitle id="preconsultation-history" icon={<CdsUtilitiesHistoryIcon />}>
        과거 진료이력
      </SectionTitle>
      {entries.length > 0 ? (
        <>
          <HistoryTimeline entries={entries} />
          {hasMoreHistory ? (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="xl"
                className="h-10 gap-1.5 pl-5 pr-4 text-sm font-medium leading-5 tracking-[0.014em]"
                aria-expanded={expanded}
                onClick={onToggle}
              >
                {expanded ? "진료이력 접기" : "전체 진료이력 보기"}
                {expanded ? <CdsNavigationChevronUpIcon data-icon="inline-end" /> : <CdsNavigationChevronDownIcon data-icon="inline-end" />}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flex min-h-[88px] items-center justify-center gap-3 rounded-[var(--clair-radius-atomic-8)] border border-dashed border-[var(--emr-line-hairline)] bg-[var(--emr-surface-muted)] px-4 py-4 text-sm text-muted-foreground">
          <CdsUtilitiesHistoryIcon className="size-6 shrink-0 text-[var(--emr-text-placeholder)]" aria-hidden="true" />
          <div>
            <strong className="block text-[var(--emr-text-secondary)]">이전 진료이력이 없어요</strong>
            <p className="mt-0.5 text-xs">첫 방문 환자라 오늘 접수부터 이력이 쌓여요.</p>
          </div>
        </div>
      )}
    </section>
  );
}

function HistoryTimeline({
  entries,
}: {
  entries: ChartPreconsultationHistoryEntry[];
}) {
  const groups = groupHistoryEntries(entries);

  return (
    <ol
      className="flex min-w-0 flex-col gap-3 px-6 py-1"
      aria-label="과거 진료 이력"
      data-testid="preconsultation-history-timeline"
    >
      {groups.map((group) => (
        <li key={group.date} className="flex min-w-0 gap-2">
          <div className="flex w-[19px] shrink-0 flex-col items-center gap-2">
            <div className="flex h-6 items-center">
              <CdsFilesCalendarIcon className="size-4 shrink-0" aria-hidden="true" />
            </div>
            <div className="flex min-h-px flex-1 justify-center px-2">
              <div className="w-px bg-[var(--clair-color-atomic-neutral-300)]" />
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex h-5 items-center text-sm font-medium leading-5 tracking-[0.014em] text-[var(--emr-text-tertiary)]">
              {group.date}
            </div>
            <ol className="flex min-w-0 flex-col gap-2">
              {group.entries.map((entry) => {
                const summary = entry.visitPurpose ?? entry.chiefComplaint ?? entry.primaryDiagnosis ?? "진료 요약 미입력";
                return (
                  <li
                    key={entry.encounterId}
                    className="flex h-14 min-w-0 items-center gap-3 overflow-hidden rounded-[var(--clair-radius-atomic-8)] border border-[var(--emr-line-hairline)] bg-[var(--emr-surface-panel)] p-4"
                  >
                    <Badge
                      className="h-[22px] w-[69px] shrink-0 rounded-[var(--clair-radius-atomic-6)] border-[rgba(0,0,0,0.08)] bg-[var(--emr-surface-panel)] px-2 font-mono text-xs font-medium"
                      variant="outline"
                    >
                      {formatHistoryTime(entry.checkedInAt)}
                    </Badge>
                    <span className="min-w-0 truncate text-[15px] font-medium leading-6 tracking-[0.006em]">
                      {summary}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </li>
      ))}
    </ol>
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
          <SheetDescription>진료 전 필요한 환자 정보를 확인합니다.</SheetDescription>
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

function GuardianInformationSheet({
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
          <SheetTitle>보호자 정보</SheetTitle>
          <SheetDescription>진료 전 필요한 보호자 정보를 확인합니다.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-4 pb-6">
            <DrawerSection title="보호자 정보">
              <DetailRow label="보호자명" value={context.guardian?.name ?? "미지정"} />
              <DetailRow label="보호자 메모" value={context.guardian?.memo ?? "등록된 보호자 메모 없음"} />
            </DrawerSection>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({
  children,
  icon,
  id,
}: {
  children: ReactNode;
  icon: ReactNode;
  id: string;
}) {
  return (
    <h2
      id={id}
      className="flex min-h-6 items-center gap-1.5 text-base font-semibold leading-6 text-[var(--emr-text-secondary)] [&_svg]:size-[18px] [&_svg]:shrink-0"
    >
      {icon}
      {children}
    </h2>
  );
}

function SectionDivider() {
  return <Separator className="bg-[var(--emr-line-subtle)]" />;
}

function VeterinarianAvatar({ name }: { name: string }) {
  return (
    <Avatar
      aria-label={`${name} 담당 수의사`}
      className="size-5 rounded-[var(--clair-radius-atomic-4)]"
      role="img"
      roundness="roundrect"
      size="sm"
    >
      <AvatarFallback className="rounded-[var(--clair-radius-atomic-4)] bg-[var(--emr-surface-muted)] text-[10px] font-medium">
        {name === "미지정" ? "—" : name.slice(0, 1)}
      </AvatarFallback>
    </Avatar>
  );
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

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatFullDate(value: string) {
  const parts = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" }).formatToParts(new Date(value));
  return `${parts.find((part) => part.type === "year")?.value}.${parts.find((part) => part.type === "month")?.value}.${parts.find((part) => part.type === "day")?.value}`;
}

function formatShortDate(value: string) {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}.${month}.${day}`;
}

function groupHistoryEntries(
  entries: ChartPreconsultationHistoryEntry[],
) {
  return entries.reduce<Array<{ date: string; entries: ChartPreconsultationHistoryEntry[] }>>(
    (groups, entry) => {
      const date = formatHistoryDate(entry.checkedInAt);
      const existing = groups.find((group) => group.date === date);
      if (existing) {
        existing.entries.push(entry);
      } else {
        groups.push({ date, entries: [entry] });
      }
      return groups;
    },
    [],
  );
}

function formatHistoryDate(value: string) {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}년 ${month}월 ${day}일`;
}

function createVitalDialogDraft(
  measurement: Pick<
    ChartPreconsultationVitalMeasurement,
    | "weightKg"
    | "temperatureC"
    | "heartRateBpm"
    | "respiratoryRateRpm"
    | "bloodPressureSystolicMmhg"
    | "bloodPressureDiastolicMmhg"
  > | undefined,
  settings: WorkspaceVitalSettingsSnapshot,
): VitalDialogDraft {
  const values = toPatientVitalWriteInput(measurement);
  return Object.fromEntries(
    Object.entries(values).map(([rawKey, value]) => {
      const key = rawKey as keyof PatientVitalWriteInput;
      if (value === null) return [key, ""];
      const setting = getVitalSettingForInputKey(settings, key);
      return [key, setting ? String(fromCanonicalVitalValue(setting.key, value, setting.displayUnit)) : String(value)];
    }),
  ) as VitalDialogDraft;
}

function parseVitalDialogDraft(
  draft: VitalDialogDraft,
  settings: WorkspaceVitalSettingsSnapshot,
):
  | { ok: true; values: PatientVitalWriteInput }
  | {
      ok: false;
      fieldErrors: Partial<Record<keyof PatientVitalWriteInput | "vitals", string>>;
    } {
  const values: PatientVitalWriteInput = { ...emptyPatientVitalWriteInput };
  const fieldErrors: Partial<Record<keyof PatientVitalWriteInput | "vitals", string>> = {};

  for (const key of Object.keys(values) as (keyof PatientVitalWriteInput)[]) {
    const rawValue = draft[key].trim();
    if (!rawValue) continue;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      fieldErrors[key] = "0보다 큰 숫자를 입력해 주세요.";
      continue;
    }
    if (key === "weightKg" && !hasAtMostVitalDecimalPlaces(parsed, 2)) {
      fieldErrors[key] = "소수점 둘째 자리까지 입력해 주세요.";
      continue;
    }
    if (key === "temperatureC" && !hasAtMostVitalDecimalPlaces(parsed, 1)) {
      fieldErrors[key] = "소수점 첫째 자리까지 입력해 주세요.";
      continue;
    }
    if (
      (key === "respiratoryRateRpm" ||
        key === "heartRateBpm" ||
        key === "bloodPressureSystolicMmhg" ||
        key === "bloodPressureDiastolicMmhg") &&
      !Number.isInteger(parsed)
    ) {
      fieldErrors[key] = "정수로 입력해 주세요.";
      continue;
    }
    const setting = getVitalSettingForInputKey(settings, key);
    values[key] = setting ? toCanonicalVitalValue(setting.key, parsed, setting.displayUnit) : parsed;
  }

  const hasSystolic = values.bloodPressureSystolicMmhg !== null;
  const hasDiastolic = values.bloodPressureDiastolicMmhg !== null;
  if (!hasSystolic && hasDiastolic) {
    const message = "이완기 혈압을 입력하려면 수축기 혈압이 필요합니다.";
    fieldErrors.bloodPressureSystolicMmhg = message;
  }

  return Object.keys(fieldErrors).length
    ? { ok: false, fieldErrors }
    : { ok: true, values };
}

function getVitalSettingForInputKey(
  settings: WorkspaceVitalSettingsSnapshot,
  inputKey: keyof PatientVitalWriteInput,
) {
  const key = inputKey === "weightKg"
    ? "weight"
    : inputKey === "temperatureC"
      ? "temperature"
      : inputKey === "heartRateBpm"
        ? "heart_rate"
        : inputKey === "respiratoryRateRpm"
          ? "respiratory_rate"
          : "blood_pressure";
  return settings.items.find((item) => item.key === key);
}

function getVitalSaveErrorMessage(error?: string) {
  if (error === "stale_status") return "호출 전 대기 상태에서만 오늘 바이탈을 저장할 수 있어요.";
  if (error === "vital_value_required") return "새 바이탈은 한 가지 이상 입력해 주세요.";
  if (error === "permission_missing" || error === "vital_writer_role_required") {
    return "오늘 바이탈을 입력할 권한이 없어요.";
  }
  return "바이탈을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

function hasAtMostVitalDecimalPlaces(value: number, decimalPlaces: number) {
  const factor = 10 ** decimalPlaces;
  return Math.abs(value * factor - Math.round(value * factor)) < Number.EPSILON * factor * 8;
}

function formatOptionalNumber(value: number | undefined, unit: string, precision: number) {
  return value === undefined ? "—" : `${value.toFixed(precision)} ${unit}`;
}

function formatBloodPressure(value: ChartPreconsultationVitalMeasurement) {
  if (value.bloodPressureSystolicMmhg === undefined) return "—";
  return value.bloodPressureDiastolicMmhg === undefined
    ? `${value.bloodPressureSystolicMmhg} mmHg`
    : `${value.bloodPressureSystolicMmhg}/${value.bloodPressureDiastolicMmhg} mmHg`;
}

function getContextErrorDescription(reason?: string) {
  if (isPermissionError(reason)) return "관리자에게 차트 조회 권한을 요청해 주세요.";
  if (reason === "encounter_unavailable") return "선택한 진료 업무를 찾을 수 없습니다.";
  return "잠시 후 다시 시도해 주세요.";
}

function isPermissionError(reason?: string) {
  return [
    "unauthenticated",
    "inactive_user",
    "workspace_membership_missing",
    "workspace_membership_inactive",
    "permission_missing",
  ].includes(reason ?? "");
}
