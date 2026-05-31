"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
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
  EmrSidePanelIdentityLine,
  EmrSidePanelMetaBadge,
  EmrSidePanelStatusBadge,
  EmrSidePanelTypeBadge,
  emrSidePanelCardActionButtonClassName,
} from "@/components/emr/side-panel-card";
import { EmrRowActionMenu } from "@/components/emr/row-action-menu";
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
import { EmrInlineAlert } from "@/components/emr/inline-alert";
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
import { useMockAuthStore } from "@/features/auth/session-store";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import type {
  ReceptionAppointmentCheckInRecord,
  ReceptionAppointmentCheckInResponse,
} from "@/features/reception/appointment-check-in";
import type {
  ReceptionPatientGuardianLookupItem,
  ReceptionPatientGuardianLookupResponse,
} from "@/features/reception/patient-guardian-lookup";
import type { ReceptionCalendarReadResponse } from "@/features/reception/reception-calendar-read";
import type { ReceptionQueueReadResponse } from "@/features/reception/reception-queue-read";
import type {
  ReceptionWalkInEncounterInput,
  ReceptionWalkInEncounterRecord,
  ReceptionWalkInEncounterResponse,
} from "@/features/reception/walk-in-encounter";
import { saveChartLiveEncounterHandoff } from "@/features/chart/live-encounter-handoff";
import { useReceptionStore } from "@/features/reception/store";
import {
  ReceptionEmptyState,
  ReceptionPanelStateMessage,
  ReceptionSearchInput,
} from "@/features/reception/reception-list-search";
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
  "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-text)]",
  "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-text)]",
  "border-[var(--emr-state-selected-border)] bg-[var(--emr-line-selected)]",
  "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-text)]",
  "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-text)]",
  "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-text)]",
  "border-[var(--emr-status-info-border)] bg-[var(--emr-text-link)]",
  "border-[var(--emr-line-strong)] bg-[var(--emr-text-secondary)]",
  "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-text)]",
  "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-text)]",
];
const veterinarianAccentToneClasses = [
  "bg-[var(--emr-status-info-text)]",
  "bg-[var(--emr-status-success-text)]",
  "bg-[var(--emr-line-selected)]",
  "bg-[var(--emr-status-warning-text)]",
  "bg-[var(--emr-status-success-text)]",
  "bg-[var(--emr-status-danger-text)]",
  "bg-[var(--emr-text-link)]",
  "bg-[var(--emr-text-secondary)]",
  "bg-[var(--emr-status-info-text)]",
  "bg-[var(--emr-status-danger-text)]",
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

function getReceptionDemoActorId(role?: string) {
  if (role === "hospital_admin" || role === "billing_admin") return "user-admin";
  if (role === "vet") return "user-vet";
  return "user-front-desk";
}

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
  if (!veterinarianId) return "bg-[var(--emr-line-strong)]";

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
        "flex h-12 min-w-0 items-center gap-2 rounded-md border px-2.5 text-primary-foreground shadow-sm",
        veterinarianHeaderToneClasses[toneIndex % veterinarianHeaderToneClasses.length]
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--emr-text-inverse)] bg-[var(--emr-state-hover)] text-[10px] font-semibold leading-none text-primary-foreground">
        {veterinarian.initial}
      </span>
      <span className="min-w-0 truncate emr-text-dense font-semibold">{veterinarian.name}</span>
    </div>
  );
}

function VeterinarianMenuItemLabel({ veterinarian }: { veterinarian: Veterinarian }) {
  const toneIndex = getVeterinarianToneIndex(veterinarian);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold leading-none text-primary-foreground",
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

const getReceptionPatientSearchText = (
  patient: Patient,
  primaryGuardian?: ReceptionPatientSummary["primaryGuardian"]
) =>
  [
    patient.name,
    patient.patientNo,
    patient.breed,
    getSpeciesLabel(patient.species),
    primaryGuardian?.name,
    primaryGuardian?.mobilePhone,
    primaryGuardian?.phone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const mapLookupItemToReceptionPatientSummary = (
  item: ReceptionPatientGuardianLookupItem
): ReceptionPatientSummary => ({
  patient: item.patient,
  primaryGuardian: item.primaryGuardian,
  searchText: item.searchText ?? getReceptionPatientSearchText(item.patient, item.primaryGuardian),
});

async function submitWalkInEncounter({
  actorRole,
  input,
  workspaceId,
}: {
  actorRole?: string;
  input: ReceptionWalkInEncounterInput;
  workspaceId: string;
}): Promise<ReceptionWalkInEncounterResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/walk-in-encounters`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-clair-demo-session-user-id": getReceptionDemoActorId(actorRole),
        },
        body: JSON.stringify(input),
      }
    );
    const body = (await response.json()) as ReceptionWalkInEncounterResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function submitAppointmentCheckIn({
  actorRole,
  appointmentId,
  workspaceId,
}: {
  actorRole?: string;
  appointmentId: string;
  workspaceId: string;
}): Promise<ReceptionAppointmentCheckInResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/appointments/${encodeURIComponent(appointmentId)}/check-in`,
      {
        method: "POST",
        headers: {
          "x-clair-demo-session-user-id": getReceptionDemoActorId(actorRole),
        },
      }
    );
    const body = (await response.json()) as ReceptionAppointmentCheckInResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function loadReceptionQueue({
  actorId,
  workspaceId,
}: {
  actorId?: string;
  workspaceId: string;
}): Promise<ReceptionQueueReadResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/queue`,
      {
        cache: "no-store",
        headers: actorId ? { "x-clair-demo-session-user-id": actorId } : undefined,
      }
    );
    const body = (await response.json()) as ReceptionQueueReadResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

async function loadReceptionCalendar({
  actorId,
  date,
  workspaceId,
}: {
  actorId?: string;
  date: string;
  workspaceId: string;
}): Promise<ReceptionCalendarReadResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/calendar/day?date=${encodeURIComponent(date)}`,
      {
        cache: "no-store",
        headers: actorId ? { "x-clair-demo-session-user-id": actorId } : undefined,
      }
    );
    const body = (await response.json()) as ReceptionCalendarReadResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

function getWalkInRouteErrorMessage(
  result: Extract<ReceptionWalkInEncounterResponse, { ok: false }>
) {
  if (result.error === "rate_limited") return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (result.error === "invalid_input") {
    return Object.values(result.fieldErrors ?? {})[0] ?? "접수 정보를 확인해 주세요.";
  }
  if (result.denialReason === "patient_unavailable") return "접수할 환자를 찾을 수 없습니다.";
  if (result.denialReason === "guardian_unavailable") return "연결할 보호자를 찾을 수 없습니다.";
  if (result.denialReason === "patient_guardian_link_missing") {
    return "선택한 보호자와 환자 연결을 확인해 주세요.";
  }
  if (
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return "이 workspace에서 현장 접수를 생성할 권한이 없습니다.";
  }

  return "현장 접수 생성에 실패했습니다.";
}

function getAppointmentCheckInRouteErrorMessage(
  result: Extract<ReceptionAppointmentCheckInResponse, { ok: false }>
) {
  if (result.error === "rate_limited") return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (result.denialReason === "appointment_unavailable") return "예약 정보를 찾을 수 없습니다.";
  if (result.denialReason === "appointment_already_checked_in") {
    return "이미 접수된 예약입니다.";
  }
  if (result.denialReason === "appointment_not_check_in_ready") {
    return "접수 처리할 수 없는 예약 상태입니다.";
  }
  if (
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return "이 workspace에서 예약 접수를 처리할 권한이 없습니다.";
  }

  return "예약 접수 처리에 실패했습니다.";
}

function getReceptionReadFailureMessage(
  result: Extract<ReceptionQueueReadResponse | ReceptionCalendarReadResponse, { ok: false }>
) {
  if (
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return "접수 보기 권한 또는 workspace membership을 확인해야 해. 현재 화면은 로컬 데모/세션 데이터 기준으로 유지돼.";
  }

  if (result.denialReason === "unauthenticated") {
    return "로그인 세션을 확인하지 못했어. 현재 화면은 로컬 데모/세션 데이터 기준으로 유지돼.";
  }

  if (result.error === "supabase_client_missing") {
    return "live Supabase read 연결이 구성되지 않았어. 현재 화면은 로컬 데모/세션 데이터 기준으로 유지돼.";
  }

  return "서버 read 결과를 반영하지 못했어. 현재 화면은 로컬 데모/세션 데이터 기준으로 유지돼.";
}

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

const getWaitingTimeTextClassName = (waitingMinutes?: number) => {
  if (waitingMinutes === undefined || waitingMinutes < 30) {
    return "text-[var(--emr-text-secondary)]";
  }

  if (waitingMinutes >= 90) {
    return "text-destructive";
  }

  if (waitingMinutes >= 60) {
    return "text-[var(--emr-status-warning-text)]";
  }

  return "text-[var(--emr-status-warning-text)]";
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
      className="inline-flex h-5 shrink-0 items-center gap-1 rounded-md border border-[var(--emr-line-subtle)] bg-[var(--emr-surface-floating)] px-1.5 text-[10px] font-semibold leading-none text-[var(--emr-text-secondary)]"
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
        "h-6 rounded-lg px-2 py-0.5 emr-text-metadata font-medium leading-4",
        tone === "green" &&
          "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] text-[var(--emr-status-success-text)]",
        tone === "orange" &&
          "border-[var(--emr-status-warning-border)] bg-[var(--emr-status-warning-bg)] text-[var(--emr-status-warning-text)]",
        tone === "sky" &&
          "border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] text-primary",
        tone === "red" &&
          "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] text-destructive",
        tone === "default" && "border-border bg-card text-[var(--emr-text-secondary)]",
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
  onOpenChart,
  onUnavailableAction,
  selected,
  summary,
  onSelect,
}: {
  onOpenChart: (summary: ReceptionPatientSummary) => void;
  onUnavailableAction: (feedback: ReceptionCardActionFeedback) => void;
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
            "ml-1 shrink-0 emr-text-micro font-semibold leading-none",
            getWaitingTimeTextClassName(waitingMinutes)
          )}
        >
          ({waitingMinutes}분 대기)
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
      selectionVariant="modulePanel"
      selected={selected}
      testId={`patient-card-${summary.patient.id}`}
      onSelect={onSelect}
    >
      <EmrSidePanelIdentityLine
        patientName={summary.patient.name}
        guardianName={guardianName}
        typeBadge={<EmrSidePanelTypeBadge label={receptionType} />}
        action={
          <EmrRowActionMenu
            ariaLabel={`${summary.patient.name} 카드 작업`}
            contentClassName="w-56"
            items={[
              {
                key: "open",
                label: "접수 상세 보기",
                description: "현재 drawer 열기",
                onSelect,
              },
              {
                key: "chart",
                label: "차트 보러가기",
                description: summary.activeEncounter
                  ? "진료/차트 탭에서 열기"
                  : "접수 생성 후 이동 가능",
                onSelect: () => {
                  if (summary.activeEncounter) {
                    onOpenChart(summary);
                    return;
                  }

                  onUnavailableAction({
                    title: "먼저 접수를 생성해야 해",
                    body: `${summary.patient.name}은 아직 진행 중인 encounter가 없어서 차트로 넘길 live 접수 id가 없어.`,
                  });
                },
              },
              {
                key: "message",
                label: "카카오톡 발송",
                description: "외부 발송 미연동",
                onSelect: () =>
                  onUnavailableAction({
                    title: "카카오톡 발송은 아직 연결되지 않았어",
                    body: "실제 카카오톡, 문자, 이메일 발송은 이번 MVP 범위 밖이야. 접수 카드에서는 환자/보호자 맥락만 확인해.",
                  }),
              },
            ]}
            testId={`reception-card-action-${summary.patient.id}`}
            triggerClassName={emrSidePanelCardActionButtonClassName}
          />
        }
      />
      <div className="mt-0.5 flex h-[18px] min-w-0 items-center gap-1 emr-text-dense-label font-medium text-muted-foreground">
        <span className="min-w-0 flex-1 truncate">{visitText}</span>
      </div>
      <div className="my-1.5 h-px w-full bg-[var(--emr-line-subtle)]" />
      <div className="flex min-h-5 min-w-0 flex-wrap items-center gap-1">
        <EmrSidePanelMetaBadge
          label="수의사"
          maxWidthClassName="max-w-[120px]"
          value={veterinarianName}
        />
        <EmrSidePanelStatusBadge
          icon={<CdsFilesClockIcon className="size-3.5" aria-hidden="true" />}
          maxWidthClassName="max-w-none"
        >
          {timeContent}
        </EmrSidePanelStatusBadge>
      </div>
    </EmrSidePanelCard>
  );
}

type ReceptionCardActionFeedback = {
  body: ReactNode;
  title: string;
};

export function ReceptionSidePanel({ moduleLabel }: ShellComponentProps) {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const queueReadError = useReceptionStore((state) => state.queueReadError);
  const queueReadStatus = useReceptionStore((state) => state.queueReadStatus);
  const [listMode, setListMode] = useState<ReceptionSideListMode>("reception");
  const [searchOpen, setSearchOpen] = useState(false);
  const [cardActionFeedback, setCardActionFeedback] = useState<ReceptionCardActionFeedback | null>(null);
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
  const requestReceptionReadRetry = useReceptionStore((state) => state.requestReceptionReadRetry);
  const setSearchQuery = useReceptionStore((state) => state.setSearchQuery);
  const scenario = getDemoScenarioFromParams(searchParams);
  const workspaceId =
    typeof params.workspaceId === "string"
      ? params.workspaceId
      : params.workspaceId?.[0] ?? "clair-demo";
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
      {queueReadStatus === "loading" ? (
        <ReceptionPanelStateMessage>대기열 불러오는 중</ReceptionPanelStateMessage>
      ) : null}
      {queueReadStatus === "error" ? (
        <EmrInlineAlert
          className="mx-3 my-2"
          severity="warning"
          title="서버 대기열을 불러오지 못했어"
          action={
            <Button size="sm" variant="outline" onClick={requestReceptionReadRetry}>
              대기열 다시 시도
            </Button>
          }
          testId="reception-queue-read-alert"
        >
          {queueReadError ?? "현재 목록은 로컬 데모/세션 데이터 기준으로 유지돼."}
        </EmrInlineAlert>
      ) : null}
      {cardActionFeedback ? (
        <EmrInlineAlert
          className="mx-3 my-2"
          severity="info"
          title={cardActionFeedback.title}
          action={
            <Button size="sm" variant="outline" onClick={() => setCardActionFeedback(null)}>
              확인
            </Button>
          }
          testId="reception-card-action-feedback"
        >
          {cardActionFeedback.body}
        </EmrInlineAlert>
      ) : null}
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
          <ReceptionSearchInput
            aria-label="대기열 검색"
            placeholder="대기열 내 환자, 보호자, 전화번호 검색"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
        </div>
      ) : null}
      <EmrSubpanelBody>
        {visiblePatients.length ? (
          visiblePatients.map((summary) => (
            <PatientCard
              key={summary.patient.id}
              summary={summary}
              selected={isReceptionSideCardSelected(summary, activeDrawer, querySelectedPatientId)}
              onOpenChart={(targetSummary) => {
                const encounter = targetSummary.activeEncounter;
                if (!encounter) return;

                saveChartLiveEncounterHandoff({
                  encounter,
                  patient: targetSummary.patient,
                  primaryGuardian: targetSummary.primaryGuardian,
                });
                selectEncounter(encounter.id);
                setActiveDrawer(null);
                router.push(buildChartRoute({
                  encounterId: encounter.id,
                  patientId: targetSummary.patient.id,
                  workspaceId,
                }));
              }}
              onUnavailableAction={setCardActionFeedback}
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
          <ReceptionEmptyState>검색 결과가 없습니다.</ReceptionEmptyState>
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

function buildChartRoute({
  encounterId,
  patientId,
  workspaceId,
}: {
  encounterId: string;
  patientId: string;
  workspaceId: string;
}) {
  const query = new URLSearchParams({
    modulePanel: "open",
    aside: "closed",
    right: "closed",
    encounterId,
    patientId,
  });

  return `/w/${encodeURIComponent(workspaceId)}/treatment?${query.toString()}`;
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
        "relative min-w-0 flex-1 overflow-hidden rounded-md border border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] p-2 pl-3 shadow-[var(--clair-shadow-sm)]",
        appointment.status === "checked_in" &&
          "border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)]",
        appointment.status === "no_show" &&
          "border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)]",
        selected && "ring-2 ring-inset ring-primary"
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
            className="h-5 rounded-md px-1.5 emr-text-micro"
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
          <span className="truncate emr-text-dense font-bold leading-4 text-foreground">
            {patient?.name ?? "환자 미지정"}
          </span>
          <span className="truncate emr-text-metadata font-semibold leading-4 text-[var(--emr-text-secondary)]">
            {visitPurpose}
          </span>
        </div>
        <div className="mt-1 truncate emr-text-micro leading-4 text-[var(--emr-text-secondary)]">
          {getShortTime(appointment.scheduledStartAt)} · {getAppointmentDurationLabel(appointment)}
        </div>
        {visitDetail ? (
          <div className="mt-0.5 truncate emr-text-micro leading-4 text-muted-foreground">
            {getGuardianDisplay(guardian)} · {visitDetail}
          </div>
        ) : null}
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate emr-text-micro text-muted-foreground">
          {getAppointmentVeterinarianName(appointment)}
        </span>
        <Button
          size="sm"
          className="h-7 px-2 emr-text-metadata"
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
      className="relative min-w-0 flex-1 overflow-hidden rounded-md border border-[var(--emr-status-success-border)] bg-[var(--emr-status-success-bg)] p-2 pl-3 shadow-[var(--clair-shadow-sm)]"
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
            className="h-5 rounded-md px-1.5 emr-text-micro"
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
          <span className="truncate emr-text-dense font-bold leading-4 text-foreground">
            {patient?.name ?? "환자 미지정"}
          </span>
          <span className="truncate emr-text-metadata font-semibold leading-4 text-[var(--emr-text-secondary)]">
            {visitPurpose}
          </span>
        </div>
        <div className="mt-0.5 truncate emr-text-micro leading-4 text-muted-foreground">
          {getShortTime(draft.encounter.checkedInAt)} · {durationLabel} · {getGuardianDisplay(guardian)} ·{" "}
          {draft.department ?? defaultWalkInDepartment}
          {draft.memo ? ` · ${draft.memo}` : ""}
        </div>
      </button>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate emr-text-micro text-muted-foreground">
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
              className="h-7 justify-start px-2 emr-text-dense font-medium text-foreground"
              aria-label={`${dateControlLabel.dateLabel} ${dateControlLabel.pickerLabel}`}
            />
          }
        >
          <CdsFilesCalendarIcon
            className="size-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <span>{dateControlLabel.dateLabel}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[244px] gap-3 p-3" initialFocus={false}>
          {view === "day" ? (
            <>
              <div className="flex items-center justify-between">
                <div className="emr-text-dense font-semibold leading-5 text-foreground">
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
                    className="h-6 emr-text-micro font-medium leading-6 text-muted-foreground"
                  >
                    {weekday}
                  </span>
                ))}
                {receptionDatePickerCells.map((cell) => (
                  <button
                    key={cell.key}
                    type="button"
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md emr-text-metadata font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                      cell.inMonth
                        ? "text-foreground"
                        : "text-muted-foreground",
                      cell.selected &&
                        "bg-primary text-primary-foreground hover:bg-primary/90"
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
                <div className="emr-text-dense font-semibold leading-5 text-foreground">
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
                      "flex h-8 items-center rounded-md px-2 text-left emr-text-metadata font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                      week.selected
                        ? "bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]"
                        : "text-foreground"
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
                <div className="emr-text-dense font-semibold leading-5 text-foreground">
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
                        "flex h-8 items-center justify-center rounded-md emr-text-metadata font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                        selected
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "text-foreground"
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
        className="h-7 bg-[var(--emr-surface-panel)] px-2 emr-text-metadata font-medium"
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
        <span className="ml-2 rounded-md bg-muted px-2 py-1 emr-text-metadata font-medium leading-4 text-muted-foreground">
          영업시간{" "}
          <span className="font-semibold text-primary">
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
                "min-w-[124px] justify-start border !border-[var(--emr-line-hairline)] bg-card text-foreground",
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
          className="h-4 w-px shrink-0 bg-[var(--emr-line-default)]"
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

function EmptyReceptionSlotButton({
  affordanceSuspended,
  ariaLabel,
  onAffordancePointerMove,
  testId,
  onCreateWalkIn,
}: {
  affordanceSuspended: boolean;
  ariaLabel: string;
  onAffordancePointerMove: () => void;
  testId: string;
  onCreateWalkIn: () => void;
}) {
  const [affordanceSuppressed, setAffordanceSuppressed] = useState(false);
  const affordanceHidden = affordanceSuppressed || affordanceSuspended;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        "group/empty-slot min-h-12 min-w-0 flex-1 rounded-md border border-dashed border-transparent text-[var(--emr-text-tertiary)] outline-none transition-colors",
        !affordanceHidden &&
          "hover:border-[var(--emr-status-info-border)] hover:bg-[var(--emr-status-info-bg)] focus-visible:border-[var(--emr-status-info-border)] focus-visible:bg-[var(--emr-status-info-bg)] focus-visible:ring-3 focus-visible:ring-ring/50"
      )}
      data-testid={testId}
      onClick={() => {
        setAffordanceSuppressed(true);
        onCreateWalkIn();
      }}
      onPointerMove={() => {
        if (affordanceSuspended) onAffordancePointerMove();
      }}
      onPointerLeave={() => setAffordanceSuppressed(false)}
    >
      <span
        className={cn(
          "flex h-full min-h-12 items-center justify-center gap-1.5 opacity-0 transition-opacity",
          !affordanceHidden &&
            "group-hover/empty-slot:!opacity-100 group-focus/empty-slot:!opacity-100 group-focus-visible/empty-slot:!opacity-100"
        )}
        data-testid={`${testId}-affordance`}
      >
        <CdsActionsPlusIcon
          className="size-3.5 text-[var(--emr-status-info-text)]"
          aria-hidden="true"
          data-testid={`${testId}-icon`}
        />
        <span
          className="whitespace-nowrap emr-text-metadata font-semibold leading-4 text-[var(--emr-status-info-text)]"
          aria-hidden="true"
          data-testid={`${testId}-label`}
        >
          접수
        </span>
      </span>
    </button>
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
    <section className="border-b bg-[var(--emr-status-info-bg)] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <ReceptionStatusBadge label={statusLabel} tone={statusTone} />
            <h2 className="truncate text-[15px] font-semibold text-foreground">
              오늘 내원: {reason}
            </h2>
          </div>
          <div className="mt-1 emr-text-metadata text-[var(--emr-text-secondary)]">
            {guardianName ?? "보호자 미지정"} 보호자 · {patientName}({patientNo}) · {summary}
          </div>
        </div>
        <div className="rounded-md border border-[var(--emr-status-info-border)] bg-card px-2.5 py-1 emr-text-micro font-medium text-muted-foreground">
          session-only demo context
        </div>
      </div>
    </section>
  );
}

function DayScheduleBoard({
  emptySlotAffordanceSuspended,
  appointments,
  draftCheckIns,
  onEmptySlotAffordancePointerMove,
  onCheckIn,
  onCreateWalkIn,
  onSelectPatient,
  onSelectAppointment,
  selectedAppointmentId,
  selectedVeterinarians,
}: {
  emptySlotAffordanceSuspended: boolean;
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  onEmptySlotAffordancePointerMove: () => void;
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
        className="sticky top-0 z-30 grid border-b bg-card shadow-xs"
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
                    className="truncate rounded border border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] px-2 py-0.5 text-left emr-text-micro font-medium text-primary"
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
        <div className="flex gap-2 border-b bg-muted/70 p-2">
          <div className="flex w-14 shrink-0 items-center justify-center emr-text-micro font-medium text-muted-foreground">
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
              className="pointer-events-none absolute inset-x-0 z-0 bg-muted/70"
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
                  "absolute left-0 right-0 flex justify-end pr-2 emr-text-micro leading-4 text-muted-foreground",
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
            <span className="size-2 rounded-full bg-destructive" />
            <span className="h-px flex-1 bg-[var(--emr-status-danger-border)]" />
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
                        <EmptyReceptionSlotButton
                          affordanceSuspended={emptySlotAffordanceSuspended}
                          ariaLabel={`${getScheduleHourLabel(hour)} ${veterinarian.name} 빈 시간 접수 생성`}
                          onAffordancePointerMove={onEmptySlotAffordancePointerMove}
                          testId={`day-empty-slot-${hour}-${veterinarian.id}`}
                          onCreateWalkIn={onCreateWalkIn}
                        />
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
  emptySlotAffordanceSuspended,
  appointments,
  draftCheckIns,
  onEmptySlotAffordancePointerMove,
  onCheckIn,
  onCreateWalkIn,
  onSelectPatient,
  onSelectAppointment,
  selectedAppointmentId,
}: {
  emptySlotAffordanceSuspended: boolean;
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  onEmptySlotAffordancePointerMove: () => void;
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
        className="sticky top-0 z-30 grid border-b bg-card shadow-xs"
        style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}
      >
        <div className="border-r" />
        {weekDays.map((day) => (
          <div
            key={`${day.label}-${day.day}-header`}
            className={cn(
              "flex h-16 flex-col items-center justify-center border-r last:border-r-0",
              day.active && "bg-[var(--emr-status-info-bg)]/60"
            )}
          >
            <span className="emr-text-micro text-muted-foreground">{day.label}</span>
            <span
              className={cn(
                "mt-1 flex size-7 items-center justify-center rounded-full emr-text-body font-semibold",
                day.active && "bg-primary text-primary-foreground"
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
            <span className="size-2 rounded-full bg-destructive" />
            <span className="h-px flex-1 bg-[var(--emr-status-danger-border)]" />
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
              <span className="absolute left-0 right-0 top-2 text-center emr-text-micro text-muted-foreground">
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
                    day.active && "bg-[var(--emr-status-info-bg)]/40",
                    !isBusinessHourRow(hour) && "bg-muted/70"
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
                    <EmptyReceptionSlotButton
                      affordanceSuspended={emptySlotAffordanceSuspended}
                      ariaLabel={`${day.label} ${getScheduleHourLabel(hour)} 빈 시간 접수 생성`}
                      onAffordancePointerMove={onEmptySlotAffordancePointerMove}
                      testId={`week-empty-slot-${day.day}-${hour}`}
                      onCreateWalkIn={onCreateWalkIn}
                    />
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
            <span className="absolute left-0 right-0 -top-3 text-center emr-text-micro text-muted-foreground">
              {getScheduleHourLabel(dayScheduleEndHour)}
            </span>
          </div>
          {weekDays.map((day) => (
            <div
              key={`week-bottom-${day.day}`}
              className={cn("border-r last:border-r-0", day.active && "bg-[var(--emr-status-info-bg)]/40")}
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
            day === 1 && "bg-[var(--emr-status-info-bg)]/50"
          )}
        >
          <div className="emr-text-dense font-semibold">{day}</div>
          <div className="mt-3 space-y-1 emr-text-metadata leading-5 text-[var(--emr-text-secondary)]">
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
  emptySlotAffordanceSuspended,
  appointments,
  draftCheckIns,
  onEmptySlotAffordancePointerMove,
  onCheckIn,
  onCreateWalkIn,
  onSelectPatient,
  onSelectAppointment,
  selectedAppointmentId,
  selectedVeterinarians,
  view,
}: {
  emptySlotAffordanceSuspended: boolean;
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  onEmptySlotAffordancePointerMove: () => void;
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
              emptySlotAffordanceSuspended={emptySlotAffordanceSuspended}
              appointments={appointments}
              draftCheckIns={draftCheckIns}
              onEmptySlotAffordancePointerMove={onEmptySlotAffordancePointerMove}
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
              emptySlotAffordanceSuspended={emptySlotAffordanceSuspended}
              appointments={appointments}
              draftCheckIns={draftCheckIns}
              onEmptySlotAffordancePointerMove={onEmptySlotAffordancePointerMove}
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
  const params = useParams<{ workspaceId?: string | string[] }>();
  const searchParams = useSearchParams();
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const [calendarView, setCalendarView] = useState<ReceptionCalendarView>("day");
  const [emptySlotAffordanceSuspended, setEmptySlotAffordanceSuspended] = useState(false);
  const [walkInInitialPatientId, setWalkInInitialPatientId] = useState<string | undefined>();
  const [walkInDialogOpen, setWalkInDialogOpen] = useState(false);
  const [selectedVeterinarianIds, setSelectedVeterinarianIds] = useState(() =>
    allVeterinarians.map((veterinarian) => veterinarian.id)
  );
  const selectedAppointmentId = useReceptionStore((state) => state.selectedAppointmentId);
  const selectedEncounterId = useReceptionStore((state) => state.selectedEncounterId);
  const selectedPatientId = useReceptionStore((state) => state.selectedPatientId);
  const calendarReadError = useReceptionStore((state) => state.calendarReadError);
  const calendarReadStatus = useReceptionStore((state) => state.calendarReadStatus);
  const messageDeliveries = useReceptionStore((state) => state.messageDeliveries);
  const applyAppointmentCheckIn = useReceptionStore((state) => state.applyAppointmentCheckIn);
  const applyPersistedReceptionCalendar = useReceptionStore(
    (state) => state.applyPersistedReceptionCalendar
  );
  const applyPersistedReceptionQueue = useReceptionStore(
    (state) => state.applyPersistedReceptionQueue
  );
  const applyWalkInCheckIn = useReceptionStore((state) => state.applyWalkInCheckIn);
  const applyPatientGuardianLookupItem = usePatientProfileStore(
    (state) => state.applyPatientGuardianLookupItem
  );
  const selectAppointment = useReceptionStore((state) => state.selectAppointment);
  const selectEncounter = useReceptionStore((state) => state.selectEncounter);
  const selectPatient = useReceptionStore((state) => state.selectPatient);
  const setReceptionCalendarReadStatus = useReceptionStore(
    (state) => state.setReceptionCalendarReadStatus
  );
  const setReceptionQueueReadStatus = useReceptionStore(
    (state) => state.setReceptionQueueReadStatus
  );
  const readRetryNonce = useReceptionStore((state) => state.readRetryNonce);
  const requestReceptionReadRetry = useReceptionStore((state) => state.requestReceptionReadRetry);
  const persistedCalendarAppointments = useReceptionStore(
    (state) => state.persistedCalendarAppointments
  );
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore((state) => state.patientGuardians);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const authSession = useMockAuthStore((state) => state.session);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryPatientId = searchParams.get("patientId") ?? scenario?.patientId;
  const queryEncounterId = searchParams.get("encounterId") ?? scenario?.encounterId;
  const workspaceId =
    typeof params.workspaceId === "string"
      ? params.workspaceId
      : params.workspaceId?.[0] ?? "clair-demo";
  const appointments = useMemo(
    () => getTodayAppointments(draftCheckIns, persistedCalendarAppointments),
    [draftCheckIns, persistedCalendarAppointments]
  );
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
  const handleCheckInAppointment = async (appointment: Appointment) => {
    const result = await submitAppointmentCheckIn({
      actorRole: authSession?.role,
      appointmentId: appointment.id,
      workspaceId,
    });

    if (!result.ok) {
      toast.error(getAppointmentCheckInRouteErrorMessage(result));
      return;
    }

    applyAppointmentCheckIn({ appointment, checkIn: result.checkIn });
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
  useEffect(() => {
    let cancelled = false;

    async function loadCalendar() {
      setReceptionCalendarReadStatus("loading");
      const result = await loadReceptionCalendar({
        actorId: authSession?.id,
        date: "2026-05-01",
        workspaceId,
      });

      if (cancelled) return;

      if (!result.ok) {
        setReceptionCalendarReadStatus("error", getReceptionReadFailureMessage(result));
        return;
      }

      applyPersistedReceptionCalendar(result.records);
    }

    void loadCalendar();

    return () => {
      cancelled = true;
    };
  }, [
    applyPersistedReceptionCalendar,
    authSession?.id,
    readRetryNonce,
    setReceptionCalendarReadStatus,
    workspaceId,
  ]);
  useEffect(() => {
    let cancelled = false;

    async function loadQueue() {
      setReceptionQueueReadStatus("loading");
      const result = await loadReceptionQueue({
        actorId: authSession?.id,
        workspaceId,
      });

      if (cancelled) return;

      if (!result.ok) {
        setReceptionQueueReadStatus("error", getReceptionReadFailureMessage(result));
        return;
      }

      applyPersistedReceptionQueue(result.queue);
    }

    void loadQueue();

    return () => {
      cancelled = true;
    };
  }, [
    applyPersistedReceptionQueue,
    authSession?.id,
    readRetryNonce,
    setReceptionQueueReadStatus,
    workspaceId,
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
          workspaceId={workspaceId}
          onOpenChange={(nextOpen) => {
            setWalkInDialogOpen(nextOpen);
            if (!nextOpen) {
              setWalkInInitialPatientId(undefined);
              setEmptySlotAffordanceSuspended(true);
            }
          }}
          onCreate={(input, walkIn, selectedSummary) => {
            applyPatientGuardianLookupItem({
              patient: selectedSummary.patient,
              primaryGuardian: selectedSummary.primaryGuardian,
              searchText: selectedSummary.searchText,
            });
            applyWalkInCheckIn({ ...input, walkIn });
            saveChartLiveEncounterHandoff({
              encounter: walkIn.encounter,
              patient: selectedSummary.patient,
              primaryGuardian: selectedSummary.primaryGuardian,
            });
            setWalkInInitialPatientId(undefined);
            setWalkInDialogOpen(false);
            setEmptySlotAffordanceSuspended(true);
          }}
        />
      ) : null}
      {lastMessageDelivery ? (
        <div
          className="border-b bg-[var(--emr-status-success-bg)] px-4 py-2 emr-text-metadata font-semibold text-[var(--emr-status-success-text)]"
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
      {calendarReadStatus === "loading" ? (
        <ReceptionPanelStateMessage>저장된 예약을 불러오는 중</ReceptionPanelStateMessage>
      ) : null}
      {calendarReadStatus === "error" ? (
        <EmrInlineAlert
          className="border-x-0 border-t-0 rounded-none px-4"
          severity="warning"
          title="서버 캘린더를 불러오지 못했어"
          action={
            <Button size="sm" variant="outline" onClick={requestReceptionReadRetry}>
              캘린더 다시 시도
            </Button>
          }
          testId="reception-calendar-read-alert"
        >
          {calendarReadError ?? "현재 캘린더는 로컬 데모/세션 데이터 기준으로 유지돼."}
        </EmrInlineAlert>
      ) : null}
      <ReceptionScheduleBoard
        emptySlotAffordanceSuspended={emptySlotAffordanceSuspended}
        appointments={visibleAppointments}
        draftCheckIns={draftCheckIns}
        onEmptySlotAffordancePointerMove={() => setEmptySlotAffordanceSuspended(false)}
        selectedAppointmentId={selectedAppointmentId}
        selectedVeterinarians={selectedVeterinarians}
        view={calendarView}
        onSelectAppointment={handleSelectAppointment}
        onSelectPatient={handleSelectPatientFromSchedule}
        onCreateWalkIn={openWalkInDialog}
        onCheckIn={handleCheckInAppointment}
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
    <label className="flex min-w-0 flex-col gap-1.5 emr-text-metadata font-medium text-[var(--emr-text-secondary)]">
      <span>
        {label}
        {required ? <span className="ml-0.5 text-primary">*</span> : null}
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
  workspaceId,
}: {
  initialPatientId?: string;
  onCreate: (
    input: WalkInReceptionInput,
    walkIn: ReceptionWalkInEncounterRecord,
    selectedSummary: ReceptionPatientSummary
  ) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  patientSummaries: ReceptionPatientSummary[];
  workspaceId: string;
}) {
  const authSession = useMockAuthStore((state) => state.session);
  const [receptionDepartment, setReceptionDepartment] = useState(defaultWalkInDepartment);
  const [receptionDuration, setReceptionDuration] = useState(defaultWalkInDuration);
  const [receptionMemo, setReceptionMemo] = useState("");
  const [receptionPatientId, setReceptionPatientId] = useState(initialPatientId ?? "");
  const [receptionVeterinarianId, setReceptionVeterinarianId] = useState(
    unassignedVeterinarianValue
  );
  const [patientLookupOpen, setPatientLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<ReceptionPatientGuardianLookupItem[]>([]);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [customPurposeTags, setCustomPurposeTags] = useState<string[]>([]);
  const [isAddingPurposeTag, setIsAddingPurposeTag] = useState(false);
  const [newPurposeTag, setNewPurposeTag] = useState("");
  const [receptionPurposeTags, setReceptionPurposeTags] = useState<string[]>([]);
  const [receptionVisitPurpose, setReceptionVisitPurpose] = useState("");
  const [sendKakaoMessage, setSendKakaoMessage] = useState(true);
  const lookupActive = lookupQuery.trim().length > 0;
  const lookupPatientSummaries = useMemo(
    () => lookupResults.map(mapLookupItemToReceptionPatientSummary),
    [lookupResults]
  );
  const selectablePatientSummaries = lookupActive ? lookupPatientSummaries : patientSummaries;
  const patientSummaryOptions = useMemo(() => {
    const summaries = [...lookupPatientSummaries, ...patientSummaries];
    const uniqueSummaries = new Map<string, ReceptionPatientSummary>();

    summaries.forEach((summary) => uniqueSummaries.set(summary.patient.id, summary));

    return Array.from(uniqueSummaries.values());
  }, [lookupPatientSummaries, patientSummaries]);
  const selectedSummary = patientSummaryOptions.find(
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
  const patientSearchPlaceholder = "동물명 또는 보호자명으로 검색";
  const lookupHelper =
    lookupActive && lookupState === "loading"
      ? "DB 환자 검색 중입니다."
      : lookupActive && lookupState === "error"
        ? "환자 검색을 불러오지 못했습니다."
        : lookupActive
          ? lookupPatientSummaries.length
            ? `DB 검색 결과 ${lookupPatientSummaries.length}건`
            : "검색 결과가 없습니다."
          : patientOptionText || "환자명, 동물 정보, 보호자명으로 검색합니다.";
  const selectReceptionPatient = (summary: ReceptionPatientSummary) => {
    setReceptionPatientId(summary.patient.id);
    setLookupQuery(getReceptionPatientOptionLabel(summary));
    setPatientLookupOpen(false);
  };

  useEffect(() => {
    if (!open) return;

    const query = lookupQuery.trim();
    if (!query) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function loadLookup() {
      setLookupState("loading");

      try {
        const headers = authSession?.id
          ? { "x-clair-demo-session-user-id": authSession.id }
          : undefined;
        const response = await fetch(
          `/api/workspaces/${workspaceId}/reception/patient-guardian-lookup?query=${encodeURIComponent(query)}`,
          {
            cache: "no-store",
            headers,
            signal: controller.signal,
          }
        );
        const result = (await response.json()) as ReceptionPatientGuardianLookupResponse;

        if (cancelled) return;

        if (!response.ok || !result.ok) {
          setLookupResults([]);
          setLookupState("error");
          return;
        }

        setLookupResults(result.patients);
        setLookupState("idle");
      } catch (error) {
        if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) {
          setLookupResults([]);
          setLookupState("error");
        }
      }
    }

    void loadLookup();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [authSession?.id, authSession?.role, lookupQuery, open, workspaceId]);

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
  const create = async () => {
    const selectedVeterinarianId =
      receptionVeterinarianId === unassignedVeterinarianValue
        ? undefined
        : receptionVeterinarianId;

    if (!patient || submitting) return;

    const input: WalkInReceptionInput = {
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
    };

    setSubmitting(true);
    const result = await submitWalkInEncounter({
      actorRole: authSession?.role,
      input,
      workspaceId,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(getWalkInRouteErrorMessage(result));
      return;
    }

    if (selectedSummary) {
      onCreate(input, result.walkIn, selectedSummary);
    }
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
              <DialogTitle className="text-[22px] font-bold leading-7 text-foreground">
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
                  helper={lookupHelper}
                >
                  <div
                    className="relative"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setPatientLookupOpen(false);
                      }
                    }}
                  >
                      <CdsActionsSearchIcon
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--emr-text-secondary)]"
                        aria-hidden="true"
                      />
                      <Input
                        aria-label="환자 검색"
                        autoComplete="off"
                        className="h-10 bg-card pl-9 pr-9"
                        placeholder={patientSearchPlaceholder}
                        value={lookupQuery}
                        onFocus={() => setPatientLookupOpen(true)}
                        onValueChange={(value) => {
                          setLookupQuery(value);
                          setPatientLookupOpen(true);
                        }}
                      />
                      {lookupQuery ? (
                        <button
                          type="button"
                          className="absolute right-2.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:text-[var(--emr-text-secondary)] focus-visible:ring-3 focus-visible:ring-ring/50"
                          aria-label="검색어 초기화"
                          onClick={() => {
                            setLookupQuery("");
                            setReceptionPatientId("");
                            setPatientLookupOpen(true);
                          }}
                        >
                          <CircleCloseFillIcon className="size-4" aria-hidden="true" />
                        </button>
                      ) : null}
                    {patientLookupOpen ? (
                      <div
                        role="listbox"
                        aria-label="검색 결과"
                        className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] grid max-h-72 gap-1 overflow-y-auto rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                      >
                        {lookupActive && lookupState === "loading" ? (
                          <div className="px-2.5 py-2 emr-text-dense text-muted-foreground">
                            DB 환자 검색 중입니다.
                          </div>
                        ) : null}
                        {lookupActive && lookupState === "error" ? (
                          <div className="px-2.5 py-2 emr-text-dense text-[var(--emr-status-danger-text)]">
                            환자 검색을 불러오지 못했습니다.
                          </div>
                        ) : null}
                        {lookupActive &&
                        lookupState === "idle" &&
                        selectablePatientSummaries.length === 0 ? (
                          <div className="px-2.5 py-2 emr-text-dense text-muted-foreground">
                            검색 결과가 없습니다.
                          </div>
                        ) : null}
                        {selectablePatientSummaries.map((summary) => {
                          const selected = summary.patient.id === receptionPatientId;
                          const optionLabel = getReceptionPatientOptionLabel(summary);

                          return (
                            <button
                              key={summary.patient.id}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              className="grid gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-[var(--emr-state-hover)] aria-selected:bg-[var(--emr-state-selected)]"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => selectReceptionPatient(summary)}
                            >
                              <span className="truncate emr-text-dense font-semibold text-foreground">
                                {optionLabel}
                              </span>
                              <span className="truncate emr-text-metadata text-muted-foreground">
                                {summary.primaryGuardian?.mobilePhone ?? "보호자 연락처 미등록"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </RegistrationFormField>

                <RegistrationFormField label="체중">
                  <div className="relative">
                    <Input
                      aria-label="체중"
                      className="h-10 bg-card pr-9 text-muted-foreground"
                      readOnly
                      value={patientWeightKg}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 emr-text-dense font-medium leading-4 text-foreground">
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
                          "h-7 rounded-full px-2.5 emr-text-metadata font-semibold",
                          selected
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
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
                      className="h-8 w-[108px] rounded-full bg-card px-3 emr-text-metadata font-semibold"
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
                    size="xl"
                    className="w-full bg-card"
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
                    size="xl"
                    className="w-full bg-card"
                  >
                    <CdsActionsSearchIcon
                      className="size-3 shrink-0 text-[var(--emr-text-secondary)]"
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
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--emr-text-secondary)]"
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
                    className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    aria-label="진료시간"
                    className="h-10 bg-card pl-9 text-muted-foreground disabled:bg-muted disabled:opacity-100"
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
                    size="xl"
                    className="w-full bg-card"
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

        <DialogFooter className="relative -mx-0 -mb-0 items-center justify-between rounded-none border-t bg-[var(--emr-surface-panel)] px-8 py-4 sm:justify-between">
          <label className="flex w-fit items-center gap-2 rounded-md border bg-card px-2.5 py-2 emr-text-metadata font-semibold text-[var(--emr-text-secondary)]">
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
              className="h-8 rounded-full px-4 emr-text-metadata font-semibold text-foreground"
              onClick={close}
            >
              취소
            </Button>
            <Button
              type="button"
              className="h-8 rounded-full bg-primary px-4 emr-text-metadata font-semibold text-primary-foreground hover:bg-primary/90"
              disabled={!canCreate || submitting}
              onClick={create}
            >
              {submitting ? "생성 중" : "생성"}
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
  const params = useParams<{ workspaceId?: string | string[] }>();
  const router = useRouter();
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const applyAppointmentCheckIn = useReceptionStore((state) => state.applyAppointmentCheckIn);
  const createWalkInCheckIn = useReceptionStore((state) => state.createWalkInCheckIn);
  const selectedEncounterId = useReceptionStore((state) => state.selectedEncounterId);
  const selectedPatientId = useReceptionStore((state) => state.selectedPatientId);
  const authSession = useMockAuthStore((state) => state.session);
  const appointments = useMemo(() => getTodayAppointments(draftCheckIns), [draftCheckIns]);
  const workspaceId =
    typeof params.workspaceId === "string"
      ? params.workspaceId
      : params.workspaceId?.[0] ?? "clair-demo";
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
  const handleAppointmentCheckIn = async (
    appointment: Appointment,
    checkIn: ReceptionAppointmentCheckInRecord
  ) => {
    applyAppointmentCheckIn({ appointment, checkIn });
    setActiveDrawer(null);
  };

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
          <section className="rounded-lg border bg-muted p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="emr-text-body font-semibold">
                  {selectedAppointment ? "예약 상세" : "접수 상세"}
                </div>
                <div className="mt-1 emr-text-metadata text-muted-foreground">
                  {guardian?.name ?? "보호자 미지정"} 보호자 · {patient.name} · {visitSummary}
                </div>
                <div className="mt-2 emr-text-dense font-medium text-foreground">
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
              <div className="flex h-9 items-center rounded-lg border border-input px-2.5 emr-text-dense">
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
              className="min-h-20 w-full resize-none rounded-lg border border-input bg-card px-2.5 py-2 emr-text-dense outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </ReceptionFormField>

          <section className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold">Assessment History</h3>
              <Button
                size="xs"
                variant="outline"
                disabled={!selectedEncounter}
                onClick={() => {
                  if (!selectedEncounter) return;

                  saveChartLiveEncounterHandoff({
                    encounter: selectedEncounter,
                    patient,
                    primaryGuardian: guardian,
                  });
                  setActiveDrawer(null);
                  router.push(buildChartRoute({
                    encounterId: selectedEncounter.id,
                    patientId: patient.id,
                    workspaceId,
                  }));
                }}
              >
                차트보기
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[86px_86px_84px_minmax(120px,1fr)_72px_72px_64px] bg-muted/50 px-3 py-2 emr-text-micro font-medium text-muted-foreground">
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
                  className="grid grid-cols-[86px_86px_84px_minmax(120px,1fr)_72px_72px_64px] border-t px-3 py-2 emr-text-micro"
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
              void submitAppointmentCheckIn({
                actorRole: authSession?.role,
                appointmentId: selectedAppointment.id,
                workspaceId,
              }).then((result) => {
                if (!result.ok) {
                  toast.error(getAppointmentCheckInRouteErrorMessage(result));
                  return;
                }

                void handleAppointmentCheckIn(selectedAppointment, result.checkIn);
              });
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
