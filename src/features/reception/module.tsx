"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  CdsActionsListFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsFilesCalendarIcon,
  CdsFilesClockIcon,
  CdsFilesMoreHorizontalIcon,
} from "@/components/cds-icons/files-and-layout";
import {
  CdsMedicalClipboardCheckIcon,
  CdsMedicalHeartPulseIcon,
  CdsMedicalStethoscopeIcon,
  CdsMedicalSyringeIcon,
} from "@/components/cds-icons/medical-and-domain";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import {
  EmrSidePanelCard,
  EmrSidePanelCardAction,
  EmrSidePanelIdentityLine,
  EmrSidePanelMetaBadge,
  EmrSidePanelStatusBadge,
  EmrSidePanelTypeBadge,
} from "@/components/emr/side-panel-card";
import { ChevronLeftIcon, ChevronRightIcon, CircleCloseFillIcon, ExcelFileIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  getReceptionPatientSummaries,
  getTodayAppointments,
  type ReceptionDraftCheckIn,
  type ReceptionPatientSummary,
} from "@/features/reception/data";
import {
  GuardianProfileDrawer,
  RegistrationDialogCloseButton,
  RegistrationFormField,
  RegistrationFormSection,
  NewUnifiedRegistrationButton,
  PatientProfileDrawer,
} from "@/features/reception/profile-drawer";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import { useReceptionStore } from "@/features/reception/store";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { cn } from "@/lib/utils";
import { getMockPatientBundle, mockEncounters, mockStaffUsers } from "@/mocks/emr-domain";
import { useLayoutStore } from "@/stores/layout-store";
import type { Appointment, Encounter, Patient } from "@/types/emr-domain";
import type { ShellComponentProps } from "@/types/emr";

const allVeterinarians = mockStaffUsers.filter((user) => user.role === "veterinarian");
const todayWorkingVeterinarianIds = new Set(["user-vet-suji", "user-vet-doyun"]);
const todayWorkingVeterinarians = allVeterinarians.filter((user) =>
  todayWorkingVeterinarianIds.has(user.id)
);
const otherVeterinarians = allVeterinarians.filter(
  (user) => !todayWorkingVeterinarianIds.has(user.id)
);
const defaultVeterinarian = allVeterinarians[0];
const veterinarianHeaderToneClasses = [
  "border-[var(--clair-color-atomic-sky-600)] bg-[var(--clair-color-atomic-sky-500)]",
  "border-[var(--clair-color-atomic-teal-700)] bg-[var(--clair-color-atomic-teal-600)]",
  "border-[var(--clair-color-atomic-purple-700)] bg-[var(--clair-color-atomic-purple-600)]",
  "border-[var(--clair-color-atomic-orange-700)] bg-[var(--clair-color-atomic-orange-600)]",
  "border-[var(--clair-color-atomic-forest-green-700)] bg-[var(--clair-color-atomic-forest-green-600)]",
  "border-[var(--clair-color-atomic-pink-700)] bg-[var(--clair-color-atomic-pink-600)]",
  "border-[var(--clair-color-atomic-cornflower-700)] bg-[var(--clair-color-atomic-cornflower-600)]",
  "border-[var(--clair-color-atomic-wood-700)] bg-[var(--clair-color-atomic-wood-600)]",
  "border-[var(--clair-color-atomic-cyan-800)] bg-[var(--clair-color-atomic-cyan-700)]",
  "border-[var(--clair-color-atomic-red-700)] bg-[var(--clair-color-atomic-red-600)]",
];
const veterinarianAccentToneClasses = [
  "bg-[var(--clair-color-atomic-sky-500)]",
  "bg-[var(--clair-color-atomic-teal-600)]",
  "bg-[var(--clair-color-atomic-purple-600)]",
  "bg-[var(--clair-color-atomic-orange-600)]",
  "bg-[var(--clair-color-atomic-forest-green-600)]",
  "bg-[var(--clair-color-atomic-pink-600)]",
  "bg-[var(--clair-color-atomic-cornflower-600)]",
  "bg-[var(--clair-color-atomic-wood-600)]",
  "bg-[var(--clair-color-atomic-cyan-700)]",
  "bg-[var(--clair-color-atomic-red-600)]",
];
const calendarViewItems = [
  { value: "day" as const, label: "일" },
  { value: "week" as const, label: "주" },
  { value: "month" as const, label: "월" },
];
const receptionQueueTabItems = [
  { value: "all" as const, label: "전체" },
  { value: "reception" as const, label: "대기" },
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
type Veterinarian = (typeof allVeterinarians)[number];
type WalkInReceptionInput = {
  department?: string;
  durationMinutes?: number;
  guardianId?: string;
  guardianMobilePhone?: string;
  memo?: string;
  patientId: string;
  patientName?: string;
  primaryVeterinarianId?: string;
  sendKakaoMessage?: boolean;
  visitPurpose?: string;
};
const unassignedVeterinarianValue = "unassigned";

function getVeterinarianFilterLabel(selectedVeterinarians: Veterinarian[]) {
  const [firstVeterinarian] = selectedVeterinarians;

  if (!firstVeterinarian) {
    return "수의사 0";
  }

  return selectedVeterinarians.length === 1
    ? firstVeterinarian.name
    : `${firstVeterinarian.name} +${selectedVeterinarians.length - 1}`;
}

function getVeterinarianToneIndex(veterinarian: Veterinarian) {
  const veterinarianIndex = allVeterinarians.findIndex((item) => item.id === veterinarian.id);

  return veterinarianIndex >= 0 ? veterinarianIndex : 0;
}

function getVeterinarianAccentClassName(veterinarianId?: string) {
  if (!veterinarianId) return "bg-[var(--clair-color-atomic-gray-300)]";

  const veterinarian = allVeterinarians.find((item) => item.id === veterinarianId);
  const toneIndex = veterinarian ? getVeterinarianToneIndex(veterinarian) : 0;

  return veterinarianAccentToneClasses[toneIndex % veterinarianAccentToneClasses.length];
}

function VeterinarianLaneHeader({
  toneIndex,
  veterinarian,
}: {
  toneIndex: number;
  veterinarian: Veterinarian;
}) {
  return (
    <div
      className={cn(
        "flex h-12 min-w-0 items-center gap-2 rounded-md border px-2.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
        veterinarianHeaderToneClasses[toneIndex % veterinarianHeaderToneClasses.length]
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-white/35 bg-white/20 text-[10px] font-semibold leading-none text-white">
        {veterinarian.initial}
      </span>
      <span className="min-w-0 truncate text-[13px] font-semibold">{veterinarian.name}</span>
    </div>
  );
}

function VeterinarianMenuItemLabel({ veterinarian }: { veterinarian: Veterinarian }) {
  const toneIndex = getVeterinarianToneIndex(veterinarian);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold leading-none text-white",
          veterinarianHeaderToneClasses[toneIndex % veterinarianHeaderToneClasses.length]
        )}
      >
        {veterinarian.initial}
      </span>
      <span className="min-w-0 truncate">{veterinarian.name}</span>
    </span>
  );
}
const defaultWalkInDepartment = "영상의학과 · 방사선종양학과";
const defaultWalkInDuration = "30분";
const receptionPurposeChips = ["예방접종", "구토/설사", "피부", "수술 후 확인", "건강검진"];

const getReceptionPatientAgeText = (patient: Patient) => {
  if (patient.estimatedAgeText) return patient.estimatedAgeText;
  if (!patient.birthDate) return "나이 미상";

  const birthYear = Number(patient.birthDate.slice(0, 4));

  return Number.isNaN(birthYear) ? "나이 미상" : `${2026 - birthYear}세`;
};

const getReceptionPatientOptionLabel = (summary: ReceptionPatientSummary) =>
  [
    summary.patient.name,
    [getSpeciesLabel(summary.patient.species), summary.patient.breed].filter(Boolean).join("/"),
    getReceptionPatientAgeText(summary.patient),
    summary.primaryGuardian?.name ?? "보호자 미지정",
  ]
    .filter(Boolean)
    .join(" · ");

const recentPatientWeightKgByPatientId: Record<string, string> = {
  "patient-coco": "4.20",
  "patient-kong": "5.10",
  "patient-dubu": "8.40",
  "patient-haru": "3.20",
  "patient-nabi": "4.80",
};

const getRecentPatientWeightKg = (patient?: Patient) =>
  patient ? recentPatientWeightKgByPatientId[patient.id] ?? "0.00" : "0.00";

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

const getBusinessHoursTimeRangeLabel = () =>
  `${getScheduleHourLabel(dayBusinessOpenHour)}-${getScheduleHourLabel(dayBusinessCloseHour)}`;

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

const getMinutesInDayFromDateTime = (dateTime?: string) => {
  if (!dateTime) return undefined;

  const hours = Number(dateTime.slice(11, 13));
  const minutes = Number(dateTime.slice(14, 16));

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return undefined;

  return hours * 60 + minutes;
};

const getWaitMinutesFromTime = (dateTime?: string) => {
  const minutesInDay = getMinutesInDayFromDateTime(dateTime);

  if (minutesInDay === undefined) return undefined;

  return Math.max(0, dayCurrentTimeMinutes - minutesInDay);
};

const getWaitingTimePillClassName = (waitingMinutes?: number) => {
  if (waitingMinutes === undefined || waitingMinutes < 30) {
    return "border-[var(--clair-color-atomic-gray-200)] bg-[var(--clair-color-atomic-gray-50)] text-[var(--clair-color-atomic-gray-600)]";
  }

  if (waitingMinutes >= 90) {
    return "border-[var(--clair-color-atomic-red-200)] bg-[var(--clair-color-atomic-red-50)] text-[var(--clair-color-atomic-red-600)]";
  }

  if (waitingMinutes >= 60) {
    return "border-[var(--clair-color-atomic-orange-200)] bg-[var(--clair-color-atomic-orange-50)] text-[var(--clair-color-atomic-orange-600)]";
  }

  return "border-[var(--clair-color-atomic-yellow-200)] bg-[var(--clair-color-atomic-yellow-50)] text-[var(--clair-color-atomic-yellow-700)]";
};

const getReceptionSideListSortTime = (summary: ReceptionPatientSummary) => {
  const dateTime =
    summary.activeEncounter?.checkedInAt ?? summary.latestAppointment?.scheduledStartAt;
  const minutesInDay = getMinutesInDayFromDateTime(dateTime);

  return minutesInDay ?? Number.MAX_SAFE_INTEGER;
};

const sortReceptionSideListItems = (items: ReceptionPatientSummary[]) =>
  items
    .map((summary, index) => ({ index, sortTime: getReceptionSideListSortTime(summary), summary }))
    .sort((a, b) => a.sortTime - b.sortTime || a.index - b.index)
    .map(({ summary }) => summary);

const getAppointmentDurationLabel = (appointment: Appointment) => {
  if (!appointment.scheduledEndAt) return "20분";

  const start = new Date(appointment.scheduledStartAt).getTime();
  const end = new Date(appointment.scheduledEndAt).getTime();
  const minutes = Math.max(10, Math.round((end - start) / 60000));

  return `${minutes}분`;
};

const getStaffDisplayName = (userId?: string) =>
  userId ? mockStaffUsers.find((user) => user.id === userId)?.name : undefined;

const getSpeciesLabel = (species: Patient["species"]) => {
  if (species === "dog") return "강아지";
  if (species === "cat") return "고양이";
  if (species === "rabbit") return "토끼";
  if (species === "ferret") return "페럿";
  if (species === "hamster") return "햄스터";
  if (species === "guinea_pig") return "기니피그";
  if (species === "hedgehog") return "고슴도치";
  if (species === "bird") return "조류";
  if (species === "reptile") return "파충류";
  if (species === "turtle") return "거북이";

  return "기타";
};

const getReceptionVeterinarianSelectLabel = (veterinarianId: string) =>
  veterinarianId === unassignedVeterinarianValue
    ? "수의사 미지정"
    : getStaffDisplayName(veterinarianId) ?? "수의사 미지정";

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

function getVisitPurposeVisual(visitText?: string) {
  const normalized = visitText ?? "";

  if (normalized.includes("예방접종")) {
    return { label: "예방접종", icon: <CdsMedicalSyringeIcon className="size-3" aria-hidden="true" /> };
  }

  if (normalized.includes("구토") || normalized.includes("식욕")) {
    return { label: "구토/식욕", icon: <CdsMedicalHeartPulseIcon className="size-3" aria-hidden="true" /> };
  }

  if (normalized.includes("피부")) {
    return { label: "피부", icon: <CdsMedicalClipboardCheckIcon className="size-3" aria-hidden="true" /> };
  }

  if (normalized.includes("수술")) {
    return { label: "수술", icon: <CdsMedicalStethoscopeIcon className="size-3" aria-hidden="true" /> };
  }

  return { label: "진료", icon: <CdsMedicalStethoscopeIcon className="size-3" aria-hidden="true" /> };
}

function VisitPurposeChip({
  label,
  icon,
  testId,
}: {
  label: string;
  icon: ReactNode;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md border border-[var(--clair-color-line-subtle)] bg-white/70 px-1.5 text-[10px] font-semibold leading-none text-[var(--clair-color-label-normal)]"
    >
      {icon}
      {label}
    </span>
  );
}

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
  const guardianName = summary.primaryGuardian?.name ?? "보호자 미지정";
  const receptionType = summary.activeDraftCheckIn?.receptionType === "walk_in"
    ? "외래"
    : summary.latestAppointment
      ? "예약"
      : "외래";
  const visitText =
    summary.activeEncounter?.chiefComplaint ??
    summary.latestAppointment?.symptomNote ??
    summary.latestAppointment?.visitPurpose ??
    "접수할 내원 목적을 확인해 주세요.";
  const waitingMinutes = getWaitMinutesFromTime(summary.activeEncounter?.checkedInAt);
  const timeContent = summary.activeEncounter?.checkedInAt ? (
    <>
      <span>{getShortTime(summary.activeEncounter.checkedInAt)} 접수</span>
      {waitingMinutes !== undefined ? (
        <span
          className={cn(
            "rounded-full border px-1.5 py-0.5 text-[11px] font-semibold leading-none",
            getWaitingTimePillClassName(waitingMinutes)
          )}
        >
          {waitingMinutes}분 대기
        </span>
      ) : null}
    </>
  ) : (
    <span>
      {summary.latestAppointment
        ? `${getShortTime(summary.latestAppointment.scheduledStartAt)} 예약`
        : "시간 미정"}
    </span>
  );
  const veterinarianName = summary.veterinarianName ?? "수의사 미지정";

  return (
    <EmrSidePanelCard
      selected={selected}
      testId={`patient-card-${summary.patient.id}`}
      onSelect={onSelect}
    >
      <EmrSidePanelIdentityLine
        patientName={summary.patient.name}
        guardianName={guardianName}
        typeBadge={<EmrSidePanelTypeBadge label={receptionType} />}
        action={<EmrSidePanelCardAction ariaLabel={`${summary.patient.name} 더보기`} />}
      />
      <div className="mt-0.5 flex h-[18px] min-w-0 items-center gap-1 text-[13px] font-medium leading-[18px] tracking-[0.247px] text-[var(--clair-color-atomic-gray-500)]">
        <span className="min-w-0 flex-1 truncate">{visitText}</span>
      </div>
      <div className="my-1.5 h-px w-full bg-[var(--clair-color-line-subtle)]" />
      <div className="flex min-h-5 min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <EmrSidePanelMetaBadge
            label="수의사"
            maxWidthClassName="max-w-[120px]"
            value={veterinarianName}
          />
        </div>
        <EmrSidePanelStatusBadge icon={<CdsFilesClockIcon className="size-3.5" aria-hidden="true" />}>
          {timeContent}
        </EmrSidePanelStatusBadge>
      </div>
    </EmrSidePanelCard>
  );
}

export function ReceptionSidePanel({ moduleLabel }: ShellComponentProps) {
  const searchParams = useSearchParams();
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const [listMode, setListMode] = useState<ReceptionSideListMode>("reception");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchQuery = useReceptionStore((state) => state.searchQuery);
  const selectAppointment = useReceptionStore((state) => state.selectAppointment);
  const selectEncounter = useReceptionStore((state) => state.selectEncounter);
  const selectPatient = useReceptionStore((state) => state.selectPatient);
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
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
              aria-label="대기열 검색"
              className="pl-8 pr-8"
              placeholder="대기열 내 환자, 보호자, 전화번호 검색"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-[var(--clair-color-atomic-gray-500)] outline-none transition-colors hover:text-[var(--clair-color-atomic-gray-600)] focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label="검색어 초기화"
                onClick={() => setSearchQuery("")}
              >
                <CircleCloseFillIcon className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <EmrSubpanelBody>
        {visiblePatients.length ? (
          visiblePatients.map((summary) => (
            <PatientCard
              key={summary.patient.id}
              summary={summary}
              selected={isReceptionSideCardSelected(summary, activeDrawer, querySelectedPatientId)}
              onSelect={() => {
                selectPatient(summary.patient.id);
                if (summary.activeEncounter) {
                  selectEncounter(summary.activeEncounter.id);
                  setActiveDrawer({
                    type: "reception-encounter",
                    id: summary.activeEncounter.id,
                    subtitle: summary.patient.patientNo,
                  });
                  return;
                }

                if (summary.latestAppointment) {
                  selectAppointment(summary.latestAppointment.id);
                  setActiveDrawer({
                    type: "reception-appointment",
                    id: summary.latestAppointment.id,
                    subtitle: summary.patient.patientNo,
                  });
                  return;
                }

                setActiveDrawer({
                  type: "reception-patient",
                  id: summary.patient.id,
                  subtitle: summary.patient.patientNo,
                });
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

function isReceptionSideCardSelected(
  summary: ReceptionPatientSummary,
  activeDrawer: { type: string; id: string } | null,
  querySelectedPatientId?: string | null
) {
  if (!activeDrawer) return Boolean(querySelectedPatientId && summary.patient.id === querySelectedPatientId);

  if (activeDrawer.type === "reception-encounter") {
    return summary.activeEncounter?.id === activeDrawer.id;
  }

  if (activeDrawer.type === "reception-appointment") {
    return summary.latestAppointment?.id === activeDrawer.id;
  }

  if (activeDrawer.type === "reception-patient") {
    return summary.patient.id === activeDrawer.id;
  }

  return false;
}

function getReceptionSideListItems(
  summaries: ReceptionPatientSummary[],
  mode: ReceptionSideListMode
) {
  if (mode === "reception") {
    return sortReceptionSideListItems(summaries.filter((summary) => Boolean(summary.activeEncounter)));
  }

  if (mode === "appointment") {
    return sortReceptionSideListItems(
      summaries.filter(
        (summary) => !summary.activeEncounter && summary.latestAppointment?.status === "confirmed"
      )
    );
  }

  return sortReceptionSideListItems(summaries);
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
  const visitPurpose = appointment.visitPurpose ?? "내원";
  const visitDetail = appointment.symptomNote ?? visitPurpose;
  const visitVisual = getVisitPurposeVisual(visitDetail);
  const accentClassName = getVeterinarianAccentClassName(appointment.assignedVeterinarianId);

  return (
    <div
      className={cn(
        "relative min-w-0 flex-1 overflow-hidden rounded-md border border-[var(--clair-color-atomic-sky-200)] bg-[var(--clair-color-atomic-sky-50)] p-2 pl-3 shadow-[0_1px_0_rgba(15,23,42,0.03)]",
        appointment.status === "checked_in" &&
          "border-[var(--clair-color-atomic-green-200)] bg-[var(--clair-color-atomic-green-50)]",
        appointment.status === "no_show" &&
          "border-[var(--clair-color-atomic-red-200)] bg-[var(--clair-color-atomic-red-50)]",
        selected && "ring-2 ring-inset ring-[var(--clair-color-primary-normal)]"
      )}
      data-testid={`appointment-card-${appointment.id}`}
    >
      <span
        data-testid={`appointment-accent-${appointment.id}`}
        className={cn("absolute inset-y-0 left-0 w-1", accentClassName)}
        aria-hidden="true"
      />
      <button type="button" className="block w-full text-left outline-none" onClick={onSelect}>
        <div className="flex items-center gap-1.5 overflow-hidden">
          <ReceptionStatusBadge
            className="h-5 rounded-md px-1.5 text-[11px]"
            label={getStatusLabel("appointment", appointment.status)}
            tone={getAppointmentTone(appointment.status)}
          />
          <VisitPurposeChip
            icon={visitVisual.icon}
            label={visitVisual.label}
            testId={`appointment-purpose-${appointment.id}`}
          />
        </div>
        <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-[13px] font-bold leading-4 text-[var(--clair-color-label-strong)]">
            {patient?.name ?? "환자 미지정"}
          </span>
          <span className="truncate text-[12px] font-semibold leading-4 text-[var(--clair-color-label-normal)]">
            {visitPurpose}
          </span>
        </div>
        <div className="mt-1 truncate text-[11px] leading-4 text-[var(--clair-color-label-normal)]">
          {getShortTime(appointment.scheduledStartAt)} · {getAppointmentDurationLabel(appointment)}
        </div>
        {visitDetail ? (
          <div className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
            {getGuardianDisplay(guardian)} · {visitDetail}
          </div>
        ) : null}
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">
          {getAppointmentVeterinarianName(appointment)}
        </span>
        <Button
          size="sm"
          className={cn(
            "h-7 px-2 text-[12px]",
            canCheckIn &&
              "bg-[var(--clair-color-label-strong)] text-white shadow-sm hover:bg-[var(--clair-color-label-normal)]"
          )}
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
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const patient = patients.find((item) => item.id === draft.encounter.patientId);
  const primaryGuardianId = patientGuardians.find(
    (link) => link.patientId === draft.encounter.patientId && link.isPrimary
  )?.guardianId;
  const guardian =
    guardians.find((item) => item.id === primaryGuardianId) ??
    getMockPatientBundle(draft.encounter.patientId)?.primaryGuardian;
  const veterinarianName = getStaffDisplayName(draft.encounter.primaryVeterinarianId);
  const durationLabel = draft.durationMinutes ? `${draft.durationMinutes}분` : defaultWalkInDuration;
  const visitPurpose = draft.encounter.chiefComplaint ?? "현장 접수";
  const visitVisual = getVisitPurposeVisual(visitPurpose);
  const accentClassName = getVeterinarianAccentClassName(draft.encounter.primaryVeterinarianId);

  return (
    <div
      className="relative min-w-0 flex-1 overflow-hidden rounded-md border border-[var(--clair-color-atomic-green-200)] bg-[var(--clair-color-atomic-green-50)] p-2 pl-3 shadow-[0_1px_0_rgba(15,23,42,0.03)]"
      data-testid={`walkin-card-${draft.encounter.id}`}
    >
      <span
        data-testid={`walkin-accent-${draft.encounter.id}`}
        className={cn("absolute inset-y-0 left-0 w-1", accentClassName)}
        aria-hidden="true"
      />
      <button
        type="button"
        className="block w-full text-left outline-none"
        onClick={() => onSelectPatient(draft.encounter.patientId)}
      >
        <div className="flex items-center gap-1.5 overflow-hidden">
          <ReceptionStatusBadge
            className="h-5 rounded-md px-1.5 text-[11px]"
            label={getReceptionEncounterStatusLabel(draft.encounter.status)}
            tone={getEncounterTone(draft.encounter.status)}
          />
          <VisitPurposeChip
            icon={visitVisual.icon}
            label={visitVisual.label}
            testId={`walkin-purpose-${draft.encounter.id}`}
          />
        </div>
        <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-[13px] font-bold leading-4 text-[var(--clair-color-label-strong)]">
            {patient?.name ?? "환자 미지정"}
          </span>
          <span className="truncate text-[12px] font-semibold leading-4 text-[var(--clair-color-label-normal)]">
            {visitPurpose}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
          {getShortTime(draft.encounter.checkedInAt)} · {durationLabel} · {getGuardianDisplay(guardian)} ·{" "}
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

const receptionToolbarDateLabel = "26.05.01 (금)";
const receptionToolbarWeekLabel = "26.04.27 - 26.05.03";
const receptionToolbarMonthLabel = "26.05";
const receptionDateControlLabels: Record<
  ReceptionCalendarView,
  {
    dateLabel: string;
    pickerLabel: string;
    previousLabel: string;
    nextLabel: string;
  }
> = {
  day: {
    dateLabel: receptionToolbarDateLabel,
    pickerLabel: "날짜 선택",
    previousLabel: "이전 날짜",
    nextLabel: "다음 날짜",
  },
  week: {
    dateLabel: receptionToolbarWeekLabel,
    pickerLabel: "주 선택",
    previousLabel: "이전 주",
    nextLabel: "다음 주",
  },
  month: {
    dateLabel: receptionToolbarMonthLabel,
    pickerLabel: "월 선택",
    previousLabel: "이전 월",
    nextLabel: "다음 월",
  },
};
const receptionDatePickerWeekdays = ["일", "월", "화", "수", "목", "금", "토"];
const receptionDatePickerCells = [
  { key: "2026-04-26", day: "26", inMonth: false },
  { key: "2026-04-27", day: "27", inMonth: false },
  { key: "2026-04-28", day: "28", inMonth: false },
  { key: "2026-04-29", day: "29", inMonth: false },
  { key: "2026-04-30", day: "30", inMonth: false },
  { key: "2026-05-01", day: "1", inMonth: true, selected: true },
  { key: "2026-05-02", day: "2", inMonth: true },
  { key: "2026-05-03", day: "3", inMonth: true },
  { key: "2026-05-04", day: "4", inMonth: true },
  { key: "2026-05-05", day: "5", inMonth: true },
  { key: "2026-05-06", day: "6", inMonth: true },
  { key: "2026-05-07", day: "7", inMonth: true },
  { key: "2026-05-08", day: "8", inMonth: true },
  { key: "2026-05-09", day: "9", inMonth: true },
  { key: "2026-05-10", day: "10", inMonth: true },
  { key: "2026-05-11", day: "11", inMonth: true },
  { key: "2026-05-12", day: "12", inMonth: true },
  { key: "2026-05-13", day: "13", inMonth: true },
  { key: "2026-05-14", day: "14", inMonth: true },
  { key: "2026-05-15", day: "15", inMonth: true },
  { key: "2026-05-16", day: "16", inMonth: true },
  { key: "2026-05-17", day: "17", inMonth: true },
  { key: "2026-05-18", day: "18", inMonth: true },
  { key: "2026-05-19", day: "19", inMonth: true },
  { key: "2026-05-20", day: "20", inMonth: true },
  { key: "2026-05-21", day: "21", inMonth: true },
  { key: "2026-05-22", day: "22", inMonth: true },
  { key: "2026-05-23", day: "23", inMonth: true },
  { key: "2026-05-24", day: "24", inMonth: true },
  { key: "2026-05-25", day: "25", inMonth: true },
  { key: "2026-05-26", day: "26", inMonth: true },
  { key: "2026-05-27", day: "27", inMonth: true },
  { key: "2026-05-28", day: "28", inMonth: true },
  { key: "2026-05-29", day: "29", inMonth: true },
  { key: "2026-05-30", day: "30", inMonth: true },
];
const receptionWeekPickerRows = [
  { key: "2026-04-13", label: "26.04.13 - 26.04.19" },
  { key: "2026-04-20", label: "26.04.20 - 26.04.26" },
  { key: "2026-04-27", label: receptionToolbarWeekLabel, selected: true },
  { key: "2026-05-04", label: "26.05.04 - 26.05.10" },
  { key: "2026-05-11", label: "26.05.11 - 26.05.17" },
];
const receptionMonthPickerItems = [
  "26.01",
  "26.02",
  "26.03",
  "26.04",
  receptionToolbarMonthLabel,
  "26.06",
  "26.07",
  "26.08",
  "26.09",
  "26.10",
  "26.11",
  "26.12",
];

function ReceptionScheduleDateControl({ view }: { view: ReceptionCalendarView }) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const dateControlLabel = receptionDateControlLabels[view];

  return (
    <div className="flex h-7 shrink-0 items-center gap-1" data-testid="reception-date-control">
      <Button
        variant="outline"
        size="icon-sm"
        className="size-7 bg-[var(--emr-surface-panel)]"
        aria-label={dateControlLabel.previousLabel}
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        className="size-7 bg-[var(--emr-surface-panel)]"
        aria-label={dateControlLabel.nextLabel}
      >
        <ChevronRightIcon />
      </Button>
      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 justify-start px-2 text-[13px] font-medium leading-[18px] text-foreground"
              aria-label={`${dateControlLabel.dateLabel} ${dateControlLabel.pickerLabel}`}
            />
          }
        >
          <CdsFilesCalendarIcon
            className="size-3.5 text-[var(--clair-color-atomic-gray-400)]"
            aria-hidden="true"
          />
          <span>{dateControlLabel.dateLabel}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[244px] gap-3 p-3" initialFocus={false}>
          {view === "day" ? (
            <>
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold leading-5 text-[var(--clair-color-label-strong)]">
                  2026년 5월
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="이전 달">
                    <ChevronLeftIcon />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="다음 달">
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {receptionDatePickerWeekdays.map((weekday) => (
                  <span
                    key={weekday}
                    className="h-6 text-[11px] font-medium leading-6 text-muted-foreground"
                  >
                    {weekday}
                  </span>
                ))}
                {receptionDatePickerCells.map((cell) => (
                  <button
                    key={cell.key}
                    type="button"
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md text-[12px] font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                      cell.inMonth
                        ? "text-[var(--clair-color-label-strong)]"
                        : "text-[var(--clair-color-label-alternative)]",
                      cell.selected &&
                        "bg-[var(--clair-color-atomic-blue-500)] text-[var(--clair-color-static-white)] hover:bg-[var(--clair-color-atomic-blue-600)]"
                    )}
                    aria-label={
                      cell.selected ? `${receptionToolbarDateLabel} 선택됨` : `${cell.day}일 선택`
                    }
                    aria-pressed={cell.selected}
                    onClick={() => setDatePickerOpen(false)}
                  >
                    {cell.day}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {view === "week" ? (
            <>
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold leading-5 text-[var(--clair-color-label-strong)]">
                  2026년 4월 - 5월
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="이전 주 보기">
                    <ChevronLeftIcon />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="다음 주 보기">
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
              <div className="grid gap-1">
                {receptionWeekPickerRows.map((week) => (
                  <button
                    key={week.key}
                    type="button"
                    className={cn(
                      "flex h-8 items-center rounded-md px-2 text-left text-[12px] font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                      week.selected
                        ? "bg-[var(--clair-color-atomic-blue-50)] text-[var(--clair-color-atomic-blue-700)]"
                        : "text-[var(--clair-color-label-strong)]"
                    )}
                    aria-label={week.selected ? `${week.label} 선택됨` : `${week.label} 주 선택`}
                    aria-pressed={week.selected}
                    onClick={() => setDatePickerOpen(false)}
                  >
                    {week.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {view === "month" ? (
            <>
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold leading-5 text-[var(--clair-color-label-strong)]">
                  2026년
                </div>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="이전 연도">
                    <ChevronLeftIcon />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="다음 연도">
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {receptionMonthPickerItems.map((month) => {
                  const selected = month === receptionToolbarMonthLabel;

                  return (
                    <button
                      key={month}
                      type="button"
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md text-[12px] font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected
                          ? "bg-[var(--clair-color-atomic-blue-500)] text-[var(--clair-color-static-white)] hover:bg-[var(--clair-color-atomic-blue-600)]"
                          : "text-[var(--clair-color-label-strong)]"
                      )}
                      aria-label={selected ? `${month} 선택됨` : `${month} 월 선택`}
                      aria-pressed={selected}
                      onClick={() => setDatePickerOpen(false)}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 bg-[var(--emr-surface-panel)] px-2 text-[12px] font-medium"
        aria-label="오늘 일자로 이동"
        onClick={() => setDatePickerOpen(false)}
      >
        오늘
      </Button>
    </div>
  );
}

function ScheduleToolbar({
  onCreateWalkIn,
  onUnifiedPatientReady,
  onToggleVeterinarian,
  selectedVeterinarianIds,
  view,
  onViewChange,
}: {
  onCreateWalkIn: () => void;
  onUnifiedPatientReady: (patientId: string) => void;
  onToggleVeterinarian: (veterinarianId: string) => void;
  selectedVeterinarianIds: string[];
  view: ReceptionCalendarView;
  onViewChange: (view: ReceptionCalendarView) => void;
}) {
  const selectedVeterinarians = allVeterinarians.filter((veterinarian) =>
    selectedVeterinarianIds.includes(veterinarian.id)
  );
  const veterinarianLabel = getVeterinarianFilterLabel(selectedVeterinarians);

  return (
    <div
      className="flex h-12 shrink-0 flex-nowrap items-center justify-between gap-3 overflow-hidden border-b bg-card px-4"
      data-testid="schedule-toolbar"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ReceptionScheduleDateControl view={view} />
        <span className="ml-2 rounded-md bg-[var(--clair-color-atomic-gray-50)] px-2 py-1 text-[12px] font-medium leading-4 text-muted-foreground">
          영업시간{" "}
          <span className="font-semibold text-[var(--clair-color-primary-normal)]">
            {getBusinessHoursTimeRangeLabel()}
          </span>
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className:
                "min-w-[124px] justify-start border !border-[var(--emr-line-hairline)] bg-card text-[var(--clair-color-label-strong)]",
            })}
          >
            <CdsActionsSearchIcon data-icon="inline-start" />
            {veterinarianLabel}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuGroup>
              <DropdownMenuLabel>오늘 근무 수의사</DropdownMenuLabel>
              {todayWorkingVeterinarians.map((veterinarian) => (
                <DropdownMenuCheckboxItem
                  key={veterinarian.id}
                  checked={selectedVeterinarianIds.includes(veterinarian.id)}
                  onCheckedChange={() => onToggleVeterinarian(veterinarian.id)}
                >
                  <VeterinarianMenuItemLabel veterinarian={veterinarian} />
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>그 외 수의사</DropdownMenuLabel>
              {otherVeterinarians.map((veterinarian) => (
                <DropdownMenuCheckboxItem
                  key={veterinarian.id}
                  checked={selectedVeterinarianIds.includes(veterinarian.id)}
                  onCheckedChange={() => onToggleVeterinarian(veterinarian.id)}
                >
                  <VeterinarianMenuItemLabel veterinarian={veterinarian} />
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
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
        <NewUnifiedRegistrationButton onPatientReady={onUnifiedPatientReady} />
        <Button
          data-testid="schedule-check-in-button"
          size="sm"
          className="px-3 font-semibold"
          onClick={onCreateWalkIn}
        >
          <CdsActionsPlusIcon data-icon="inline-start" />
          진료 접수
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
  onCreateWalkIn,
  onSelectPatient,
  onSelectAppointment,
  selectedAppointmentId,
  selectedVeterinarians,
}: {
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  onCheckIn: (appointment: Appointment) => void;
  onCreateWalkIn: () => void;
  onSelectPatient: (patientId: string) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  selectedAppointmentId?: Appointment["id"];
  selectedVeterinarians: Veterinarian[];
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
              <VeterinarianLaneHeader toneIndex={getVeterinarianToneIndex(veterinarian)} veterinarian={veterinarian} />
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
        {dayScheduleHours.map((hour, index) =>
          isBusinessHourRow(hour) ? null : (
            <div
              key={`off-hour-background-${hour}`}
              className="pointer-events-none absolute inset-x-0 z-0 bg-[var(--clair-color-atomic-gray-50)]/70"
              style={{
                top: index * dayScheduleHourRowHeight,
                height: dayScheduleHourRowHeight,
              }}
            />
          )
        )}
        <div
          data-testid="day-time-axis"
          className="relative z-10 border-r"
          style={{ minHeight: dayScheduleHeight }}
        >
          {dayScheduleHourLabels.map((hour, index) => {
            const firstLabel = index === 0;
            const lastLabel = index === dayScheduleHourLabels.length - 1;

            return (
              <div
                key={hour}
                className={cn(
                  "absolute left-0 right-0 flex justify-end pr-2 text-[11px] leading-4 text-muted-foreground",
                  firstLabel && "translate-y-1",
                  lastLabel && "-translate-y-full",
                  !firstLabel && !lastLabel && "-translate-y-1/2"
                )}
                style={{
                  top: index * dayScheduleHourRowHeight,
                }}
              >
                {getScheduleHourLabel(hour)}
              </div>
            );
          })}
        </div>
        <div className="relative z-10 col-span-full col-start-2 min-w-0">
          <div
            className="pointer-events-none absolute -left-1 right-0 z-10 flex items-center"
            style={{ top: currentTimeOffset }}
          >
            <span className="size-2 rounded-full bg-[var(--clair-color-atomic-red-400)]" />
            <span className="h-px flex-1 bg-[var(--clair-color-atomic-red-300)]" />
          </div>
          {dayScheduleHours.map((hour) => {
            return (
              <div
                key={hour}
                data-testid={`day-hour-row-${hour}`}
                className="grid border-b"
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
                        <button
                          type="button"
                          aria-label={`${getScheduleHourLabel(hour)} ${veterinarian.name} 빈 시간 접수 생성`}
                          className="min-h-12 min-w-0 flex-1 rounded-md border border-dashed border-transparent outline-none transition-colors hover:border-[var(--clair-color-atomic-sky-200)] hover:bg-[var(--clair-color-atomic-sky-50)] focus-visible:ring-3 focus-visible:ring-ring/50"
                          data-testid={`day-empty-slot-${hour}-${veterinarian.id}`}
                          onClick={onCreateWalkIn}
                        >
                          <span className="sr-only">진료 접수 생성</span>
                        </button>
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
  draftCheckIns,
  onCheckIn,
  onCreateWalkIn,
  onSelectPatient,
  onSelectAppointment,
  selectedAppointmentId,
}: {
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  onCheckIn: (appointment: Appointment) => void;
  onCreateWalkIn: () => void;
  onSelectPatient: (patientId: string) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  selectedAppointmentId?: Appointment["id"];
}) {
  const currentTimeOffset = getDayCurrentTimeOffset();
  const activeDayIndex = weekDays.findIndex((day) => day.active);
  const dayColumnWidth = "calc((100% - 56px) / 7)";
  const weekScheduleHeight = dayScheduleHours.length * dayScheduleHourRowHeight;
  const walkInDrafts = draftCheckIns.filter((draft) => draft.receptionType === "walk_in");

  return (
    <div
      className="flex min-h-[720px] min-w-[1120px] flex-col bg-card"
      data-testid="reception-week-calendar"
    >
      <div
        className="sticky top-0 z-30 grid border-b bg-card shadow-[0_1px_0_var(--border)]"
        style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}
      >
        <div className="border-r" />
        {weekDays.map((day) => (
          <div
            key={`${day.label}-${day.day}-header`}
            className={cn(
              "flex h-16 flex-col items-center justify-center border-r last:border-r-0",
              day.active && "bg-[var(--clair-color-atomic-sky-50)]/60"
            )}
          >
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
        ))}
      </div>

      <div
        className="relative flex-1"
        style={{ minHeight: weekScheduleHeight }}
      >
        {activeDayIndex >= 0 ? (
          <div
            data-testid="week-current-time-indicator"
            className="pointer-events-none absolute z-20 flex items-center"
            style={{
              left: `calc(56px + ${dayColumnWidth} * ${activeDayIndex})`,
              top: currentTimeOffset,
              width: dayColumnWidth,
            }}
          >
            <span className="size-2 rounded-full bg-[var(--clair-color-atomic-red-400)]" />
            <span className="h-px flex-1 bg-[var(--clair-color-atomic-red-300)]" />
          </div>
        ) : null}

        {dayScheduleHours.map((hour) => (
          <div
            key={`week-hour-${hour}`}
            className="grid border-b last:border-b-0"
            style={{
              gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))",
              minHeight: dayScheduleHourRowHeight,
            }}
          >
            <div className="relative border-r">
              <span className="absolute left-0 right-0 top-2 text-center text-[11px] text-muted-foreground">
                {getScheduleHourLabel(hour)}
              </span>
            </div>
            {weekDays.map((day) => {
              const dayAppointments = day.active ? appointments : appointments.slice(0, 1);
              const hourAppointments = dayAppointments.filter(
                (appointment) => getAppointmentHour(appointment) === hour
              );
              const hourWalkIns = day.active
                ? walkInDrafts.filter(
                    (draft) =>
                      Number((draft.encounter.checkedInAt ?? draft.encounter.createdAt).slice(11, 13)) ===
                      hour
                  )
                : [];

              return (
                <div
                  key={`week-${day.day}-${hour}`}
                  className={cn(
                    "flex min-w-0 gap-2 border-r p-2 last:border-r-0",
                    day.active && "bg-[var(--clair-color-atomic-sky-50)]/40",
                    !isBusinessHourRow(hour) && "bg-[var(--clair-color-atomic-gray-50)]/70"
                  )}
                >
                  {hourAppointments.map((appointment) => (
                    <ScheduleAppointmentCard
                      key={`${day.day}-${hour}-${appointment.id}`}
                      appointment={appointment}
                      selected={Boolean(day.active && appointment.id === selectedAppointmentId)}
                      onSelect={() => onSelectAppointment(appointment)}
                      onCheckIn={() => onCheckIn(appointment)}
                    />
                  ))}
                  {hourWalkIns.map((draft) => (
                    <ScheduleWalkInQueueCard
                      key={`${day.day}-${hour}-${draft.encounter.id}`}
                      draft={draft}
                      onSelectPatient={onSelectPatient}
                    />
                  ))}
                  {hourAppointments.length || hourWalkIns.length ? null : (
                    <button
                      type="button"
                      aria-label={`${day.label} ${getScheduleHourLabel(hour)} 빈 시간 접수 생성`}
                      className="min-h-12 min-w-0 flex-1 rounded-md border border-dashed border-transparent outline-none transition-colors hover:border-[var(--clair-color-atomic-sky-200)] hover:bg-[var(--clair-color-atomic-sky-50)] focus-visible:ring-3 focus-visible:ring-ring/50"
                      data-testid={`week-empty-slot-${day.day}-${hour}`}
                      onClick={onCreateWalkIn}
                    >
                      <span className="sr-only">진료 접수 생성</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div
          className="grid"
          style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}
        >
          <div className="relative h-6 border-r">
            <span className="absolute left-0 right-0 -top-3 text-center text-[11px] text-muted-foreground">
              {getScheduleHourLabel(dayScheduleEndHour)}
            </span>
          </div>
          {weekDays.map((day) => (
            <div
              key={`week-bottom-${day.day}`}
              className={cn("border-r last:border-r-0", day.active && "bg-[var(--clair-color-atomic-sky-50)]/40")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthScheduleBoard({ appointmentCount }: { appointmentCount: number }) {
  return (
    <div
      className="grid h-full min-h-[720px] grid-cols-7 grid-rows-5 bg-card"
      data-testid="reception-month-calendar"
    >
      {monthDays.map((day) => (
        <div
          key={day}
          className={cn(
            "min-h-0 border-b border-r p-3 last:border-r-0",
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
  onCreateWalkIn,
  onSelectPatient,
  onSelectAppointment,
  selectedAppointmentId,
  selectedVeterinarians,
  view,
}: {
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  onCheckIn: (appointment: Appointment) => void;
  onCreateWalkIn: () => void;
  onSelectPatient: (patientId: string) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  selectedAppointmentId?: Appointment["id"];
  selectedVeterinarians: Veterinarian[];
  view: ReceptionCalendarView;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden">
      <section
        className="min-h-0 min-w-0 overflow-hidden bg-card"
        data-testid="reception-calendar-frame"
      >
        <ScrollArea className="h-full">
          {view === "day" ? (
            <DayScheduleBoard
              appointments={appointments}
              draftCheckIns={draftCheckIns}
              selectedAppointmentId={selectedAppointmentId}
              selectedVeterinarians={selectedVeterinarians}
              onSelectAppointment={onSelectAppointment}
              onSelectPatient={onSelectPatient}
              onCreateWalkIn={onCreateWalkIn}
              onCheckIn={onCheckIn}
            />
          ) : null}
          {view === "week" ? (
            <WeekScheduleBoard
              appointments={appointments}
              draftCheckIns={draftCheckIns}
              selectedAppointmentId={selectedAppointmentId}
              onSelectAppointment={onSelectAppointment}
              onSelectPatient={onSelectPatient}
              onCreateWalkIn={onCreateWalkIn}
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
  const [walkInInitialPatientId, setWalkInInitialPatientId] = useState<string | undefined>();
  const [walkInDialogOpen, setWalkInDialogOpen] = useState(false);
  const [selectedVeterinarianIds, setSelectedVeterinarianIds] = useState(() =>
    allVeterinarians.map((veterinarian) => veterinarian.id)
  );
  const selectedAppointmentId = useReceptionStore((state) => state.selectedAppointmentId);
  const selectedEncounterId = useReceptionStore((state) => state.selectedEncounterId);
  const selectedPatientId = useReceptionStore((state) => state.selectedPatientId);
  const messageDeliveries = useReceptionStore((state) => state.messageDeliveries);
  const checkInAppointment = useReceptionStore((state) => state.checkInAppointment);
  const createWalkInCheckIn = useReceptionStore((state) => state.createWalkInCheckIn);
  const selectAppointment = useReceptionStore((state) => state.selectAppointment);
  const selectEncounter = useReceptionStore((state) => state.selectEncounter);
  const selectPatient = useReceptionStore((state) => state.selectPatient);
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryPatientId = searchParams.get("patientId") ?? scenario?.patientId;
  const queryEncounterId = searchParams.get("encounterId") ?? scenario?.encounterId;
  const appointments = useMemo(() => getTodayAppointments(draftCheckIns), [draftCheckIns]);
  const patientSummaries = useMemo(
    () => getReceptionPatientSummaries(draftCheckIns, { guardians, patientGuardians, patients }),
    [draftCheckIns, guardians, patientGuardians, patients]
  );
  const selectedVeterinarians = useMemo(
    () =>
      allVeterinarians.filter((veterinarian) =>
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
  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);
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
  const lastMessageDelivery = messageDeliveries.at(-1);
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
  const openWalkInDialog = () => {
    setActiveDrawer(null);
    setWalkInInitialPatientId(undefined);
    setWalkInDialogOpen(true);
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
        onCreateWalkIn={openWalkInDialog}
        onUnifiedPatientReady={(patientId) => {
          setActiveDrawer(null);
          selectPatient(patientId);
          setWalkInInitialPatientId(patientId);
          setWalkInDialogOpen(true);
        }}
      />
      {walkInDialogOpen ? (
        <WalkInReceptionDialog
          initialPatientId={walkInInitialPatientId}
          open={walkInDialogOpen}
          patientSummaries={patientSummaries}
          onOpenChange={(nextOpen) => {
            setWalkInDialogOpen(nextOpen);
            if (!nextOpen) setWalkInInitialPatientId(undefined);
          }}
          onCreate={(input) => {
            createWalkInCheckIn(input);
            setWalkInInitialPatientId(undefined);
            setWalkInDialogOpen(false);
          }}
        />
      ) : null}
      {lastMessageDelivery ? (
        <div
          className="border-b bg-[var(--clair-color-atomic-green-50)] px-4 py-2 text-[12px] font-semibold text-[var(--clair-color-atomic-green-700)]"
          data-testid="check-in-message-delivery"
        >
          카카오톡 발송 완료: {lastMessageDelivery.bodySnapshot}
        </div>
      ) : null}
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
        onCreateWalkIn={openWalkInDialog}
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

function WalkInReceptionDialog({
  initialPatientId,
  onCreate,
  onOpenChange,
  open,
  patientSummaries,
}: {
  initialPatientId?: string;
  onCreate: (input: WalkInReceptionInput) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  patientSummaries: ReceptionPatientSummary[];
}) {
  const [receptionDepartment, setReceptionDepartment] = useState(defaultWalkInDepartment);
  const [receptionDuration, setReceptionDuration] = useState(defaultWalkInDuration);
  const [receptionMemo, setReceptionMemo] = useState("");
  const [receptionPatientId, setReceptionPatientId] = useState(initialPatientId ?? "");
  const [receptionVeterinarianId, setReceptionVeterinarianId] = useState(
    unassignedVeterinarianValue
  );
  const [customPurposeTags, setCustomPurposeTags] = useState<string[]>([]);
  const [isAddingPurposeTag, setIsAddingPurposeTag] = useState(false);
  const [newPurposeTag, setNewPurposeTag] = useState("");
  const [receptionPurposeTags, setReceptionPurposeTags] = useState<string[]>([]);
  const [receptionVisitPurpose, setReceptionVisitPurpose] = useState("");
  const [sendKakaoMessage, setSendKakaoMessage] = useState(true);
  const selectedSummary = patientSummaries.find(
    (summary) => summary.patient.id === receptionPatientId
  );
  const patient = selectedSummary?.patient;
  const guardian = selectedSummary?.primaryGuardian;
  const visitPurpose = [receptionPurposeTags.join(", "), receptionVisitPurpose.trim()]
    .filter(Boolean)
    .join(" · ");
  const canCreate = Boolean(patient && visitPurpose);
  const patientOptionText = selectedSummary ? getReceptionPatientOptionLabel(selectedSummary) : "";
  const patientWeightKg = getRecentPatientWeightKg(patient);
  const purposeChips = [...receptionPurposeChips, ...customPurposeTags];

  const close = () => onOpenChange(false);
  const togglePurposeTag = (purpose: string) => {
    setReceptionPurposeTags((current) =>
      current.includes(purpose)
        ? current.filter((item) => item !== purpose)
        : [...current, purpose]
    );
  };
  const addPurposeTag = () => {
    const purpose = newPurposeTag.trim();

    if (!purpose) {
      setIsAddingPurposeTag(false);
      setNewPurposeTag("");
      return;
    }

    const existingPurpose = purposeChips.find((item) => item === purpose);

    if (!existingPurpose) {
      setCustomPurposeTags((current) =>
        current.includes(purpose) ? current : [...current, purpose]
      );
    }

    setReceptionPurposeTags((current) =>
      current.includes(existingPurpose ?? purpose) ? current : [...current, existingPurpose ?? purpose]
    );
    setIsAddingPurposeTag(false);
    setNewPurposeTag("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid max-h-[calc(100vh-5rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[640px]"
        data-testid="walk-in-reception-dialog"
        showCloseButton={false}
      >
        <DialogHeader className="px-8 pb-4 pt-7">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-[22px] font-bold leading-7 text-[var(--clair-color-label-strong)]">
                진료 접수
              </DialogTitle>
              <DialogDescription className="sr-only">
                새 진료 접수 생성 양식입니다.
              </DialogDescription>
            </div>
            <RegistrationDialogCloseButton ariaLabel="진료 접수 닫기" onClick={close} />
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(100vh-15rem)] min-h-0 overflow-hidden px-7">
          <div className="flex flex-col gap-5 px-1 pb-6 pt-3">
            <RegistrationFormSection separated={false} title="환자 정보">
              <div className="grid grid-cols-[minmax(0,1fr)_160px] gap-x-7 gap-y-5">
                <RegistrationFormField
                  label="환자 검색"
                  required
                  helper={patientOptionText || "환자명, 동물 정보, 보호자명으로 검색합니다."}
                >
                  <Select
                    value={receptionPatientId}
                    onValueChange={(value) => setReceptionPatientId(value ?? "")}
                  >
                    <SelectTrigger
                      aria-label="환자 검색"
                      className="h-10 w-full bg-card"
                    >
                      <CdsActionsSearchIcon
                        className="size-3 shrink-0 text-[var(--clair-color-atomic-gray-600)]"
                        aria-hidden="true"
                      />
                      <SelectValue placeholder="동물명 또는 보호자명으로 검색" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {patientSummaries.map((summary) => (
                          <SelectItem key={summary.patient.id} value={summary.patient.id}>
                            {getReceptionPatientOptionLabel(summary)}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </RegistrationFormField>

                <RegistrationFormField label="체중">
                  <div className="relative">
                    <Input
                      aria-label="체중"
                      className="h-10 bg-card pr-9 text-[var(--clair-color-atomic-gray-500)]"
                      readOnly
                      value={patientWeightKg}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-medium leading-4 text-[var(--clair-color-label-strong)]">
                      kg
                    </span>
                  </div>
                </RegistrationFormField>
              </div>

              <RegistrationFormField
                label="방문 목적"
                required
                helper="태그는 방문 목적 검색과 통계 분류에 사용하고, 상세 내용은 자유롭게 남깁니다."
              >
                <Textarea
                  aria-label="방문 목적"
                  className="min-h-[104px] resize-none bg-card"
                  placeholder="방문 목적을 자세히 입력해주세요"
                  value={receptionVisitPurpose}
                  onChange={(event) => setReceptionVisitPurpose(event.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {purposeChips.map((purpose) => {
                    const selected = receptionPurposeTags.includes(purpose);

                    return (
                      <Button
                        key={purpose}
                        type="button"
                        variant={selected ? "default" : "outline"}
                        size="sm"
                        className={cn(
                          "h-7 rounded-full px-2.5 text-[12px] font-semibold",
                          selected
                            ? "bg-[var(--clair-color-primary-normal)] text-white hover:bg-[var(--clair-color-primary-normal)]/90"
                            : ""
                        )}
                        aria-pressed={selected}
                        onClick={() => togglePurposeTag(purpose)}
                      >
                        {purpose}
                      </Button>
                    );
                  })}
                  {isAddingPurposeTag ? (
                    <Input
                      aria-label="태그명"
                      autoFocus
                      className="h-8 w-[108px] rounded-full bg-card px-3 text-[12px] font-semibold"
                      placeholder="태그명"
                      value={newPurposeTag}
                      onBlur={addPurposeTag}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addPurposeTag();
                        }
                        if (event.key === "Escape") {
                          setIsAddingPurposeTag(false);
                          setNewPurposeTag("");
                        }
                      }}
                      onValueChange={setNewPurposeTag}
                    />
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="size-7 rounded-full"
                      aria-label="태그 추가"
                      onClick={() => setIsAddingPurposeTag(true)}
                    >
                      <CdsActionsPlusIcon className="size-3.5" />
                    </Button>
                  )}
                </div>
              </RegistrationFormField>
            </RegistrationFormSection>

            <RegistrationFormSection title="접수 정보">
              <div className="grid grid-cols-2 gap-x-7 gap-y-5">
                <RegistrationFormField
                  label="진료과"
                  required
                  helper="다른 진료과로의 접수는 먼저 진료과를 변경한 후 가능합니다."
                >
                <Select
                  value={receptionDepartment}
                  onValueChange={(value) => {
                    if (value) setReceptionDepartment(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="진료과"
                    className="h-10 w-full bg-card"
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
              </RegistrationFormField>

                <RegistrationFormField
                  label="담당의"
                  helper="담당의 지정 후 시간을 설정할 수 있습니다."
                >
                <Select
                  value={receptionVeterinarianId}
                  onValueChange={(value) => {
                    if (value) setReceptionVeterinarianId(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="담당의"
                    className="h-10 w-full bg-card"
                  >
                    <CdsActionsSearchIcon
                      className="size-3 shrink-0 text-[var(--clair-color-atomic-gray-600)]"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-left">
                      {getReceptionVeterinarianSelectLabel(receptionVeterinarianId)}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={unassignedVeterinarianValue}>수의사 미지정</SelectItem>
                      {allVeterinarians.map((veterinarian) => (
                        <SelectItem key={veterinarian.id} value={veterinarian.id}>
                          {veterinarian.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </RegistrationFormField>
              </div>
              <div className="grid grid-cols-3 gap-x-7 gap-y-5">
                <RegistrationFormField label="접수일">
                <div className="relative">
                  <CdsFilesCalendarIcon
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--clair-color-atomic-gray-600)]"
                    aria-hidden="true"
                  />
                  <Input
                    aria-label="접수일"
                    className="h-10 bg-card pl-9"
                    readOnly
                    value="26.05.01"
                  />
                </div>
              </RegistrationFormField>

                <RegistrationFormField label="진료시간">
                <div className="relative">
                  <CdsFilesClockIcon
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--clair-color-atomic-gray-400)]"
                    aria-hidden="true"
                  />
                  <Input
                    aria-label="진료시간"
                    className="h-10 bg-card pl-9 text-[var(--clair-color-atomic-gray-500)] disabled:bg-[var(--clair-color-background-surface)] disabled:opacity-100"
                    disabled
                    value="진료시간"
                  />
                </div>
              </RegistrationFormField>

                <RegistrationFormField label="예상시간" required>
                <Select
                  value={receptionDuration}
                  onValueChange={(value) => {
                    if (value) setReceptionDuration(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="예상시간"
                    className="h-10 w-full bg-card"
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
              </RegistrationFormField>
              </div>
              <RegistrationFormField label="접수 메모">
                <Textarea
                  aria-label="접수 메모"
                  className="min-h-[88px] resize-none bg-card"
                  placeholder="접수 메모를 입력해주세요"
                  value={receptionMemo}
                  onChange={(event) => setReceptionMemo(event.target.value)}
                />
              </RegistrationFormField>
            </RegistrationFormSection>
          </div>
        </ScrollArea>

        <DialogFooter className="relative -mx-0 -mb-0 items-center justify-between rounded-none border-t bg-white px-8 py-4 sm:justify-between">
          <label className="flex w-fit items-center gap-2 rounded-md border bg-card px-2.5 py-2 text-[12px] font-semibold text-[var(--clair-color-label-normal)]">
            <Checkbox
              aria-label="카카오톡 발송"
              checked={sendKakaoMessage}
              onCheckedChange={(checked) => setSendKakaoMessage(Boolean(checked))}
            />
            카카오톡 발송
          </label>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-8 rounded-full px-4 text-[12px] font-semibold text-[var(--clair-color-label-strong)]"
              onClick={close}
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

                if (!patient) return;

                onCreate({
                  department: receptionDepartment,
                  durationMinutes: getDurationMinutesFromLabel(receptionDuration),
                  guardianId: guardian?.id,
                  guardianMobilePhone: guardian?.mobilePhone,
                  memo: receptionMemo.trim() || undefined,
                  patientId: patient.id,
                  patientName: patient.name,
                  primaryVeterinarianId: selectedVeterinarianId,
                  sendKakaoMessage,
                  visitPurpose,
                });
              }}
            >
              생성
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getReceptionDrawerPatientNo(
  activeDrawer: { type: string; id: string },
  draftCheckIns: ReceptionDraftCheckIn[],
  appointments: Appointment[]
) {
  if (activeDrawer.type === "reception-appointment") {
    const appointment = appointments.find((item) => item.id === activeDrawer.id);

    return appointment ? getMockPatientBundle(appointment.patientId)?.patient.patientNo : undefined;
  }

  const encounter =
    draftCheckIns.map((draft) => draft.encounter).find((item) => item.id === activeDrawer.id) ??
    mockEncounters.find((item) => item.id === activeDrawer.id);

  return encounter ? getMockPatientBundle(encounter.patientId)?.patient.patientNo : undefined;
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
  useEffect(() => {
    if (activeDrawer?.type === "reception-form") {
      setActiveDrawer(null);
      return;
    }

    if (!activeDrawer || activeDrawer.subtitle) return;
    if (activeDrawer.type !== "reception-encounter" && activeDrawer.type !== "reception-appointment") return;

    const subtitle = getReceptionDrawerPatientNo(activeDrawer, draftCheckIns, appointments);

    if (subtitle) {
      setActiveDrawer({ ...activeDrawer, subtitle });
    }
  }, [activeDrawer, appointments, draftCheckIns, setActiveDrawer]);

  if (activeDrawer?.type === "reception-patient") {
    return <PatientProfileDrawer patientId={activeDrawer.id} />;
  }

  if (activeDrawer?.type === "reception-guardian") {
    return <GuardianProfileDrawer guardianId={activeDrawer.id} />;
  }

  if (activeDrawer?.type === "reception-form") {
    return null;
  }

  const selectedAppointment =
    activeDrawer?.type === "reception-appointment"
      ? appointments.find((appointment) => appointment.id === activeDrawer.id)
      : undefined;
  const selectedDrawerEncounter =
    activeDrawer?.type === "reception-encounter"
      ? [...draftCheckIns.map((draft) => draft.encounter), ...mockEncounters].find(
          (encounter) => encounter.id === activeDrawer.id
        )
      : undefined;
  const patientId =
    selectedAppointment?.patientId ??
    selectedDrawerEncounter?.patientId ??
    (activeDrawer?.type === "reception-patient" ? activeDrawer.id : selectedPatientId);
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
      : selectedDrawerEncounter
        ? recentEncounters.find((encounter) => encounter.id === selectedDrawerEncounter.id) ??
          selectedDrawerEncounter
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
