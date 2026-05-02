"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CdsActionsListFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CdsFilesMoreHorizontalIcon } from "@/components/cds-icons/files-and-layout";
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
  getAppointmentGuardian,
  getAppointmentPatient,
  getAppointmentVeterinarianName,
  getFilteredReceptionPatients,
  getGuardianDisplay,
  getPatientDisplayAge,
  getReceptionPatientSummaries,
  getSpeciesLabel,
  getTodayAppointments,
  type ReceptionPatientSummary,
} from "@/features/reception/data";
import { useReceptionStore } from "@/features/reception/store";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { cn } from "@/lib/utils";
import { getMockPatientBundle, mockStaffUsers } from "@/mocks/emr-domain";
import { useLayoutStore } from "@/stores/layout-store";
import type { Appointment, Encounter } from "@/types/emr-domain";
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
      label={getStatusLabel("encounter", summary.activeEncounter.status)}
      tone={getEncounterTone(summary.activeEncounter.status)}
    />
  ) : (
    <ReceptionStatusBadge label={appointmentLabel} tone="default" />
  );
  const visitText =
    summary.activeEncounter?.chiefComplaint ??
    summary.latestAppointment?.symptomNote ??
    summary.latestAppointment?.visitPurpose ??
    "접수할 내원 목적을 확인해 주세요.";
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
              {getSpeciesLabel(summary.patient)} · {getPatientDisplayAge(summary.patient)}
            </span>
          </>
        }
        onSelect={onSelect}
      />
    </div>
  );
}

export function ReceptionSidePanel({ moduleLabel }: ShellComponentProps) {
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const [listMode, setListMode] = useState<ReceptionSideListMode>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchQuery = useReceptionStore((state) => state.searchQuery);
  const selectedPatientId = useReceptionStore((state) => state.selectedPatientId);
  const selectPatient = useReceptionStore((state) => state.selectPatient);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const setModulePanelOpen = useLayoutStore((state) => state.setModulePanelOpen);
  const setSearchQuery = useReceptionStore((state) => state.setSearchQuery);
  const patientSummaries = useMemo(
    () => getReceptionPatientSummaries(draftCheckIns),
    [draftCheckIns]
  );
  const filteredPatients = useMemo(
    () => getFilteredReceptionPatients(patientSummaries, searchQuery),
    [patientSummaries, searchQuery]
  );
  const visiblePatients = useMemo(
    () => getReceptionSideListItems(filteredPatients, listMode),
    [filteredPatients, listMode]
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
              selected={summary.patient.id === selectedPatientId}
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
  mode: ReceptionSideListMode
) {
  if (mode === "reception") {
    return summaries.filter((summary) => Boolean(summary.activeEncounter));
  }

  if (mode === "appointment") {
    return summaries.filter(
      (summary) => !summary.activeEncounter && summary.latestAppointment?.status === "confirmed"
    );
  }

  return summaries;
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
              className: "min-w-[124px] justify-start bg-card",
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
        <Button size="sm" onClick={onCreateWalkIn}>
          <CdsActionsPlusIcon data-icon="inline-start" />
          현장 접수
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="캘린더 옵션"
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

function DayScheduleBoard({
  appointments,
  onCheckIn,
  onSelectAppointment,
  selectedAppointmentId,
  selectedVeterinarians,
}: {
  appointments: Appointment[];
  onCheckIn: (appointment: Appointment) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  selectedAppointmentId?: Appointment["id"];
  selectedVeterinarians: TodayWorkingVeterinarian[];
}) {
  const dayScheduleHeight = dayScheduleHours.length * dayScheduleHourRowHeight;
  const currentTimeOffset = getDayCurrentTimeOffset();
  const scheduleGridTemplateColumns = `56px repeat(${selectedVeterinarians.length}, minmax(180px, 1fr))`;

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

                  return (
                    <div key={`${hour}-${veterinarian.id}`} className="flex min-w-0 gap-2 border-r p-2 last:border-r-0">
                      {hourAppointments.length ? (
                        hourAppointments.map((appointment) => (
                          <ScheduleAppointmentCard
                            key={appointment.id}
                            appointment={appointment}
                            selected={appointment.id === selectedAppointmentId}
                            onSelect={() => onSelectAppointment(appointment)}
                            onCheckIn={() => onCheckIn(appointment)}
                          />
                        ))
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
  onCheckIn,
  onSelectAppointment,
  selectedAppointmentId,
  selectedVeterinarians,
  view,
}: {
  appointments: Appointment[];
  onCheckIn: (appointment: Appointment) => void;
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
              selectedAppointmentId={selectedAppointmentId}
              selectedVeterinarians={selectedVeterinarians}
              onSelectAppointment={onSelectAppointment}
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
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const [calendarView, setCalendarView] = useState<ReceptionCalendarView>("day");
  const [selectedVeterinarianIds, setSelectedVeterinarianIds] = useState(() =>
    todayWorkingVeterinarians.map((veterinarian) => veterinarian.id)
  );
  const selectedAppointmentId = useReceptionStore((state) => state.selectedAppointmentId);
  const selectedPatientId = useReceptionStore((state) => state.selectedPatientId);
  const checkInAppointment = useReceptionStore((state) => state.checkInAppointment);
  const createWalkInCheckIn = useReceptionStore((state) => state.createWalkInCheckIn);
  const selectAppointment = useReceptionStore((state) => state.selectAppointment);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
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
  const selectedGuardian = selectedBundle?.primaryGuardian;
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
        onCreateWalkIn={() =>
          createWalkInCheckIn({
            guardianId: selectedGuardian?.id,
            patientId: selectedPatient.id,
            primaryVeterinarianId: defaultVeterinarian?.id,
            visitPurpose: "현장 접수",
          })
        }
      />
      <ReceptionScheduleBoard
        appointments={visibleAppointments}
        selectedAppointmentId={selectedAppointmentId}
        selectedVeterinarians={selectedVeterinarians}
        view={calendarView}
        onSelectAppointment={handleSelectAppointment}
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

export function ReceptionDrawer() {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const checkInAppointment = useReceptionStore((state) => state.checkInAppointment);
  const createWalkInCheckIn = useReceptionStore((state) => state.createWalkInCheckIn);
  const selectedPatientId = useReceptionStore((state) => state.selectedPatientId);
  const appointments = useMemo(() => getTodayAppointments(draftCheckIns), [draftCheckIns]);
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

  if (!patient || !bundle) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        환자를 선택해 주세요.
      </div>
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
                  {patient.name} · {guardian?.name ?? "보호자 미지정"}
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
              <Input value="영상의학과 · 방사선종양학과" readOnly className="h-9 bg-card" />
            </ReceptionFormField>
            <ReceptionFormField label="담당의">
              <Input value={defaultVeterinarian?.name ?? "담당의 미지정"} readOnly className="h-9 bg-card" />
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
              value={patient.handlingCautionNote ?? "방문 목적 텍스트"}
              readOnly
              className="h-9 bg-card"
            />
          </ReceptionFormField>

          <section className="grid grid-cols-3 gap-3">
            <ReceptionFormField label="접수일">
              <Input value="26.05.01" readOnly className="h-9 bg-card" />
            </ReceptionFormField>
            <ReceptionFormField label="진료시작시간">
              <Input
                value={selectedAppointment ? getShortTime(selectedAppointment.scheduledStartAt) : "진료시간"}
                disabled={!selectedAppointment}
                readOnly={Boolean(selectedAppointment)}
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
              value="접수/예약 메모 텍스트"
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
