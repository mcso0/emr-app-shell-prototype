"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrListSearchEmptyState,
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
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCloseFillIcon,
  ExcelFileIcon,
} from "@/components/icons";
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
  getAppointmentPatient,
  getEffectiveEncounters,
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
import type {
  ReceptionCalendarReadRecord,
  ReceptionCalendarReadResponse,
} from "@/features/reception/reception-calendar-read";
import type {
  ReceptionQueueReadRecord,
  ReceptionQueueReadResponse,
} from "@/features/reception/reception-queue-read";
import type {
  ReceptionEncounterCancelResponse,
} from "@/features/reception/encounter-cancel";
import type {
  ReceptionWalkInEncounterInput,
  ReceptionWalkInEncounterRecord,
  ReceptionWalkInEncounterResponse,
} from "@/features/reception/walk-in-encounter";
import {
  readChartLiveEncounterHandoff,
  saveChartLiveEncounterHandoff,
} from "@/features/chart/live-encounter-handoff";
import {
  useReceptionStore,
  type ReceptionCalendarDraftSelection,
} from "@/features/reception/store";
import {
  ReceptionEmptyState,
  ReceptionPanelStateMessage,
} from "@/features/reception/reception-list-search";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
import {
  formatKoreanOperatingDateLabel,
  formatOperatingMonthLabel,
  formatOperatingShortTime,
  formatShortOperatingDate,
  getOperatingDateFromIso,
  getOperatingIsoAtMinutes,
  getOperatingMinutesFromIso,
  getWorkspaceOperatingDate,
  getWorkspaceOperatingNow,
} from "@/lib/emr-domain/demo-date";
import {
  LEGACY_SALES_DEMO_WORKSPACE_ID,
  isLegacySalesDemoWorkspace,
  isPreparedEmptyClinicWorkspace,
} from "@/lib/emr-domain/demo-workspaces";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { cn } from "@/lib/utils";
import {
  getMockPatientBundle,
  mockEncounters,
  mockStaffUsers,
} from "@/mocks/emr-domain";
import { useLayoutStore } from "@/stores/layout-store";
import type {
  Appointment,
  Encounter,
  Guardian,
  Patient,
  PatientGuardian,
} from "@/types/emr-domain";
import type { ShellComponentProps } from "@/types/emr";

const allVeterinarians = mockStaffUsers.filter(
  (user) => user.role === "veterinarian",
).map((user) => ({
  id: user.id,
  initial: user.initial,
  name: user.name,
  role: "veterinarian" as const,
}));
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
const scheduleSlotMinutes = 15;
const scheduleSlotCountPerHour = 60 / scheduleSlotMinutes;
const maxReceptionCalendarDraftDurationMinutes = 240;
const receptionCalendarDragStartEvent = "reception-calendar-drag-start";
const receptionCalendarDragClearEvent = "reception-calendar-drag-clear";
const legacyDayCurrentTimeMinutes = 11 * 60 + 20;
const dayScheduleHours = Array.from(
  { length: dayScheduleEndHour - dayScheduleStartHour },
  (_, index) => dayScheduleStartHour + index,
);
const dayScheduleHourLabels = Array.from(
  { length: dayScheduleEndHour - dayScheduleStartHour + 1 },
  (_, index) => dayScheduleStartHour + index,
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
type Veterinarian = {
  department?: string;
  id: string;
  initial?: string;
  name: string;
  role: "veterinarian";
  title?: string;
};
type WorkspaceStaffReadResponse =
  | {
      ok: true;
      status: 200;
      staff: Array<{
        department?: string;
        displayName: string;
        id: string;
        initial?: string;
        roles: string[];
        status: string;
        title?: string;
      }>;
    }
  | {
      ok: false;
      status?: number;
      denialReason?: string;
      error?: string;
    };
type WalkInReceptionInput = {
  department?: string;
  durationMinutes?: number;
  guardianId?: string;
  guardianMobilePhone?: string;
  memo?: string;
  patientId: string;
  patientName?: string;
  plannedStartAt?: string;
  primaryVeterinarianId?: string;
  sendKakaoMessage?: boolean;
  visitPurpose?: string;
};
const unassignedVeterinarianValue = "unassigned";

const dispatchReceptionCalendarDragStart = (testId: string) => {
  window.dispatchEvent(
    new CustomEvent<{ testId: string }>(receptionCalendarDragStartEvent, {
      detail: { testId },
    }),
  );
};

const dispatchReceptionCalendarDragClear = () => {
  window.dispatchEvent(new Event(receptionCalendarDragClearEvent));
};

function getReceptionDemoActorId(role?: string) {
  if (role === "hospital_admin" || role === "billing_admin")
    return "user-admin";
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

function getVeterinarianToneIndex(
  veterinarian: Veterinarian,
  veterinarians: Veterinarian[] = allVeterinarians,
) {
  const veterinarianIndex = veterinarians.findIndex(
    (item) => item.id === veterinarian.id,
  );

  return veterinarianIndex >= 0 ? veterinarianIndex : 0;
}

function getVeterinarianAccentClassName(
  veterinarianId?: string,
  veterinarians: Veterinarian[] = allVeterinarians,
) {
  if (!veterinarianId) return "bg-[var(--emr-line-strong)]";

  const veterinarian = veterinarians.find(
    (item) => item.id === veterinarianId,
  );
  const toneIndex = veterinarian
    ? getVeterinarianToneIndex(veterinarian, veterinarians)
    : 0;

  return veterinarianAccentToneClasses[
    toneIndex % veterinarianAccentToneClasses.length
  ];
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
        veterinarianHeaderToneClasses[
          toneIndex % veterinarianHeaderToneClasses.length
        ],
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--emr-text-inverse)] bg-[var(--emr-state-hover)] text-[10px] font-semibold leading-none text-primary-foreground">
        {veterinarian.initial}
      </span>
      <span className="min-w-0 truncate emr-text-dense font-semibold">
        {veterinarian.name}
      </span>
    </div>
  );
}

function VeterinarianMenuItemLabel({
  veterinarian,
}: {
  veterinarian: Veterinarian;
}) {
  const toneIndex = getVeterinarianToneIndex(veterinarian);

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-semibold leading-none text-primary-foreground",
          veterinarianHeaderToneClasses[
            toneIndex % veterinarianHeaderToneClasses.length
          ],
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
const receptionDurationOptions = [15, 30, 45, 60, 90, 120, 180, 240].map(
  (minutes) => `${minutes}분`,
);
const receptionPurposeChips = [
  "예방접종",
  "구토/설사",
  "피부",
  "수술 후 확인",
  "건강검진",
];

const getReceptionPatientAgeText = (patient: Patient) => {
  if (patient.estimatedAgeText) return patient.estimatedAgeText;
  if (!patient.birthDate) return "나이 미상";

  const birthYear = Number(patient.birthDate.slice(0, 4));

  return Number.isNaN(birthYear) ? "나이 미상" : `${2026 - birthYear}세`;
};

const getReceptionPatientOptionLabel = (summary: ReceptionPatientSummary) =>
  [
    summary.patient.name,
    [getSpeciesLabel(summary.patient.species), summary.patient.breed]
      .filter(Boolean)
      .join("/"),
    getReceptionPatientAgeText(summary.patient),
    summary.primaryGuardian?.name ?? "보호자 미지정",
  ]
    .filter(Boolean)
    .join(" · ");

const getReceptionPatientSearchText = (
  patient: Patient,
  primaryGuardian?: ReceptionPatientSummary["primaryGuardian"],
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
  item: ReceptionPatientGuardianLookupItem,
): ReceptionPatientSummary => ({
  patient: item.patient,
  primaryGuardian: item.primaryGuardian,
  searchText:
    item.searchText ??
    getReceptionPatientSearchText(item.patient, item.primaryGuardian),
});

type ReceptionReadbackProfileRecord =
  | ReceptionCalendarReadRecord
  | ReceptionQueueReadRecord;

const getReceptionReadbackRecords = ({
  calendarResult,
  queueResult,
}: {
  calendarResult: ReceptionCalendarReadResponse;
  queueResult: ReceptionQueueReadResponse;
}): ReceptionReadbackProfileRecord[] => [
  ...(calendarResult.ok ? calendarResult.records : []),
  ...(queueResult.ok ? queueResult.queue : []),
];

const getReadbackPatientIds = (records: ReceptionReadbackProfileRecord[]) =>
  Array.from(
    new Set(
      records
        .map((record) => record.patient?.id ?? record.encounter?.patientId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

const getEmbeddedReadbackLookupItems = (
  records: ReceptionReadbackProfileRecord[],
): ReceptionPatientGuardianLookupItem[] =>
  records
    .map((record) =>
      record.patient
        ? {
            patient: record.patient,
            ...(record.primaryGuardian
              ? { primaryGuardian: record.primaryGuardian }
              : {}),
          }
        : null,
    )
    .filter(
      (item): item is ReceptionPatientGuardianLookupItem => Boolean(item),
    );

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
      },
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
      },
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

async function submitReceptionEncounterCancel({
  actorRole,
  encounterId,
  workspaceId,
}: {
  actorRole?: string;
  encounterId: string;
  workspaceId: string;
}): Promise<ReceptionEncounterCancelResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/encounters/${encodeURIComponent(encounterId)}/cancel`,
      {
        method: "POST",
        headers: {
          "x-clair-demo-session-user-id": getReceptionDemoActorId(actorRole),
        },
      },
    );
    const body = (await response.json()) as ReceptionEncounterCancelResponse;

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
        headers: actorId
          ? { "x-clair-demo-session-user-id": actorId }
          : undefined,
      },
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
        headers: actorId
          ? { "x-clair-demo-session-user-id": actorId }
          : undefined,
      },
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

async function loadReceptionPatientGuardianProfiles({
  actorId,
  workspaceId,
}: {
  actorId?: string;
  workspaceId: string;
}): Promise<ReceptionPatientGuardianLookupResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/patient-guardian-lookup?query=`,
      {
        cache: "no-store",
        headers: actorId
          ? { "x-clair-demo-session-user-id": actorId }
          : undefined,
      },
    );
    const body =
      (await response.json()) as ReceptionPatientGuardianLookupResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return body;
      return { ok: false, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, error: "db_read_failed" };
  }
}

async function loadWorkspaceVeterinarians({
  actorId,
  workspaceId,
}: {
  actorId?: string;
  workspaceId: string;
}): Promise<WorkspaceStaffReadResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/staff?role=vet`,
      {
        cache: "no-store",
        headers: actorId
          ? { "x-clair-demo-session-user-id": actorId }
          : undefined,
      },
    );
    const body = (await response.json()) as WorkspaceStaffReadResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_read_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_read_failed" };
  }
}

function mapWorkspaceStaffToVeterinarians(
  response: WorkspaceStaffReadResponse,
): Veterinarian[] {
  if (!response.ok) return [];

  return response.staff
    .filter((member) => member.status === "active" && member.roles.includes("vet"))
    .map((member) => ({
      department: member.department,
      id: member.id,
      initial: member.initial,
      name: member.displayName,
      role: "veterinarian" as const,
      title: member.title,
    }));
}

function getWalkInRouteErrorMessage(
  result: Extract<ReceptionWalkInEncounterResponse, { ok: false }>,
) {
  if (result.error === "rate_limited")
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (result.error === "invalid_input") {
    return (
      Object.values(result.fieldErrors ?? {})[0] ?? "접수 정보를 확인해 주세요."
    );
  }
  if (result.denialReason === "patient_unavailable")
    return "접수를 생성할 수 없습니다.";
  if (result.denialReason === "guardian_unavailable")
    return "접수를 생성할 수 없습니다.";
  if (result.denialReason === "patient_guardian_link_missing") {
    return "접수를 생성할 수 없습니다.";
  }
  if (
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return "이 workspace에서 현장 접수를 생성할 권한이 없습니다.";
  }

  return "접수를 생성할 수 없습니다.";
}

function getAppointmentCheckInRouteErrorMessage(
  result: Extract<ReceptionAppointmentCheckInResponse, { ok: false }>,
) {
  if (result.error === "rate_limited")
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (result.denialReason === "appointment_unavailable")
    return "예약 정보를 찾을 수 없습니다.";
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

function getEncounterCancelRouteErrorMessage(
  result: Extract<ReceptionEncounterCancelResponse, { ok: false }>,
) {
  if (result.error === "rate_limited")
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (result.denialReason === "encounter_unavailable")
    return "접수 정보를 찾을 수 없습니다.";
  if (result.denialReason === "encounter_already_cancelled")
    return "이미 취소된 접수입니다.";
  if (result.denialReason === "encounter_not_cancelable")
    return "현재 상태에서는 접수를 취소할 수 없습니다.";
  if (result.denialReason === "queue_entry_unavailable")
    return "진료 대기열 정보를 찾을 수 없습니다.";
  if (
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return "이 workspace에서 접수를 취소할 권한이 없습니다.";
  }

  return "접수 취소에 실패했습니다.";
}

function getReceptionReadFailureMessage(
  result: Extract<
    ReceptionQueueReadResponse | ReceptionCalendarReadResponse,
    { ok: false }
  >,
  workspaceId?: string,
) {
  const preparedEmptyClinic = isPreparedEmptyClinicWorkspace(workspaceId);
  const localFallbackText = preparedEmptyClinic
    ? "기존 데모 업무는 표시하지 않고 준비된 빈 병원 상태를 유지해."
    : "현재 화면은 로컬 데모/세션 데이터 기준으로 유지돼.";

  if (
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return `접수 보기 권한 또는 workspace membership을 확인해야 해. ${localFallbackText}`;
  }

  if (result.denialReason === "unauthenticated") {
    return `로그인 세션을 확인하지 못했어. ${localFallbackText}`;
  }

  if (result.error === "supabase_client_missing") {
    return `live Supabase read 연결이 구성되지 않았어. ${localFallbackText}`;
  }

  return `서버 read 결과를 반영하지 못했어. ${localFallbackText}`;
}

function getReceptionEmptyStateCopy({
  listMode,
  searchQuery,
  workspaceId,
}: {
  listMode: ReceptionSideListMode;
  searchQuery: string;
  workspaceId: string;
}) {
  if (searchQuery.trim()) return "검색 결과가 없습니다.";
  if (isPreparedEmptyClinicWorkspace(workspaceId)) {
    if (listMode === "appointment") return "오늘 예정된 예약이 아직 없습니다.";
    if (listMode === "reception") return "아직 접수 대기 업무가 없습니다.";
    return "아직 오늘 접수/예약 업무가 없습니다.";
  }
  if (listMode === "appointment") return "예약 목록이 비어 있습니다.";
  if (listMode === "reception") return "대기열이 비어 있습니다.";
  return "목록이 비어 있습니다.";
}

const recentPatientWeightKgByPatientId: Record<string, string> = {
  "patient-coco": "4.20",
  "patient-kong": "5.10",
  "patient-dubu": "8.40",
  "patient-haru": "3.20",
  "patient-nabi": "4.80",
};

const getRecentPatientWeightKg = (patient?: Patient) =>
  patient ? (recentPatientWeightKgByPatientId[patient.id] ?? "0.00") : "0.00";

const getShortTime = (dateTime?: string) => {
  return formatOperatingShortTime(dateTime);
};

const getShortDate = (dateTime?: string) => {
  const operatingDate = getOperatingDateFromIso(dateTime);

  return operatingDate ? formatShortOperatingDate(operatingDate) : "-";
};

const getAppointmentHour = (appointment: Appointment) =>
  Math.floor((getMinutesInDayFromDateTime(appointment.scheduledStartAt) ?? 0) / 60);

const getScheduleHourLabel = (hour: number) =>
  `${String(hour).padStart(2, "0")}:00`;

const getScheduleTimeLabelFromMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const getReceptionIsoAtMinutes = (date: string, minutes: number) =>
  getOperatingIsoAtMinutes(date, minutes);

const getWorkspaceCurrentOperatingMinutes = (workspaceId: string) =>
  getOperatingMinutesFromIso(getWorkspaceOperatingNow(workspaceId)) ??
  legacyDayCurrentTimeMinutes;

const getDraftScheduleStartAt = (draft: ReceptionDraftCheckIn) =>
  draft.plannedStartAt ??
  draft.encounter.checkedInAt ??
  draft.encounter.createdAt;

const isDraftOnOperatingDate = (
  draft: ReceptionDraftCheckIn,
  operatingDate: string,
) => getOperatingDateFromIso(getDraftScheduleStartAt(draft)) === operatingDate;

const getDraftScheduleHour = (draft: ReceptionDraftCheckIn) =>
  Math.floor((getOperatingMinutesFromIso(getDraftScheduleStartAt(draft)) ?? 0) / 60);

const getDraftDurationLabel = (draft: ReceptionDraftCheckIn) =>
  draft.durationMinutes ? `${draft.durationMinutes}분` : defaultWalkInDuration;

const clampScheduleMinutes = (minutes: number) =>
  Math.min(
    dayScheduleEndHour * 60,
    Math.max(dayScheduleStartHour * 60, minutes),
  );

const snapScheduleStartMinutes = (minutes: number) =>
  clampScheduleMinutes(
    Math.floor(minutes / scheduleSlotMinutes) * scheduleSlotMinutes,
  );

const snapScheduleEndMinutes = (minutes: number) =>
  clampScheduleMinutes(
    Math.ceil(minutes / scheduleSlotMinutes) * scheduleSlotMinutes,
  );

type ReceptionCalendarSelectionInvalidReason =
  | "outside-business-hours"
  | "unavailable-time"
  | "overlap"
  | "too-short"
  | "too-long"
  | "lane-boundary"
  | "date-boundary";

type ReceptionCalendarScheduleBlock = {
  endMinutes: number;
  label: string;
  startMinutes: number;
  veterinarianId?: string;
};

type ReceptionCalendarSelectionValidationResult =
  | {
      durationMinutes: number;
      endMinutes: number;
      plannedStartAt: string;
      startMinutes: number;
      valid: true;
    }
  | {
      message: string;
      reason: ReceptionCalendarSelectionInvalidReason;
      valid: false;
    };

const dayBusinessOpenMinutes = dayBusinessOpenHour * 60;
const dayBusinessCloseMinutes = dayBusinessCloseHour * 60;
const receptionCalendarUnavailableBlocks: ReceptionCalendarScheduleBlock[] = [];

const rangesOverlap = (
  startMinutes: number,
  endMinutes: number,
  blockStart: number,
  blockEnd: number,
) => startMinutes < blockEnd && endMinutes > blockStart;

const normalizeReceptionCalendarSelection = ({
  endMinutes,
  startMinutes,
}: {
  endMinutes: number;
  startMinutes: number;
}) => {
  const rawStart = Math.min(startMinutes, endMinutes);
  const rawEnd = Math.max(startMinutes, endMinutes);
  const snappedStart = snapScheduleStartMinutes(rawStart);
  const snappedEnd = Math.max(
    snappedStart + scheduleSlotMinutes,
    snapScheduleEndMinutes(rawEnd),
  );

  return {
    durationMinutes: snappedEnd - snappedStart,
    endMinutes: snappedEnd,
    startMinutes: snappedStart,
  };
};

const getAppointmentScheduleBlock = (
  appointment: Appointment,
): ReceptionCalendarScheduleBlock | undefined => {
  const startMinutes = getMinutesInDayFromDateTime(
    appointment.scheduledStartAt,
  );

  if (startMinutes === undefined) return undefined;

  const endMinutes =
    getMinutesInDayFromDateTime(appointment.scheduledEndAt) ??
    startMinutes + scheduleSlotMinutes;

  return {
    endMinutes,
    label: getAppointmentPatient(appointment)?.name ?? "예약",
    startMinutes,
    veterinarianId: appointment.assignedVeterinarianId,
  };
};

const getDraftScheduleBlock = (
  draft: ReceptionDraftCheckIn,
): ReceptionCalendarScheduleBlock | undefined => {
  const startMinutes = getMinutesInDayFromDateTime(
    getDraftScheduleStartAt(draft),
  );
  const durationMinutes =
    draft.durationMinutes ??
    getDurationMinutesFromLabel(defaultWalkInDuration) ??
    30;

  if (startMinutes === undefined) return undefined;

  return {
    endMinutes: startMinutes + durationMinutes,
    label: draft.encounter.visitPurpose ?? "접수",
    startMinutes,
    veterinarianId: draft.encounter.primaryVeterinarianId,
  };
};

const getReceptionCalendarSelectionMessage = (
  reason: ReceptionCalendarSelectionInvalidReason,
  block?: ReceptionCalendarScheduleBlock,
) => {
  if (reason === "outside-business-hours") {
    return `영업시간 ${getBusinessHoursTimeRangeLabel()} 안에서만 접수/예약을 만들 수 있어.`;
  }
  if (reason === "unavailable-time") {
    return `${block?.label ?? "접수/예약 불가 시간"}에는 접수/예약을 만들 수 없어.`;
  }
  if (reason === "overlap") {
    return `${block?.label ?? "기존 일정"}과 겹치는 시간에는 접수/예약을 만들 수 없어.`;
  }
  if (reason === "too-long") {
    return `접수 task는 최대 ${maxReceptionCalendarDraftDurationMinutes}분까지 만들 수 있어.`;
  }
  if (reason === "too-short") {
    return "접수 task는 최소 15분 이상이어야 해.";
  }

  return "선택한 캘린더 위치에서는 접수/예약을 만들 수 없어.";
};

const validateReceptionCalendarSelection = ({
  appointments,
  draftCheckIns,
  endMinutes,
  operatingDate,
  startMinutes,
  veterinarianId,
}: {
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  endMinutes: number;
  operatingDate: string;
  startMinutes: number;
  veterinarianId: string;
}): ReceptionCalendarSelectionValidationResult => {
  const normalized = normalizeReceptionCalendarSelection({
    endMinutes,
    startMinutes,
  });

  if (normalized.durationMinutes < scheduleSlotMinutes) {
    return {
      message: getReceptionCalendarSelectionMessage("too-short"),
      reason: "too-short",
      valid: false,
    };
  }

  if (normalized.durationMinutes > maxReceptionCalendarDraftDurationMinutes) {
    return {
      message: getReceptionCalendarSelectionMessage("too-long"),
      reason: "too-long",
      valid: false,
    };
  }

  if (
    normalized.startMinutes < dayBusinessOpenMinutes ||
    normalized.endMinutes > dayBusinessCloseMinutes
  ) {
    return {
      message: getReceptionCalendarSelectionMessage("outside-business-hours"),
      reason: "outside-business-hours",
      valid: false,
    };
  }

  const unavailableBlock = receptionCalendarUnavailableBlocks.find(
    (block) =>
      (!block.veterinarianId || block.veterinarianId === veterinarianId) &&
      rangesOverlap(
        normalized.startMinutes,
        normalized.endMinutes,
        block.startMinutes,
        block.endMinutes,
      ),
  );

  if (unavailableBlock) {
    return {
      message: getReceptionCalendarSelectionMessage(
        "unavailable-time",
        unavailableBlock,
      ),
      reason: "unavailable-time",
      valid: false,
    };
  }

  const scheduleBlocks = [
    ...appointments.map(getAppointmentScheduleBlock),
    ...draftCheckIns.map(getDraftScheduleBlock),
  ].filter((block): block is ReceptionCalendarScheduleBlock => Boolean(block));
  const overlappingBlock = scheduleBlocks.find(
    (block) =>
      block.veterinarianId === veterinarianId &&
      rangesOverlap(
        normalized.startMinutes,
        normalized.endMinutes,
        block.startMinutes,
        block.endMinutes,
      ),
  );

  if (overlappingBlock) {
    return {
      message: getReceptionCalendarSelectionMessage(
        "overlap",
        overlappingBlock,
      ),
      reason: "overlap",
      valid: false,
    };
  }

  return {
    ...normalized,
    plannedStartAt: getReceptionIsoAtMinutes(
      operatingDate,
      normalized.startMinutes,
    ),
    valid: true,
  };
};

const getScheduleSelectionFromPointer = ({
  bounds,
  baseHour,
  clientY,
}: {
  baseHour: number;
  bounds: DOMRect;
  clientY: number;
}) => {
  const minutesPerPixel = 60 / bounds.height;
  const rawMinutes = baseHour * 60 + (clientY - bounds.top) * minutesPerPixel;

  return clampScheduleMinutes(rawMinutes);
};

const getBusinessHoursTimeRangeLabel = () =>
  `${getScheduleHourLabel(dayBusinessOpenHour)}-${getScheduleHourLabel(dayBusinessCloseHour)}`;

const isBusinessHourRow = (hour: number) =>
  hour >= dayBusinessOpenHour && hour < dayBusinessCloseHour;

const getDayCurrentTimeOffset = (currentOperatingMinutes = legacyDayCurrentTimeMinutes) => {
  const openMinutes = dayScheduleStartHour * 60;
  const closeMinutes = dayScheduleEndHour * 60;
  const boundedMinutes = Math.min(
    Math.max(currentOperatingMinutes, openMinutes),
    closeMinutes,
  );

  return Math.round(
    ((boundedMinutes - openMinutes) / 60) * dayScheduleHourRowHeight,
  );
};

const getMinutesInDayFromDateTime = (dateTime?: string) => {
  return getOperatingMinutesFromIso(dateTime);
};

const getWaitMinutesFromTime = (
  dateTime?: string,
  currentOperatingMinutes = legacyDayCurrentTimeMinutes,
) => {
  const minutesInDay = getMinutesInDayFromDateTime(dateTime);

  if (minutesInDay === undefined) return undefined;

  return Math.max(0, currentOperatingMinutes - minutesInDay);
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
    summary.activeEncounter?.checkedInAt ??
    summary.latestAppointment?.scheduledStartAt;
  const minutesInDay = getMinutesInDayFromDateTime(dateTime);

  return minutesInDay ?? Number.MAX_SAFE_INTEGER;
};

const sortReceptionSideListItems = (items: ReceptionPatientSummary[]) =>
  items
    .map((summary, index) => ({
      index,
      sortTime: getReceptionSideListSortTime(summary),
      summary,
    }))
    .sort((a, b) => a.sortTime - b.sortTime || a.index - b.index)
    .map(({ summary }) => summary);

const getAppointmentDurationLabel = (appointment: Appointment) => {
  if (!appointment.scheduledEndAt) return "15분";

  const start = new Date(appointment.scheduledStartAt).getTime();
  const end = new Date(appointment.scheduledEndAt).getTime();
  const minutes = Math.max(10, Math.round((end - start) / 60000));

  return `${minutes}분`;
};

const getReceptionDrawerDurationLabel = ({
  appointment,
  encounter,
}: {
  appointment?: Appointment;
  encounter?: Encounter;
}) => {
  if (
    typeof encounter?.durationMinutes === "number" &&
    Number.isFinite(encounter.durationMinutes) &&
    encounter.durationMinutes > 0
  ) {
    return `${encounter.durationMinutes}분`;
  }

  return appointment ? getAppointmentDurationLabel(appointment) : "30분";
};

const getStaffDisplayName = (
  userId?: string,
  staff: Veterinarian[] = allVeterinarians,
) =>
  userId
    ? (staff.find((user) => user.id === userId)?.name ??
      mockStaffUsers.find((user) => user.id === userId)?.name)
    : undefined;

const getPrimaryGuardianFromProfiles = ({
  guardians,
  patientGuardians,
  patientId,
  workspaceId,
}: {
  guardians: Guardian[];
  patientGuardians: PatientGuardian[];
  patientId?: string;
  workspaceId: string;
}) => {
  if (!patientId) return undefined;

  const primaryGuardianId = patientGuardians.find(
    (link) => link.patientId === patientId && link.isPrimary,
  )?.guardianId;

  return primaryGuardianId
    ? guardians.find(
        (guardian) =>
          guardian.id === primaryGuardianId &&
          guardian.workspaceId === workspaceId,
      )
    : undefined;
};

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

const getReceptionVeterinarianSelectLabel = (
  veterinarianId: string,
  veterinarians: Veterinarian[] = allVeterinarians,
) =>
  veterinarianId === unassignedVeterinarianValue
    ? "수의사 미지정"
    : (getStaffDisplayName(veterinarianId, veterinarians) ?? "수의사 미지정");

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
    return { label: "예방접종" };
  }

  if (normalized.includes("구토") || normalized.includes("식욕")) {
    return { label: "구토/식욕" };
  }

  if (normalized.includes("피부")) {
    return { label: "피부" };
  }

  if (normalized.includes("수술")) {
    return { label: "수술" };
  }

  return { label: "진료" };
}

function CalendarTaskBadge({
  testId,
  type = "예약",
}: {
  testId?: string;
  type?: "예약" | "외래" | "노쇼";
}) {
  const outpatient = type === "외래";
  const noShow = type === "노쇼";

  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex h-5 min-w-[34px] shrink-0 items-center justify-center whitespace-nowrap rounded-[6px] px-[6px] py-[2px] font-['Pretendard'] text-[12px] font-medium leading-4 tracking-[0.3px]",
        noShow &&
          "border border-[#feb2b2] bg-gradient-to-b from-[rgba(245,101,101,0)] to-[rgba(245,101,101,0.1)] text-[#e53e3e]",
        outpatient &&
          "border border-[#90cdf4] bg-gradient-to-b from-[rgba(66,153,225,0)] to-[rgba(66,153,225,0.1)] text-[#2b6cb0]",
        !outpatient &&
          !noShow &&
          "border border-transparent bg-gradient-to-b from-[#2989e4] to-[#3182ce] text-white",
      )}
    >
      {type}
    </span>
  );
}

function CalendarQuarterHourLines() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      data-testid="calendar-quarter-hour-lines"
      aria-hidden="true"
    >
      {Array.from({ length: scheduleSlotCountPerHour - 1 }, (_, index) => (
        <span
          key={`quarter-line-${index}`}
          className="absolute left-0 right-0 h-px bg-[var(--emr-line-subtle)]/70"
          style={{ top: `${((index + 1) / scheduleSlotCountPerHour) * 100}%` }}
        />
      ))}
    </div>
  );
}

type CalendarTaskCardProps = {
  accentClassName?: string;
  accentTestId?: string;
  ariaLabel: string;
  badgeType: "예약" | "외래" | "노쇼";
  className?: string;
  description?: string;
  disabled?: boolean;
  onClick: () => void;
  onPointerDown?: () => void;
  patientLabel: string;
  purposeLabel: string;
  purposeTestId?: string;
  secondaryBadgeLabel?: string;
  secondaryBadgeTestId?: string;
  selected?: boolean;
  testId: string;
  type?: "default" | "compact" | "noShow";
};

function CalendarTaskCard({
  accentClassName,
  accentTestId,
  ariaLabel,
  badgeType,
  className,
  description,
  disabled,
  onClick,
  onPointerDown,
  patientLabel,
  purposeLabel,
  purposeTestId,
  secondaryBadgeLabel,
  secondaryBadgeTestId,
  selected,
  testId,
  type = "default",
}: CalendarTaskCardProps) {
  const noShow = type === "noShow";
  const compact = type === "compact";

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      className={cn(
        "relative z-10 flex min-w-0 flex-1 items-start overflow-hidden rounded-[8px] border p-[8px] text-left font-['Pretendard'] outline-none transition-colors",
        compact
          ? "h-[36px] flex-row items-center gap-[8px]"
          : "flex-col gap-[4px]",
        type === "default" && "h-[80px]",
        noShow && "h-[60px]",
        noShow
          ? "border-[#feb2b2] bg-[rgba(229,62,62,0.06)] text-[#e53e3e] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
          : selected
            ? "border-[#63b3ed] bg-[rgba(66,153,225,0.16)] text-[#2b6cb0] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
            : "border-[#63b3ed] bg-[rgba(66,153,225,0.08)] text-[#2b6cb0] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]",
        !noShow && "hover:bg-[rgba(66,153,225,0.16)]",
        "focus-visible:border-[3px] focus-visible:border-[rgba(0,0,0,0.24)] focus-visible:bg-[rgba(66,153,225,0.08)] focus-visible:shadow-none",
        disabled && "opacity-50",
        className,
      )}
      data-testid={testId}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      <span
        data-testid={accentTestId ?? `${testId}-accent`}
        className={cn(
          "sr-only",
          noShow ? "text-[#e53e3e]" : "text-[#2b6cb0]",
          accentClassName,
        )}
        aria-hidden="true"
      />
      {compact ? (
        <>
          <CalendarTaskBadge type={badgeType} />
          <span
            data-testid={purposeTestId}
            className="flex min-w-0 items-center gap-[4px] text-[14px] font-medium leading-5 tracking-[0.196px]"
          >
            <span className="truncate">{patientLabel}</span>
            <span className="shrink-0">·</span>
            <span className="truncate">{purposeLabel}</span>
          </span>
        </>
      ) : (
        <>
          <span className="flex w-full min-w-0 items-center gap-[6px] overflow-hidden">
            <CalendarTaskBadge type={badgeType} />
            {!noShow && secondaryBadgeLabel ? (
              <CalendarTaskBadge testId={secondaryBadgeTestId} type="외래" />
            ) : null}
          </span>
          <span
            data-testid={purposeTestId}
            className="flex w-full min-w-0 items-start gap-[4px] text-[14px] font-medium leading-5 tracking-[0.196px]"
          >
            <span className="truncate">{patientLabel}</span>
            <span className="shrink-0">·</span>
            <span className="truncate">{purposeLabel}</span>
          </span>
          {!noShow && description ? (
            <span className="w-full truncate text-[12px] font-normal leading-4 tracking-[0.3px]">
              {description}
            </span>
          ) : null}
        </>
      )}
    </button>
  );
}

const getReceptionVisitSummary = ({
  appointment,
  encounter,
  veterinarians = allVeterinarians,
}: {
  appointment?: Appointment;
  encounter?: Encounter;
  veterinarians?: Veterinarian[];
}) => {
  const checkedInAt = encounter?.checkedInAt
    ? `${getShortTime(encounter.checkedInAt)} 접수`
    : null;
  const appointmentAt = appointment?.scheduledStartAt
    ? `${getShortTime(appointment.scheduledStartAt)} 예약`
    : null;
  const veterinarianName =
    getStaffDisplayName(encounter?.primaryVeterinarianId, veterinarians) ??
    getStaffDisplayName(appointment?.assignedVeterinarianId, veterinarians) ??
    "담당의 미지정";
  const encounterNo = encounter?.encounterNo ?? "encounter 생성 전";

  return [checkedInAt ?? appointmentAt, veterinarianName, encounterNo]
    .filter(Boolean)
    .join(" · ");
};

const findScenarioEncounter = (
  encounters: Encounter[] | undefined,
  encounterId?: string | null,
) => {
  if (!encounters?.length) return undefined;

  return (
    encounters.find((encounter) => encounter.id === encounterId) ??
    encounters.find((encounter) =>
      ["waiting", "in_consultation", "ordered", "ready_for_billing"].includes(
        encounter.status,
      ),
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
        tone === "default" &&
          "border-border bg-card text-[var(--emr-text-secondary)]",
        className,
      )}
    >
      {label}
    </Badge>
  );
}

const getEncounterTone = (status: Encounter["status"]) => {
  if (status === "completed") return "green";
  if (status === "cancelled") return "red";
  if (
    status === "ordered" ||
    status === "in_consultation" ||
    status === "ready_for_billing"
  ) {
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
  currentOperatingMinutes,
  onOpenChart,
  onUnavailableAction,
  selected,
  summary,
  onSelect,
}: {
  currentOperatingMinutes: number;
  onOpenChart: (summary: ReceptionPatientSummary) => void;
  onUnavailableAction: (feedback: ReceptionCardActionFeedback) => void;
  selected: boolean;
  summary: ReceptionPatientSummary;
  onSelect: () => void;
}) {
  const guardianName = summary.primaryGuardian?.name ?? "보호자 미지정";
  const receptionType =
    summary.activeDraftCheckIn?.receptionType === "walk_in"
      ? "외래"
      : summary.latestAppointment
        ? "예약"
        : "외래";
  const visitText =
    summary.activeEncounter?.chiefComplaint ??
    summary.latestAppointment?.symptomNote ??
    summary.latestAppointment?.visitPurpose ??
    "접수할 내원 목적을 확인해 주세요.";
  const waitingMinutes = getWaitMinutesFromTime(
    summary.activeEncounter?.checkedInAt,
    currentOperatingMinutes,
  );
  const timeContent = summary.activeEncounter?.checkedInAt ? (
    <>
      <span>{getShortTime(summary.activeEncounter.checkedInAt)} 접수</span>
      {waitingMinutes !== undefined ? (
        <span
          className={cn(
            "ml-1 shrink-0 emr-text-micro font-semibold leading-none",
            getWaitingTimeTextClassName(waitingMinutes),
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
      <div className="mt-0.5 flex h-[18px] min-w-0 items-center gap-1 pl-1 emr-text-dense-label font-medium text-muted-foreground">
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
  const [cardActionFeedback, setCardActionFeedback] =
    useState<ReceptionCardActionFeedback | null>(null);
  const [workspaceVeterinarians, setWorkspaceVeterinarians] = useState<
    Veterinarian[]
  >([]);
  const searchQuery = useReceptionStore((state) => state.searchQuery);
  const selectAppointment = useReceptionStore(
    (state) => state.selectAppointment,
  );
  const selectEncounter = useReceptionStore((state) => state.selectEncounter);
  const selectPatient = useReceptionStore((state) => state.selectPatient);
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore(
    (state) => state.patientGuardians,
  );
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const authSession = useMockAuthStore((state) => state.session);
  const setModulePanelOpen = useLayoutStore(
    (state) => state.setModulePanelOpen,
  );
  const requestReceptionReadRetry = useReceptionStore(
    (state) => state.requestReceptionReadRetry,
  );
  const setSearchQuery = useReceptionStore((state) => state.setSearchQuery);
  const scenario = getDemoScenarioFromParams(searchParams);
  const workspaceId =
    typeof params.workspaceId === "string"
      ? params.workspaceId
      : (params.workspaceId?.[0] ?? LEGACY_SALES_DEMO_WORKSPACE_ID);
  const defaultOperatingDate = getWorkspaceOperatingDate(workspaceId);
  const operatingDateOverride = useReceptionStore(
    (state) => state.operatingDateByWorkspace[workspaceId],
  );
  const operatingDate = operatingDateOverride ?? defaultOperatingDate;
  const currentOperatingMinutes = getWorkspaceCurrentOperatingMinutes(workspaceId);
  const liveStaffSourceEnabled = isPreparedEmptyClinicWorkspace(workspaceId);
  const veterinarians =
    liveStaffSourceEnabled && workspaceVeterinarians.length > 0
      ? workspaceVeterinarians
      : allVeterinarians;
  const veterinarianStaffMembers = useMemo(
    () =>
      veterinarians.map((veterinarian) => ({
        displayName: veterinarian.name,
        id: veterinarian.id,
      })),
    [veterinarians],
  );
  const querySelectedPatientId =
    searchParams.get("patientId") ?? scenario?.patientId;
  const patientSummaries = useMemo(
    () =>
      getReceptionPatientSummaries(
        draftCheckIns,
        {
          guardians,
          patientGuardians,
          patients,
        },
        { operatingDate, staffMembers: veterinarianStaffMembers, workspaceId },
      ),
    [
      draftCheckIns,
      guardians,
      operatingDate,
      patientGuardians,
      patients,
      veterinarianStaffMembers,
      workspaceId,
    ],
  );
  const filteredPatients = useMemo(
    () => getFilteredReceptionPatients(patientSummaries, searchQuery),
    [patientSummaries, searchQuery],
  );
  const visiblePatients = useMemo(
    () => getReceptionSideListItems(filteredPatients, listMode),
    [filteredPatients, listMode],
  );
  const sideListCounts = useMemo(
    () =>
      Object.fromEntries(
        receptionQueueTabItems.map((item) => [
          item.value,
          getReceptionSideListItems(patientSummaries, item.value).length,
        ]),
      ) as Record<ReceptionSideListMode, number>,
    [patientSummaries],
  );
  const sideListFilterItems = useMemo(
    () =>
      receptionQueueTabItems.map((item) => ({
        ...item,
        count: sideListCounts[item.value],
      })),
    [sideListCounts],
  );
  const emptyStateCopy = getReceptionEmptyStateCopy({
    listMode,
    searchQuery,
    workspaceId,
  });
  const closeSearch = useCallback(() => {
    setSearchQuery("");
    setSearchOpen(false);
  }, [setSearchQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      if (!liveStaffSourceEnabled) {
        setWorkspaceVeterinarians([]);
        return;
      }

      const result = await loadWorkspaceVeterinarians({
        actorId: authSession?.id,
        workspaceId,
      });
      if (cancelled) return;

      setWorkspaceVeterinarians(mapWorkspaceStaffToVeterinarians(result));
    }

    void loadStaff();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id, liveStaffSourceEnabled, workspaceId]);

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title={moduleLabel}
        collapseLabel="사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
      />
      {queueReadStatus === "loading" ? (
        <ReceptionPanelStateMessage>대기열 확인 중</ReceptionPanelStateMessage>
      ) : null}
      {queueReadStatus === "error" ? (
        <EmrInlineAlert
          className="mx-3 my-2"
          severity="warning"
          title="서버 대기열을 불러오지 못했어"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={requestReceptionReadRetry}
            >
              대기열 다시 시도
            </Button>
          }
          testId="reception-queue-read-alert"
        >
          {queueReadError ??
            (isPreparedEmptyClinicWorkspace(workspaceId)
              ? "기존 데모 업무는 표시하지 않고 준비된 빈 병원 상태를 유지해."
              : "현재 목록은 로컬 데모/세션 데이터 기준으로 유지돼.")}
        </EmrInlineAlert>
      ) : null}
      {cardActionFeedback ? (
        <EmrInlineAlert
          className="mx-3 my-2"
          severity="info"
          title={cardActionFeedback.title}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCardActionFeedback(null)}
            >
              확인
            </Button>
          }
          testId="reception-card-action-feedback"
        >
          {cardActionFeedback.body}
        </EmrInlineAlert>
      ) : null}
      <EmrListHeader
        label={
          <SegmentedControl
            aria-label="접수 목록 유형"
            className="shrink-0"
            items={sideListFilterItems}
            value={listMode}
            variant="tabs"
            onValueChange={setListMode}
          />
        }
        search={{
          active: searchOpen,
          closeLabel: "대기열 검색 닫기",
          inputLabel: "대기열 검색",
          onClose: closeSearch,
          onQueryChange: setSearchQuery,
          placeholder: "환자, 보호자, 전화번호, 방문 목적, 메모, 담당의 검색",
          query: searchQuery,
          resultCount: visiblePatients.length,
        }}
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
              onClick={() => setSearchOpen(true)}
            >
              <CdsActionsSearchIcon className="size-4" />
            </EmrListHeaderIconButton>
          </>
        }
      />
      <EmrSubpanelBody>
        {visiblePatients.length ? (
          visiblePatients.map((summary) => (
            <PatientCard
              key={summary.patient.id}
              currentOperatingMinutes={currentOperatingMinutes}
              summary={summary}
              selected={isReceptionSideCardSelected(
                summary,
                activeDrawer,
                querySelectedPatientId,
              )}
              onOpenChart={(targetSummary) => {
                const encounter = targetSummary.activeEncounter;
                if (!encounter) return;

                saveChartLiveEncounterHandoff({
                  encounter,
                  patient: targetSummary.patient,
                  primaryGuardian: targetSummary.primaryGuardian,
                  veterinarianName: targetSummary.veterinarianName,
                });
                selectEncounter(encounter.id);
                setActiveDrawer(null);
                router.push(
                  buildChartRoute({
                    encounterId: encounter.id,
                    patientId: targetSummary.patient.id,
                    workspaceId,
                  }),
                );
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
        ) : searchQuery.trim() ? (
          <EmrListSearchEmptyState
            objectLabel="접수/예약 항목"
            query={searchQuery}
            onClear={() => setSearchQuery("")}
          />
        ) : (
          <ReceptionEmptyState>{emptyStateCopy}</ReceptionEmptyState>
        )}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

function isReceptionSideCardSelected(
  summary: ReceptionPatientSummary,
  activeDrawer: { type: string; id: string } | null,
  querySelectedPatientId?: string | null,
) {
  if (!activeDrawer)
    return Boolean(
      querySelectedPatientId && summary.patient.id === querySelectedPatientId,
    );

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
  mode: ReceptionSideListMode,
) {
  if (mode === "reception") {
    return sortReceptionSideListItems(
      summaries.filter((summary) => Boolean(summary.activeEncounter)),
    );
  }

  if (mode === "appointment") {
    return sortReceptionSideListItems(
      summaries.filter(
        (summary) =>
          !summary.activeEncounter &&
          summary.latestAppointment?.status === "confirmed",
      ),
    );
  }

  return sortReceptionSideListItems(
    summaries.filter(
      (summary) => summary.activeEncounter || summary.latestAppointment,
    ),
  );
}

function ScheduleAppointmentCard({
  appointment,
  onClearCalendarTransientSelection,
  onSelect,
  selected,
  veterinarians = allVeterinarians,
}: {
  appointment: Appointment;
  onClearCalendarTransientSelection: () => void;
  onSelect: () => void;
  selected: boolean;
  veterinarians?: Veterinarian[];
}) {
  const patient = getAppointmentPatient(appointment);
  const visitPurpose = appointment.visitPurpose ?? "내원";
  const visitDetail = appointment.symptomNote ?? visitPurpose;
  const visitVisual = getVisitPurposeVisual(visitDetail);
  const noShow =
    appointment.status === "no_show" || appointment.status === "cancelled";
  const checkedIn = appointment.status === "checked_in";
  const cardType = noShow ? "noShow" : checkedIn ? "compact" : "default";
  const patientLabel = patient?.name ?? "환자 미지정";
  const description = `${getShortTime(appointment.scheduledStartAt)} · ${getAppointmentDurationLabel(appointment)} · ${visitDetail}`;

  return (
    <CalendarTaskCard
      accentClassName={getVeterinarianAccentClassName(
        appointment.assignedVeterinarianId,
        veterinarians,
      )}
      accentTestId={`appointment-accent-${appointment.id}`}
      ariaLabel={`${getStatusLabel("appointment", appointment.status)} ${patientLabel} · ${visitPurpose}`}
      badgeType={noShow ? "노쇼" : "예약"}
      description={cardType === "default" ? description : undefined}
      disabled={appointment.status !== "confirmed" && !checkedIn}
      onPointerDown={onClearCalendarTransientSelection}
      onClick={onSelect}
      patientLabel={patientLabel}
      purposeLabel={visitPurpose}
      purposeTestId={`appointment-purpose-${appointment.id}`}
      secondaryBadgeLabel={
        cardType === "default" ? visitVisual.label : undefined
      }
      secondaryBadgeTestId={`appointment-purpose-chip-${appointment.id}`}
      selected={selected}
      testId={`appointment-card-${appointment.id}`}
      type={cardType}
    />
  );
}

function ScheduleWalkInQueueCard({
  draft,
  onClearCalendarTransientSelection,
  onSelectEncounter,
  veterinarians = allVeterinarians,
}: {
  draft: ReceptionDraftCheckIn;
  onClearCalendarTransientSelection: () => void;
  onSelectEncounter: (draft: ReceptionDraftCheckIn) => void;
  veterinarians?: Veterinarian[];
}) {
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore(
    (state) => state.patientGuardians,
  );
  const patient = patients.find(
    (item) => item.id === draft.encounter.patientId,
  );
  const primaryGuardianId = patientGuardians.find(
    (link) => link.patientId === draft.encounter.patientId && link.isPrimary,
  )?.guardianId;
  const guardian =
    guardians.find((item) => item.id === primaryGuardianId) ??
    getMockPatientBundle(draft.encounter.patientId)?.primaryGuardian;
  const veterinarianName = getStaffDisplayName(
    draft.encounter.primaryVeterinarianId,
    veterinarians,
  );
  const durationLabel = getDraftDurationLabel(draft);
  const visitPurpose = draft.encounter.chiefComplaint ?? "현장 접수";
  const visitVisual = getVisitPurposeVisual(visitPurpose);
  const scheduledStartAt = getDraftScheduleStartAt(draft);
  const patientLabel = patient?.name ?? "환자 미지정";

  return (
    <CalendarTaskCard
      accentClassName={getVeterinarianAccentClassName(
        draft.encounter.primaryVeterinarianId,
        veterinarians,
      )}
      accentTestId={`walkin-accent-${draft.encounter.id}`}
      ariaLabel={`${getReceptionEncounterStatusLabel(draft.encounter.status)} ${patientLabel} · ${visitPurpose}`}
      badgeType="외래"
      description={`${getShortTime(scheduledStartAt)} · ${durationLabel} · ${getGuardianDisplay(guardian)} · ${
        draft.department ?? defaultWalkInDepartment
      }${draft.memo ? ` · ${draft.memo}` : ""}${veterinarianName ? ` · ${veterinarianName}` : ""}`}
      onPointerDown={onClearCalendarTransientSelection}
      onClick={() => onSelectEncounter(draft)}
      patientLabel={patientLabel}
      purposeLabel={visitPurpose}
      purposeTestId={`walkin-purpose-${draft.encounter.id}`}
      secondaryBadgeLabel={visitVisual.label}
      secondaryBadgeTestId={`walkin-purpose-chip-${draft.encounter.id}`}
      testId={`walkin-card-${draft.encounter.id}`}
      type="default"
    />
  );
}

const receptionDatePickerWeekdays = ["일", "월", "화", "수", "목", "금", "토"];
const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDateParts(date: string) {
  const match = isoDatePattern.exec(date);
  if (!match) return { year: 2026, month: 5, day: 1 };

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getIsoDateFromUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDaysToIsoDate(date: string, days: number) {
  const parts = parseIsoDateParts(date);
  const utcDate = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );

  return getIsoDateFromUtcDate(utcDate);
}

function getStartOfWeekIsoDate(date: string) {
  const parts = parseIsoDateParts(date);
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const dayOffset = utcDate.getUTCDay();

  return addDaysToIsoDate(date, -dayOffset);
}

function getReceptionWeekLabel(date: string) {
  const weekStart = getStartOfWeekIsoDate(date);
  const weekEnd = addDaysToIsoDate(weekStart, 6);

  return `${formatShortOperatingDate(weekStart)} - ${formatShortOperatingDate(weekEnd)}`;
}

function getReceptionDateControlLabels(operatingDate: string) {
  const dateLabel = formatKoreanOperatingDateLabel(operatingDate);

  return {
    day: {
      dateLabel,
      pickerLabel: "날짜 선택",
      previousLabel: "이전 날짜",
      nextLabel: "다음 날짜",
    },
    week: {
      dateLabel: getReceptionWeekLabel(operatingDate),
      pickerLabel: "주 선택",
      previousLabel: "이전 주",
      nextLabel: "다음 주",
    },
    month: {
      dateLabel: formatOperatingMonthLabel(operatingDate),
      pickerLabel: "월 선택",
      previousLabel: "이전 월",
      nextLabel: "다음 월",
    },
  } satisfies Record<
    ReceptionCalendarView,
    {
      dateLabel: string;
      pickerLabel: string;
      previousLabel: string;
      nextLabel: string;
    }
  >;
}

function getReceptionMonthDatePickerCells(
  visibleMonthDate: string,
  selectedDate: string,
) {
  const parts = parseIsoDateParts(visibleMonthDate);
  const monthStart = new Date(Date.UTC(parts.year, parts.month - 1, 1));
  const firstCellDate = new Date(monthStart);
  firstCellDate.setUTCDate(1 - monthStart.getUTCDay());

  return Array.from({ length: 35 }, (_, index) => {
    const cellDate = new Date(firstCellDate);
    cellDate.setUTCDate(firstCellDate.getUTCDate() + index);
    const key = getIsoDateFromUtcDate(cellDate);

    return {
      key,
      day: String(cellDate.getUTCDate()),
      inMonth: cellDate.getUTCMonth() === parts.month - 1,
      selected: key === selectedDate,
    };
  });
}

function getReceptionWeekPickerRows(operatingDate: string) {
  const selectedWeekStart = getStartOfWeekIsoDate(operatingDate);

  return [-2, -1, 0, 1, 2].map((offset) => {
    const key = addDaysToIsoDate(selectedWeekStart, offset * 7);

    return {
      key,
      label: getReceptionWeekLabel(key),
      selected: key === selectedWeekStart,
    };
  });
}

function getReceptionMonthPickerItems(operatingDate: string) {
  const { year, month } = parseIsoDateParts(operatingDate);

  return Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1;

    return {
      label: `${String(year).slice(2)}.${String(monthNumber).padStart(2, "0")}`,
      selected: monthNumber === month,
    };
  });
}

function getDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonthsToIsoDate(date: string, months: number) {
  const parts = parseIsoDateParts(date);
  const nextMonthIndex = parts.month - 1 + months;
  const year = parts.year + Math.floor(nextMonthIndex / 12);
  const monthIndex = ((nextMonthIndex % 12) + 12) % 12;
  const day = Math.min(parts.day, getDaysInMonth(year, monthIndex + 1));

  return getIsoDateFromUtcDate(new Date(Date.UTC(year, monthIndex, day)));
}

function setMonthOnIsoDate(date: string, month: number) {
  const parts = parseIsoDateParts(date);
  const day = Math.min(parts.day, getDaysInMonth(parts.year, month));

  return getIsoDateFromUtcDate(new Date(Date.UTC(parts.year, month - 1, day)));
}

function getAdjacentReceptionDate(
  operatingDate: string,
  view: ReceptionCalendarView,
  direction: -1 | 1,
) {
  if (view === "week") return addDaysToIsoDate(operatingDate, direction * 7);
  if (view === "month") return addMonthsToIsoDate(operatingDate, direction);

  return addDaysToIsoDate(operatingDate, direction);
}

function ReceptionScheduleDateControl({
  onOperatingDateChange,
  operatingDate,
  todayDate,
  view,
}: {
  onOperatingDateChange: (operatingDate: string) => void;
  operatingDate: string;
  todayDate: string;
  view: ReceptionCalendarView;
}) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerMonthDate, setPickerMonthDate] = useState(operatingDate);
  const dateControlLabel = getReceptionDateControlLabels(operatingDate)[view];
  const datePickerCells = getReceptionMonthDatePickerCells(
    pickerMonthDate,
    operatingDate,
  );
  const weekPickerRows = getReceptionWeekPickerRows(operatingDate);
  const monthPickerItems = getReceptionMonthPickerItems(operatingDate);
  const pickerMonthDateParts = parseIsoDateParts(pickerMonthDate);
  const operatingDateParts = parseIsoDateParts(operatingDate);
  const showingToday = operatingDate === todayDate;

  useEffect(() => {
    if (!datePickerOpen) setPickerMonthDate(operatingDate);
  }, [datePickerOpen, operatingDate]);

  const selectOperatingDate = (nextOperatingDate: string) => {
    onOperatingDateChange(nextOperatingDate);
    setDatePickerOpen(false);
  };

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-1"
      data-testid="reception-date-control"
    >
      <Button
        variant="outline"
        size="icon-sm"
        className="size-7 bg-[var(--emr-surface-panel)]"
        aria-label={dateControlLabel.previousLabel}
        onClick={() =>
          onOperatingDateChange(
            getAdjacentReceptionDate(operatingDate, view, -1),
          )
        }
      >
        <ChevronLeftIcon />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        className="size-7 bg-[var(--emr-surface-panel)]"
        aria-label={dateControlLabel.nextLabel}
        onClick={() =>
          onOperatingDateChange(
            getAdjacentReceptionDate(operatingDate, view, 1),
          )
        }
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
        <PopoverContent
          align="start"
          className="w-[244px] gap-3 p-3"
          initialFocus={false}
        >
          {view === "day" ? (
            <>
              <div className="flex items-center justify-between">
                <div className="emr-text-dense font-semibold leading-5 text-foreground">
                  {pickerMonthDateParts.year}년 {pickerMonthDateParts.month}월
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="이전 달"
                    onClick={() =>
                      setPickerMonthDate((current) =>
                        addMonthsToIsoDate(current, -1),
                      )
                    }
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="다음 달"
                    onClick={() =>
                      setPickerMonthDate((current) =>
                        addMonthsToIsoDate(current, 1),
                      )
                    }
                  >
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
                {datePickerCells.map((cell) => (
                  <button
                    key={cell.key}
                    type="button"
                    className={cn(
                      "flex size-7 items-center justify-center rounded-md emr-text-metadata font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                      cell.inMonth
                        ? "text-foreground"
                        : "text-muted-foreground",
                      cell.selected &&
                        "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                    aria-label={
                      cell.selected
                        ? `${formatKoreanOperatingDateLabel(cell.key)} 선택됨`
                        : `${cell.day}일 선택`
                    }
                    aria-pressed={cell.selected}
                    onClick={() => selectOperatingDate(cell.key)}
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
                  {operatingDateParts.year}년 {operatingDateParts.month}월
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="이전 주 보기"
                    onClick={() =>
                      onOperatingDateChange(addDaysToIsoDate(operatingDate, -7))
                    }
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="다음 주 보기"
                    onClick={() =>
                      onOperatingDateChange(addDaysToIsoDate(operatingDate, 7))
                    }
                  >
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
              <div className="grid gap-1">
                {weekPickerRows.map((week) => (
                  <button
                    key={week.key}
                    type="button"
                    className={cn(
                      "flex h-8 items-center rounded-md px-2 text-left emr-text-metadata font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                      week.selected
                        ? "bg-[var(--emr-status-info-bg)] text-[var(--emr-status-info-text)]"
                        : "text-foreground",
                    )}
                    aria-label={
                      week.selected
                        ? `${week.label} 선택됨`
                        : `${week.label} 주 선택`
                    }
                    aria-pressed={week.selected}
                    onClick={() => selectOperatingDate(week.key)}
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
                  {operatingDateParts.year}년
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="이전 연도"
                    onClick={() =>
                      onOperatingDateChange(addMonthsToIsoDate(operatingDate, -12))
                    }
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label="다음 연도"
                    onClick={() =>
                      onOperatingDateChange(addMonthsToIsoDate(operatingDate, 12))
                    }
                  >
                    <ChevronRightIcon />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {monthPickerItems.map((month, index) => {
                  const nextMonth = index + 1;
                  return (
                    <button
                      key={month.label}
                      type="button"
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md emr-text-metadata font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                        month.selected
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "text-foreground",
                      )}
                      aria-label={
                        month.selected
                          ? `${month.label} 선택됨`
                          : `${month.label} 월 선택`
                      }
                      aria-pressed={month.selected}
                      onClick={() =>
                        selectOperatingDate(
                          setMonthOnIsoDate(operatingDate, nextMonth),
                        )
                      }
                    >
                      {month.label}
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
        disabled={showingToday}
        onClick={() => selectOperatingDate(todayDate)}
      >
        오늘
      </Button>
    </div>
  );
}

function ScheduleToolbar({
  onOperatingDateChange,
  operatingDate,
  onCreateWalkIn,
  onUnifiedPatientReady,
  onToggleVeterinarian,
  selectedVeterinarianIds,
  todayDate,
  veterinarians,
  view,
  onViewChange,
}: {
  onOperatingDateChange: (operatingDate: string) => void;
  operatingDate: string;
  onCreateWalkIn: () => void;
  onUnifiedPatientReady: (patientId: string) => void;
  onToggleVeterinarian: (veterinarianId: string) => void;
  selectedVeterinarianIds: string[];
  todayDate: string;
  veterinarians: Veterinarian[];
  view: ReceptionCalendarView;
  onViewChange: (view: ReceptionCalendarView) => void;
}) {
  const selectedVeterinarians = veterinarians.filter((veterinarian) =>
    selectedVeterinarianIds.includes(veterinarian.id),
  );
  const todayWorkingVeterinarians = veterinarians.slice(0, 4);
  const todayWorkingVeterinarianIds = new Set(
    todayWorkingVeterinarians.map((veterinarian) => veterinarian.id),
  );
  const otherVeterinarians = veterinarians.filter(
    (veterinarian) => !todayWorkingVeterinarianIds.has(veterinarian.id),
  );
  const veterinarianLabel = getVeterinarianFilterLabel(selectedVeterinarians);

  return (
    <div
      className="flex h-12 shrink-0 flex-nowrap items-center justify-between gap-3 overflow-hidden border-b bg-card px-4"
      data-testid="schedule-toolbar"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ReceptionScheduleDateControl
          onOperatingDateChange={onOperatingDateChange}
          operatingDate={operatingDate}
          todayDate={todayDate}
          view={view}
        />
        <span className="ml-2 rounded-md bg-muted px-2 py-1 emr-text-metadata font-medium leading-4 text-muted-foreground">
          영업시간{" "}
          <span className="font-semibold text-sky-600">
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
        "group/empty-slot min-h-12 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent text-[var(--emr-text-tertiary)] outline-none transition-colors",
        !affordanceHidden &&
          "hover:border-[var(--emr-status-info-border)] hover:bg-[var(--emr-status-info-bg)] focus-visible:border-[var(--emr-status-info-border)] focus-visible:bg-[var(--emr-status-info-bg)] focus-visible:ring-3 focus-visible:ring-ring/50",
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
      <span className="sr-only" data-testid={`${testId}-affordance`}>
        접수 생성
      </span>
    </button>
  );
}

type ReceptionCalendarDraftInput = {
  durationMinutes: number;
  plannedStartAt: string;
  primaryVeterinarianId?: string;
};

function ScheduleDraftSelectionCard({
  selection,
}: {
  selection: ReceptionCalendarDraftSelection;
}) {
  const startMinutes = getMinutesInDayFromDateTime(selection.plannedStartAt);

  if (startMinutes === undefined) return null;

  const endMinutes = startMinutes + selection.durationMinutes;
  const startHour = Math.floor(startMinutes / 60);
  const selectionTop =
    ((startMinutes - startHour * 60) / 60) * dayScheduleHourRowHeight;
  const selectionHeight = Math.max(
    dayScheduleHourRowHeight / (60 / scheduleSlotMinutes),
    (selection.durationMinutes / 60) * dayScheduleHourRowHeight,
  );

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 rounded-[8px] border border-[#63b3ed] bg-[rgba(66,153,225,0.08)] px-[8px] py-[6px] font-['Pretendard'] text-[#2b6cb0] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
      data-testid={`calendar-draft-card-${selection.id}`}
      style={{
        height: selectionHeight,
        top: selectionTop,
      }}
    >
      <div className="truncate text-[14px] font-medium leading-5 tracking-[0.196px]">
        {getScheduleTimeLabelFromMinutes(startMinutes)} -{" "}
        {getScheduleTimeLabelFromMinutes(endMinutes)}
      </div>
    </div>
  );
}

function ScheduleSelectionCell({
  affordanceSuspended,
  calendarDraftSelection,
  appointments,
  draftCheckIns,
  hour,
  operatingDate,
  onAffordancePointerMove,
  onCreateDraft,
  testId,
  veterinarian,
}: {
  affordanceSuspended: boolean;
  calendarDraftSelection?: ReceptionCalendarDraftSelection;
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  hour: number;
  operatingDate: string;
  onAffordancePointerMove: () => void;
  onCreateDraft: (draft: ReceptionCalendarDraftInput) => void;
  testId: string;
  veterinarian: Veterinarian;
}) {
  const [dragState, setDragState] = useState<{
    bounds: DOMRect;
    pointerId: number;
    startMinutes: number;
    endMinutes: number;
  } | null>(null);
  useEffect(() => {
    const clearDragState = () => setDragState(null);
    const clearOtherCellDragState = (event: Event) => {
      const nextTestId = (event as CustomEvent<{ testId?: string }>).detail
        ?.testId;

      if (nextTestId !== testId) clearDragState();
    };

    window.addEventListener(
      receptionCalendarDragStartEvent,
      clearOtherCellDragState,
    );
    window.addEventListener(receptionCalendarDragClearEvent, clearDragState);
    window.addEventListener("blur", clearDragState);

    return () => {
      window.removeEventListener(
        receptionCalendarDragStartEvent,
        clearOtherCellDragState,
      );
      window.removeEventListener(
        receptionCalendarDragClearEvent,
        clearDragState,
      );
      window.removeEventListener("blur", clearDragState);
    };
  }, [testId]);
  const selectionStart = dragState
    ? snapScheduleStartMinutes(
        Math.min(dragState.startMinutes, dragState.endMinutes),
      )
    : undefined;
  const selectionEnd = dragState
    ? Math.max(
        (selectionStart ?? dragState.startMinutes) + scheduleSlotMinutes,
        snapScheduleEndMinutes(
          Math.max(dragState.startMinutes, dragState.endMinutes),
        ),
      )
    : undefined;
  const selectionCellHeight =
    dragState?.bounds.height ?? dayScheduleHourRowHeight;
  const selectionSlotRowHeight =
    selectionCellHeight / (60 / scheduleSlotMinutes);
  const selectionTop =
    selectionStart !== undefined
      ? ((selectionStart - hour * 60) / 60) * selectionCellHeight
      : 0;
  const selectionHeight =
    selectionStart !== undefined && selectionEnd !== undefined
      ? Math.max(
          selectionSlotRowHeight,
          ((selectionEnd - selectionStart) / 60) * selectionCellHeight,
        )
      : selectionSlotRowHeight;
  const selectionValidation =
    dragState && selectionStart !== undefined && selectionEnd !== undefined
      ? validateReceptionCalendarSelection({
          appointments,
          draftCheckIns,
          endMinutes: selectionEnd,
          operatingDate,
          startMinutes: selectionStart,
          veterinarianId: veterinarian.id,
        })
      : undefined;

  const createDraftFromMinutes = (startMinutes: number, endMinutes: number) => {
    const selection = validateReceptionCalendarSelection({
      appointments,
      draftCheckIns,
      endMinutes,
      operatingDate,
      startMinutes,
      veterinarianId: veterinarian.id,
    });

    if (!selection.valid) {
      return;
    }

    onCreateDraft({
      durationMinutes: selection.durationMinutes,
      plannedStartAt: selection.plannedStartAt,
      primaryVeterinarianId: veterinarian.id,
    });
  };

  return (
    <div
      className="relative h-full min-h-0 min-w-0 flex-1 touch-none bg-transparent outline-none"
      data-testid={testId}
      onPointerDown={(event) => {
        if (event.button !== 0) return;

        dispatchReceptionCalendarDragStart(testId);
        const bounds = event.currentTarget.getBoundingClientRect();
        const startMinutes = getScheduleSelectionFromPointer({
          baseHour: hour,
          bounds,
          clientY: event.clientY,
        });
        const startSlotValidation = validateReceptionCalendarSelection({
          appointments,
          draftCheckIns,
          endMinutes: startMinutes + scheduleSlotMinutes,
          operatingDate,
          startMinutes,
          veterinarianId: veterinarian.id,
        });

        if (!startSlotValidation.valid) {
          dispatchReceptionCalendarDragClear();
          return;
        }

        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Synthetic pointer events used by regression tests may not have an active pointer capture target.
        }
        setDragState({
          bounds,
          endMinutes: startMinutes,
          pointerId: event.pointerId,
          startMinutes,
        });
      }}
      onPointerMove={(event) => {
        if (affordanceSuspended) onAffordancePointerMove();
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        setDragState({
          ...dragState,
          endMinutes: getScheduleSelectionFromPointer({
            baseHour: hour,
            bounds: dragState.bounds,
            clientY: event.clientY,
          }),
        });
      }}
      onPointerCancel={() => {
        setDragState(null);
        dispatchReceptionCalendarDragClear();
      }}
      onPointerUp={(event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) return;

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }

        const endMinutes = getScheduleSelectionFromPointer({
          baseHour: hour,
          bounds: dragState.bounds,
          clientY: event.clientY,
        });
        const moved = Math.abs(endMinutes - dragState.startMinutes) >= 3;
        const start = moved
          ? Math.min(dragState.startMinutes, endMinutes)
          : dragState.startMinutes;
        const end = moved
          ? Math.max(dragState.startMinutes, endMinutes)
          : dragState.startMinutes;

        setDragState(null);
        dispatchReceptionCalendarDragClear();
        createDraftFromMinutes(start, end);
      }}
    >
      {dragState &&
      selectionStart !== undefined &&
      selectionEnd !== undefined &&
      selectionValidation?.valid !== false ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 rounded-[8px] border border-[#63b3ed] bg-[rgba(66,153,225,0.16)] px-[8px] py-[6px] font-['Pretendard'] text-[#2b6cb0] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
          data-testid={`${testId}-selection-preview`}
          style={{
            height: selectionHeight,
            top: selectionTop,
          }}
        >
          <div className="truncate text-[14px] font-medium leading-5 tracking-[0.196px]">
            {getScheduleTimeLabelFromMinutes(selectionStart)} -{" "}
            {getScheduleTimeLabelFromMinutes(selectionEnd)}
          </div>
        </div>
      ) : null}
      {calendarDraftSelection &&
      calendarDraftSelection.primaryVeterinarianId === veterinarian.id &&
      getMinutesInDayFromDateTime(calendarDraftSelection.plannedStartAt) !==
        undefined &&
      Math.floor(
        getMinutesInDayFromDateTime(calendarDraftSelection.plannedStartAt)! /
          60,
      ) === hour ? (
        <ScheduleDraftSelectionCard selection={calendarDraftSelection} />
      ) : null}
      <CalendarQuarterHourLines />
      <div className="relative z-10 grid h-full min-h-0 grid-rows-4">
        {Array.from({ length: scheduleSlotCountPerHour }, (_, index) => {
          const slotMinutes = hour * 60 + index * scheduleSlotMinutes;
          const slotValidation = validateReceptionCalendarSelection({
            appointments,
            draftCheckIns,
            endMinutes: slotMinutes + scheduleSlotMinutes,
            operatingDate,
            startMinutes: slotMinutes,
            veterinarianId: veterinarian.id,
          });

          return (
            <button
              key={slotMinutes}
              type="button"
              aria-label={`${getScheduleTimeLabelFromMinutes(slotMinutes)} ${veterinarian.name} 접수/예약 생성`}
              aria-disabled={!slotValidation.valid}
              className={cn(
                "group/slot flex min-h-0 items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                slotValidation.valid
                  ? "focus-visible:border-[var(--emr-status-info-border)] focus-visible:bg-[var(--emr-status-info-bg)]"
                  : "cursor-default",
              )}
              data-testid={`${testId}-slot-${getScheduleTimeLabelFromMinutes(slotMinutes).replace(":", "")}`}
              tabIndex={dragState ? -1 : 0}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                createDraftFromMinutes(
                  slotMinutes,
                  slotMinutes + scheduleSlotMinutes,
                );
              }}
            />
          );
        })}
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
  veterinarians = allVeterinarians,
}: {
  appointment?: Appointment;
  encounter?: Encounter;
  guardianName?: string;
  patientName: string;
  patientNo: string;
  reason: string;
  veterinarians?: Veterinarian[];
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
  const summary = getReceptionVisitSummary({
    appointment,
    encounter,
    veterinarians,
  });

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
            {guardianName ?? "보호자 미지정"} 보호자 · {patientName}({patientNo}
            ) · {summary}
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
  calendarDraftSelection,
  currentOperatingMinutes,
  emptySlotAffordanceSuspended,
  appointments,
  draftCheckIns,
  operatingDate,
  onEmptySlotAffordancePointerMove,
  onClearCalendarTransientSelection,
  onCreateCalendarDraft,
  onSelectEncounter,
  onSelectAppointment,
  selectedAppointmentId,
  selectedVeterinarians,
}: {
  calendarDraftSelection?: ReceptionCalendarDraftSelection;
  currentOperatingMinutes: number;
  emptySlotAffordanceSuspended: boolean;
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  operatingDate: string;
  onEmptySlotAffordancePointerMove: () => void;
  onClearCalendarTransientSelection: () => void;
  onCreateCalendarDraft: (draft: ReceptionCalendarDraftInput) => void;
  onSelectEncounter: (draft: ReceptionDraftCheckIn) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  selectedAppointmentId?: Appointment["id"];
  selectedVeterinarians: Veterinarian[];
}) {
  const dayScheduleHeight = dayScheduleHours.length * dayScheduleHourRowHeight;
  const currentTimeOffset = getDayCurrentTimeOffset(currentOperatingMinutes);
  const scheduleGridTemplateColumns = `56px repeat(${selectedVeterinarians.length}, minmax(180px, 1fr))`;
  const walkInDrafts = draftCheckIns.filter(
    (draft) =>
      draft.receptionType === "walk_in" &&
      isDraftOnOperatingDate(draft, operatingDate),
  );
  const unassignedWalkIns = walkInDrafts.filter(
    (draft) => !draft.encounter.primaryVeterinarianId,
  );

  return (
    <div
      className="flex min-h-[720px] flex-col bg-card"
      data-testid="reception-day-calendar"
    >
      <div
        className="sticky top-0 z-30 grid border-b bg-card shadow-xs"
        style={{ gridTemplateColumns: scheduleGridTemplateColumns }}
      >
        <div className="border-r" />
        {selectedVeterinarians.map((veterinarian) => {
          const laneAppointments = appointments.filter(
            (appointment) =>
              appointment.assignedVeterinarianId === veterinarian.id,
          );

          return (
            <div key={veterinarian.id} className="border-r p-2 last:border-r-0">
              <VeterinarianLaneHeader
                toneIndex={getVeterinarianToneIndex(
                  veterinarian,
                  selectedVeterinarians,
                )}
                veterinarian={veterinarian}
              />
              <div className="mt-1 flex flex-col gap-1">
                {laneAppointments.slice(0, 2).map((appointment) => (
                  <button
                    key={`all-day-${veterinarian.id}-${appointment.id}`}
                    type="button"
                    className="truncate rounded border border-[var(--emr-status-info-border)] bg-[var(--emr-status-info-bg)] px-2 py-0.5 text-left emr-text-micro font-medium text-primary"
                    onPointerDown={onClearCalendarTransientSelection}
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
                veterinarians={selectedVeterinarians}
                onClearCalendarTransientSelection={
                  onClearCalendarTransientSelection
                }
                onSelectEncounter={onSelectEncounter}
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
          ),
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
                  !firstLabel && !lastLabel && "-translate-y-1/2",
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
                  height: dayScheduleHourRowHeight,
                }}
              >
                {selectedVeterinarians.map((veterinarian) => {
                  const hourAppointments = appointments.filter(
                    (appointment) =>
                      appointment.assignedVeterinarianId === veterinarian.id &&
                      getAppointmentHour(appointment) === hour,
                  );
                  const hourWalkIns = walkInDrafts.filter(
                    (draft) =>
                      draft.encounter.primaryVeterinarianId ===
                        veterinarian.id && getDraftScheduleHour(draft) === hour,
                  );
                  const hasScheduleCards = Boolean(
                    hourAppointments.length || hourWalkIns.length,
                  );

                  return (
                    <div
                      key={`${hour}-${veterinarian.id}`}
                      className={cn(
                        "relative flex h-full min-h-0 min-w-0 gap-2 border-r last:border-r-0",
                        hasScheduleCards
                          ? "overflow-hidden pr-2"
                          : "overflow-visible",
                      )}
                    >
                      <CalendarQuarterHourLines />
                      {hasScheduleCards ? (
                        <>
                          {hourAppointments.map((appointment) => (
                            <ScheduleAppointmentCard
                              key={appointment.id}
                              appointment={appointment}
                              veterinarians={selectedVeterinarians}
                              onClearCalendarTransientSelection={
                                onClearCalendarTransientSelection
                              }
                              selected={
                                appointment.id === selectedAppointmentId
                              }
                              onSelect={() => onSelectAppointment(appointment)}
                            />
                          ))}
                          {hourWalkIns.map((draft) => (
                            <ScheduleWalkInQueueCard
                              key={draft.encounter.id}
                              draft={draft}
                              veterinarians={selectedVeterinarians}
                              onClearCalendarTransientSelection={
                                onClearCalendarTransientSelection
                              }
                              onSelectEncounter={onSelectEncounter}
                            />
                          ))}
                        </>
                      ) : (
                        <ScheduleSelectionCell
                          affordanceSuspended={emptySlotAffordanceSuspended}
                          calendarDraftSelection={calendarDraftSelection}
                          appointments={appointments}
                          draftCheckIns={draftCheckIns}
                          hour={hour}
                          operatingDate={operatingDate}
                          onAffordancePointerMove={
                            onEmptySlotAffordancePointerMove
                          }
                          testId={`day-empty-slot-${hour}-${veterinarian.id}`}
                          veterinarian={veterinarian}
                          onCreateDraft={onCreateCalendarDraft}
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
  currentOperatingMinutes,
  emptySlotAffordanceSuspended,
  appointments,
  draftCheckIns,
  operatingDate,
  onEmptySlotAffordancePointerMove,
  onClearCalendarTransientSelection,
  onCreateWalkIn,
  onSelectEncounter,
  onSelectAppointment,
  selectedAppointmentId,
  veterinarians = allVeterinarians,
}: {
  currentOperatingMinutes: number;
  emptySlotAffordanceSuspended: boolean;
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  operatingDate: string;
  onEmptySlotAffordancePointerMove: () => void;
  onClearCalendarTransientSelection: () => void;
  onCreateWalkIn: () => void;
  onSelectEncounter: (draft: ReceptionDraftCheckIn) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  selectedAppointmentId?: Appointment["id"];
  veterinarians?: Veterinarian[];
}) {
  const currentTimeOffset = getDayCurrentTimeOffset(currentOperatingMinutes);
  const activeDayIndex = weekDays.findIndex((day) => day.active);
  const dayColumnWidth = "calc((100% - 56px) / 7)";
  const weekScheduleHeight = dayScheduleHours.length * dayScheduleHourRowHeight;
  const walkInDrafts = draftCheckIns.filter(
    (draft) =>
      draft.receptionType === "walk_in" &&
      isDraftOnOperatingDate(draft, operatingDate),
  );

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
              day.active && "bg-[var(--emr-status-info-bg)]/60",
            )}
          >
            <span className="emr-text-micro text-muted-foreground">
              {day.label}
            </span>
            <span
              className={cn(
                "mt-1 flex size-7 items-center justify-center rounded-full emr-text-body font-semibold",
                day.active && "bg-primary text-primary-foreground",
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
              height: dayScheduleHourRowHeight,
            }}
          >
            <div className="relative border-r">
              <span className="absolute left-0 right-0 top-2 text-center emr-text-micro text-muted-foreground">
                {getScheduleHourLabel(hour)}
              </span>
            </div>
            {weekDays.map((day) => {
              const dayAppointments = day.active
                ? appointments
                : appointments.slice(0, 1);
              const hourAppointments = dayAppointments.filter(
                (appointment) => getAppointmentHour(appointment) === hour,
              );
              const hourWalkIns = day.active
                ? walkInDrafts.filter(
                    (draft) => getDraftScheduleHour(draft) === hour,
                  )
                : [];
              const hasScheduleCards = Boolean(
                hourAppointments.length || hourWalkIns.length,
              );

              return (
                <div
                  key={`week-${day.day}-${hour}`}
                  className={cn(
                    "relative flex h-full min-h-0 min-w-0 gap-2 overflow-hidden border-r last:border-r-0",
                    hasScheduleCards && "pr-2",
                    day.active && "bg-[var(--emr-status-info-bg)]/40",
                    !isBusinessHourRow(hour) && "bg-muted/70",
                  )}
                >
                  <CalendarQuarterHourLines />
                  {hourAppointments.map((appointment) => (
                    <ScheduleAppointmentCard
                      key={`${day.day}-${hour}-${appointment.id}`}
                      appointment={appointment}
                      veterinarians={veterinarians}
                      onClearCalendarTransientSelection={
                        onClearCalendarTransientSelection
                      }
                      selected={Boolean(
                        day.active && appointment.id === selectedAppointmentId,
                      )}
                      onSelect={() => onSelectAppointment(appointment)}
                    />
                  ))}
                  {hourWalkIns.map((draft) => (
                    <ScheduleWalkInQueueCard
                      key={`${day.day}-${hour}-${draft.encounter.id}`}
                      draft={draft}
                      veterinarians={veterinarians}
                      onClearCalendarTransientSelection={
                        onClearCalendarTransientSelection
                      }
                      onSelectEncounter={onSelectEncounter}
                    />
                  ))}
                  {hasScheduleCards ? null : (
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
              className={cn(
                "border-r last:border-r-0",
                day.active && "bg-[var(--emr-status-info-bg)]/40",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MonthScheduleBoard({
  appointmentCount,
}: {
  appointmentCount: number;
}) {
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
            day === 1 && "bg-[var(--emr-status-info-bg)]/50",
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
  calendarDraftSelection,
  currentOperatingMinutes,
  emptySlotAffordanceSuspended,
  appointments,
  draftCheckIns,
  operatingDate,
  onClearCalendarDraft,
  onClearCalendarTransientSelection,
  onEmptySlotAffordancePointerMove,
  onCreateCalendarDraft,
  onCreateWalkIn,
  onSelectEncounter,
  onSelectAppointment,
  selectedAppointmentId,
  selectedVeterinarians,
  view,
}: {
  calendarDraftSelection?: ReceptionCalendarDraftSelection;
  currentOperatingMinutes: number;
  emptySlotAffordanceSuspended: boolean;
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  operatingDate: string;
  onClearCalendarDraft: () => void;
  onClearCalendarTransientSelection: () => void;
  onEmptySlotAffordancePointerMove: () => void;
  onCreateCalendarDraft: (draft: ReceptionCalendarDraftInput) => void;
  onCreateWalkIn: () => void;
  onSelectEncounter: (draft: ReceptionDraftCheckIn) => void;
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
        onPointerDown={() => {
          if (calendarDraftSelection) onClearCalendarDraft();
        }}
      >
        <ScrollArea className="h-full">
          {view === "day" ? (
            <DayScheduleBoard
              calendarDraftSelection={calendarDraftSelection}
              currentOperatingMinutes={currentOperatingMinutes}
              emptySlotAffordanceSuspended={emptySlotAffordanceSuspended}
              appointments={appointments}
              draftCheckIns={draftCheckIns}
              operatingDate={operatingDate}
              onEmptySlotAffordancePointerMove={
                onEmptySlotAffordancePointerMove
              }
              onClearCalendarTransientSelection={
                onClearCalendarTransientSelection
              }
              onCreateCalendarDraft={onCreateCalendarDraft}
              selectedAppointmentId={selectedAppointmentId}
              selectedVeterinarians={selectedVeterinarians}
              onSelectAppointment={onSelectAppointment}
              onSelectEncounter={onSelectEncounter}
            />
          ) : null}
          {view === "week" ? (
            <WeekScheduleBoard
              currentOperatingMinutes={currentOperatingMinutes}
              emptySlotAffordanceSuspended={emptySlotAffordanceSuspended}
              appointments={appointments}
              draftCheckIns={draftCheckIns}
              operatingDate={operatingDate}
              onEmptySlotAffordancePointerMove={
                onEmptySlotAffordancePointerMove
              }
              onClearCalendarTransientSelection={
                onClearCalendarTransientSelection
              }
              selectedAppointmentId={selectedAppointmentId}
              veterinarians={selectedVeterinarians}
              onSelectAppointment={onSelectAppointment}
              onSelectEncounter={onSelectEncounter}
              onCreateWalkIn={onCreateWalkIn}
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
  const [calendarView, setCalendarView] =
    useState<ReceptionCalendarView>("day");
  const [emptySlotAffordanceSuspended, setEmptySlotAffordanceSuspended] =
    useState(false);
  const [walkInInitialPatientId, setWalkInInitialPatientId] = useState<
    string | undefined
  >();
  const [walkInDialogOpen, setWalkInDialogOpen] = useState(false);
  const [selectedVeterinarianIds, setSelectedVeterinarianIds] = useState(() =>
    allVeterinarians.map((veterinarian) => veterinarian.id),
  );
  const [workspaceVeterinarians, setWorkspaceVeterinarians] = useState<
    Veterinarian[]
  >([]);
  const selectedAppointmentId = useReceptionStore(
    (state) => state.selectedAppointmentId,
  );
  const selectedEncounterId = useReceptionStore(
    (state) => state.selectedEncounterId,
  );
  const selectedPatientId = useReceptionStore(
    (state) => state.selectedPatientId,
  );
  const calendarDraftSelection = useReceptionStore(
    (state) => state.calendarDraftSelection,
  );
  const calendarReadError = useReceptionStore(
    (state) => state.calendarReadError,
  );
  const calendarReadStatus = useReceptionStore(
    (state) => state.calendarReadStatus,
  );
  const messageDeliveries = useReceptionStore(
    (state) => state.messageDeliveries,
  );
  const applyPersistedReceptionCalendar = useReceptionStore(
    (state) => state.applyPersistedReceptionCalendar,
  );
  const applyPersistedReceptionQueue = useReceptionStore(
    (state) => state.applyPersistedReceptionQueue,
  );
  const applyWalkInCheckIn = useReceptionStore(
    (state) => state.applyWalkInCheckIn,
  );
  const applyPatientGuardianLookupItem = usePatientProfileStore(
    (state) => state.applyPatientGuardianLookupItem,
  );
  const selectAppointment = useReceptionStore(
    (state) => state.selectAppointment,
  );
  const selectEncounter = useReceptionStore((state) => state.selectEncounter);
  const selectPatient = useReceptionStore((state) => state.selectPatient);
  const setCalendarDraftSelection = useReceptionStore(
    (state) => state.setCalendarDraftSelection,
  );
  const setWorkspaceOperatingDate = useReceptionStore(
    (state) => state.setWorkspaceOperatingDate,
  );
  const setReceptionCalendarReadStatus = useReceptionStore(
    (state) => state.setReceptionCalendarReadStatus,
  );
  const setReceptionQueueReadStatus = useReceptionStore(
    (state) => state.setReceptionQueueReadStatus,
  );
  const readRetryNonce = useReceptionStore((state) => state.readRetryNonce);
  const requestReceptionReadRetry = useReceptionStore(
    (state) => state.requestReceptionReadRetry,
  );
  const persistedCalendarAppointments = useReceptionStore(
    (state) => state.persistedCalendarAppointments,
  );
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore(
    (state) => state.patientGuardians,
  );
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const authSession = useMockAuthStore((state) => state.session);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryPatientId = searchParams.get("patientId") ?? scenario?.patientId;
  const queryEncounterId =
    searchParams.get("encounterId") ?? scenario?.encounterId;
  const workspaceId =
    typeof params.workspaceId === "string"
      ? params.workspaceId
      : (params.workspaceId?.[0] ?? LEGACY_SALES_DEMO_WORKSPACE_ID);
  const defaultOperatingDate = getWorkspaceOperatingDate(workspaceId);
  const operatingDateOverride = useReceptionStore(
    (state) => state.operatingDateByWorkspace[workspaceId],
  );
  const operatingDate = operatingDateOverride ?? defaultOperatingDate;
  const currentOperatingMinutes = getWorkspaceCurrentOperatingMinutes(workspaceId);
  const liveStaffSourceEnabled = isPreparedEmptyClinicWorkspace(workspaceId);
  const veterinarians =
    liveStaffSourceEnabled && workspaceVeterinarians.length > 0
      ? workspaceVeterinarians
      : allVeterinarians;
	  const veterinarianStaffMembers = useMemo(
    () =>
      veterinarians.map((veterinarian) => ({
        displayName: veterinarian.name,
        id: veterinarian.id,
      })),
	    [veterinarians],
	  );
	  const veterinarianIds = useMemo(
	    () => veterinarians.map((veterinarian) => veterinarian.id),
	    [veterinarians],
	  );
	  const effectiveSelectedVeterinarianIds = useMemo(() => {
	    const selectedIds = selectedVeterinarianIds.filter((id) =>
	      veterinarianIds.includes(id),
	    );

	    return selectedIds.length > 0 ? selectedIds : veterinarianIds;
	  }, [selectedVeterinarianIds, veterinarianIds]);
  const workspaceDraftCheckIns = useMemo(
    () =>
      draftCheckIns.filter(
        (draft) => draft.encounter.workspaceId === workspaceId,
      ),
    [draftCheckIns, workspaceId],
  );
  const appointments = useMemo(
    () =>
      getTodayAppointments(
        workspaceDraftCheckIns,
        persistedCalendarAppointments,
        {
          operatingDate,
          workspaceId,
        },
      ),
    [
      operatingDate,
      persistedCalendarAppointments,
      workspaceDraftCheckIns,
      workspaceId,
    ],
  );
  const patientSummaries = useMemo(
    () =>
      getReceptionPatientSummaries(
        workspaceDraftCheckIns,
        {
          guardians,
          patientGuardians,
          patients,
        },
	        { operatingDate, staffMembers: veterinarianStaffMembers, workspaceId },
	      ),
    [
      guardians,
	      operatingDate,
	      patientGuardians,
	      patients,
	      veterinarianStaffMembers,
	      workspaceDraftCheckIns,
	      workspaceId,
	    ],
	  );
	  const selectedVeterinarians = useMemo(
	    () =>
		      veterinarians.filter((veterinarian) =>
		        effectiveSelectedVeterinarianIds.includes(veterinarian.id),
		      ),
		    [effectiveSelectedVeterinarianIds, veterinarians],
		  );
  const visibleAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.assignedVeterinarianId &&
	          effectiveSelectedVeterinarianIds.includes(
	            appointment.assignedVeterinarianId,
	          ),
	      ),
	    [appointments, effectiveSelectedVeterinarianIds],
	  );
  const selectedBundle = getMockPatientBundle(selectedPatientId);
  const selectedPatient = patients.find(
    (patient) => patient.id === selectedPatientId,
  );
  const activeAppointmentId =
    activeDrawer?.type === "reception-appointment"
      ? activeDrawer.id
      : (selectedAppointmentId ?? scenario?.appointmentId);
  const selectedAppointment =
    appointments.find(
      (appointment) => appointment.id === activeAppointmentId,
    ) ??
    appointments.find(
      (appointment) => appointment.patientId === selectedPatientId,
    );
  const selectedEncounter = findScenarioEncounter(
    selectedBundle?.encounters,
    queryEncounterId,
  );
  const selectedVisitReason = getReceptionVisitReason({
    appointment: selectedAppointment,
    encounter: selectedEncounter,
    patientSpecialNote: selectedPatient?.specialNote,
  });
  const lastMessageDelivery = messageDeliveries.at(-1);
	  const toggleVeterinarian = (veterinarianId: string) => {
	    setSelectedVeterinarianIds((current) => {
	      const currentInWorkspace = current.filter((id) =>
	        veterinarianIds.includes(id),
	      );
	      const baseSelection =
	        currentInWorkspace.length > 0 ? currentInWorkspace : veterinarianIds;

	      if (baseSelection.includes(veterinarianId)) {
	        return baseSelection.length > 1
	          ? baseSelection.filter((id) => id !== veterinarianId)
	          : baseSelection;
	      }

	      return [...baseSelection, veterinarianId];
	    });
	  };
  function clearCalendarTransientSelection() {
    dispatchReceptionCalendarDragClear();
    setCalendarDraftSelection(undefined);
  }
  const handleOperatingDateChange = (nextOperatingDate: string) => {
    clearCalendarTransientSelection();
    setWorkspaceOperatingDate(workspaceId, nextOperatingDate);
  };
  const handleSelectAppointment = (appointment: Appointment) => {
    clearCalendarTransientSelection();
    selectAppointment(appointment.id);
    setActiveDrawer({ type: "reception-appointment", id: appointment.id });
  };
  const handleSelectEncounterFromSchedule = (draft: ReceptionDraftCheckIn) => {
    clearCalendarTransientSelection();
    selectPatient(draft.encounter.patientId);
    selectEncounter(draft.encounter.id);
    setActiveDrawer({
      type: "reception-encounter",
      id: draft.encounter.id,
    });
  };
  const openWalkInDialog = () => {
    setActiveDrawer(null);
    setCalendarDraftSelection(undefined);
    setWalkInInitialPatientId(undefined);
    setWalkInDialogOpen(true);
  };
  const openCalendarDraftDrawer = (draft: ReceptionCalendarDraftInput) => {
    const id = `calendar-draft-${draft.plannedStartAt}-${draft.primaryVeterinarianId ?? "unassigned"}`;
    const draftPatientId =
      selectedAppointment?.patientId ??
      selectedEncounter?.patientId ??
      selectedPatientId;

    dispatchReceptionCalendarDragClear();
    setWalkInDialogOpen(false);
    setWalkInInitialPatientId(undefined);
    selectPatient(draftPatientId);
    setCalendarDraftSelection({ ...draft, id });
    setActiveDrawer({
      type: "reception-draft-task",
      id,
      subtitle: `${getShortTime(draft.plannedStartAt)} · ${draft.durationMinutes}분`,
    });
  };
  const clearCalendarDraft = () => {
    setCalendarDraftSelection(undefined);
  };

  useEffect(() => {
    if (
      calendarDraftSelection &&
      activeDrawer?.type !== "reception-draft-task"
    ) {
      setCalendarDraftSelection(undefined);
    }
  }, [activeDrawer?.type, calendarDraftSelection, setCalendarDraftSelection]);

  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      if (!liveStaffSourceEnabled) {
        setWorkspaceVeterinarians([]);
        return;
      }

      const result = await loadWorkspaceVeterinarians({
        actorId: authSession?.id,
        workspaceId,
      });
      if (cancelled) return;

      const nextVeterinarians = mapWorkspaceStaffToVeterinarians(result);
      setWorkspaceVeterinarians(nextVeterinarians);
    }

    void loadStaff();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id, liveStaffSourceEnabled, workspaceId]);

  useEffect(() => {
    if (queryPatientId && queryPatientId !== selectedPatientId) {
      selectPatient(queryPatientId);
    }
    if (
      scenario?.appointmentId &&
      scenario.appointmentId !== selectedAppointmentId
    ) {
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
  const refreshReceptionReads = useCallback(
    async ({ showLoading = false }: { showLoading?: boolean } = {}) => {
      if (showLoading) {
        setReceptionCalendarReadStatus("loading");
        setReceptionQueueReadStatus("loading");
      }

      const [calendarResult, queueResult] = await Promise.all([
        loadReceptionCalendar({
          actorId: authSession?.id,
          date: operatingDate,
          workspaceId,
        }),
        loadReceptionQueue({
          actorId: authSession?.id,
          workspaceId,
        }),
      ]);
      const readbackRecords = getReceptionReadbackRecords({
        calendarResult,
        queueResult,
      });
      const embeddedLookupItems = getEmbeddedReadbackLookupItems(readbackRecords);

      embeddedLookupItems.forEach(applyPatientGuardianLookupItem);

      const knownPatientIds = new Set([
        ...patients.map((patient) => patient.id),
        ...embeddedLookupItems.map((item) => item.patient.id),
      ]);
      const missingReadbackPatientIds = getReadbackPatientIds(
        readbackRecords,
      ).filter((patientId) => !knownPatientIds.has(patientId));

      if (liveStaffSourceEnabled && missingReadbackPatientIds.length > 0) {
        const profileResult = await loadReceptionPatientGuardianProfiles({
          actorId: authSession?.id,
          workspaceId,
        });

        if (profileResult.ok) {
          const missingPatientIds = new Set(missingReadbackPatientIds);
          profileResult.patients
            .filter((item) => missingPatientIds.has(item.patient.id))
            .forEach(applyPatientGuardianLookupItem);
        }
      }

      if (!calendarResult.ok) {
        setReceptionCalendarReadStatus(
          "error",
          getReceptionReadFailureMessage(calendarResult, workspaceId),
        );
      } else {
        applyPersistedReceptionCalendar(calendarResult.records);
      }

      if (!queueResult.ok) {
        setReceptionQueueReadStatus(
          "error",
          getReceptionReadFailureMessage(queueResult, workspaceId),
        );
      } else {
        applyPersistedReceptionQueue(queueResult.queue);
      }
    },
    [
      applyPatientGuardianLookupItem,
      applyPersistedReceptionCalendar,
      applyPersistedReceptionQueue,
      authSession?.id,
      liveStaffSourceEnabled,
      operatingDate,
      patients,
      setReceptionCalendarReadStatus,
      setReceptionQueueReadStatus,
      workspaceId,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      await refreshReceptionReads({ showLoading: true });
    }

    void refresh().then(() => {
      if (cancelled) return;
    });

    return () => {
      cancelled = true;
    };
  }, [readRetryNonce, refreshReceptionReads]);

  useEffect(() => {
    if (!liveStaffSourceEnabled) return;

    const refresh = () => {
      void refreshReceptionReads();
    };
    window.addEventListener("focus", refresh);
    const intervalId = window.setInterval(refresh, 9000);

    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(intervalId);
    };
  }, [liveStaffSourceEnabled, refreshReceptionReads]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScheduleToolbar
        onOperatingDateChange={handleOperatingDateChange}
        operatingDate={operatingDate}
        view={calendarView}
        onViewChange={setCalendarView}
        selectedVeterinarianIds={effectiveSelectedVeterinarianIds}
        todayDate={defaultOperatingDate}
        veterinarians={veterinarians}
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
          currentOperatingMinutes={currentOperatingMinutes}
          initialPatientId={walkInInitialPatientId}
          open={walkInDialogOpen}
          operatingDate={operatingDate}
          patientSummaries={patientSummaries}
          veterinarians={veterinarians}
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
            requestReceptionReadRetry();
            saveChartLiveEncounterHandoff({
              encounter: walkIn.encounter,
              patient: selectedSummary.patient,
              primaryGuardian: selectedSummary.primaryGuardian,
              veterinarianName: getStaffDisplayName(
                walkIn.encounter.primaryVeterinarianId,
                veterinarians,
              ),
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
      {(scenario || queryPatientId || queryEncounterId) && selectedPatient ? (
        <ReceptionVisitContextBanner
          appointment={selectedAppointment}
          encounter={selectedEncounter}
          guardianName={selectedBundle?.primaryGuardian?.name}
          patientName={selectedPatient.name}
          patientNo={selectedPatient.patientNo}
          reason={selectedVisitReason}
          veterinarians={veterinarians}
        />
      ) : null}
      {calendarReadStatus === "loading" ? (
        <ReceptionPanelStateMessage>
          저장된 예약을 불러오는 중
        </ReceptionPanelStateMessage>
      ) : null}
      {calendarReadStatus === "error" ? (
        <EmrInlineAlert
          className="border-x-0 border-t-0 rounded-none px-4"
          severity="warning"
          title="서버 캘린더를 불러오지 못했어"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={requestReceptionReadRetry}
            >
              캘린더 다시 시도
            </Button>
          }
          testId="reception-calendar-read-alert"
        >
          {calendarReadError ??
            (isPreparedEmptyClinicWorkspace(workspaceId)
              ? "기존 데모 예약은 표시하지 않고 준비된 빈 병원 캘린더를 유지해."
              : "현재 캘린더는 로컬 데모/세션 데이터 기준으로 유지돼.")}
        </EmrInlineAlert>
      ) : null}
      <ReceptionScheduleBoard
        calendarDraftSelection={calendarDraftSelection}
        currentOperatingMinutes={currentOperatingMinutes}
        emptySlotAffordanceSuspended={emptySlotAffordanceSuspended}
        appointments={visibleAppointments}
        draftCheckIns={workspaceDraftCheckIns}
        operatingDate={operatingDate}
        onClearCalendarDraft={clearCalendarDraft}
        onClearCalendarTransientSelection={clearCalendarTransientSelection}
        onEmptySlotAffordancePointerMove={() =>
          setEmptySlotAffordanceSuspended(false)
        }
        selectedAppointmentId={selectedAppointmentId}
        selectedVeterinarians={selectedVeterinarians}
        view={calendarView}
        onSelectAppointment={handleSelectAppointment}
        onSelectEncounter={handleSelectEncounterFromSchedule}
        onCreateCalendarDraft={openCalendarDraftDrawer}
        onCreateWalkIn={openWalkInDialog}
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
  currentOperatingMinutes,
  initialPatientId,
  onCreate,
  onOpenChange,
  open,
  operatingDate,
  patientSummaries,
  veterinarians,
  workspaceId,
}: {
  currentOperatingMinutes: number;
  initialPatientId?: string;
  onCreate: (
    input: WalkInReceptionInput,
    walkIn: ReceptionWalkInEncounterRecord,
    selectedSummary: ReceptionPatientSummary,
  ) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  operatingDate: string;
  patientSummaries: ReceptionPatientSummary[];
  veterinarians: Veterinarian[];
  workspaceId: string;
}) {
  const authSession = useMockAuthStore((state) => state.session);
  const [receptionDepartment, setReceptionDepartment] = useState(
    defaultWalkInDepartment,
  );
  const [receptionDuration, setReceptionDuration] = useState(
    defaultWalkInDuration,
  );
  const [receptionMemo, setReceptionMemo] = useState("");
  const [receptionPatientId, setReceptionPatientId] = useState(
    initialPatientId ?? "",
  );
  const [receptionVeterinarianId, setReceptionVeterinarianId] = useState(
    unassignedVeterinarianValue,
  );
  const [patientLookupOpen, setPatientLookupOpen] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<
    ReceptionPatientGuardianLookupItem[]
  >([]);
  const [selectedLookupSummary, setSelectedLookupSummary] =
    useState<ReceptionPatientSummary | null>(null);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [submitting, setSubmitting] = useState(false);
  const [customPurposeTags, setCustomPurposeTags] = useState<string[]>([]);
  const [isAddingPurposeTag, setIsAddingPurposeTag] = useState(false);
  const [newPurposeTag, setNewPurposeTag] = useState("");
  const [receptionPurposeTags, setReceptionPurposeTags] = useState<string[]>(
    [],
  );
  const [receptionVisitPurpose, setReceptionVisitPurpose] = useState("");
  const [sendKakaoMessage, setSendKakaoMessage] = useState(true);
  const receptionPlannedStartAt = getReceptionIsoAtMinutes(
    operatingDate,
    currentOperatingMinutes,
  );
  const lookupActive = lookupQuery.trim().length > 0;
  const lookupPatientSummaries = useMemo(
    () => lookupResults.map(mapLookupItemToReceptionPatientSummary),
    [lookupResults],
  );
  const selectablePatientSummaries = lookupActive
    ? lookupPatientSummaries
    : patientSummaries;
  const patientSummaryOptions = useMemo(() => {
    const summaries = [
      ...(selectedLookupSummary ? [selectedLookupSummary] : []),
      ...lookupPatientSummaries,
      ...patientSummaries,
    ];
    const uniqueSummaries = new Map<string, ReceptionPatientSummary>();

    summaries.forEach((summary) =>
      uniqueSummaries.set(summary.patient.id, summary),
    );

    return Array.from(uniqueSummaries.values());
  }, [lookupPatientSummaries, patientSummaries, selectedLookupSummary]);
  const selectedSummary = patientSummaryOptions.find(
    (summary) => summary.patient.id === receptionPatientId,
  );
  const patient = selectedSummary?.patient;
  const guardian = selectedSummary?.primaryGuardian;
  const patientOptionText = selectedSummary
    ? getReceptionPatientOptionLabel(selectedSummary)
    : "";
  const lookupMatchesSelectedPatient =
    Boolean(selectedSummary) && lookupQuery === patientOptionText;
  const shouldShowPatientLookup = patientLookupOpen && lookupActive;
  const visitPurpose = [
    receptionPurposeTags.join(", "),
    receptionVisitPurpose.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
  const canCreate = Boolean(patient && visitPurpose);
  const patientWeightKg = getRecentPatientWeightKg(patient);
  const purposeChips = [...receptionPurposeChips, ...customPurposeTags];
  const patientSearchPlaceholder = "동물명 또는 보호자명으로 검색";
  const lookupHelper = lookupMatchesSelectedPatient
    ? patientOptionText
    : lookupActive && lookupState === "loading"
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
    setSelectedLookupSummary(summary);
    setLookupQuery(getReceptionPatientOptionLabel(summary));
    setPatientLookupOpen(false);
  };
  const effectiveReceptionVeterinarianId =
    receptionVeterinarianId !== unassignedVeterinarianValue &&
    veterinarians.some((veterinarian) => veterinarian.id === receptionVeterinarianId)
      ? receptionVeterinarianId
      : unassignedVeterinarianValue;

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
          },
        );
        const result =
          (await response.json()) as ReceptionPatientGuardianLookupResponse;

        if (cancelled) return;

        if (!response.ok || !result.ok) {
          setLookupResults([]);
          setLookupState("error");
          return;
        }

        setLookupResults(result.patients);
        setLookupState("idle");
      } catch (error) {
        if (
          !cancelled &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
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
        : [...current, purpose],
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
        current.includes(purpose) ? current : [...current, purpose],
      );
    }

    setReceptionPurposeTags((current) =>
      current.includes(existingPurpose ?? purpose)
        ? current
        : [...current, existingPurpose ?? purpose],
    );
    setIsAddingPurposeTag(false);
    setNewPurposeTag("");
  };
  const create = async () => {
    const selectedVeterinarianId =
	      effectiveReceptionVeterinarianId === unassignedVeterinarianValue
	        ? undefined
	        : effectiveReceptionVeterinarianId;

    if (!patient || submitting) return;

    const input: WalkInReceptionInput = {
      department: receptionDepartment,
      durationMinutes: getDurationMinutesFromLabel(receptionDuration),
      guardianId: guardian?.id,
      guardianMobilePhone: guardian?.mobilePhone,
      memo: receptionMemo.trim() || undefined,
      patientId: patient.id,
      patientName: patient.name,
      plannedStartAt: receptionPlannedStartAt,
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
            <RegistrationDialogCloseButton
              ariaLabel="진료 접수 닫기"
              onClick={close}
            />
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
                        if (
                          selectedLookupSummary &&
                          value !==
                            getReceptionPatientOptionLabel(
                              selectedLookupSummary,
                            )
                        ) {
                          setReceptionPatientId("");
                          setSelectedLookupSummary(null);
                        }
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
                          setSelectedLookupSummary(null);
                          setPatientLookupOpen(true);
                        }}
                      >
                        <CircleCloseFillIcon
                          className="size-4"
                          aria-hidden="true"
                        />
                      </button>
                    ) : null}
                    {shouldShowPatientLookup ? (
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
                        !lookupMatchesSelectedPatient &&
                        selectablePatientSummaries.length === 0 ? (
                          <div className="px-2.5 py-2 emr-text-dense text-muted-foreground">
                            검색 결과가 없습니다.
                          </div>
                        ) : null}
                        {selectablePatientSummaries.map((summary) => {
                          const selected =
                            summary.patient.id === receptionPatientId;
                          const optionLabel =
                            getReceptionPatientOptionLabel(summary);

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
                                {summary.primaryGuardian?.mobilePhone ??
                                  "보호자 연락처 미등록"}
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
                  onChange={(event) =>
                    setReceptionVisitPurpose(event.target.value)
                  }
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
                            : "",
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
	                    value={effectiveReceptionVeterinarianId}
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
	                        {getReceptionVeterinarianSelectLabel(
	                          effectiveReceptionVeterinarianId,
	                          veterinarians,
	                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value={unassignedVeterinarianValue}>
                          수의사 미지정
                        </SelectItem>
                        {veterinarians.map((veterinarian) => (
                          <SelectItem
                            key={veterinarian.id}
                            value={veterinarian.id}
                          >
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
                      value={formatShortOperatingDate(operatingDate)}
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
                      value={getShortTime(receptionPlannedStartAt)}
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
                        {receptionDurationOptions.map((duration) => (
                          <SelectItem key={duration} value={duration}>
                            {duration}
                          </SelectItem>
                        ))}
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
              onCheckedChange={(checked) =>
                setSendKakaoMessage(Boolean(checked))
              }
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
  appointments: Appointment[],
  patients: Patient[],
  workspaceId: string,
) {
  if (activeDrawer.type === "reception-appointment") {
    const appointment = appointments.find(
      (item) => item.id === activeDrawer.id,
    );

    return appointment
      ? (patients.find((patient) => patient.id === appointment.patientId)
          ?.patientNo ??
          getMockPatientBundle(appointment.patientId)?.patient.patientNo)
      : undefined;
  }

  const encounter = getEffectiveEncounters(draftCheckIns, {
    operatingDate: getWorkspaceOperatingDate(workspaceId),
    workspaceId,
  }).find((item) => item.id === activeDrawer.id);

  return encounter
    ? (patients.find((patient) => patient.id === encounter.patientId)
        ?.patientNo ??
        getMockPatientBundle(encounter.patientId)?.patient.patientNo)
    : undefined;
}

function ReceptionDraftTaskDrawer({
  selection,
  veterinarians = allVeterinarians,
}: {
  selection: ReceptionCalendarDraftSelection;
  veterinarians?: Veterinarian[];
}) {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const applyWalkInCheckIn = useReceptionStore(
    (state) => state.applyWalkInCheckIn,
  );
  const setCalendarDraftSelection = useReceptionStore(
    (state) => state.setCalendarDraftSelection,
  );
  const requestReceptionReadRetry = useReceptionStore(
    (state) => state.requestReceptionReadRetry,
  );
  const selectedPatientId = useReceptionStore(
    (state) => state.selectedPatientId,
  );
  const authSession = useMockAuthStore((state) => state.session);
  const [department, setDepartment] = useState(defaultWalkInDepartment);
  const [duration, setDuration] = useState(`${selection.durationMinutes}분`);
  const [memo, setMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [veterinarianId, setVeterinarianId] = useState(
    selection.primaryVeterinarianId ?? unassignedVeterinarianValue,
  );
  const [visitPurpose, setVisitPurpose] = useState("현장 접수");
  const bundle = getMockPatientBundle(selectedPatientId);
  const patient = bundle?.patient;
  const guardian = bundle?.primaryGuardian;
  const startTime = getShortTime(selection.plannedStartAt);
  const workspaceId =
    typeof params.workspaceId === "string"
      ? params.workspaceId
      : (params.workspaceId?.[0] ?? LEGACY_SALES_DEMO_WORKSPACE_ID);
  const close = () => {
    if (submitting) return;
    setCalendarDraftSelection(undefined);
    setActiveDrawer(null);
  };
  const effectiveVeterinarianId =
    veterinarianId !== unassignedVeterinarianValue &&
    veterinarians.some((veterinarian) => veterinarian.id === veterinarianId)
      ? veterinarianId
      : unassignedVeterinarianValue;

  const create = async () => {
    if (!patient || submitting) return;

    const durationMinutes = getDurationMinutesFromLabel(duration);
    const input: ReceptionWalkInEncounterInput = {
      department,
      durationMinutes,
      guardianId: guardian?.id,
      memo,
      patientId: patient.id,
      plannedStartAt: selection.plannedStartAt,
      primaryVeterinarianId:
	        effectiveVeterinarianId === unassignedVeterinarianValue
	          ? undefined
	          : effectiveVeterinarianId,
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

    applyWalkInCheckIn({
      ...input,
      guardianMobilePhone: guardian?.mobilePhone,
      patientName: patient.name,
      plannedStartAt: selection.plannedStartAt,
      walkIn: result.walkIn,
    });
    requestReceptionReadRetry();
    saveChartLiveEncounterHandoff({
      encounter: result.walkIn.encounter,
      patient,
      primaryGuardian: guardian,
      veterinarianName: getStaffDisplayName(
        result.walkIn.encounter.primaryVeterinarianId,
        veterinarians,
      ),
    });
    setCalendarDraftSelection(undefined);
    setActiveDrawer(null);
  };

  if (!patient) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        환자를 선택해 주세요.
      </div>
    );
  }

  return (
    <div
      className="flex h-[calc(100%-48px)] flex-col"
      data-testid="reception-draft-task-drawer"
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <section className="rounded-lg border bg-[var(--emr-status-info-bg)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="emr-text-body font-semibold">
                  접수 task 생성
                </div>
                <div className="mt-1 emr-text-metadata text-[var(--emr-text-secondary)]">
                  {guardian?.name ?? "보호자 미지정"} 보호자 · {patient.name} ·{" "}
                  {startTime} 시작
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <ReceptionFormField label="진료과" required>
              <Select
                value={department}
                onValueChange={(value) => value && setDepartment(value)}
              >
                <SelectTrigger aria-label="진료과" className="w-full bg-card">
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
            </ReceptionFormField>
            <ReceptionFormField label="담당의">
              <Select
	                value={effectiveVeterinarianId}
                onValueChange={(value) => value && setVeterinarianId(value)}
              >
                <SelectTrigger aria-label="담당의" className="w-full bg-card">
                  <span className="flex flex-1 text-left">
	                    {getReceptionVeterinarianSelectLabel(
	                      effectiveVeterinarianId,
	                      veterinarians,
	                    )}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value={unassignedVeterinarianValue}>
                      수의사 미지정
                    </SelectItem>
                    {veterinarians.map((veterinarian) => (
                      <SelectItem key={veterinarian.id} value={veterinarian.id}>
                        {veterinarian.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </ReceptionFormField>
          </section>

          <section className="grid grid-cols-[minmax(0,1fr)_104px] gap-3">
            <ReceptionFormField label="보호자 및 동물검색" required>
              <Input
                value={`${patient.name} · ${guardian?.name ?? "보호자 미지정"} ${guardian?.mobilePhone ?? ""}`}
                readOnly
                className="h-9 bg-card"
              />
            </ReceptionFormField>
            <ReceptionFormField label="접수구분">
              <div className="flex h-9 items-center rounded-lg border border-input px-2.5 emr-text-dense">
                현장
              </div>
            </ReceptionFormField>
          </section>

          <ReceptionFormField label="방문 목적" required>
            <Input
              aria-label="방문 목적"
              value={visitPurpose}
              className="h-9 bg-card"
              onChange={(event) => setVisitPurpose(event.target.value)}
            />
          </ReceptionFormField>

          <section className="grid grid-cols-3 gap-3">
            <ReceptionFormField label="접수일">
              <Input
                aria-label="접수일"
                value={formatShortOperatingDate(
                  getOperatingDateFromIso(selection.plannedStartAt) ??
                    getWorkspaceOperatingDate(workspaceId),
                )}
                readOnly
                className="h-9 bg-card"
              />
            </ReceptionFormField>
            <ReceptionFormField label="진료시작시간">
              <Input
                aria-label="진료시작시간"
                value={startTime}
                readOnly
                className="h-9 bg-card"
              />
            </ReceptionFormField>
            <ReceptionFormField label="소요시간" required>
              <Select
                value={duration}
                onValueChange={(value) => value && setDuration(value)}
              >
                <SelectTrigger aria-label="소요시간" className="w-full bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {receptionDurationOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </ReceptionFormField>
          </section>

          <ReceptionFormField label="접수/예약 메모">
            <Textarea
              aria-label="접수/예약 메모"
              className="min-h-24 resize-none bg-card"
              placeholder="접수 메모를 입력해주세요"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
          </ReceptionFormField>
        </div>
      </ScrollArea>
      <div className="mt-auto flex shrink-0 justify-between gap-2 border-t bg-card p-4">
        <Button variant="outline" onClick={close} disabled={submitting}>
          취소
        </Button>
        <Button onClick={create} disabled={submitting}>
          {submitting ? "저장 중" : "생성"}
        </Button>
      </div>
    </div>
  );
}

export function ReceptionDrawer() {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const router = useRouter();
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const calendarDraftSelection = useReceptionStore(
    (state) => state.calendarDraftSelection,
  );
  const applyAppointmentCheckIn = useReceptionStore(
    (state) => state.applyAppointmentCheckIn,
  );
  const removeCancelledReceptionEncounter = useReceptionStore(
    (state) => state.cancelReceptionEncounter,
  );
  const createWalkInCheckIn = useReceptionStore(
    (state) => state.createWalkInCheckIn,
  );
  const requestReceptionReadRetry = useReceptionStore(
    (state) => state.requestReceptionReadRetry,
  );
  const selectedEncounterId = useReceptionStore(
    (state) => state.selectedEncounterId,
  );
  const selectedPatientId = useReceptionStore(
    (state) => state.selectedPatientId,
  );
  const patients = usePatientProfileStore((state) => state.patients);
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore(
    (state) => state.patientGuardians,
  );
  const authSession = useMockAuthStore((state) => state.session);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [workspaceVeterinarians, setWorkspaceVeterinarians] = useState<
    Veterinarian[]
  >([]);
  const workspaceId =
    typeof params.workspaceId === "string"
      ? params.workspaceId
      : (params.workspaceId?.[0] ?? LEGACY_SALES_DEMO_WORKSPACE_ID);
  const operatingDateOverride = useReceptionStore(
    (state) => state.operatingDateByWorkspace[workspaceId],
  );
  const operatingDate =
    operatingDateOverride ?? getWorkspaceOperatingDate(workspaceId);
  const liveStaffSourceEnabled = isPreparedEmptyClinicWorkspace(workspaceId);
  const veterinarians =
    liveStaffSourceEnabled && workspaceVeterinarians.length > 0
      ? workspaceVeterinarians
      : allVeterinarians;
  const appointments = useMemo(
    () =>
      getTodayAppointments(draftCheckIns, [], { operatingDate, workspaceId }),
    [draftCheckIns, operatingDate, workspaceId],
  );
  useEffect(() => {
    if (activeDrawer?.type === "reception-form") {
      setActiveDrawer(null);
      return;
    }

    if (!activeDrawer || activeDrawer.subtitle) return;
    if (
      activeDrawer.type !== "reception-encounter" &&
      activeDrawer.type !== "reception-appointment"
    )
      return;

    const subtitle = getReceptionDrawerPatientNo(
      activeDrawer,
      draftCheckIns,
      appointments,
      patients,
      workspaceId,
    );

    if (subtitle) {
      setActiveDrawer({ ...activeDrawer, subtitle });
    }
  }, [
    activeDrawer,
    appointments,
    draftCheckIns,
    patients,
    setActiveDrawer,
    workspaceId,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadStaff() {
      if (!liveStaffSourceEnabled) {
        setWorkspaceVeterinarians([]);
        return;
      }

      const result = await loadWorkspaceVeterinarians({
        actorId: authSession?.id,
        workspaceId,
      });
      if (cancelled) return;

      setWorkspaceVeterinarians(mapWorkspaceStaffToVeterinarians(result));
    }

    void loadStaff();

    return () => {
      cancelled = true;
    };
  }, [authSession?.id, liveStaffSourceEnabled, workspaceId]);

  if (activeDrawer?.type === "reception-patient") {
    return <PatientProfileDrawer patientId={activeDrawer.id} />;
  }

  if (activeDrawer?.type === "reception-guardian") {
    return <GuardianProfileDrawer guardianId={activeDrawer.id} />;
  }

  if (activeDrawer?.type === "reception-form") {
    return null;
  }

  if (activeDrawer?.type === "reception-draft-task" && calendarDraftSelection) {
    return (
      <ReceptionDraftTaskDrawer
        selection={calendarDraftSelection}
        veterinarians={veterinarians}
      />
    );
  }

  const selectedAppointment =
    activeDrawer?.type === "reception-appointment"
      ? appointments.find((appointment) => appointment.id === activeDrawer.id)
      : undefined;
  const selectedDrawerEncounter =
    activeDrawer?.type === "reception-encounter"
      ? [
          ...draftCheckIns.map((draft) => draft.encounter),
          ...(isLegacySalesDemoWorkspace(workspaceId) ? mockEncounters : []),
        ].find((encounter) => encounter.id === activeDrawer.id)
      : undefined;
  const patientId =
    selectedAppointment?.patientId ??
    selectedDrawerEncounter?.patientId ??
    (activeDrawer?.type === "reception-patient"
      ? activeDrawer.id
      : selectedPatientId);
  const mockBundle =
    getMockPatientBundle(patientId) ?? getMockPatientBundle(selectedPatientId);
  const liveHandoff = selectedDrawerEncounter
    ? readChartLiveEncounterHandoff(selectedDrawerEncounter.id)
    : null;
  const livePatient =
    liveHandoff?.patient ??
    patients.find(
      (item) => item.id === patientId && item.workspaceId === workspaceId,
    );
  const liveGuardian =
    liveHandoff?.primaryGuardian ??
    getPrimaryGuardianFromProfiles({
      guardians,
      patientGuardians,
      patientId,
      workspaceId,
    });
  const patient = livePatient ?? mockBundle?.patient;
  const guardian = liveGuardian ?? mockBundle?.primaryGuardian;
  const liveEncounters = getEffectiveEncounters(draftCheckIns, {
    operatingDate,
    workspaceId,
  }).filter((encounter) => encounter.patientId === patient?.id);
  const recentEncounters =
    livePatient || liveEncounters.length
      ? [...liveEncounters].sort((a, b) =>
          (b.checkedInAt ?? b.createdAt).localeCompare(
            a.checkedInAt ?? a.createdAt,
          ),
        )
      : mockBundle
        ? [...mockBundle.encounters].sort((a, b) =>
            (b.checkedInAt ?? b.createdAt).localeCompare(
              a.checkedInAt ?? a.createdAt,
            ),
          )
        : [];
  const selectedEncounter = selectedAppointment
    ? recentEncounters.find(
        (encounter) => encounter.appointmentId === selectedAppointment.id,
      )
    : selectedDrawerEncounter
      ? (recentEncounters.find(
          (encounter) => encounter.id === selectedDrawerEncounter.id,
        ) ?? selectedDrawerEncounter)
      : (recentEncounters.find(
          (encounter) => encounter.id === selectedEncounterId,
        ) ?? recentEncounters[0]);
  const visitReason = getReceptionVisitReason({
    appointment: selectedAppointment,
    encounter: selectedEncounter,
    patientSpecialNote: patient?.specialNote,
  });
  const visitSummary = getReceptionVisitSummary({
    appointment: selectedAppointment,
    encounter: selectedEncounter,
    veterinarians,
  });
  const veterinarianName =
    getStaffDisplayName(selectedEncounter?.primaryVeterinarianId, veterinarians) ??
    getStaffDisplayName(selectedAppointment?.assignedVeterinarianId, veterinarians) ??
    defaultVeterinarian?.name ??
    "담당의 미지정";
  const receptionDate = getShortDate(
    selectedEncounter?.checkedInAt ??
      selectedEncounter?.createdAt ??
      selectedAppointment?.scheduledStartAt,
  );
  const receptionStartAt =
    selectedEncounter?.startedAt ??
    selectedEncounter?.checkedInAt ??
    selectedEncounter?.createdAt ??
    selectedAppointment?.scheduledStartAt;
  const canCancelSelectedEncounter =
    !selectedAppointment &&
    selectedEncounter &&
    (selectedEncounter.status === "waiting" ||
      selectedEncounter.status === "in_consultation");
  const handleAppointmentCheckIn = async (
    appointment: Appointment,
    checkIn: ReceptionAppointmentCheckInRecord,
  ) => {
    applyAppointmentCheckIn({ appointment, checkIn });
    setActiveDrawer(null);
  };
  const handleCancelSelectedEncounter = async () => {
    if (!selectedEncounter || cancelSubmitting) return;

    setCancelSubmitting(true);
    const result = await submitReceptionEncounterCancel({
      actorRole: authSession?.role,
      encounterId: selectedEncounter.id,
      workspaceId,
    });
    setCancelSubmitting(false);

    if (!result.ok) {
      toast.error(getEncounterCancelRouteErrorMessage(result));
      return;
    }

    removeCancelledReceptionEncounter({
      encounterId: result.cancellation.encounter.id,
      workspaceId,
    });
    requestReceptionReadRetry();
    setCancelConfirmOpen(false);
    setActiveDrawer(null);
    toast.success("접수를 취소했습니다.");
  };

  if (!patient) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        환자를 선택해 주세요.
      </div>
    );
  }

  return (
    <>
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
                  {guardian?.name ?? "보호자 미지정"} 보호자 · {patient.name} ·{" "}
                  {visitSummary}
                </div>
                <div className="mt-2 emr-text-dense font-medium text-foreground">
                  오늘 내원: {visitReason}
                </div>
              </div>
              {selectedAppointment ? (
                <ReceptionStatusBadge
                  label={getStatusLabel(
                    "appointment",
                    selectedAppointment.status,
                  )}
                  tone={getAppointmentTone(selectedAppointment.status)}
                />
              ) : null}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <ReceptionFormField label="진료과" required>
              <Input
                value={
                  selectedEncounter?.visitPurpose ??
                  "영상의학과 · 방사선종양학과"
                }
                readOnly
                className="h-9 bg-card"
              />
            </ReceptionFormField>
            <ReceptionFormField label="담당의">
              <Input
                value={veterinarianName}
                readOnly
                className="h-9 bg-card"
              />
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
              <Input
                value="0.00 kg"
                readOnly
                className="h-9 bg-card text-right"
              />
            </ReceptionFormField>
            <ReceptionFormField label="접수구분">
              <div className="flex h-9 items-center rounded-lg border border-input px-2.5 emr-text-dense">
                재진
              </div>
            </ReceptionFormField>
          </section>

          <ReceptionFormField label="방문 목적" required>
            <Input value={visitReason} readOnly className="h-9 bg-card" />
          </ReceptionFormField>

          <section className="grid grid-cols-3 gap-3">
            <ReceptionFormField label="접수일">
              <Input value={receptionDate} readOnly className="h-9 bg-card" />
            </ReceptionFormField>
            <ReceptionFormField label="진료시작시간">
              <Input
                value={getShortTime(receptionStartAt)}
                disabled={!receptionStartAt}
                readOnly={Boolean(receptionStartAt)}
                className="h-9 bg-card disabled:bg-input/50"
              />
            </ReceptionFormField>
            <ReceptionFormField label="소요시간" required>
              <Input
                value={getReceptionDrawerDurationLabel({
                  appointment: selectedAppointment,
                  encounter: selectedEncounter,
                })}
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
                    veterinarianName,
                  });
                  setActiveDrawer(null);
                  router.push(
                    buildChartRoute({
                      encounterId: selectedEncounter.id,
                      patientId: patient.id,
                      workspaceId,
                    }),
                  );
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
                  <span>
                    {getShortDate(encounter.checkedInAt ?? encounter.createdAt)}
                  </span>
                  <span>
                    {encounter.completedAt
                      ? getShortDate(encounter.completedAt)
                      : "-"}
                  </span>
                  <span className="truncate">호흡기계</span>
                  <span className="truncate">
                    {encounter.chiefComplaint ??
                      encounter.visitPurpose ??
                      "내원"}
                  </span>
                  <span>
                    {encounter.status === "completed" ? "치료완료" : "진행중"}
                  </span>
                  <span>
                    {encounter.status === "completed" ? "확정진단" : "가진단"}
                  </span>
                  <span className="truncate">
                    {veterinarians[0]?.name ?? defaultVeterinarian?.name ?? "수의사"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
        </ScrollArea>
        <div className="mt-auto flex shrink-0 justify-end gap-2 border-t bg-card p-4">
          {canCancelSelectedEncounter ? (
            <Button
              variant="outline"
              className="border-[var(--emr-status-danger-border)] text-[var(--emr-status-danger-text)] hover:bg-[var(--emr-status-danger-bg)]"
              onClick={() => setCancelConfirmOpen(true)}
              data-testid="reception-encounter-cancel-open"
            >
              접수 취소
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => setActiveDrawer(null)}>
            닫기
          </Button>
          {selectedAppointment || !selectedEncounter ? (
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

                    void handleAppointmentCheckIn(
                      selectedAppointment,
                      result.checkIn,
                    );
                  });
                  return;
                }

                createWalkInCheckIn({
                  guardianId: guardian?.id,
                  patientId: patient.id,
                  primaryVeterinarianId: veterinarians[0]?.id ?? defaultVeterinarian?.id,
                  visitPurpose: "현장 접수",
                  workspaceId,
                });
                setActiveDrawer(null);
              }}
              disabled={Boolean(
                selectedAppointment && selectedAppointment.status !== "confirmed",
              )}
            >
              {selectedAppointment ? "접수 처리" : "생성"}
            </Button>
          ) : null}
        </div>
      </div>
      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>접수를 취소할까요?</DialogTitle>
            <DialogDescription>
              취소하면 접수 캘린더와 진료 대기열에서 이 접수가 사라집니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCancelConfirmOpen(false)}
              disabled={cancelSubmitting}
            >
              닫기
            </Button>
            <Button
              variant="outline"
              className="border-[var(--emr-status-danger-border)] text-[var(--emr-status-danger-text)] hover:bg-[var(--emr-status-danger-bg)]"
              disabled={cancelSubmitting}
              onClick={() => {
                void handleCancelSelectedEncounter();
              }}
              data-testid="reception-encounter-cancel-confirm"
            >
              {cancelSubmitting ? "취소 중" : "접수 취소"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
