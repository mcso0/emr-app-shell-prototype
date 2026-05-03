"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  CdsActionsListFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsFilesCalendarIcon,
  CdsFilesClockIcon,
  CdsFilesMoreHorizontalIcon,
} from "@/components/cds-icons/files-and-layout";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  EmrDateNavigator,
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrListItem,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import { ExcelFileIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  getAppointmentGuardian,
  getAppointmentPatient,
  getAppointmentVeterinarianName,
  getFilteredReceptionPatients,
  getGuardianDisplay,
  getPatientDisplayAge,
  getReceptionPatientSummaries,
  getSpeciesLabel,
  getTodayAppointments,
  type ReceptionDraftCheckIn,
  type ReceptionPatientSummary,
} from "@/features/reception/data";
import {
  GuardianProfileDrawer,
  NewGuardianButton,
  NewPatientButton,
  PatientProfileDrawer,
} from "@/features/reception/profile-drawer";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import { useReceptionStore } from "@/features/reception/store";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { cn } from "@/lib/utils";
import { getMockPatientBundle, mockStaffUsers } from "@/mocks/emr-domain";
import { useLayoutStore } from "@/stores/layout-store";
import type { Appointment, Encounter, Guardian, Patient } from "@/types/emr-domain";
import type { ShellComponentProps } from "@/types/emr";

const defaultVeterinarian = mockStaffUsers.find((user) => user.role === "veterinarian");
const todayWorkingVeterinarians = mockStaffUsers.filter((user) => user.role === "veterinarian");
const calendarViewItems = [
  { value: "day" as const, label: "일" },
  { value: "week" as const, label: "주" },
  { value: "month" as const, label: "월" },
];
const receptionQueueTabItems = [
  { value: "all" as const, label: "전체" },
  { value: "reception" as const, label: "접수" },
  { value: "appointment" as const, label: "예약" },
];
const dayScheduleStartHour = 8;
const dayScheduleEndHour = 20;
const dayBusinessOpenHour = 9;
const dayBusinessCloseHour = 19;
const dayScheduleHourRowHeight = 112;
const dayCurrentTimeMinutes = 11 * 60 + 20;
const dayScheduleHours = Array.from(
  { length: dayScheduleEndHour - dayScheduleStartHour },
  (_, index) => dayScheduleStartHour + index
);
const dayScheduleHourLabels = Array.from(
  { length: dayScheduleEndHour - dayScheduleStartHour + 1 },
  (_, index) => dayScheduleStartHour + index
);
const weekDays = [
  { label: "월", day: "27" },
  { label: "화", day: "28" },
  { label: "수", day: "29" },
  { label: "목", day: "30" },
  { label: "금", day: "01", active: true },
  { label: "토", day: "02" },
  { label: "일", day: "03" },
];
const monthDays = Array.from({ length: 35 }, (_, index) => index + 1);

type ReceptionCalendarView = (typeof calendarViewItems)[number]["value"];
type ReceptionSideListMode = (typeof receptionQueueTabItems)[number]["value"];
type TodayWorkingVeterinarian = (typeof todayWorkingVeterinarians)[number];
const unassignedVeterinarianValue = "unassigned";
const defaultWalkInDepartment = "영상의학과 · 방사선종양학과";
const defaultWalkInDuration = "30분";

const getShortTime = (dateTime?: string) => {
  if (!dateTime) return "-";

  return dateTime.slice(11, 16);
};

const getShortDate = (dateTime?: string) => {
  if (!dateTime) return "-";

  return dateTime.slice(2, 10).replaceAll("-", ".");
};

const getAppointmentHour = (appointment: Appointment) =>
  Number(appointment.scheduledStartAt.slice(11, 13));

const getScheduleHourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

const getBusinessHoursLabel = () =>
  `영업시간 ${getScheduleHourLabel(dayBusinessOpenHour)}-${getScheduleHourLabel(dayBusinessCloseHour)}`;

const isBusinessHourRow = (hour: number) =>
  hour >= dayBusinessOpenHour && hour < dayBusinessCloseHour;

const getDayCurrentTimeOffset = () => {
  const openMinutes = dayScheduleStartHour * 60;
  const closeMinutes = dayScheduleEndHour * 60;
  const boundedMinutes = Math.min(
    Math.max(dayCurrentTimeMinutes, openMinutes),
    closeMinutes
  );

  return Math.round(((boundedMinutes - openMinutes) / 60) * dayScheduleHourRowHeight);
};

const getAppointmentDurationLabel = (appointment: Appointment) => {
  if (!appointment.scheduledEndAt) return "20분";

  const start = new Date(appointment.scheduledStartAt).getTime();
  const end = new Date(appointment.scheduledEndAt).getTime();
  const minutes = Math.max(10, Math.round((end - start) / 60000));

  return `${minutes}분`;
};

const getStaffDisplayName = (userId?: string) =>
  userId ? mockStaffUsers.find((user) => user.id === userId)?.name : undefined;

const getReceptionEncounterStatusLabel = (status: Encounter["status"]) =>
  status === "waiting" ? "진료대기" : getStatusLabel("encounter", status);

const getDurationMinutesFromLabel = (label: string) => {
  const minutes = Number(label.replace("분", ""));

  return Number.isFinite(minutes) ? minutes : undefined;
};

const getReceptionVisitReason = ({
  appointment,
  encounter,
  patientSpecialNote,
}: {
  appointment?: Appointment;
  encounter?: Encounter;
  patientSpecialNote?: string;
}) =>
  encounter?.chiefComplaint ??
  appointment?.symptomNote ??
  appointment?.visitPurpose ??
  patientSpecialNote ??
  "내원 목적 확인";

const getReceptionVisitSummary = ({
  appointment,
  encounter,
}: {
  appointment?: Appointment;
  encounter?: Encounter;
}) => {
  const checkedInAt = encounter?.checkedInAt ? `${getShortTime(encounter.checkedInAt)} 접수` : null;
  const appointmentAt = appointment?.scheduledStartAt
    ? `${getShortTime(appointment.scheduledStartAt)} 예약`
    : null;
  const veterinarianName =
    getStaffDisplayName(encounter?.primaryVeterinarianId) ??
    getStaffDisplayName(appointment?.assignedVeterinarianId) ??
    "담당의 미지정";
  const encounterNo = encounter?.encounterNo ?? "encounter 생성 전";

  return [checkedInAt ?? appointmentAt, veterinarianName, encounterNo].filter(Boolean).join(" · ");
};

const findScenarioEncounter = (
  encounters: Encounter[] | undefined,
  encounterId?: string | null
) => {
  if (!encounters?.length) return undefined;

  return (
    encounters.find((encounter) => encounter.id === encounterId) ??
    encounters.find((encounter) =>
      ["waiting", "in_consultation", "ordered", "ready_for_billing"].includes(encounter.status)
    ) ??
    encounters[0]
  );
};

function ReceptionStatusBadge({
  className,
  label,
  tone = "default",
}: {
  className?: string;
  label: string;
  tone?: "default" | "green" | "orange" | "sky" | "red";
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 rounded-lg px-2 py-0.5 text-[12px] font-medium leading-4",
        tone === "green" &&
          "border-[var(--clair-color-atomic-green-200)] bg-[var(--clair-color-atomic-green-50)] text-[var(--clair-color-atomic-green-600)]",
        tone === "orange" &&
          "border-[var(--clair-color-atomic-orange-200)] bg-[var(--clair-color-atomic-orange-50)] text-[var(--clair-color-atomic-orange-600)]",
        tone === "sky" &&
          "border-[var(--clair-color-atomic-sky-100)] bg-[var(--clair-color-atomic-sky-50)] text-[var(--clair-color-primary-normal)]",
        tone === "red" &&
          "border-[var(--clair-color-atomic-red-200)] bg-[var(--clair-color-atomic-red-50)] text-[var(--clair-color-atomic-red-600)]",
        tone === "default" && "border-border bg-card text-[var(--clair-color-label-normal)]",
        className
      )}
    >
      {label}
    </Badge>
  );
}

const getEncounterTone = (status: Encounter["status"]) => {
  if (status === "completed") return "green";
  if (status === "cancelled") return "red";
  if (status === "ordered" || status === "in_consultation" || status === "ready_for_billing") {
    return "sky";
  }

  return "default";
};

const getAppointmentTone = (status: Appointment["status"]) => {
  if (status === "checked_in") return "green";
  if (status === "confirmed") return "sky";
  if (status === "no_show" || status === "cancelled") return "red";
  if (status === "changed") return "orange";

  return "default";
};

function PatientCard({
  selected,
  summary,
  onSelect,
}: {
  selected: boolean;
  summary: ReceptionPatientSummary;
  onSelect: () => void;
}) {
  const appointmentLabel = summary.latestAppointment
    ? getStatusLabel("appointment", summary.latestAppointment.status)
    : "예약없음";
  const statusBadge = summary.activeEncounter ? (
    <ReceptionStatusBadge
      label={getReceptionEncounterStatusLabel(summary.activeEncounter.status)}
      tone={getEncounterTone(summary.activeEncounter.status)}
    />
  ) : (
    <ReceptionStatusBadge label={appointmentLabel} tone="default" />
  );
  const visitText =
    [
      summary.activeEncounter?.chiefComplaint ??
        summary.latestAppointment?.symptomNote ??
        summary.latestAppointment?.visitPurpose ??
        "접수할 내원 목적을 확인해 주세요.",
      summary.activeDraftCheckIn?.memo,
    ]
      .filter(Boolean)
      .join(" · ");
  const timeText = summary.activeEncounter?.checkedInAt
    ? `${getShortTime(summary.activeEncounter.checkedInAt)} 접수`
    : summary.latestAppointment
      ? `${getShortTime(summary.latestAppointment.scheduledStartAt)} 예약`
      : "예약 없음";

  return (
    <div data-testid={`patient-card-${summary.patient.id}`}>
      <EmrListItem
        selected={selected}
        variant="outline"
        title={`${summary.patient.name} · ${summary.patient.patientNo}`}
        subtitle={`${getGuardianDisplay(summary.primaryGuardian)} · ${summary.patient.breed ?? "품종 미상"}`}
        meta={visitText}
        itemBadge={
          <div className="flex items-center gap-1.5">
            {statusBadge}
            <CdsFilesMoreHorizontalIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>
        }
        footer={
          <>
            <span className="truncate">{timeText}</span>
            <span className="shrink-0">
              {summary.veterinarianName ?? "담당의 미지정"} · {getSpeciesLabel(summary.patient)} ·{" "}
              {getPatientDisplayAge(summary.patient)}
            </span>
          </>
        }
        onSelect={onSelect}
      />
    </div>
  );
}

export function ReceptionSidePanel({ moduleLabel }: ShellComponentProps) {
  const searchParams = useSearchParams();
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const [listMode, setListMode] = useState<ReceptionSideListMode>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchQuery = useReceptionStore((state) => state.searchQuery);
  const selectedPatientId = useReceptionStore((state) => state.selectedPatientId);
  const selectPatient = useReceptionStore((state) => state.selectPatient);
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const setSearchQuery = useReceptionStore((state) => state.setSearchQuery);
  const scenario = getDemoScenarioFromParams(searchParams);
  const querySelectedPatientId = searchParams.get("patientId") ?? scenario?.patientId;
  const patientSummaries = useMemo(
    () => getReceptionPatientSummaries(draftCheckIns, { guardians, patientGuardians, patients }),
    [draftCheckIns, guardians, patientGuardians, patients]
  );
  const filteredPatients = useMemo(
    () => getFilteredReceptionPatients(patientSummaries, searchQuery),
    [patientSummaries, searchQuery]
  );
  const visiblePatients = useMemo(
    () => getReceptionSideListItems(filteredPatients, listMode, querySelectedPatientId ?? selectedPatientId),
    [filteredPatients, listMode, querySelectedPatientId, selectedPatientId]
  );
  const sideListLabel =
    receptionQueueTabItems.find((item) => item.value === listMode)?.label ?? "전체";
  const sideListCount = visiblePatients.length;

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title={moduleLabel}
        collapseLabel="사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
        tabs={
          <SegmentedControl
            aria-label="접수 목록 유형"
            className="shrink-0"
            items={receptionQueueTabItems}
            value={listMode}
            variant="tabs"
            onValueChange={setListMode}
          />
        }
      />
      <EmrListHeader
        label={sideListLabel}
        count={sideListCount}
        headerActions={
          <>
            <EmrListHeaderIconButton ariaLabel="정렬">
              <CdsUtilitiesSortIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton ariaLabel="필터">
              <CdsActionsListFilterIcon className="size-4" />
            </EmrListHeaderIconButton>
            <EmrListHeaderIconButton
              ariaLabel="검색"
              onClick={() => setSearchOpen((current) => !current)}
            >
              <CdsActionsSearchIcon className="size-4" />
            </EmrListHeaderIconButton>
          </>
        }
      />
      {searchOpen || searchQuery ? (
        <div className="px-4 pb-3">
          <div className="relative">
            <CdsActionsSearchIcon
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label="환자 검색"
              className="pl-8"
              placeholder="환자, 보호자, 전화번호 검색"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
        </div>
      ) : null}
      <EmrSubpanelBody>
        {visiblePatients.length ? (
          visiblePatients.map((summary) => (
            <PatientCard
              key={summary.patient.id}
              summary={summary}
              selected={summary.patient.id === (querySelectedPatientId ?? selectedPatientId)}
              onSelect={() => {
                selectPatient(summary.patient.id);
                setActiveDrawer({ type: "reception-patient", id: summary.patient.id });
              }}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed bg-card p-4 text-[13px] text-muted-foreground">
            검색 결과가 없습니다.
          </div>
        )}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

function getReceptionSideListItems(
  summaries: ReceptionPatientSummary[],
  mode: ReceptionSideListMode,
  preferredPatientId?: string
) {
  const prioritizePreferredPatient = (items: ReceptionPatientSummary[]) => {
    if (!preferredPatientId) return items;

    return [...items].sort((a, b) => {
      if (a.patient.id === preferredPatientId) return -1;
      if (b.patient.id === preferredPatientId) return 1;
      return 0;
    });
  };

  if (mode === "reception") {
    return prioritizePreferredPatient(summaries.filter((summary) => Boolean(summary.activeEncounter)));
  }

  if (mode === "appointment") {
    return prioritizePreferredPatient(
      summaries.filter(
        (summary) => !summary.activeEncounter && summary.latestAppointment?.status === "confirmed"
      )
    );
  }

  return prioritizePreferredPatient(summaries);
}

function ScheduleAppointmentCard({
  appointment,
  onCheckIn,
  onSelect,
  selected,
}: {
  appointment: Appointment;
  onCheckIn: () => void;
  onSelect: () => void;
  selected: boolean;
}) {
  const patient = getAppointmentPatient(appointment);
  const guardian = getAppointmentGuardian(appointment);
  const canCheckIn = appointment.status === "confirmed";

  return (
    <div
      className={cn(
        "min-w-[180px] flex-1 rounded-md border border-[var(--clair-color-atomic-sky-200)] bg-[var(--clair-color-atomic-sky-50)] p-2 shadow-[0_1px_0_rgba(15,23,42,0.03)]",
        appointment.status === "checked_in" &&
          "border-[var(--clair-color-atomic-green-200)] bg-[var(--clair-color-atomic-green-50)]",
        appointment.status === "no_show" &&
          "border-[var(--clair-color-atomic-red-200)] bg-[var(--clair-color-atomic-red-50)]",
        selected && "ring-2 ring-[var(--clair-color-primary-normal)]"
      )}
      data-testid={`appointment-card-${appointment.id}`}
    >
      <button type="button" className="block w-full text-left outline-none" onClick={onSelect}>
        <div className="flex items-center gap-1.5">
          <ReceptionStatusBadge
            className="h-5 rounded-md px-1.5 text-[11px]"
            label={getStatusLabel("appointment", appointment.status)}
            tone={getAppointmentTone(appointment.status)}
          />
          <span className="truncate text-[12px] font-semibold leading-4">
            {patient?.name ?? "환자 미지정"} · {appointment.visitPurpose ?? "내원"}
          </span>
        </div>
        <div className="mt-1 truncate text-[11px] leading-4 text-[var(--clair-color-label-normal)]">
          {getShortTime(appointment.scheduledStartAt)} · {getAppointmentDurationLabel(appointment)} ·{" "}
          {getGuardianDisplay(guardian)}
        </div>
        {appointment.symptomNote ? (
          <div className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
            {appointment.symptomNote}
          </div>
        ) : null}
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">
          {getAppointmentVeterinarianName(appointment)}
        </span>
        <Button
          size="sm"
          className="h-7 px-2 text-[12px]"
          variant={canCheckIn ? "default" : "outline"}
          disabled={!canCheckIn}
          onClick={onCheckIn}
        >
          접수 처리
        </Button>
      </div>
    </div>
  );
}

function ScheduleWalkInQueueCard({
  draft,
  onSelectPatient,
}: {
  draft: ReceptionDraftCheckIn;
  onSelectPatient: (patientId: string) => void;
}) {
  const bundle = getMockPatientBundle(draft.encounter.patientId);
  const patient = bundle?.patient;
  const guardian = bundle?.primaryGuardian;
  const veterinarianName = getStaffDisplayName(draft.encounter.primaryVeterinarianId);
  const durationLabel = draft.durationMinutes ? `${draft.durationMinutes}분` : defaultWalkInDuration;

  return (
    <div
      className="min-w-[180px] flex-1 rounded-md border border-[var(--clair-color-atomic-green-200)] bg-[var(--clair-color-atomic-green-50)] p-2 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
      data-testid={`walkin-card-${draft.encounter.id}`}
    >
      <button
        type="button"
        className="block w-full text-left outline-none"
        onClick={() => onSelectPatient(draft.encounter.patientId)}
      >
        <div className="flex items-center gap-1.5">
          <ReceptionStatusBadge
            className="h-5 rounded-md px-1.5 text-[11px]"
            label={getReceptionEncounterStatusLabel(draft.encounter.status)}
            tone={getEncounterTone(draft.encounter.status)}
          />
          <span className="truncate text-[12px] font-semibold leading-4">
            {patient?.name ?? "환자 미지정"} · {draft.encounter.chiefComplaint ?? "현장 접수"}
          </span>
        </div>
        <div className="mt-1 truncate text-[11px] leading-4 text-[var(--clair-color-label-normal)]">
          {getShortTime(draft.encounter.checkedInAt)} · {durationLabel} ·{" "}
          {getGuardianDisplay(guardian)}
        </div>
        <div className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
          {draft.department ?? defaultWalkInDepartment}
          {draft.memo ? ` · ${draft.memo}` : ""}
        </div>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">
          {veterinarianName ?? "담당의 미지정"}
        </span>
      </div>
    </div>
  );
}

function ScheduleToolbar({
  onCreateWalkIn,
  onToggleVeterinarian,
  selectedVeterinarianIds,
  view,
  onViewChange,
}: {
  onCreateWalkIn: () => void;
  onToggleVeterinarian: (veterinarianId: string) => void;
  selectedVeterinarianIds: string[];
  view: ReceptionCalendarView;
  onViewChange: (view: ReceptionCalendarView) => void;
}) {
  const selectedVeterinarians = todayWorkingVeterinarians.filter((veterinarian) =>
    selectedVeterinarianIds.includes(veterinarian.id)
  );
  const veterinarianLabel =
    selectedVeterinarians.length === 1
      ? selectedVeterinarians[0]?.name
      : `수의사 ${selectedVeterinarians.length}`;

  return (
    <div className="flex min-h-[68px] shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <EmrDateNavigator
          className="h-auto min-w-[220px] max-w-[320px] px-0"
          dateLabel="26.05.01 (금)"
          todayLabel="오늘"
        />
        <span className="rounded-md bg-[var(--clair-color-atomic-gray-50)] px-2 py-1 text-[12px] font-medium leading-4 text-muted-foreground">
          {getBusinessHoursLabel()}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className:
                "min-w-[124px] justify-start border-[var(--clair-color-line-normal)] bg-card text-[var(--clair-color-label-strong)] shadow-[0_1px_0_rgba(15,23,42,0.03)] hover:bg-[var(--clair-color-background-surface)] aria-expanded:bg-[var(--clair-color-background-surface)]",
            })}
          >
            <CdsActionsSearchIcon data-icon="inline-start" />
            {veterinarianLabel}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
              오늘 근무 수의사
            </div>
            <DropdownMenuSeparator />
            {todayWorkingVeterinarians.map((veterinarian) => (
              <DropdownMenuCheckboxItem
                key={veterinarian.id}
                checked={selectedVeterinarianIds.includes(veterinarian.id)}
                onCheckedChange={() => onToggleVeterinarian(veterinarian.id)}
              >
                <span className="truncate">{veterinarian.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <SegmentedControl
          aria-label="접수 캘린더 보기"
          items={calendarViewItems}
          value={view}
          variant="tabs"
          onValueChange={onViewChange}
        />
        <div
          aria-hidden="true"
          className="h-4 w-px shrink-0 bg-[var(--clair-color-line-normal)]"
        />
        <NewPatientButton label="환자 등록" variant="text" />
        <NewGuardianButton label="보호자 등록" />
        <Button
          data-testid="schedule-check-in-button"
          size="sm"
          className="h-8 rounded-md px-3 text-[12px] font-semibold"
          onClick={onCreateWalkIn}
        >
          <CdsActionsPlusIcon data-icon="inline-start" />
          접수
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="더보기"
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <CdsFilesMoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem className="h-8 cursor-pointer">
              <ExcelFileIcon className="size-4" />
              Excel 다운로드
            </DropdownMenuItem>
            <DropdownMenuItem className="h-8 cursor-pointer">
              <ExcelFileIcon className="size-4" />
              Excel 업로드
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function ReceptionVisitContextBanner({
  appointment,
  encounter,
  guardianName,
  patientName,
  patientNo,
  reason,
}: {
  appointment?: Appointment;
  encounter?: Encounter;
  guardianName?: string;
  patientName: string;
  patientNo: string;
  reason: string;
}) {
  const statusLabel = encounter
    ? getReceptionEncounterStatusLabel(encounter.status)
    : appointment
      ? getStatusLabel("appointment", appointment.status)
      : "선택";
  const statusTone = encounter
    ? getEncounterTone(encounter.status)
    : appointment
      ? getAppointmentTone(appointment.status)
      : "default";
  const summary = getReceptionVisitSummary({ appointment, encounter });

  return (
    <section className="border-b bg-[var(--clair-color-atomic-sky-50)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ReceptionStatusBadge label={statusLabel} tone={statusTone} />
            <h2 className="truncate text-[15px] font-semibold text-[var(--clair-color-label-strong)]">
              오늘 내원: {reason}
            </h2>
          </div>
          <div className="mt-1 text-[12px] text-[var(--clair-color-label-normal)]">
            {guardianName ?? "보호자 미지정"} 보호자 · {patientName}({patientNo}) · {summary}
          </div>
        </div>
        <div className="rounded-md border border-[var(--clair-color-atomic-sky-100)] bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          session-only demo context
        </div>
      </div>
    </section>
  );
}

function DayScheduleBoard({
  appointments,
  draftCheckIns,
  onCheckIn,
  onSelectPatient,
  onSelectAppointment,
  selectedAppointmentId,
  selectedVeterinarians,
}: {
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  onCheckIn: (appointment: Appointment) => void;
  onSelectPatient: (patientId: string) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  selectedAppointmentId?: Appointment["id"];
  selectedVeterinarians: TodayWorkingVeterinarian[];
}) {
  const dayScheduleHeight = dayScheduleHours.length * dayScheduleHourRowHeight;
  const currentTimeOffset = getDayCurrentTimeOffset();
  const scheduleGridTemplateColumns = `56px repeat(${selectedVeterinarians.length}, minmax(180px, 1fr))`;
  const walkInDrafts = draftCheckIns.filter((draft) => draft.receptionType === "walk_in");
  const unassignedWalkIns = walkInDrafts.filter(
    (draft) => !draft.encounter.primaryVeterinarianId
  );

  return (
    <div className="flex min-h-[720px] flex-col bg-card" data-testid="reception-day-calendar">
      <div
        className="sticky top-0 z-30 grid border-b bg-card shadow-[0_1px_0_var(--border)]"
        style={{ gridTemplateColumns: scheduleGridTemplateColumns }}
      >
        <div className="border-r" />
        {selectedVeterinarians.map((veterinarian) => {
          const laneAppointments = appointments.filter(
            (appointment) => appointment.assignedVeterinarianId === veterinarian.id
          );

          return (
            <div key={veterinarian.id} className="border-r p-2 last:border-r-0">
              <div className="flex h-12 items-center rounded-md bg-[var(--clair-color-primary-normal)] px-3 text-[13px] font-semibold text-white">
                {veterinarian.name}
              </div>
              <div className="mt-1 flex flex-col gap-1">
                {laneAppointments.slice(0, 2).map((appointment) => (
                  <button
                    key={`all-day-${veterinarian.id}-${appointment.id}`}
                    type="button"
                    className="truncate rounded border border-[var(--clair-color-atomic-sky-200)] bg-[var(--clair-color-atomic-sky-50)] px-2 py-0.5 text-left text-[11px] font-medium text-[var(--clair-color-primary-normal)]"
                    onClick={() => onSelectAppointment(appointment)}
                  >
                    예약 {getAppointmentPatient(appointment)?.name ?? "환자"} ·{" "}
                    {appointment.visitPurpose ?? "내원"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {unassignedWalkIns.length ? (
        <div className="flex gap-2 border-b bg-[var(--clair-color-atomic-gray-50)]/70 p-2">
          <div className="flex w-14 shrink-0 items-center justify-center text-[11px] font-medium text-muted-foreground">
            미지정
          </div>
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {unassignedWalkIns.map((draft) => (
              <ScheduleWalkInQueueCard
                key={draft.encounter.id}
                draft={draft}
                onSelectPatient={onSelectPatient}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div
        className="relative grid flex-1"
        style={{ gridTemplateColumns: scheduleGridTemplateColumns }}
      >
        <div
          className="relative border-r bg-card"
          style={{ minHeight: dayScheduleHeight }}
        >
          {dayScheduleHours.map((hour, index) =>
            isBusinessHourRow(hour) ? null : (
              <div
                key={`off-hour-label-${hour}`}
                className="absolute left-0 right-0 bg-[var(--clair-color-atomic-gray-50)]/70"
                style={{
                  top: index * dayScheduleHourRowHeight,
                  height: dayScheduleHourRowHeight,
                }}
              />
            )
          )}
          {dayScheduleHourLabels.map((hour, index) => (
            <div
              key={hour}
              className="absolute left-0 right-0 flex justify-center text-[11px] text-muted-foreground"
              style={{
                top:
                  index === dayScheduleHourLabels.length - 1
                    ? index * dayScheduleHourRowHeight - 14
                    : index * dayScheduleHourRowHeight + 8,
              }}
            >
              {getScheduleHourLabel(hour)}
            </div>
          ))}
        </div>
        <div className="relative col-span-full col-start-2 min-w-0">
          <div
            className="absolute -left-1 right-0 z-10 flex items-center"
            style={{ top: currentTimeOffset }}
          >
            <span className="size-2 rounded-full bg-[var(--clair-color-atomic-red-400)]" />
            <span className="h-px flex-1 bg-[var(--clair-color-atomic-red-300)]" />
          </div>
          {dayScheduleHours.map((hour) => {
            return (
              <div
                key={hour}
                className={cn(
                  "grid border-b",
                  !isBusinessHourRow(hour) && "bg-[var(--clair-color-atomic-gray-50)]/70"
                )}
                style={{
                  gridTemplateColumns: `repeat(${selectedVeterinarians.length}, minmax(180px, 1fr))`,
                  minHeight: dayScheduleHourRowHeight,
                }}
              >
                {selectedVeterinarians.map((veterinarian) => {
                  const hourAppointments = appointments.filter(
                    (appointment) =>
                      appointment.assignedVeterinarianId === veterinarian.id &&
                      getAppointmentHour(appointment) === hour
                  );
                  const hourWalkIns = walkInDrafts.filter(
                    (draft) =>
                      draft.encounter.primaryVeterinarianId === veterinarian.id &&
                      Number((draft.encounter.checkedInAt ?? draft.encounter.createdAt).slice(11, 13)) ===
                        hour
                  );

                  return (
                    <div key={`${hour}-${veterinarian.id}`} className="flex min-w-0 gap-2 border-r p-2 last:border-r-0">
                      {hourAppointments.length || hourWalkIns.length ? (
                        <>
                          {hourAppointments.map((appointment) => (
                          <ScheduleAppointmentCard
                            key={appointment.id}
                            appointment={appointment}
                            selected={appointment.id === selectedAppointmentId}
                            onSelect={() => onSelectAppointment(appointment)}
                            onCheckIn={() => onCheckIn(appointment)}
                          />
                          ))}
                          {hourWalkIns.map((draft) => (
                            <ScheduleWalkInQueueCard
                              key={draft.encounter.id}
                              draft={draft}
                              onSelectPatient={onSelectPatient}
                            />
                          ))}
                        </>
                      ) : (
                        <div className="min-h-12 flex-1 rounded-md border border-dashed border-transparent" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeekScheduleBoard({
  appointments,
  onCheckIn,
  onSelectAppointment,
  selectedAppointmentId,
}: {
  appointments: Appointment[];
  onCheckIn: (appointment: Appointment) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  selectedAppointmentId?: Appointment["id"];
}) {
  return (
    <div className="grid min-h-[720px] grid-cols-7 bg-card" data-testid="reception-week-calendar">
      {weekDays.map((day) => (
        <div
          key={`${day.label}-${day.day}`}
          className={cn("min-w-0 border-r last:border-r-0", day.active && "bg-[var(--clair-color-atomic-sky-50)]/40")}
        >
          <div className="flex h-16 flex-col items-center justify-center border-b bg-card">
            <span className="text-[11px] text-muted-foreground">{day.label}</span>
            <span
              className={cn(
                "mt-1 flex size-7 items-center justify-center rounded-full text-[14px] font-semibold",
                day.active && "bg-[var(--clair-color-primary-normal)] text-white"
              )}
            >
              {day.day}
            </span>
          </div>
          <div className="flex min-h-[620px] flex-col gap-2 p-2">
            {(day.active ? appointments : appointments.slice(0, 1)).map((appointment) => (
              <ScheduleAppointmentCard
                key={`${day.day}-${appointment.id}`}
                appointment={appointment}
                selected={Boolean(day.active && appointment.id === selectedAppointmentId)}
                onSelect={() => onSelectAppointment(appointment)}
                onCheckIn={() => onCheckIn(appointment)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthScheduleBoard({ appointmentCount }: { appointmentCount: number }) {
  return (
    <div className="grid min-h-[720px] grid-cols-7 bg-card" data-testid="reception-month-calendar">
      {monthDays.map((day) => (
        <div
          key={day}
          className={cn(
            "min-h-32 border-b border-r p-3 last:border-r-0",
            day === 1 && "bg-[var(--clair-color-atomic-sky-50)]/50"
          )}
        >
          <div className="text-[13px] font-semibold">{day}</div>
          <div className="mt-3 space-y-1 text-[12px] leading-5 text-[var(--clair-color-label-normal)]">
            <div>진료 0건</div>
            <div>예약 {day === 1 ? appointmentCount : 1}건</div>
            <div>행사 0건</div>
            <div>휴무 0건</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReceptionScheduleBoard({
  appointments,
  draftCheckIns,
  onCheckIn,
  onSelectPatient,
  onSelectAppointment,
  selectedAppointmentId,
  selectedVeterinarians,
  view,
}: {
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  onCheckIn: (appointment: Appointment) => void;
  onSelectPatient: (patientId: string) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  selectedAppointmentId?: Appointment["id"];
  selectedVeterinarians: TodayWorkingVeterinarian[];
  view: ReceptionCalendarView;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden p-3">
      <section className="min-h-0 min-w-0 overflow-hidden rounded-lg border bg-card">
        <ScrollArea className="h-full">
          {view === "day" ? (
            <DayScheduleBoard
              appointments={appointments}
              draftCheckIns={draftCheckIns}
              selectedAppointmentId={selectedAppointmentId}
              selectedVeterinarians={selectedVeterinarians}
              onSelectAppointment={onSelectAppointment}
              onSelectPatient={onSelectPatient}
              onCheckIn={onCheckIn}
            />
          ) : null}
          {view === "week" ? (
            <WeekScheduleBoard
              appointments={appointments}
              selectedAppointmentId={selectedAppointmentId}
              onSelectAppointment={onSelectAppointment}
              onCheckIn={onCheckIn}
            />
          ) : null}
          {view === "month" ? (
            <MonthScheduleBoard appointmentCount={appointments.length} />
          ) : null}
        </ScrollArea>
      </section>
    </div>
  );
}

export function ReceptionContent() {
  const searchParams = useSearchParams();
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const [calendarView, setCalendarView] = useState<ReceptionCalendarView>("day");
  const [selectedVeterinarianIds, setSelectedVeterinarianIds] = useState(() =>
    todayWorkingVeterinarians.map((veterinarian) => veterinarian.id)
  );
  const selectedAppointmentId = useReceptionStore((state) => state.selectedAppointmentId);
  const selectedEncounterId = useReceptionStore((state) => state.selectedEncounterId);
  const selectedPatientId = useReceptionStore((state) => state.selectedPatientId);
  const checkInAppointment = useReceptionStore((state) => state.checkInAppointment);
  const selectAppointment = useReceptionStore((state) => state.selectAppointment);
  const selectEncounter = useReceptionStore((state) => state.selectEncounter);
  const selectPatient = useReceptionStore((state) => state.selectPatient);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryPatientId = searchParams.get("patientId") ?? scenario?.patientId;
  const queryEncounterId = searchParams.get("encounterId") ?? scenario?.encounterId;
  const appointments = useMemo(() => getTodayAppointments(draftCheckIns), [draftCheckIns]);
  const selectedVeterinarians = useMemo(
    () =>
      todayWorkingVeterinarians.filter((veterinarian) =>
        selectedVeterinarianIds.includes(veterinarian.id)
      ),
    [selectedVeterinarianIds]
  );
  const visibleAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.assignedVeterinarianId &&
          selectedVeterinarianIds.includes(appointment.assignedVeterinarianId)
      ),
    [appointments, selectedVeterinarianIds]
  );
  const selectedBundle = getMockPatientBundle(selectedPatientId);
  const selectedPatient = selectedBundle?.patient;
  const selectedAppointment = appointments.find(
    (appointment) =>
      appointment.id === selectedAppointmentId ||
      appointment.id === scenario?.appointmentId ||
      appointment.patientId === selectedPatientId
  );
  const selectedEncounter = findScenarioEncounter(selectedBundle?.encounters, queryEncounterId);
  const selectedVisitReason = getReceptionVisitReason({
    appointment: selectedAppointment,
    encounter: selectedEncounter,
    patientSpecialNote: selectedPatient?.specialNote,
  });
  const toggleVeterinarian = (veterinarianId: string) => {
    setSelectedVeterinarianIds((current) => {
      if (current.includes(veterinarianId)) {
        return current.length > 1 ? current.filter((id) => id !== veterinarianId) : current;
      }

      return [...current, veterinarianId];
    });
  };
  const handleSelectAppointment = (appointment: Appointment) => {
    selectAppointment(appointment.id);
    setActiveDrawer({ type: "reception-appointment", id: appointment.id });
  };
  const handleSelectPatientFromSchedule = (patientId: string) => {
    selectPatient(patientId);
    setActiveDrawer({ type: "reception-patient", id: patientId });
  };

  useEffect(() => {
    if (queryPatientId && queryPatientId !== selectedPatientId) {
      selectPatient(queryPatientId);
    }
    if (scenario?.appointmentId && scenario.appointmentId !== selectedAppointmentId) {
      selectAppointment(scenario.appointmentId);
    }
    if (queryEncounterId && queryEncounterId !== selectedEncounterId) {
      selectEncounter(queryEncounterId);
    }
  }, [
    queryEncounterId,
    queryPatientId,
    scenario?.appointmentId,
    selectAppointment,
    selectEncounter,
    selectPatient,
    selectedAppointmentId,
    selectedEncounterId,
    selectedPatientId,
  ]);

  if (!selectedPatient) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        환자를 선택해 주세요.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScheduleToolbar
        view={calendarView}
        onViewChange={setCalendarView}
        selectedVeterinarianIds={selectedVeterinarianIds}
        onToggleVeterinarian={toggleVeterinarian}
        onCreateWalkIn={() => setActiveDrawer({ type: "reception-form", id: selectedPatient.id })}
      />
      {scenario || queryPatientId || queryEncounterId ? (
        <ReceptionVisitContextBanner
          appointment={selectedAppointment}
          encounter={selectedEncounter}
          guardianName={selectedBundle?.primaryGuardian?.name}
          patientName={selectedPatient.name}
          patientNo={selectedPatient.patientNo}
          reason={selectedVisitReason}
        />
      ) : null}
      <ReceptionScheduleBoard
        appointments={visibleAppointments}
        draftCheckIns={draftCheckIns}
        selectedAppointmentId={selectedAppointmentId}
        selectedVeterinarians={selectedVeterinarians}
        view={calendarView}
        onSelectAppointment={handleSelectAppointment}
        onSelectPatient={handleSelectPatientFromSchedule}
        onCheckIn={checkInAppointment}
      />
    </div>
  );
}

function ReceptionFormField({
  children,
  label,
  required,
}: {
  children: ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-[12px] font-medium text-[var(--clair-color-label-normal)]">
      <span>
        {label}
        {required ? <span className="ml-0.5 text-[var(--clair-color-primary-normal)]">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function ReceptionReferenceLabel({
  actions,
  label,
  required,
}: {
  actions?: ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="flex min-h-[22px] items-center justify-between gap-2">
      <div className="flex min-w-0 items-start gap-0.5">
        <span className="truncate text-[14px] font-bold leading-[18px] text-[var(--clair-color-label-strong)]">
          {label}
        </span>
        {required ? (
          <span className="text-[14px] font-bold leading-[18px] text-[var(--clair-color-primary-normal)]">
            *
          </span>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </div>
  );
}

function ReceptionReferenceField({
  actions,
  children,
  className,
  label,
  required,
  supportingText,
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  label: string;
  required?: boolean;
  supportingText?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <ReceptionReferenceLabel actions={actions} label={label} required={required} />
      <div className="flex min-w-0 flex-col">
        {children}
        {supportingText ? (
          <div className="min-h-5 px-2 py-1 text-[10px] font-medium leading-3 text-[var(--clair-color-atomic-gray-500)]">
            {supportingText}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReceptionReferencePill({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className="h-[22px] rounded-full border-[var(--clair-color-atomic-gray-300)] bg-card px-3 text-[10px] font-semibold leading-3 text-[var(--clair-color-atomic-gray-400)]"
    >
      {icon}
      {children}
    </Button>
  );
}

const receptionReferenceInputClassName =
  "h-8 w-full rounded border-[var(--clair-color-atomic-gray-200)] bg-[#fbfcfd] px-2 text-[12px] font-medium leading-[14px] text-[var(--clair-color-label-strong)] placeholder:text-[var(--clair-color-atomic-gray-500)]";

const receptionReferenceDisabledInputClassName =
  "h-8 w-full rounded border-transparent bg-[var(--clair-color-atomic-gray-200)] px-2 text-[12px] font-medium leading-[14px] text-[var(--clair-color-atomic-gray-400)] disabled:opacity-100";

function WalkInReceptionFormDrawer({
  guardian,
  onClose,
  onCreate,
  patient,
}: {
  guardian?: Guardian;
  onClose: () => void;
  onCreate: (input: {
    department?: string;
    durationMinutes?: number;
    guardianId?: string;
    memo?: string;
    patientId: string;
    primaryVeterinarianId?: string;
    visitPurpose?: string;
  }) => void;
  patient: Patient;
}) {
  const [receptionDepartment, setReceptionDepartment] = useState(defaultWalkInDepartment);
  const [receptionDuration, setReceptionDuration] = useState(defaultWalkInDuration);
  const [receptionMemo, setReceptionMemo] = useState("");
  const [receptionVeterinarianId, setReceptionVeterinarianId] = useState(
    unassignedVeterinarianValue
  );
  const [receptionVisitPurpose, setReceptionVisitPurpose] = useState("");
  const canCreate = Boolean(receptionVisitPurpose.trim());

  return (
    <div className="flex h-full flex-col bg-white" data-testid="walk-in-reception-form">
      <div className="flex h-[76px] shrink-0 items-center gap-2 border-x border-t border-[var(--clair-color-atomic-gray-200)] px-6">
        <h2 className="min-w-0 flex-1 text-[18px] font-semibold leading-[22px] text-[var(--clair-color-label-strong)]">
          접수
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-[22px] rounded-sm text-[var(--clair-color-atomic-gray-600)] hover:bg-[var(--clair-color-atomic-gray-50)]"
          aria-label="상세 닫기"
          onClick={onClose}
        >
          <CdsActionsXIcon className="size-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 border-x border-[var(--clair-color-atomic-gray-200)]">
        <div className="flex flex-col gap-6 px-6 pt-4">
          <section className="flex flex-col gap-3">
            <div className="grid grid-cols-[minmax(0,1fr)_248px] gap-2">
              <ReceptionReferenceField
                label="진료과"
                required
                supportingText="다른 진료과로의 접수는 먼저 진료과를 변경한 후 가능합니다."
              >
                <Select
                  value={receptionDepartment}
                  onValueChange={(value) => {
                    if (value) setReceptionDepartment(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="진료과"
                    className={cn(receptionReferenceInputClassName, "justify-between")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="영상의학과 · 방사선종양학과">
                        영상의학과 · 방사선종양학과
                      </SelectItem>
                      <SelectItem value="내과">내과</SelectItem>
                      <SelectItem value="외과">외과</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </ReceptionReferenceField>

              <ReceptionReferenceField
                label="담당의"
                supportingText="담당의 지정시 진료시작시간을 설정할 수 있습니다."
              >
                <Select
                  value={receptionVeterinarianId}
                  onValueChange={(value) => {
                    if (value) setReceptionVeterinarianId(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="담당의"
                    className={cn(receptionReferenceInputClassName, "justify-between")}
                  >
                    <CdsActionsSearchIcon
                      className="size-3 shrink-0 text-[var(--clair-color-atomic-gray-600)]"
                      aria-hidden="true"
                    />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={unassignedVeterinarianValue}>수의사미지정</SelectItem>
                      {todayWorkingVeterinarians.map((veterinarian) => (
                        <SelectItem key={veterinarian.id} value={veterinarian.id}>
                          {veterinarian.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </ReceptionReferenceField>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_248px] gap-2">
              <ReceptionReferenceField
                label="보호자 및 동물검색"
                required
                actions={
                  <>
                    <ReceptionReferencePill>동물 정보</ReceptionReferencePill>
                    <ReceptionReferencePill>카카오톡 발송</ReceptionReferencePill>
                    <ReceptionReferencePill
                      icon={<CdsActionsPlusIcon data-icon="inline-start" />}
                    >
                      진료의뢰
                    </ReceptionReferencePill>
                  </>
                }
              >
                <div className="relative">
                  <CdsActionsSearchIcon
                    className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-[var(--clair-color-atomic-gray-600)]"
                    aria-hidden="true"
                  />
                  <Input
                    aria-label="보호자 및 동물검색"
                    className={cn(receptionReferenceInputClassName, "pl-7")}
                    readOnly
                    value={`${patient.name} · ${guardian?.name ?? "보호자 미지정"} ${guardian?.mobilePhone ?? ""}`}
                  />
                </div>
              </ReceptionReferenceField>

              <div className="grid grid-cols-[minmax(0,1fr)_66px] gap-2">
                <ReceptionReferenceField label="동물 체중">
                  <div className="relative">
                    <Input
                      aria-label="동물 체중"
                      className={cn(
                        receptionReferenceInputClassName,
                        "pr-8 text-[var(--clair-color-atomic-gray-500)]"
                      )}
                      readOnly
                      value="0.00"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-medium leading-[14px] text-[var(--clair-color-label-strong)]">
                      kg
                    </span>
                  </div>
                </ReceptionReferenceField>

                <ReceptionReferenceField label="접수구분">
                  <div className="flex h-8 items-center gap-1 text-[12px] font-medium leading-[14px] text-[var(--clair-color-atomic-gray-400)]">
                    <Checkbox aria-label="재진 여부" disabled />
                    <span>재진</span>
                  </div>
                </ReceptionReferenceField>
              </div>
            </div>

            <ReceptionReferenceField label="방문 목적" required>
              <Input
                aria-label="방문 목적"
                className={receptionReferenceInputClassName}
                placeholder="방문 목적을 입력해주세요"
                value={receptionVisitPurpose}
                onChange={(event) => setReceptionVisitPurpose(event.target.value)}
              />
            </ReceptionReferenceField>

            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_248px] gap-2">
              <ReceptionReferenceField label="접수일">
                <div className="relative">
                  <CdsFilesCalendarIcon
                    className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-[var(--clair-color-atomic-gray-600)]"
                    aria-hidden="true"
                  />
                  <Input
                    aria-label="접수일"
                    className="h-8 w-full rounded-none border-x-0 border-t-0 border-[var(--clair-color-atomic-gray-200)] bg-transparent px-2 pl-7 text-[12px] font-medium leading-[14px] text-[var(--clair-color-label-strong)] focus-visible:ring-0"
                    readOnly
                    value="26.05.01"
                  />
                </div>
              </ReceptionReferenceField>

              <ReceptionReferenceField label="진료시작시간">
                <div className="relative">
                  <CdsFilesClockIcon
                    className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-[var(--clair-color-atomic-gray-400)]"
                    aria-hidden="true"
                  />
                  <Input
                    aria-label="진료시작시간"
                    className={cn(receptionReferenceDisabledInputClassName, "pl-7")}
                    disabled
                    value="진료시간"
                  />
                </div>
              </ReceptionReferenceField>

              <ReceptionReferenceField label="소요시간" required>
                <Select
                  value={receptionDuration}
                  onValueChange={(value) => {
                    if (value) setReceptionDuration(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="소요시간"
                    className={cn(receptionReferenceInputClassName, "justify-between")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="20분">20분</SelectItem>
                      <SelectItem value="30분">30분</SelectItem>
                      <SelectItem value="40분">40분</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </ReceptionReferenceField>
            </div>

            <ReceptionReferenceField label="접수/예약 메모">
              <Textarea
                aria-label="접수/예약 메모"
                className="min-h-[66px] resize-none rounded border-[var(--clair-color-atomic-gray-200)] bg-[#fbfcfd] p-2 text-[12px] font-medium leading-[1.5] text-[var(--clair-color-label-strong)] placeholder:text-[var(--clair-color-atomic-gray-500)]"
                placeholder="접수/예약 메모를 입력해주세요"
                value={receptionMemo}
                onChange={(event) => setReceptionMemo(event.target.value)}
              />
            </ReceptionReferenceField>
          </section>
        </div>
      </ScrollArea>

      <div className="flex shrink-0 justify-end gap-2 border-x border-b border-[var(--clair-color-atomic-gray-200)] bg-white px-6 pb-6 pt-11">
        <Button
          type="button"
          variant="ghost"
          className="h-8 rounded-full px-4 text-[12px] font-semibold text-[var(--clair-color-label-strong)]"
          onClick={onClose}
        >
          취소
        </Button>
        <Button
          type="button"
          className="h-8 rounded-full bg-[var(--clair-color-primary-normal)] px-4 text-[12px] font-semibold text-white hover:bg-[var(--clair-color-primary-normal)]/90"
          disabled={!canCreate}
          onClick={() => {
            const selectedVeterinarianId =
              receptionVeterinarianId === unassignedVeterinarianValue
                ? undefined
                : receptionVeterinarianId;

            onCreate({
              department: receptionDepartment,
              durationMinutes: getDurationMinutesFromLabel(receptionDuration),
              guardianId: guardian?.id,
              memo: receptionMemo.trim() || undefined,
              patientId: patient.id,
              primaryVeterinarianId: selectedVeterinarianId,
              visitPurpose: receptionVisitPurpose.trim(),
            });
          }}
        >
          생성
        </Button>
      </div>
    </div>
  );
}

export function ReceptionDrawer() {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const checkInAppointment = useReceptionStore((state) => state.checkInAppointment);
  const createWalkInCheckIn = useReceptionStore((state) => state.createWalkInCheckIn);
  const selectedEncounterId = useReceptionStore((state) => state.selectedEncounterId);
  const selectedPatientId = useReceptionStore((state) => state.selectedPatientId);
  const appointments = useMemo(() => getTodayAppointments(draftCheckIns), [draftCheckIns]);
  if (activeDrawer?.type === "reception-patient") {
    return <PatientProfileDrawer patientId={activeDrawer.id} />;
  }

  if (activeDrawer?.type === "reception-guardian") {
    return <GuardianProfileDrawer guardianId={activeDrawer.id} />;
  }

  const selectedAppointment =
    activeDrawer?.type === "reception-appointment"
      ? appointments.find((appointment) => appointment.id === activeDrawer.id)
      : undefined;
  const patientId =
    selectedAppointment?.patientId ??
    (activeDrawer?.type === "reception-form" || activeDrawer?.type === "reception-patient"
      ? activeDrawer.id
      : selectedPatientId);
  const bundle = getMockPatientBundle(patientId) ?? getMockPatientBundle(selectedPatientId);
  const patient = bundle?.patient;
  const guardian = bundle?.primaryGuardian;
  const recentEncounters = bundle
    ? [...bundle.encounters].sort((a, b) =>
        (b.checkedInAt ?? b.createdAt).localeCompare(a.checkedInAt ?? a.createdAt)
      )
    : [];
  const selectedEncounter =
    selectedAppointment
      ? recentEncounters.find((encounter) => encounter.appointmentId === selectedAppointment.id)
      : recentEncounters.find((encounter) => encounter.id === selectedEncounterId) ?? recentEncounters[0];
  const visitReason = getReceptionVisitReason({
    appointment: selectedAppointment,
    encounter: selectedEncounter,
    patientSpecialNote: patient?.specialNote,
  });
  const visitSummary = getReceptionVisitSummary({
    appointment: selectedAppointment,
    encounter: selectedEncounter,
  });
  const veterinarianName =
    getStaffDisplayName(selectedEncounter?.primaryVeterinarianId) ??
    getStaffDisplayName(selectedAppointment?.assignedVeterinarianId) ??
    defaultVeterinarian?.name ??
    "담당의 미지정";
  const receptionDate = getShortDate(
    selectedEncounter?.checkedInAt ?? selectedAppointment?.scheduledStartAt
  );

  if (!patient || !bundle) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        환자를 선택해 주세요.
      </div>
    );
  }

  if (activeDrawer?.type === "reception-form") {
    return (
      <WalkInReceptionFormDrawer
        key={patient.id}
        guardian={guardian}
        patient={patient}
        onClose={() => setActiveDrawer(null)}
        onCreate={(input) => {
          createWalkInCheckIn(input);
          setActiveDrawer(null);
        }}
      />
    );
  }

  return (
    <div className="flex h-[calc(100%-48px)] flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <section className="rounded-lg border bg-[var(--clair-color-background-surface)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[14px] font-semibold">
                  {selectedAppointment ? "예약 상세" : "접수 상세"}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {guardian?.name ?? "보호자 미지정"} 보호자 · {patient.name} · {visitSummary}
                </div>
                <div className="mt-2 text-[13px] font-medium text-[var(--clair-color-label-strong)]">
                  오늘 내원: {visitReason}
                </div>
              </div>
              {selectedAppointment ? (
                <ReceptionStatusBadge
                  label={getStatusLabel("appointment", selectedAppointment.status)}
                  tone={getAppointmentTone(selectedAppointment.status)}
                />
              ) : null}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <ReceptionFormField label="진료과" required>
              <Input value={selectedEncounter?.visitPurpose ?? "영상의학과 · 방사선종양학과"} readOnly className="h-9 bg-card" />
            </ReceptionFormField>
            <ReceptionFormField label="담당의">
              <Input value={veterinarianName} readOnly className="h-9 bg-card" />
            </ReceptionFormField>
          </section>

          <section className="grid grid-cols-[minmax(0,1fr)_120px_88px] gap-3">
            <ReceptionFormField label="보호자 및 동물검색" required>
              <Input
                value={`${patient.name} · ${guardian?.name ?? "보호자 미지정"} ${guardian?.mobilePhone ?? ""}`}
                readOnly
                className="h-9 bg-card"
              />
            </ReceptionFormField>
            <ReceptionFormField label="동물 체중">
              <Input value="0.00 kg" readOnly className="h-9 bg-card text-right" />
            </ReceptionFormField>
            <ReceptionFormField label="접수구분">
              <div className="flex h-9 items-center rounded-lg border border-input px-2.5 text-[13px]">
                재진
              </div>
            </ReceptionFormField>
          </section>

          <ReceptionFormField label="방문 목적" required>
            <Input
              value={visitReason}
              readOnly
              className="h-9 bg-card"
            />
          </ReceptionFormField>

          <section className="grid grid-cols-3 gap-3">
            <ReceptionFormField label="접수일">
              <Input value={receptionDate} readOnly className="h-9 bg-card" />
            </ReceptionFormField>
            <ReceptionFormField label="진료시작시간">
              <Input
                value={
                  selectedEncounter?.startedAt
                    ? getShortTime(selectedEncounter.startedAt)
                    : selectedAppointment
                      ? getShortTime(selectedAppointment.scheduledStartAt)
                      : "진료시간"
                }
                disabled={!selectedAppointment && !selectedEncounter?.startedAt}
                readOnly={Boolean(selectedAppointment || selectedEncounter?.startedAt)}
                className="h-9 bg-card disabled:bg-input/50"
              />
            </ReceptionFormField>
            <ReceptionFormField label="소요시간" required>
              <Input
                value={selectedAppointment ? getAppointmentDurationLabel(selectedAppointment) : "30분"}
                readOnly
                className="h-9 bg-card"
              />
            </ReceptionFormField>
          </section>

          <ReceptionFormField label="접수/예약 메모">
            <textarea
              value={`${guardian?.name ?? "보호자"} 보호자: ${selectedAppointment?.symptomNote ?? patient.specialNote ?? visitReason}`}
              readOnly
              className="min-h-20 w-full resize-none rounded-lg border border-input bg-card px-2.5 py-2 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </ReceptionFormField>

          <section className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold">Assessment History</h3>
              <Button size="xs" variant="outline">
                차트보기
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[86px_86px_84px_minmax(120px,1fr)_72px_72px_64px] bg-muted/50 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                <span>진단일</span>
                <span>종료일</span>
                <span>계통 구분</span>
                <span>진단명</span>
                <span>종료여부</span>
                <span>진단여부</span>
                <span>수의사</span>
              </div>
              {recentEncounters.slice(0, 4).map((encounter) => (
                <div
                  key={encounter.id}
                  className="grid grid-cols-[86px_86px_84px_minmax(120px,1fr)_72px_72px_64px] border-t px-3 py-2 text-[11px]"
                >
                  <span>{getShortDate(encounter.checkedInAt ?? encounter.createdAt)}</span>
                  <span>{encounter.completedAt ? getShortDate(encounter.completedAt) : "-"}</span>
                  <span className="truncate">호흡기계</span>
                  <span className="truncate">{encounter.chiefComplaint ?? encounter.visitPurpose ?? "내원"}</span>
                  <span>{encounter.status === "completed" ? "치료완료" : "진행중"}</span>
                  <span>{encounter.status === "completed" ? "확정진단" : "가진단"}</span>
                  <span className="truncate">{defaultVeterinarian?.name ?? "수의사"}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>
      <div className="mt-auto flex shrink-0 justify-end gap-2 border-t bg-card p-4">
        <Button variant="ghost" onClick={() => setActiveDrawer(null)}>
          취소
        </Button>
        <Button
          onClick={() => {
            if (selectedAppointment) {
              checkInAppointment(selectedAppointment);
              setActiveDrawer(null);
              return;
            }

            createWalkInCheckIn({
              guardianId: guardian?.id,
              patientId: patient.id,
              primaryVeterinarianId: defaultVeterinarian?.id,
              visitPurpose: "현장 접수",
            });
            setActiveDrawer(null);
          }}
          disabled={Boolean(selectedAppointment && selectedAppointment.status !== "confirmed")}
        >
          {selectedAppointment ? "접수 처리" : "생성"}
        </Button>
      </div>
    </div>
  );
}
