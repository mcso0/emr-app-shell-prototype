"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CdsActionsListFilterIcon,
  CdsActionsPlusIcon,
  CdsActionsSearchIcon,
  CdsActionsTrash2Icon,
  CdsActionsXIcon,
} from "@/components/cds-icons/actions-and-controls";
import {
  CdsAlertsAlertCircleIcon,
  CdsAlertsEyeIcon,
} from "@/components/cds-icons/alerts-and-status";
import {
  CdsFilesCalendarIcon,
  CdsFilesClockIcon,
  CdsFilesMoreHorizontalIcon,
} from "@/components/cds-icons/files-and-layout";
import {
  CdsMedicalActivityIcon,
  CdsMedicalClipboardPenIcon,
  CdsMedicalHeartPulseIcon,
  CdsMedicalPawPrintIcon,
  CdsMedicalStethoscopeIcon,
  CdsMedicalThermometerIcon,
} from "@/components/cds-icons/medical-and-domain";
import {
  CdsNavigationChevronLeftIcon,
  CdsNavigationSidebarIcon,
} from "@/components/cds-icons/navigation";
import {
  CdsPeopleUserIcon,
  CdsPeopleUserMinusIcon,
} from "@/components/cds-icons/people-and-places";
import { CdsUtilitiesSortIcon } from "@/components/cds-icons/utilities-and-misc";
import {
  StaffOperationalProfilePanel,
  type StaffCalendarAppointmentWork,
} from "@/features/staff/staff-operational-profile-drawer";
import {
  EmrListHeader,
  EmrListHeaderIconButton,
  EmrListSearchEmptyState,
  EmrQueueLoadingState,
  EmrSubpanel,
  EmrSubpanelBody,
  EmrSubpanelTitle,
} from "@/components/emr/subpanel";
import { EmrConfirmDialogContent } from "@/components/emr/confirm-dialog-content";
import { EmrDatePickerDayButton } from "@/components/emr/date-picker-day-button";
import { EmrEmptyState } from "@/components/emr/empty-state";
import {
  EmrRightPanel,
  EmrRightPanelBody,
  EmrRightPanelFooter,
} from "@/components/emr/right-panel";
import { EmrRightPanelHeader } from "@/components/emr/right-panel-header";
import { EmrRightPanelHeaderIconButton } from "@/components/emr/right-panel-header-icon-button";
import { EmrRequiredIndicator } from "@/components/emr/required-indicator";
import { EmrSidePanelCollapsibleGroup } from "@/components/emr/side-panel-collapsible-group";
import { EmrSidePanelMiniCalendar } from "@/components/emr/side-panel-mini-calendar";
import type { EmrSidePanelStateIconState } from "@/components/emr/side-panel-state-icon";
import {
  EmrTaskQueueCard,
  type EmrTaskQueueCardItem,
} from "@/components/emr/task-queue-card";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CheckIcon,
  ExcelFileIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { FieldError } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmrInlineAlert } from "@/components/emr/inline-alert";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getAppointmentPatient,
  getAppointmentGuardian,
  getEffectiveEncounters,
  getReceptionPatientSummaries,
  getReceptionQueueRows,
  getTodayAppointments,
  type ReceptionDraftCheckIn,
  type ReceptionProfileDataset,
  type ReceptionPatientSummary,
} from "@/features/reception/data";
import {
  getCalendarTimeRangeLayout,
  type CalendarTimeRangeLayout,
} from "@/features/reception/calendar-time-layout";
import { createCalendarTimeScale, type CalendarTimeScale } from "@/features/reception/calendar-time-scale";
import {
  getOperatingTimeClassification,
  getOperatingScheduleLabel,
  getSelectableOperatingStartMinutes,
  toOperatingMinutes,
} from "@/features/reception/effective-operating-hours";
import { createInitialHospitalBasicSettingsDraft, resolveEffectiveOperatingHours, type EffectiveOperatingHours } from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import {
  getCalendarOverlapLayouts,
  type CalendarOverlapLayout,
} from "@/features/reception/calendar-overlap-layout";
import {
  GuardianProfileDrawer,
  RegistrationFormField,
  RegistrationFormSection,
  NewUnifiedRegistrationButton,
  PatientProfileDrawer,
} from "@/features/reception/profile-drawer";
import { useAuthClient } from "@/features/auth/auth-client";
import { useMockAuthStore } from "@/features/auth/session-store";
import { resolveReceptionMockAssigneeUserId } from "@/features/reception/reception-assignee";
import { usePatientProfileStore } from "@/features/reception/patient-profile-store";
import type {
  ReceptionAppointmentCheckInInput,
  ReceptionAppointmentCheckInRecord,
  ReceptionAppointmentCheckInResponse,
} from "@/features/reception/appointment-check-in";
import type {
  ReceptionAppointmentCreateInput,
  ReceptionAppointmentCreateResponse,
} from "@/features/reception/appointment-create";
import type {
  ReceptionAppointmentRestoreResponse,
} from "@/features/reception/appointment-restore";
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
import type { ReceptionSnapshotReadResponse } from "@/features/reception/reception-snapshot-read";
import type {
  ReceptionEncounterCancelResponse,
} from "@/features/reception/encounter-cancel";
import type {
  ReceptionEncounterRestoreResponse,
} from "@/features/reception/encounter-restore";
import type {
  ReceptionEncounterUpdateInput,
  ReceptionEncounterUpdateResponse,
} from "@/features/reception/encounter-update";
import type {
  ReceptionVitalMeasurementInput,
  ReceptionWalkInEncounterInput,
  ReceptionWalkInEncounterRecord,
  ReceptionWalkInEncounterResponse,
} from "@/features/reception/walk-in-encounter";
import {
  fromCanonicalVitalValue,
  getEnabledWorkspaceVitalSettings,
  toCanonicalVitalValue,
  type WorkspaceVitalKey,
  type WorkspaceVitalSettingsSnapshot,
  type WorkspaceVitalUnit,
} from "@/features/patient-vitals/workspace-vital-settings";
import { useWorkspaceVitalSettings } from "@/features/patient-vitals/use-workspace-vital-settings";
import { formatEnteredPatientVitalDisplayItemsForSettings } from "@/features/patient-vitals/patient-vital-types";
import { useReceptionEncounterVital } from "@/features/reception/use-reception-encounter-vital";
import {
  readChartLiveEncounterHandoff,
  saveChartLiveEncounterHandoff,
} from "@/features/chart/live-encounter-handoff";
import {
  useReceptionStore,
  type ReceptionCalendarDraftSelection,
  type ReceptionCalendarView,
} from "@/features/reception/store";
import {
  emptyReceptionStaffMembers,
  emptyReceptionStaffVeterinarians,
  getReceptionStaffResourceKey,
  useReceptionStaffResourceStore,
  type ReceptionStaffOperationalStatus,
  type ReceptionStaffMember,
  type ReceptionStaffReadStatus,
  type ReceptionStaffVeterinarian,
} from "@/features/reception/staff-resource-store";
import {
  ReceptionEmptyState,
} from "@/features/reception/reception-list-search";
import { getDemoScenarioFromParams } from "@/lib/emr-domain/demo-scenarios";
import {
  formatOperatingMonthLabel,
  formatOperatingShortTime,
  formatShortOperatingDate,
  getOperatingDateFromIso,
  getOperatingIsoAtMinutes,
  getOperatingMinutesFromIso,
  getWorkspaceOperatingDate,
  getWorkspaceOperatingNow,
  isIsoOperatingDate,
} from "@/lib/emr-domain/demo-date";
import {
  isLegacySalesDemoWorkspace,
  isPreparedEmptyClinicWorkspace,
  resolveWorkspaceRouteParam,
} from "@/lib/emr-domain/demo-workspaces";
import { getStatusLabel } from "@/lib/emr-domain/status-labels";
import { shouldUseSupabaseAuth } from "@/lib/supabase/config";
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
import type { DrawerState, ShellComponentProps } from "@/types/emr";

const allVeterinarians = mockStaffUsers.filter(
  (user) => user.role === "veterinarian",
).map((user) => ({
  avatarUrl: user.avatarUrl ?? undefined,
  id: user.id,
  initial: user.initial,
  name: user.name,
  role: "veterinarian" as const,
}));
const allReceptionStaff: ReceptionStaffMember[] = mockStaffUsers
  .map((user) => ({
    avatarUrl: user.avatarUrl ?? undefined,
    department: user.department,
    id: user.id,
    initial: user.initial,
    name: user.name,
    roles: getMockReceptionStaffRoles(user.role),
    title: getMockReceptionStaffTitle(user.role),
  }))
  .filter((staff) => staff.roles.length > 0);
const defaultVeterinarian = allVeterinarians[0];
type ReceptionDrawerPresentation = "drawer" | "side-panel";

const receptionPatientLookupDecorationClassName =
  "absolute right-[var(--clair-spacing-8)] top-1/2 flex size-[var(--clair-spacing-24)] -translate-y-1/2 items-center justify-center p-0.5";

function ReceptionPatientLookupDecoration({
  hasQuery,
  onClear,
}: {
  hasQuery: boolean;
  onClear: () => void;
}) {
  if (hasQuery) {
    return (
      <button
        type="button"
        className={`${receptionPatientLookupDecorationClassName} rounded-full text-muted-foreground outline-none transition-colors hover:text-[var(--emr-text-secondary)] focus-visible:ring-3 focus-visible:ring-ring/50`}
        aria-label="환자 선택 초기화"
        data-state="clear"
        data-testid="reception-patient-lookup-decoration"
        onClick={onClear}
      >
        <CdsActionsXIcon className="size-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <span
      className={`${receptionPatientLookupDecorationClassName} pointer-events-none text-[var(--clair-color-atomic-neutral-500)]`}
      aria-hidden="true"
      data-state="search"
      data-testid="reception-patient-lookup-decoration"
    >
      <CdsActionsSearchIcon className="size-4" aria-hidden="true" />
    </span>
  );
}

const receptionRightPanelDrawerTypes = new Set([
  "reception-appointment",
  "reception-appointment-check-in-form",
  "reception-encounter",
  "reception-form",
  "reception-reservation-form",
]);

const isReceptionRightPanelDrawer = (
  drawer: DrawerState,
): drawer is NonNullable<DrawerState> =>
  Boolean(drawer && receptionRightPanelDrawerTypes.has(drawer.type));

const getReceptionDrawerSurfaceClassName = (
  presentation: ReceptionDrawerPresentation,
) =>
  cn(
    "flex flex-col",
    presentation === "side-panel" ? "h-full" : "h-[calc(100%-48px)]",
  );

type ReceptionSidePanelVitalId =
  | "weight"
  | "temperature"
  | "respiration"
  | "heartRate"
  | "bloodPressure";

const receptionSidePanelVitalOptions: Array<{
  defaultValue: string;
  icon: ReactNode;
  id: ReceptionSidePanelVitalId;
  label: string;
  unit: string;
}> = [
  {
    defaultValue: "",
    icon: <CdsMedicalActivityIcon className="size-3.5" />,
    id: "weight",
    label: "체중",
    unit: "Kg",
  },
  {
    defaultValue: "38.5",
    icon: <CdsMedicalThermometerIcon className="size-3.5" />,
    id: "temperature",
    label: "체온",
    unit: "°C",
  },
  {
    defaultValue: "20",
    icon: <CdsMedicalActivityIcon className="size-3.5" />,
    id: "respiration",
    label: "호흡수",
    unit: "rpm",
  },
  {
    defaultValue: "88",
    icon: <CdsMedicalHeartPulseIcon className="size-3.5" />,
    id: "heartRate",
    label: "심박수",
    unit: "bpm",
  },
  {
    defaultValue: "",
    icon: <CdsMedicalHeartPulseIcon className="size-3.5" />,
    id: "bloodPressure",
    label: "혈압",
    unit: "mmHg",
  },
];
const veterinarianHeaderToneClasses = [
  "[--emr-calendar-lane-header-tone-border:var(--clair-color-atomic-blue-200)] [--emr-calendar-lane-header-tone:var(--clair-color-atomic-blue-500)]",
  "[--emr-calendar-lane-header-tone-border:var(--clair-color-atomic-forest-green-200)] [--emr-calendar-lane-header-tone:var(--clair-color-atomic-forest-green-500)]",
  "[--emr-calendar-lane-header-tone-border:var(--clair-color-atomic-sky-200)] [--emr-calendar-lane-header-tone:var(--clair-color-atomic-sky-500)]",
  "[--emr-calendar-lane-header-tone-border:var(--clair-color-atomic-orange-200)] [--emr-calendar-lane-header-tone:var(--clair-color-atomic-orange-500)]",
  "[--emr-calendar-lane-header-tone-border:var(--clair-color-atomic-green-200)] [--emr-calendar-lane-header-tone:var(--clair-color-atomic-green-500)]",
  "[--emr-calendar-lane-header-tone-border:var(--clair-color-atomic-red-200)] [--emr-calendar-lane-header-tone:var(--clair-color-atomic-red-500)]",
  "[--emr-calendar-lane-header-tone-border:var(--clair-color-atomic-teal-200)] [--emr-calendar-lane-header-tone:var(--clair-color-atomic-teal-500)]",
  "[--emr-calendar-lane-header-tone-border:var(--clair-color-atomic-neutral-200)] [--emr-calendar-lane-header-tone:var(--clair-color-atomic-neutral-500)]",
  "[--emr-calendar-lane-header-tone-border:var(--clair-color-atomic-purple-200)] [--emr-calendar-lane-header-tone:var(--clair-color-atomic-purple-500)]",
  "[--emr-calendar-lane-header-tone-border:var(--clair-color-atomic-red-200)] [--emr-calendar-lane-header-tone:var(--clair-color-atomic-red-500)]",
];
const veterinarianMenuItemToneClasses = [
  "border-[var(--clair-color-atomic-blue-500)] bg-[var(--clair-color-atomic-blue-500)]",
  "border-[var(--clair-color-atomic-forest-green-500)] bg-[var(--clair-color-atomic-forest-green-500)]",
  "border-[var(--clair-color-atomic-sky-500)] bg-[var(--clair-color-atomic-sky-500)]",
  "border-[var(--clair-color-atomic-orange-500)] bg-[var(--clair-color-atomic-orange-500)]",
  "border-[var(--clair-color-atomic-green-500)] bg-[var(--clair-color-atomic-green-500)]",
  "border-[var(--clair-color-atomic-red-500)] bg-[var(--clair-color-atomic-red-500)]",
  "border-[var(--clair-color-atomic-teal-500)] bg-[var(--clair-color-atomic-teal-500)]",
  "border-[var(--clair-color-atomic-neutral-500)] bg-[var(--clair-color-atomic-neutral-500)]",
  "border-[var(--clair-color-atomic-purple-500)] bg-[var(--clair-color-atomic-purple-500)]",
  "border-[var(--clair-color-atomic-red-500)] bg-[var(--clair-color-atomic-red-500)]",
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
const veterinarianCalendarCardNeutralToneClass =
  "border-[var(--clair-color-atomic-neutral-300)] bg-[var(--clair-color-atomic-neutral-50)] text-[var(--clair-color-atomic-neutral-700)] hover:bg-[var(--clair-color-atomic-neutral-100)]";
const veterinarianCalendarCardToneClasses = [
  "border-[var(--clair-color-atomic-blue-300)] bg-[var(--clair-color-atomic-blue-50)] text-[var(--clair-color-atomic-blue-800)] hover:bg-[var(--clair-color-atomic-blue-100)]",
  "border-[var(--clair-color-atomic-forest-green-300)] bg-[var(--clair-color-atomic-forest-green-50)] text-[var(--clair-color-atomic-forest-green-800)] hover:bg-[var(--clair-color-atomic-forest-green-100)]",
  "border-[var(--clair-color-atomic-sky-300)] bg-[var(--clair-color-atomic-sky-50)] text-[var(--clair-color-atomic-sky-800)] hover:bg-[var(--clair-color-atomic-sky-100)]",
  "border-[var(--clair-color-atomic-orange-300)] bg-[var(--clair-color-atomic-orange-50)] text-[var(--clair-color-atomic-orange-800)] hover:bg-[var(--clair-color-atomic-orange-100)]",
  "border-[var(--clair-color-atomic-green-300)] bg-[var(--clair-color-atomic-green-50)] text-[var(--clair-color-atomic-green-800)] hover:bg-[var(--clair-color-atomic-green-100)]",
  "border-[var(--clair-color-atomic-red-300)] bg-[var(--clair-color-atomic-red-50)] text-[var(--clair-color-atomic-red-800)] hover:bg-[var(--clair-color-atomic-red-100)]",
  "border-[var(--clair-color-atomic-teal-300)] bg-[var(--clair-color-atomic-teal-50)] text-[var(--clair-color-atomic-teal-800)] hover:bg-[var(--clair-color-atomic-teal-100)]",
  veterinarianCalendarCardNeutralToneClass,
  "border-[var(--clair-color-atomic-purple-300)] bg-[var(--clair-color-atomic-purple-50)] text-[var(--clair-color-atomic-purple-800)] hover:bg-[var(--clair-color-atomic-purple-100)]",
  "border-[var(--clair-color-atomic-red-300)] bg-[var(--clair-color-atomic-red-50)] text-[var(--clair-color-atomic-red-800)] hover:bg-[var(--clair-color-atomic-red-100)]",
];
const veterinarianCalendarBadgeNeutralToneClass =
  "border-[var(--clair-color-atomic-neutral-300)] bg-[var(--clair-color-atomic-neutral-100)] text-[var(--clair-color-atomic-neutral-700)]";
const veterinarianCalendarBadgeToneClasses = [
  "border-[var(--clair-color-atomic-blue-300)] bg-[var(--clair-color-atomic-blue-100)] text-[var(--clair-color-atomic-blue-800)]",
  "border-[var(--clair-color-atomic-forest-green-300)] bg-[var(--clair-color-atomic-forest-green-100)] text-[var(--clair-color-atomic-forest-green-800)]",
  "border-[var(--clair-color-atomic-sky-300)] bg-[var(--clair-color-atomic-sky-100)] text-[var(--clair-color-atomic-sky-800)]",
  "border-[var(--clair-color-atomic-orange-300)] bg-[var(--clair-color-atomic-orange-100)] text-[var(--clair-color-atomic-orange-800)]",
  "border-[var(--clair-color-atomic-green-300)] bg-[var(--clair-color-atomic-green-100)] text-[var(--clair-color-atomic-green-800)]",
  "border-[var(--clair-color-atomic-red-300)] bg-[var(--clair-color-atomic-red-100)] text-[var(--clair-color-atomic-red-800)]",
  "border-[var(--clair-color-atomic-teal-300)] bg-[var(--clair-color-atomic-teal-100)] text-[var(--clair-color-atomic-teal-800)]",
  veterinarianCalendarBadgeNeutralToneClass,
  "border-[var(--clair-color-atomic-purple-300)] bg-[var(--clair-color-atomic-purple-100)] text-[var(--clair-color-atomic-purple-800)]",
  "border-[var(--clair-color-atomic-red-300)] bg-[var(--clair-color-atomic-red-100)] text-[var(--clair-color-atomic-red-800)]",
];
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
const dayScheduleStartHour = 0;
const dayScheduleEndHour = 24;
const dayBusinessOpenHour = 9;
const dayBusinessCloseHour = 19;
const dayScheduleHourRowHeight = 144;
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

type ReceptionSideListMode = (typeof receptionQueueTabItems)[number]["value"];
type CalendarTaskBadgeType = "예약" | "외래" | "노쇼";
type VeterinarianOperationalStatus = ReceptionStaffOperationalStatus;
const veterinarianOperationalStatusToneClasses: Record<
  VeterinarianOperationalStatus["code"],
  string
> = {
  available:
    "[--emr-calendar-lane-status-text:var(--emr-calendar-lane-status-text-available)]",
  clocked_out:
    "min-w-[var(--emr-calendar-lane-status-clocked-out-width)] [--emr-calendar-lane-status-text:var(--emr-calendar-lane-status-text-clocked-out)]",
  in_consultation:
    "[--emr-calendar-lane-status-text:var(--emr-calendar-lane-status-text-available)]",
  leave:
    "[--emr-calendar-lane-status-text:var(--emr-calendar-lane-status-text-leave)]",
  off: "[--emr-calendar-lane-status-text:var(--emr-calendar-lane-status-text-waiting)]",
  scheduled:
    "[--emr-calendar-lane-status-text:var(--emr-calendar-lane-status-text-waiting)]",
  shift_ended:
    "[--emr-calendar-lane-status-text:var(--emr-calendar-lane-status-text-clocked-out)]",
};
type Veterinarian = ReceptionStaffVeterinarian;
type WorkspaceStaffReadStatus = ReceptionStaffReadStatus;
type CalendarResourceState = "loading" | "ready" | "empty" | "error";
type WorkspaceStaffReadResponse =
  | {
      ok: true;
      status: 200;
      actorUserId: string;
      staff: Array<{
        department?: string;
        displayName: string;
        id: string;
        initial?: string;
        avatarUrl?: string;
        operationalStatus?: VeterinarianOperationalStatus;
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
type ReceptionCreateVitalId =
  | "weight"
  | "temperature"
  | "heartRate"
  | "respiration"
  | "bloodPressure";

type ReceptionCreateVitalValues = {
  weightKg: string;
  temperatureC: string;
  heartRateBpm: string;
  respiratoryRateRpm: string;
  bloodPressureSystolicMmhg: string;
  bloodPressureDiastolicMmhg: string;
};

type ReceptionCreateVitalDraft = {
  selectedIds: ReceptionCreateVitalId[];
  serverErrors: ReceptionCreateVitalFieldErrors;
  shownErrors: Partial<Record<keyof ReceptionCreateVitalValues, boolean>>;
  shownWarnings: Partial<Record<keyof ReceptionCreateVitalValues, boolean>>;
  values: ReceptionCreateVitalValues;
};

type ReceptionCreateVitalFieldErrors = Partial<
  Record<keyof ReceptionCreateVitalDraft["values"], string>
>;

type ReceptionCreateVitalFieldWarnings = ReceptionCreateVitalFieldErrors;

type WalkInReceptionInput = Omit<ReceptionWalkInEncounterInput, "vitals"> & {
  guardianMobilePhone?: string;
  patientName?: string;
  sendKakaoMessage?: boolean;
  vitals?: ReceptionVitalMeasurementInput;
};
const unassignedVeterinarianValue = "unassigned";
const demoSessionUserIdHeaderName = "x-clair-demo-session-user-id";

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

function getMockReceptionStaffRoles(
  role: (typeof mockStaffUsers)[number]["role"],
): string[] {
  if (role === "veterinarian") return ["vet"];
  if (role === "technician") return ["technician"];
  if (role === "desk") return ["front_desk"];
  if (role === "billing") return ["billing_admin"];
  if (role === "admin") return ["hospital_admin"];
  return [];
}

function getMockReceptionStaffTitle(
  role: (typeof mockStaffUsers)[number]["role"],
): string | undefined {
  if (role === "veterinarian") return "수의사";
  if (role === "technician") return "테크니션";
  if (role === "desk") return "데스크";
  if (role === "billing") return "수납";
  if (role === "admin") return "관리자";
  return undefined;
}

function getVeterinarianFilterLabel(selectedVeterinarians: Veterinarian[]) {
  const [firstVeterinarian] = selectedVeterinarians;

  if (!firstVeterinarian) {
    return "선택된 수의사 없음";
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
  if (!veterinarianId) return "bg-[var(--clair-color-atomic-neutral-300)]";

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

function getVeterinarianCalendarCardToneClassName(
  veterinarianId?: string,
  veterinarians: Veterinarian[] = allVeterinarians,
) {
  if (!veterinarianId) return veterinarianCalendarCardNeutralToneClass;

  const veterinarian = veterinarians.find(
    (item) => item.id === veterinarianId,
  );
  if (!veterinarian) return veterinarianCalendarCardNeutralToneClass;

  const toneIndex = getVeterinarianToneIndex(veterinarian, veterinarians);

  return veterinarianCalendarCardToneClasses[
    toneIndex % veterinarianCalendarCardToneClasses.length
  ];
}

function getVeterinarianCalendarBadgeToneClassName(
  veterinarianId?: string,
  veterinarians: Veterinarian[] = allVeterinarians,
) {
  if (!veterinarianId) return veterinarianCalendarBadgeNeutralToneClass;

  const veterinarian = veterinarians.find(
    (item) => item.id === veterinarianId,
  );
  if (!veterinarian) return veterinarianCalendarBadgeNeutralToneClass;

  const toneIndex = getVeterinarianToneIndex(veterinarian, veterinarians);

  return veterinarianCalendarBadgeToneClasses[
    toneIndex % veterinarianCalendarBadgeToneClasses.length
  ];
}

function VeterinarianLaneHeader({
  onHide,
  onOpenProfile,
  selectedLaneCount,
  toneIndex,
  veterinarian,
}: {
  onHide: () => void;
  onOpenProfile: (opener: HTMLButtonElement | null) => void;
  selectedLaneCount: number;
  toneIndex: number;
  veterinarian: Veterinarian;
}) {
  const actionButtonRef = useRef<HTMLButtonElement | null>(null);
  const hideDisabled = selectedLaneCount <= 1;
  const hideDescriptionId = `last-veterinarian-lane-description-${veterinarian.id}`;

  return (
    <div
      data-testid="veterinarian-lane-header"
      tabIndex={0}
      aria-label={`${veterinarian.name} 레인 헤더`}
      className={cn(
        "emr-calendar-lane-header group/veterinarian-lane flex h-[var(--emr-calendar-lane-header-height)] min-w-0 items-center gap-[var(--emr-calendar-lane-header-gap)] rounded-[var(--emr-calendar-lane-header-radius)] border border-[var(--emr-calendar-lane-header-tone-border)] py-[var(--emr-calendar-lane-header-padding-y)] pl-[var(--emr-calendar-lane-header-padding-left)] pr-[var(--emr-calendar-lane-header-padding-right)] text-[var(--emr-calendar-lane-header-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        veterinarianHeaderToneClasses[
          toneIndex % veterinarianHeaderToneClasses.length
        ],
      )}
    >
      <Avatar
        data-testid="veterinarian-lane-avatar"
        roundness="roundrect"
        size="sm"
        className="after:border-[var(--emr-calendar-lane-avatar-border)]"
      >
        {veterinarian.avatarUrl ? (
          <AvatarImage src={veterinarian.avatarUrl} alt="" />
        ) : null}
        <AvatarFallback className="bg-[var(--emr-surface-panel)] font-medium text-[var(--clair-color-atomic-gray-500)]">
          {veterinarian.initial}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 items-center gap-[var(--emr-calendar-lane-header-name-status-gap)]">
        <span
          data-testid="veterinarian-lane-name"
          className="min-w-0 truncate text-[length:var(--emr-calendar-lane-header-name-size)] font-[var(--emr-calendar-lane-header-name-weight)] leading-[var(--emr-calendar-lane-header-name-leading)] tracking-[var(--emr-calendar-lane-header-name-tracking)]"
        >
          {veterinarian.name}
        </span>
        {veterinarian.operationalStatus ? (
          <span
            data-testid="veterinarian-operational-status"
            data-status={veterinarian.operationalStatus.code}
            className={cn(
              "inline-flex h-[var(--emr-calendar-lane-status-height)] min-w-[var(--emr-calendar-lane-status-min-width)] shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--emr-calendar-lane-status-radius)] bg-[var(--emr-calendar-lane-status-bg)] px-[var(--emr-calendar-lane-status-padding-x)] py-[var(--emr-calendar-lane-status-padding-y)] text-center text-[length:var(--emr-calendar-lane-status-size)] font-[var(--emr-calendar-lane-status-weight)] leading-[var(--emr-calendar-lane-status-leading)] tracking-[var(--emr-calendar-lane-status-tracking)] text-[var(--emr-calendar-lane-status-text)] shadow-[0_0_0_1px_var(--emr-calendar-lane-status-border)]",
              veterinarianOperationalStatusToneClasses[
                veterinarian.operationalStatus.code
              ],
            )}
          >
            {veterinarian.operationalStatus.label}
          </span>
        ) : null}
      </div>
      <div
        className="pointer-events-auto ml-auto flex shrink-0 items-center gap-[var(--emr-calendar-lane-header-action-gap)] opacity-0 transition-opacity group-hover/veterinarian-lane:opacity-100 group-focus/veterinarian-lane:opacity-100 group-focus-within/veterinarian-lane:opacity-100 max-md:opacity-100 [@media(hover:none)]:opacity-100 [@media(pointer:coarse)]:opacity-100"
        data-testid="veterinarian-lane-header-actions"
      >
        <button
          type="button"
          aria-label={`${veterinarian.name} 레인 숨기기`}
          aria-describedby={hideDisabled ? hideDescriptionId : undefined}
          className="grid size-[var(--emr-calendar-lane-header-action-size)] place-items-center rounded-[var(--emr-calendar-lane-header-action-radius)] bg-transparent p-1 text-[var(--emr-calendar-lane-header-action-icon)] outline-none transition-colors hover:bg-[var(--emr-calendar-lane-header-action-hover)] focus-visible:bg-[var(--emr-calendar-lane-header-action-hover)] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40"
          disabled={hideDisabled}
          onClick={onHide}
        >
          <CdsAlertsEyeIcon aria-hidden="true" size={14} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            ref={actionButtonRef}
            aria-label={`${veterinarian.name} 수의사 옵션`}
            className="grid size-[var(--emr-calendar-lane-header-action-size)] place-items-center rounded-[var(--emr-calendar-lane-header-action-radius)] bg-transparent p-1 text-[var(--emr-calendar-lane-header-action-icon)] outline-none transition-colors hover:bg-[var(--emr-calendar-lane-header-action-hover)] focus-visible:bg-[var(--emr-calendar-lane-header-action-hover)] focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:bg-[var(--emr-calendar-lane-header-action-hover)]"
          >
            <CdsFilesMoreHorizontalIcon aria-hidden="true" size={14} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              aria-describedby={hideDisabled ? hideDescriptionId : undefined}
              disabled={hideDisabled}
              onClick={onHide}
            >
              캘린더에서 숨기기
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onOpenProfile(actionButtonRef.current)}
            >
              운영 프로필 보기
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {hideDisabled ? (
          <span className="sr-only" id={hideDescriptionId}>
            최소 1명의 수의사를 표시해야 해요
          </span>
        ) : null}
      </div>
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
          "flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-[var(--clair-color-atomic-black-alpha-6)] text-[8px] font-normal leading-3 tracking-[0.304px] text-primary-foreground",
          veterinarianMenuItemToneClasses[
            toneIndex % veterinarianMenuItemToneClasses.length
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

type ReceptionPatientLookupState = "idle" | "loading" | "error";

const receptionPatientLookupDebounceMs = 275;

function useReceptionPatientLookup({
  authSessionId,
  patientSummaries,
  workspaceId,
}: {
  authSessionId?: string;
  patientSummaries: ReceptionPatientSummary[];
  workspaceId: string;
}) {
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState<
    ReceptionPatientGuardianLookupItem[]
  >([]);
  const [lookupState, setLookupState] =
    useState<ReceptionPatientLookupState>("idle");
  const [patientId, setPatientId] = useState("");
  const [selectedLookupSummary, setSelectedLookupSummary] =
    useState<ReceptionPatientSummary>();
  const lookupRequestSeqRef = useRef(0);
  const lastSuccessfulLookupKeyRef = useRef("");
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
    (summary) => summary.patient.id === patientId,
  );
  const selectedPatientLabel = selectedSummary
    ? getReceptionPatientOptionLabel(selectedSummary)
    : "";

  useEffect(() => {
    const query = lookupQuery.trim();
    if (!query) {
      lastSuccessfulLookupKeyRef.current = "";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLookupResults([]);
      setLookupState("idle");
      return;
    }

    if (selectedSummary && query === selectedPatientLabel.trim()) {
      return;
    }

    const lookupKey = `${workspaceId}\u0000${authSessionId ?? ""}\u0000${query}`;
    if (lookupKey === lastSuccessfulLookupKeyRef.current) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const requestSeq = lookupRequestSeqRef.current + 1;
    lookupRequestSeqRef.current = requestSeq;

    async function loadLookup() {
      if (cancelled || requestSeq !== lookupRequestSeqRef.current) return;
      setLookupState("loading");

      try {
        const headers = authSessionId
          ? { "x-clair-demo-session-user-id": authSessionId }
          : undefined;
        const response = await fetch(
          `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/patient-guardian-lookup?query=${encodeURIComponent(query)}`,
          {
            cache: "no-store",
            headers,
            signal: controller.signal,
          },
        );
        const result =
          (await response.json()) as ReceptionPatientGuardianLookupResponse;

        if (cancelled || requestSeq !== lookupRequestSeqRef.current) return;

        if (!response.ok || !result.ok) {
          setLookupResults([]);
          setLookupState("error");
          return;
        }

        setLookupResults(result.patients);
        setLookupState("idle");
        lastSuccessfulLookupKeyRef.current = lookupKey;
      } catch (error) {
        if (
          !cancelled &&
          requestSeq === lookupRequestSeqRef.current &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setLookupResults([]);
          setLookupState("error");
        }
      }
    }

    const debounceTimer = window.setTimeout(() => {
      void loadLookup();
    }, receptionPatientLookupDebounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [
    authSessionId,
    lookupQuery,
    selectedPatientLabel,
    selectedSummary,
    workspaceId,
  ]);

  const updateLookupQuery = useCallback(
    (value: string) => {
      setLookupQuery(value);
      if (selectedSummary && value !== selectedPatientLabel) {
        setPatientId("");
      }
    },
    [selectedPatientLabel, selectedSummary],
  );

  const selectPatientSummary = useCallback((summary: ReceptionPatientSummary) => {
    setPatientId(summary.patient.id);
    setSelectedLookupSummary(summary);
    setLookupQuery(getReceptionPatientOptionLabel(summary));
  }, []);

  const clearPatientSelection = useCallback(() => {
    setPatientId("");
    setLookupQuery("");
    setLookupResults([]);
    setLookupState("idle");
    setSelectedLookupSummary(undefined);
  }, []);

  return {
    clearPatientSelection,
    lookupActive,
    lookupQuery,
    lookupState,
    patientId,
    selectPatientSummary,
    selectablePatientSummaries,
    selectedSummary,
    updateLookupQuery,
  };
}

function ReceptionPatientLookupStateMessage({
  lookupActive,
  lookupState,
  resultCount,
}: {
  lookupActive: boolean;
  lookupState: ReceptionPatientLookupState;
  resultCount: number;
}) {
  if (!lookupActive) return null;

  const message =
    lookupState === "loading"
      ? "DB 환자 검색 중입니다."
      : lookupState === "error"
        ? "환자 검색을 불러오지 못했습니다."
        : resultCount === 0
          ? "검색 결과가 없습니다."
          : undefined;

  if (!message) return null;

  return (
    <div className="px-3 py-2 text-sm text-[var(--emr-text-secondary)]">
      {message}
    </div>
  );
}

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
        .map((record) => {
          if (record.patient?.id) return record.patient.id;
          if ("encounter" in record && record.encounter) {
            return record.encounter.patientId;
          }
          if ("appointment" in record && record.appointment) {
            return record.appointment.patientId;
          }

          return undefined;
        })
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

async function submitAppointmentCreate({
  actorRole,
  input,
  workspaceId,
}: {
  actorRole?: string;
  input: ReceptionAppointmentCreateInput;
  workspaceId: string;
}): Promise<ReceptionAppointmentCreateResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/appointments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(!isPreparedEmptyClinicWorkspace(workspaceId)
            ? { [demoSessionUserIdHeaderName]: getReceptionDemoActorId(actorRole) }
            : {}),
        },
        body: JSON.stringify(input),
      },
    );
    const body = (await response.json()) as ReceptionAppointmentCreateResponse;

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
  input,
  workspaceId,
}: {
  actorRole?: string;
  appointmentId: string;
  input?: ReceptionAppointmentCheckInInput;
  workspaceId: string;
}): Promise<ReceptionAppointmentCheckInResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/appointments/${encodeURIComponent(appointmentId)}/check-in`,
      {
        method: "POST",
        headers: {
          ...(input ? { "Content-Type": "application/json" } : {}),
          "x-clair-demo-session-user-id": getReceptionDemoActorId(actorRole),
        },
        body: input ? JSON.stringify(input) : undefined,
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
          "Content-Type": "application/json",
          "x-clair-demo-session-user-id": getReceptionDemoActorId(actorRole),
        },
        body: JSON.stringify({ cancelReason: "접수 화면에서 취소" }),
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

async function submitReceptionEncounterRestore({
  actorRole,
  encounterId,
  workspaceId,
}: {
  actorRole?: string;
  encounterId: string;
  workspaceId: string;
}): Promise<ReceptionEncounterRestoreResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/encounters/${encodeURIComponent(encounterId)}/restore`,
      {
        method: "POST",
        headers: {
          "x-clair-demo-session-user-id": getReceptionDemoActorId(actorRole),
        },
      },
    );
    const body = (await response.json()) as ReceptionEncounterRestoreResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function submitReceptionAppointmentRestore({
  actorRole,
  appointmentId,
  workspaceId,
}: {
  actorRole?: string;
  appointmentId: string;
  workspaceId: string;
}): Promise<ReceptionAppointmentRestoreResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/appointments/${encodeURIComponent(appointmentId)}/restore`,
      {
        method: "POST",
        headers: {
          "x-clair-demo-session-user-id": getReceptionDemoActorId(actorRole),
        },
      },
    );
    const body = (await response.json()) as ReceptionAppointmentRestoreResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) return { ...body, status: response.status };
      return { ok: false, status: response.status, error: "db_write_failed" };
    }

    return body;
  } catch {
    return { ok: false, status: 500, error: "db_write_failed" };
  }
}

async function submitReceptionEncounterUpdate({
  actorRole,
  encounterId,
  input,
  workspaceId,
}: {
  actorRole?: string;
  encounterId: string;
  input: ReceptionEncounterUpdateInput;
  workspaceId: string;
}): Promise<ReceptionEncounterUpdateResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/encounters/${encodeURIComponent(encounterId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-clair-demo-session-user-id": getReceptionDemoActorId(actorRole),
        },
        body: JSON.stringify(input),
      },
    );
    const body = (await response.json()) as ReceptionEncounterUpdateResponse;

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
  date,
  workspaceId,
}: {
  actorId?: string;
  date: string;
  workspaceId: string;
}): Promise<ReceptionQueueReadResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/queue?date=${encodeURIComponent(date)}`,
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

type ReceptionRefreshResult = {
  ok: boolean;
  stale?: boolean;
};

async function loadReceptionSnapshot({
  actorId,
  date,
  workspaceId,
}: {
  actorId?: string;
  date: string;
  workspaceId: string;
}): Promise<{
  calendarResult: ReceptionCalendarReadResponse;
  queueResult: ReceptionQueueReadResponse;
}> {
  const failure = {
    ok: false,
    status: 500,
    error: "db_read_failed",
  } as const;

  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/reception/snapshot?date=${encodeURIComponent(date)}`,
      {
        cache: "no-store",
        headers: actorId
          ? { "x-clair-demo-session-user-id": actorId }
          : undefined,
      },
    );
    const body = (await response.json()) as ReceptionSnapshotReadResponse;

    if (!("calendar" in body) || !("queue" in body)) {
      const responseFailure = {
        ...failure,
        status: response.status,
      };
      return {
        calendarResult: responseFailure,
        queueResult: responseFailure,
      };
    }

    return {
      calendarResult: body.calendar,
      queueResult: body.queue,
    };
  } catch {
    return {
      calendarResult: failure,
      queueResult: failure,
    };
  }
}

function useReceptionOperatingSchedule({
  actorId,
  date,
  workspaceId,
}: {
  actorId?: string;
  date: string;
  workspaceId: string;
}) {
  const fallback = useMemo(
    () => resolveEffectiveOperatingHours(createInitialHospitalBasicSettingsDraft(), date),
    [date],
  );
  const requestKey = `${workspaceId}\u0000${actorId ?? ""}\u0000${date}`;
  const [resolved, setResolved] = useState<{
    key: string;
    schedule: EffectiveOperatingHours;
    status: "error" | "ready";
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadReceptionCalendar({ actorId, date, workspaceId }).then((result) => {
      if (!cancelled) {
        const authoritativeSchedule =
          result.ok && result.operatingSchedule?.date === date
            ? result.operatingSchedule
            : undefined;
        setResolved({
          key: requestKey,
          schedule: authoritativeSchedule ?? fallback,
          status:
            authoritativeSchedule || !shouldUseSupabaseAuth()
              ? "ready"
              : "error",
        });
      }
    });
    return () => { cancelled = true; };
  }, [actorId, date, fallback, requestKey, workspaceId]);

  return {
    schedule:
      resolved?.key === requestKey && resolved.schedule.date === date
        ? resolved.schedule
        : fallback,
    status: resolved?.key === requestKey ? resolved.status : "loading",
  } as const;
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

async function loadWorkspaceStaff({
  actorId,
  operatingDate,
  workspaceId,
}: {
  actorId?: string;
  operatingDate: string;
  workspaceId: string;
}): Promise<WorkspaceStaffReadResponse> {
  try {
    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/staff?date=${encodeURIComponent(operatingDate)}`,
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
      avatarUrl: member.avatarUrl,
      department: member.department,
      id: member.id,
      initial: member.initial,
      name: member.displayName,
      operationalStatus: member.operationalStatus,
      role: "veterinarian" as const,
      title: member.title,
    }));
}

function mapWorkspaceStaffToReceptionStaff(
  response: WorkspaceStaffReadResponse,
): ReceptionStaffMember[] {
  if (!response.ok) return [];

  return response.staff
    .filter((member) => member.status === "active" && member.roles.length > 0)
    .map((member) => ({
      avatarUrl: member.avatarUrl,
      department: member.department,
      id: member.id,
      initial: member.initial,
      name: member.displayName,
      operationalStatus: member.operationalStatus,
      roles: member.roles,
      title: member.title,
    }));
}

function isAppointmentAssignedToStaff(appointment: Appointment, staffUserId: string) {
  return appointment.assignedStaffUserIds?.includes(staffUserId) ??
    appointment.assignedVeterinarianId === staffUserId;
}

function isEncounterAssignedToStaff(encounter: Encounter, staffUserId: string) {
  return encounter.assignedStaffUserIds?.includes(staffUserId) ??
    encounter.primaryVeterinarianId === staffUserId;
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
  if (result.denialReason === "walk_in_outside_business_hours") {
    return "영업시간 안에서만 접수를 생성할 수 있습니다.";
  }
  if (
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return "이 workspace에서 현장 접수를 생성할 권한이 없습니다.";
  }

  return "접수를 만들지 못했어요. 입력값은 그대로 두었어요. 다시 시도해 주세요.";
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

function getAppointmentCreateRouteErrorMessage(
  result: Extract<ReceptionAppointmentCreateResponse, { ok: false }>,
) {
  if (result.error === "rate_limited")
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (result.error === "invalid_input") {
    return (
      Object.values(result.fieldErrors ?? {})[0] ?? "예약 정보를 확인해 주세요."
    );
  }
  if (result.denialReason === "appointment_slot_unavailable")
    return "이미 예약된 시간대입니다.";
  if (result.denialReason === "appointment_closed_day")
    return "휴진일에는 예약을 생성할 수 없습니다.";
  if (result.denialReason === "appointment_outside_business_hours")
    return "진료 시간 안에서 예약 시간을 선택해 주세요.";
  if (
    result.denialReason === "patient_unavailable" ||
    result.denialReason === "guardian_unavailable" ||
    result.denialReason === "patient_guardian_link_missing" ||
    result.denialReason === "primary_veterinarian_unavailable"
  ) {
    return "예약 대상 정보를 확인해 주세요.";
  }
  if (
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return "이 workspace에서 예약을 생성할 권한이 없습니다.";
  }
  if (result.denialReason === "unauthenticated") {
    return "로그인 세션을 확인하지 못했습니다. 다시 로그인 후 예약을 생성해 주세요.";
  }

  return "예약을 생성할 수 없습니다.";
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

function getReceptionRestoreFailureMessage(
  result: Extract<
    ReceptionAppointmentRestoreResponse | ReceptionEncounterRestoreResponse,
    { ok: false }
  >,
) {
  if (result.error === "rate_limited")
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (
    result.denialReason === "encounter_unavailable" ||
    result.denialReason === "appointment_unavailable"
  ) {
    return "복구할 접수/예약 정보를 찾을 수 없습니다.";
  }
  if (
    result.denialReason === "encounter_already_active" ||
    result.denialReason === "appointment_already_active"
  ) {
    return "이미 복구된 접수/예약입니다.";
  }
  if (
    result.denialReason === "encounter_not_restorable" ||
    result.denialReason === "appointment_not_restorable"
  ) {
    return "현재 상태에서는 복구할 수 없습니다.";
  }
  if (result.denialReason === "appointment_active_encounter_exists") {
    return "이미 연결된 활성 접수가 있어 예약을 복구할 수 없습니다.";
  }
  if (
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return "이 workspace에서 접수/예약을 복구할 권한이 없습니다.";
  }

  return "접수/예약 복구에 실패했습니다.";
}

function getEncounterUpdateRouteErrorMessage(
  result: Extract<ReceptionEncounterUpdateResponse, { ok: false }>,
) {
  if (result.error === "rate_limited")
    return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  if (result.error === "invalid_input") {
    return (
      Object.values(result.fieldErrors ?? {})[0] ?? "접수 정보를 확인해 주세요."
    );
  }
  if (result.denialReason === "encounter_unavailable")
    return "접수 정보를 찾을 수 없습니다.";
  if (result.denialReason === "encounter_not_editable")
    return "현재 상태에서는 접수 정보를 수정할 수 없습니다.";
  if (
    result.denialReason === "patient_unavailable" ||
    result.denialReason === "primary_veterinarian_unavailable" ||
    result.denialReason === "queue_entry_unavailable"
  ) {
    return "접수 연결 정보를 확인해 주세요.";
  }
  if (
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return "이 workspace에서 접수 정보를 수정할 권한이 없습니다.";
  }

  return "접수 정보 수정에 실패했습니다.";
}

type ReceptionEncounterEditFieldErrors = Partial<
  Record<keyof ReceptionEncounterUpdateInput, string>
>;

type ReceptionEncounterEditFeedback = {
  kind: "blocked" | "permission" | "save" | "validation";
  message: string;
};

function getEncounterUpdateEditFeedback(
  result: Extract<ReceptionEncounterUpdateResponse, { ok: false }>,
): {
  feedback: ReceptionEncounterEditFeedback;
  fieldErrors: ReceptionEncounterEditFieldErrors;
} {
  if (result.error === "invalid_input") {
    return {
      feedback: {
        kind: "validation",
        message: "입력값을 확인해 주세요.",
      },
      fieldErrors: result.fieldErrors ?? {},
    };
  }

  if (
    result.denialReason === "unauthenticated" ||
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return {
      feedback: {
        kind: "permission",
        message:
          result.denialReason === "unauthenticated"
            ? "로그인 상태를 확인해 주세요."
            : "접수 수정 권한이 없습니다.",
      },
      fieldErrors: {},
    };
  }

  if (
    result.denialReason === "encounter_unavailable" ||
    result.denialReason === "encounter_not_editable" ||
    result.denialReason === "patient_unavailable" ||
    result.denialReason === "primary_veterinarian_unavailable" ||
    result.denialReason === "queue_entry_unavailable"
  ) {
    return {
      feedback: {
        kind: "blocked",
        message: getEncounterUpdateRouteErrorMessage(result),
      },
      fieldErrors: {},
    };
  }

  return {
    feedback: {
      kind: "save",
      message: getEncounterUpdateRouteErrorMessage(result),
    },
    fieldErrors: {},
  };
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
    ? "기존 데모 업무는 표시하지 않고 준비된 빈 병원 상태를 유지합니다."
    : "현재 화면은 로컬 데모/세션 데이터 기준으로 유지됩니다.";

  if (
    result.denialReason === "permission_missing" ||
    result.denialReason === "inactive_user" ||
    result.denialReason === "workspace_membership_missing" ||
    result.denialReason === "workspace_membership_inactive"
  ) {
    return `접수 보기 권한 또는 workspace membership을 확인해야 합니다. ${localFallbackText}`;
  }

  if (result.denialReason === "unauthenticated") {
    return `로그인 세션을 확인하지 못했습니다. ${localFallbackText}`;
  }

  if (result.error === "supabase_client_missing") {
    return `live Supabase read 연결이 구성되지 않았습니다. ${localFallbackText}`;
  }

  return `서버 read 결과를 반영하지 못했습니다. ${localFallbackText}`;
}

function getReceptionEmptyStateCopy({
  operatingDate,
  listMode,
  queueSummary,
  todayDate,
}: {
  operatingDate: string;
  listMode: ReceptionSideListMode;
  queueSummary?: {
    appointmentCount: number;
    date: string;
    receptionCount: number;
    totalCount: number;
    workspaceId: string;
  };
  todayDate: string;
}) {
  void operatingDate;
  void queueSummary;
  void todayDate;

  if (listMode === "reception") return "현재 진료 대기 중인 접수가 없습니다";
  if (listMode === "appointment") return "현재 접수 전 예약이 없습니다";
  return "대기 중인 접수/예약이 없습니다";
}

const formatPatientWeightKgInput = (weightKg?: number) =>
  typeof weightKg === "number" && Number.isFinite(weightKg)
    ? weightKg.toFixed(2)
    : "";

const parseWeightKgInput = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return undefined;

  const weightKg = Number(normalized);
  return Number.isFinite(weightKg) && weightKg > 0
    ? Math.round(weightKg * 100) / 100
    : undefined;
};

const receptionIdByWorkspaceVitalKey: Record<WorkspaceVitalKey, ReceptionCreateVitalId> = {
  weight: "weight",
  temperature: "temperature",
  heart_rate: "heartRate",
  respiratory_rate: "respiration",
  blood_pressure: "bloodPressure",
};

const workspaceVitalKeyByReceptionId: Record<ReceptionCreateVitalId, WorkspaceVitalKey> = {
  weight: "weight",
  temperature: "temperature",
  heartRate: "heart_rate",
  respiration: "respiratory_rate",
  bloodPressure: "blood_pressure",
};

const workspaceVitalKeyToReceptionId = (key: WorkspaceVitalKey) =>
  receptionIdByWorkspaceVitalKey[key];

const getReceptionVitalUnit = (
  settings: WorkspaceVitalSettingsSnapshot | undefined,
  key: WorkspaceVitalKey,
): WorkspaceVitalUnit =>
  settings?.items.find((item) => item.key === key)?.displayUnit ??
  settings?.presets.find((preset) => preset.key === key)?.canonicalUnit ??
  ({
    weight: "kg",
    temperature: "°C",
    heart_rate: "bpm",
    respiratory_rate: "rpm",
    blood_pressure: "mmHg",
  } satisfies Record<WorkspaceVitalKey, WorkspaceVitalUnit>)[key];

const formatReceptionInitialWeight = (
  weightKg: number | undefined,
  settings: WorkspaceVitalSettingsSnapshot | undefined,
) => {
  if (weightKg === undefined) return "";
  const unit = getReceptionVitalUnit(settings, "weight");
  return unit === "kg"
    ? formatPatientWeightKgInput(weightKg)
    : String(fromCanonicalVitalValue("weight", weightKg, unit));
};

const createReceptionVitalDraft = (
  weightKg?: number,
  settings?: WorkspaceVitalSettingsSnapshot,
): ReceptionCreateVitalDraft => ({
  selectedIds: settings
    ? getEnabledWorkspaceVitalSettings(settings).map((item) => workspaceVitalKeyToReceptionId(item.key))
    : ["weight", "temperature", "heartRate", "respiration"],
  serverErrors: {},
  shownErrors: {},
  shownWarnings: {},
  values: {
    weightKg: formatReceptionInitialWeight(weightKg, settings),
    temperatureC: "",
    heartRateBpm: "",
    respiratoryRateRpm: "",
    bloodPressureSystolicMmhg: "",
    bloodPressureDiastolicMmhg: "",
  },
});

const buildReceptionVitalInput = (
  draft: ReceptionCreateVitalDraft,
  settings?: WorkspaceVitalSettingsSnapshot,
  patient?: Pick<Patient, "species" | "weightKg">,
): {
  fieldErrors: ReceptionCreateVitalFieldErrors;
  fieldWarnings: ReceptionCreateVitalFieldWarnings;
  input?: ReceptionVitalMeasurementInput;
} => {
  const selected = new Set(draft.selectedIds);
  const fieldErrors: ReceptionCreateVitalFieldErrors = {};
  const fieldWarnings: ReceptionCreateVitalFieldWarnings = {};
  const input: ReceptionVitalMeasurementInput = {};

  const readPositiveNumber = (
    key: keyof ReceptionCreateVitalDraft["values"],
    {
      integer = false,
      maxValue,
      maxDecimals,
      precisionMessage,
    }: {
      integer?: boolean;
      maxValue?: number;
      maxDecimals?: number;
      precisionMessage?: string;
    } = {},
  ) => {
    const raw = draft.values[key].trim();
    if (!raw) return undefined;
    const value = Number(raw);

    if (!Number.isFinite(value)) {
      fieldErrors[key] = "숫자로 입력해 주세요.";
      return undefined;
    }
    if (value <= 0) {
      fieldErrors[key] = "0보다 크게 입력해 주세요.";
      return undefined;
    }
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw)) {
      fieldErrors[key] = "숫자로 입력해 주세요.";
      return undefined;
    }
    if (integer && !Number.isInteger(value)) {
      fieldErrors[key] = "정수로 입력해 주세요.";
      return undefined;
    }
    if (maxValue !== undefined && value > maxValue) {
      fieldErrors[key] = "저장할 수 있는 범위를 넘었어요.";
      return undefined;
    }
    const decimalPlaces = raw.split(".")[1]?.length ?? 0;
    if (
      maxDecimals !== undefined &&
      decimalPlaces > maxDecimals &&
      precisionMessage
    ) {
      fieldErrors[key] = precisionMessage;
      return undefined;
    }

    return value;
  };

  if (selected.has("weight")) {
    const value = readPositiveNumber("weightKg", {
      maxDecimals: 2,
      precisionMessage: "소수 둘째 자리까지 입력해 주세요.",
    });
    if (value !== undefined) {
      const canonicalValue = toCanonicalVitalValue(
        "weight",
        value,
        getReceptionVitalUnit(settings, "weight"),
      );
      if (canonicalValue > 9_999.99) {
        fieldErrors.weightKg = "저장할 수 있는 범위를 넘었어요.";
      } else {
        input.weightKg = canonicalValue;
      }
    }
  }
  if (selected.has("temperature")) {
    const value = readPositiveNumber("temperatureC", {
      maxDecimals: 1,
      precisionMessage: "소수 첫째 자리까지 입력해 주세요.",
    });
    if (value !== undefined) {
      const canonicalValue = toCanonicalVitalValue(
        "temperature",
        value,
        getReceptionVitalUnit(settings, "temperature"),
      );
      if (canonicalValue > 999.9) {
        fieldErrors.temperatureC = "저장할 수 있는 범위를 넘었어요.";
      } else {
        input.temperatureC = canonicalValue;
      }
    }
  }
  if (selected.has("heartRate")) {
    const value = readPositiveNumber("heartRateBpm", {
      integer: true,
      maxValue: 2_147_483_647,
    });
    if (value !== undefined) input.heartRateBpm = value;
  }
  if (selected.has("respiration")) {
    const value = readPositiveNumber("respiratoryRateRpm", {
      integer: true,
      maxValue: 2_147_483_647,
    });
    if (value !== undefined) input.respiratoryRateRpm = value;
  }
  if (selected.has("bloodPressure")) {
    const systolicRaw = draft.values.bloodPressureSystolicMmhg.trim();
    const diastolicRaw = draft.values.bloodPressureDiastolicMmhg.trim();
    if (!systolicRaw && diastolicRaw) {
      fieldErrors.bloodPressureDiastolicMmhg = "수축기를 먼저 입력해 주세요.";
    } else if (systolicRaw) {
      const systolic = readPositiveNumber("bloodPressureSystolicMmhg", {
        integer: true,
        maxValue: 2_147_483_647,
      });
      const diastolic = diastolicRaw
        ? readPositiveNumber("bloodPressureDiastolicMmhg", {
            integer: true,
            maxValue: 2_147_483_647,
          })
        : undefined;
      if (
        systolic !== undefined &&
        diastolic !== undefined &&
        diastolic >= systolic
      ) {
        fieldErrors.bloodPressureDiastolicMmhg =
          "수축기보다 작게 입력해 주세요.";
      } else if (
        systolic !== undefined &&
        (!diastolicRaw || diastolic !== undefined)
      ) {
        input.bloodPressure = {
          systolicMmhg: systolic,
          ...(diastolic === undefined ? {} : { diastolicMmhg: diastolic }),
        };
      }
    }
  }

  const isDogOrCat = patient?.species === "dog" || patient?.species === "cat";
  if (isDogOrCat) {
    const weightUnit = getReceptionVitalUnit(settings, "weight");
    const temperatureUnit = getReceptionVitalUnit(settings, "temperature");
    const priorWeightKg = patient?.weightKg;
    if (
      input.weightKg !== undefined &&
      (input.weightKg < 0.05 ||
        input.weightKg > 200 ||
        (priorWeightKg !== undefined &&
          (input.weightKg < priorWeightKg / 4 || input.weightKg > priorWeightKg * 4)))
    ) {
      fieldWarnings.weightKg = `기존 체중과 차이가 커요. ${weightUnit} 단위와 측정값을 확인해 주세요.`;
    }
    if (
      input.temperatureC !== undefined &&
      (input.temperatureC < 30 || input.temperatureC > 45)
    ) {
      fieldWarnings.temperatureC = `체온이 매우 이례적이에요. ${temperatureUnit} 단위를 확인해 주세요.`;
    }
    if (
      input.heartRateBpm !== undefined &&
      (input.heartRateBpm < 20 || input.heartRateBpm > 400)
    ) {
      fieldWarnings.heartRateBpm =
        "심박수가 매우 이례적이에요. 측정값을 확인해 주세요.";
    }
    if (
      input.respiratoryRateRpm !== undefined &&
      (input.respiratoryRateRpm < 5 || input.respiratoryRateRpm > 200)
    ) {
      fieldWarnings.respiratoryRateRpm =
        "호흡수가 매우 이례적이에요. 측정값을 확인해 주세요.";
    }
    if (
      input.bloodPressure?.systolicMmhg !== undefined &&
      (input.bloodPressure.systolicMmhg < 20 ||
        input.bloodPressure.systolicMmhg > 400)
    ) {
      fieldWarnings.bloodPressureSystolicMmhg =
        "수축기 혈압이 매우 이례적이에요. 측정값을 확인해 주세요.";
    }
    if (
      input.bloodPressure?.diastolicMmhg !== undefined &&
      (input.bloodPressure.diastolicMmhg < 10 ||
        input.bloodPressure.diastolicMmhg > 300)
    ) {
      fieldWarnings.bloodPressureDiastolicMmhg =
        "이완기 혈압이 매우 이례적이에요. 측정값을 확인해 주세요.";
    }
  }

  return {
    fieldErrors,
    fieldWarnings,
    input: Object.keys(input).length > 0 ? input : undefined,
  };
};

const walkInVitalResponseFieldMap = {
  "vitals.weightKg": "weightKg",
  "vitals.temperatureC": "temperatureC",
  "vitals.heartRateBpm": "heartRateBpm",
  "vitals.respiratoryRateRpm": "respiratoryRateRpm",
  "vitals.bloodPressure": "bloodPressureSystolicMmhg",
  "vitals.bloodPressure.systolicMmhg": "bloodPressureSystolicMmhg",
  "vitals.bloodPressure.diastolicMmhg": "bloodPressureDiastolicMmhg",
} as const satisfies Record<string, keyof ReceptionCreateVitalValues>;

const getWalkInVitalResponseErrors = (
  fieldErrors?: Record<string, string>,
): ReceptionCreateVitalFieldErrors =>
  Object.entries(fieldErrors ?? {}).reduce<ReceptionCreateVitalFieldErrors>(
    (mapped, [key, message]) => {
      const vitalKey = walkInVitalResponseFieldMap[
        key as keyof typeof walkInVitalResponseFieldMap
      ];
      if (vitalKey) mapped[vitalKey] = message;
      return mapped;
    },
    {},
  );

function ReceptionCreateButton({
  hasVitalWarnings,
  inputBlocked,
  onClick,
  scheduleBlocked,
  submitting,
}: {
  hasVitalWarnings: boolean;
  inputBlocked: boolean;
  onClick: () => void;
  scheduleBlocked: boolean;
  submitting: boolean;
}) {
  const disabled = inputBlocked || scheduleBlocked || submitting;
  const showInputTooltip = inputBlocked && !scheduleBlocked && !submitting;
  const button = (
    <Button
      type="button"
      size="default"
      aria-disabled={disabled || undefined}
      className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      onClick={() => {
        if (!scheduleBlocked && !submitting) onClick();
      }}
    >
      {submitting ? "생성 중" : hasVitalWarnings ? "확인하고 생성" : "생성"}
    </Button>
  );

  return showInputTooltip ? (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent role="tooltip">필수 입력 정보를 확인해주세요</TooltipContent>
    </Tooltip>
  ) : (
    button
  );
}

const getReservationTimeOptions = (
  date: string,
  durationMinutes: number,
  appointments: Appointment[],
  currentDate: string,
  currentOperatingMinutes: number,
  operatingSchedule: EffectiveOperatingHours,
) => {
  const options: Array<{
    breakWarning: boolean;
    disabled: boolean;
    label: string;
    minutes: number;
    reason?: string;
  }> = [];

  for (const minutes of getSelectableOperatingStartMinutes(operatingSchedule, durationMinutes)) {
    const startAt = getReceptionIsoAtMinutes(date, minutes);
    const startMs = Date.parse(startAt);
    const endMs = startMs + durationMinutes * 60_000;
    const conflict = appointments.some((appointment) => {
      if (
        getOperatingDateFromIso(appointment.scheduledStartAt) !== date ||
        !["requested", "confirmed", "changed"].includes(appointment.status)
      ) {
        return false;
      }
      const appointmentStartMs = Date.parse(appointment.scheduledStartAt);
      const appointmentEndMs = appointment.scheduledEndAt
        ? Date.parse(appointment.scheduledEndAt)
        : appointmentStartMs + 30 * 60_000;
      return startMs < appointmentEndMs && endMs > appointmentStartMs;
    });
    const elapsed = date === currentDate && minutes < currentOperatingMinutes;
    const reason = elapsed ? "지난 시간" : conflict ? "예약됨" : undefined;
    const breakWarning =
      getOperatingTimeClassification(
        operatingSchedule,
        minutes,
        durationMinutes,
      ) === "break-warning";

    options.push({
      breakWarning,
      disabled: elapsed || conflict,
      label: getScheduleTimeLabelFromMinutes(minutes),
      minutes,
      reason,
    });
  }

  return options;
};

const getWalkInTimeBlockMessage = (
  currentOperatingMinutes: number,
  durationMinutes: number,
  operatingSchedule: EffectiveOperatingHours,
) => {
  if (!operatingSchedule.isOpen || !operatingSchedule.treatmentStart || !operatingSchedule.treatmentEnd) {
    return "오늘은 휴진일입니다. 다음 영업일 예약으로 등록해 주세요.";
  }
  const treatmentStart = toOperatingMinutes(operatingSchedule.treatmentStart);
  const treatmentEnd = toOperatingMinutes(operatingSchedule.treatmentEnd);

  if (currentOperatingMinutes < treatmentStart) {
    return `아직 접수 시작 전입니다. 오늘 접수는 ${operatingSchedule.treatmentStart}부터 생성할 수 있어요.`;
  }

  if (currentOperatingMinutes >= treatmentEnd) {
    return "오늘 접수 가능 시간이 지났습니다. 다음 영업일 예약으로 등록해 주세요.";
  }

  if (
    getOperatingTimeClassification(
      operatingSchedule,
      currentOperatingMinutes,
      durationMinutes,
    ) === "blocked"
  ) {
    return "예상시간이 영업 종료 시간을 넘습니다. 더 이른 시간이나 짧은 예상시간을 선택해 주세요.";
  }

  return undefined;
};

const getShortTime = (dateTime?: string) => {
  return formatOperatingShortTime(dateTime);
};

const formatReceptionSidePanelDate = (date: string) => {
  const [year = "0000", month = "00", day = "00"] = date.split("-");
  return `${year}.${month}.${day}`;
};

const formatReceptionSidePanelDateFromDateTime = (dateTime?: string) => {
  const operatingDate = getOperatingDateFromIso(dateTime);
  return operatingDate ? formatReceptionSidePanelDate(operatingDate) : "-";
};

const formatReceptionSidePanelTime = (dateTime?: string) => {
  const minutes = getOperatingMinutesFromIso(dateTime);
  if (minutes === undefined) return "-";

  const hours = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hours >= 12 ? "오후" : "오전";
  const hour12 = hours % 12 || 12;

  return `${period} ${hour12}:${String(minute).padStart(2, "0")}`;
};

const getShortDate = (dateTime?: string) => {
  const operatingDate = getOperatingDateFromIso(dateTime);

  return operatingDate ? formatShortOperatingDate(operatingDate) : "-";
};

const getScheduleHourLabel = (hour: number) =>
  `${String(hour).padStart(2, "0")}:00`;

const getScheduleTimeLabelFromMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const getScheduleTimeRangeLabelFromIso = ({
  durationMinutes = scheduleSlotMinutes,
  endAt,
  startAt,
}: {
  durationMinutes?: number;
  endAt?: string;
  startAt?: string;
}) => {
  const startMinutes = getOperatingMinutesFromIso(startAt);

  if (startMinutes === undefined) return "시간 미정";

  const endMinutes =
    getOperatingMinutesFromIso(endAt) ?? startMinutes + durationMinutes;

  return `${getScheduleTimeLabelFromMinutes(startMinutes)}-${getScheduleTimeLabelFromMinutes(
    endMinutes,
  )}`;
};

const getCurrentOperatingTimeLabel = (currentOperatingMinutes: number) =>
  getScheduleTimeLabelFromMinutes(clampScheduleMinutes(currentOperatingMinutes));

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
  | "past-time"
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

type DayScheduleLaneItem =
  | {
      readonly appointment: Appointment;
      readonly block: ReceptionCalendarScheduleBlock;
      readonly id: string;
      readonly kind: "appointment";
    }
  | {
      readonly block: ReceptionCalendarScheduleBlock;
      readonly draft: ReceptionDraftCheckIn;
      readonly id: string;
      readonly kind: "walkIn";
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

const getScheduleCardLayout = (
  block?: ReceptionCalendarScheduleBlock,
  timeScale?: CalendarTimeScale,
): CalendarTimeRangeLayout | undefined => {
  const scheduleStartMinutes = dayScheduleStartHour * 60;
  const scheduleEndMinutes = dayScheduleEndHour * 60;

  if (
    !block ||
    block.endMinutes <= scheduleStartMinutes ||
    block.startMinutes >= scheduleEndMinutes
  ) {
    return undefined;
  }

  if (timeScale) {
    const startMinutes = Math.max(block.startMinutes, scheduleStartMinutes);
    const endMinutes = Math.min(block.endMinutes, scheduleEndMinutes);
    return {
      top: timeScale.minutesToY(startMinutes),
      height: Math.max(36, timeScale.rangeHeight(startMinutes, endMinutes)),
    };
  }

  return getCalendarTimeRangeLayout({
    endMinutes: Math.min(block.endMinutes, scheduleEndMinutes),
    hourRowHeight: dayScheduleHourRowHeight,
    minDurationMinutes: scheduleSlotMinutes,
    scheduleStartMinutes,
    startMinutes: Math.max(block.startMinutes, scheduleStartMinutes),
  });
};

const getAppointmentDayScheduleLaneItem = (
  appointment: Appointment,
): DayScheduleLaneItem | undefined => {
  const block = getAppointmentScheduleBlock(appointment);

  if (!block) return undefined;

  return {
    appointment,
    block,
    id: `appointment:${appointment.id}`,
    kind: "appointment",
  };
};

const getDraftDayScheduleLaneItem = (
  draft: ReceptionDraftCheckIn,
): DayScheduleLaneItem | undefined => {
  const block = getDraftScheduleBlock(draft);

  if (!block) return undefined;

  return {
    block,
    draft,
    id: `walk-in:${draft.encounter.id}`,
    kind: "walkIn",
  };
};

const isDayScheduleLaneItem = (
  item: DayScheduleLaneItem | undefined,
): item is DayScheduleLaneItem => Boolean(item);

const getReceptionCalendarSelectionMessage = (
  reason: ReceptionCalendarSelectionInvalidReason,
  block?: ReceptionCalendarScheduleBlock,
) => {
  if (reason === "outside-business-hours") {
    return "설정된 영업시간 안에서만 접수/예약을 만들 수 있습니다.";
  }
  if (reason === "past-time") {
    return "이미 지난 시간에는 접수/예약을 만들 수 없습니다. 현재 이후 시간을 선택해 주세요.";
  }
  if (reason === "unavailable-time") {
    return `${block?.label ?? "접수/예약 불가 시간"}에는 접수/예약을 만들 수 없습니다.`;
  }
  if (reason === "overlap") {
    return `${block?.label ?? "기존 일정"}과 겹치는 시간에는 접수/예약을 만들 수 없습니다.`;
  }
  if (reason === "too-long") {
    return `접수 task는 최대 ${maxReceptionCalendarDraftDurationMinutes}분까지 만들 수 있습니다.`;
  }
  if (reason === "too-short") {
    return "접수 task는 최소 15분 이상이어야 합니다.";
  }

  return "선택한 캘린더 위치에서는 접수/예약을 만들 수 없습니다.";
};

const validateReceptionCalendarSelection = ({
  appointments,
  currentDate,
  currentOperatingMinutes,
  draftCheckIns,
  endMinutes,
  operatingDate,
  startMinutes,
  timeScale,
  veterinarianId,
}: {
  appointments: Appointment[];
  currentDate: string;
  currentOperatingMinutes: number;
  draftCheckIns: ReceptionDraftCheckIn[];
  endMinutes: number;
  operatingDate: string;
  startMinutes: number;
  timeScale?: CalendarTimeScale;
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

  if (timeScale
    ? !timeScale.isSelectable(normalized.startMinutes, normalized.durationMinutes)
    : normalized.startMinutes < dayBusinessOpenMinutes || normalized.endMinutes > dayBusinessCloseMinutes) {
    return {
      message: getReceptionCalendarSelectionMessage("outside-business-hours"),
      reason: "outside-business-hours",
      valid: false,
    };
  }

  if (operatingDate === currentDate && normalized.startMinutes < currentOperatingMinutes) {
    return {
      message: getReceptionCalendarSelectionMessage("past-time"),
      reason: "past-time",
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
  timeScale,
}: {
  baseHour: number;
  bounds: DOMRect;
  clientY: number;
  timeScale?: CalendarTimeScale;
}) => {
  if (timeScale) {
    return clampScheduleMinutes(timeScale.yToMinutes(
      timeScale.minutesToY(baseHour * 60) + clientY - bounds.top,
    ));
  }
  const minutesPerPixel = 60 / bounds.height;
  const rawMinutes = baseHour * 60 + (clientY - bounds.top) * minutesPerPixel;

  return clampScheduleMinutes(rawMinutes);
};

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

const getAppointmentDurationLabel = (appointment: Appointment) => {
  if (!appointment.scheduledEndAt) return "15분";

  const start = new Date(appointment.scheduledStartAt).getTime();
  const end = new Date(appointment.scheduledEndAt).getTime();
  const minutes = Math.max(10, Math.round((end - start) / 60000));

  return `${minutes}분`;
};

const getAppointmentDurationMinutes = (appointment: Appointment) => {
  if (!appointment.scheduledEndAt) return scheduleSlotMinutes;

  const start = new Date(appointment.scheduledStartAt).getTime();
  const end = new Date(appointment.scheduledEndAt).getTime();
  const minutes = Math.round((end - start) / 60000);

  return Number.isFinite(minutes) && minutes > 0 ? minutes : scheduleSlotMinutes;
};

function getVeterinarianLaneOperationalStatus({
  appointments,
  currentDate,
  currentOperatingMinutes,
  operatingDate,
  veterinarian,
}: {
  appointments: Appointment[];
  currentDate: string;
  currentOperatingMinutes: number;
  operatingDate: string;
  veterinarian: Veterinarian;
}): VeterinarianOperationalStatus | undefined {
  if (operatingDate !== currentDate) return veterinarian.operationalStatus;

  const hasCurrentCheckedInAppointment = appointments.some((appointment) => {
    if (
      appointment.assignedVeterinarianId !== veterinarian.id ||
      appointment.status !== "checked_in" ||
      getOperatingDateFromIso(appointment.scheduledStartAt) !== operatingDate
    ) {
      return false;
    }

    const startMinutes = getOperatingMinutesFromIso(
      appointment.scheduledStartAt,
    );
    if (startMinutes === undefined) return false;
    const endMinutes = appointment.scheduledEndAt
      ? getOperatingMinutesFromIso(appointment.scheduledEndAt)
      : startMinutes + scheduleSlotMinutes;

    return (
      endMinutes !== undefined &&
      currentOperatingMinutes >= startMinutes &&
      currentOperatingMinutes < endMinutes
    );
  });

  if (!hasCurrentCheckedInAppointment) return veterinarian.operationalStatus;

  return {
    code: "in_consultation",
    label: "진료중",
    source: "reception",
  };
}

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
  options?: { allowMockFallback?: boolean },
) => {
  if (!userId) return undefined;

  const staffName = staff.find((user) => user.id === userId)?.name;
  if (staffName) return staffName;

  const allowMockFallback =
    options?.allowMockFallback ?? staff === allVeterinarians;
  return allowMockFallback
    ? mockStaffUsers.find((user) => user.id === userId)?.name
    : undefined;
};

const getScopedStaffDisplayName = ({
  allowMockFallback,
  staffMembers,
  userId,
}: {
  allowMockFallback: boolean;
  staffMembers: Array<{ displayName: string; id: string }>;
  userId?: string;
}) => {
  if (!userId) return undefined;

  const staffName = staffMembers.find((item) => item.id === userId)?.displayName;
  if (staffName) return staffName;

  return allowMockFallback ? getStaffDisplayName(userId) : undefined;
};

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

function ReceptionVeterinarianAvatar({
  veterinarian,
}: {
  veterinarian?: Veterinarian;
}) {
  if (!veterinarian) {
    return (
      <span
        aria-hidden="true"
        data-testid="reception-veterinarian-unassigned-icon"
        className="flex size-[var(--emr-reception-veterinarian-avatar-size)] shrink-0 items-center justify-center rounded-full border border-[var(--emr-reception-veterinarian-avatar-border)] bg-[var(--emr-reception-veterinarian-avatar-bg)] text-[var(--emr-reception-veterinarian-avatar-text)]"
      >
        <CdsPeopleUserMinusIcon className="size-3" />
      </span>
    );
  }

  return (
    <Avatar
      data-testid="reception-veterinarian-avatar"
      roundness="roundrect"
      className="size-[var(--emr-reception-veterinarian-avatar-size)] after:border-[var(--emr-reception-veterinarian-avatar-border)]"
    >
      {veterinarian.avatarUrl ? (
        <AvatarImage src={veterinarian.avatarUrl} alt="" />
      ) : null}
      <AvatarFallback className="bg-[var(--emr-reception-veterinarian-avatar-bg)] text-[10px] font-medium text-[var(--emr-reception-veterinarian-avatar-text)]">
        {veterinarian.initial ?? veterinarian.name.slice(0, 1)}
      </AvatarFallback>
    </Avatar>
  );
}

function ReceptionVeterinarianIdentity({
  className,
  veterinarianId,
  veterinarians = allVeterinarians,
}: {
  className?: string;
  veterinarianId: string;
  veterinarians?: Veterinarian[];
}) {
  const veterinarian =
    veterinarianId === unassignedVeterinarianValue
      ? undefined
      : veterinarians.find((item) => item.id === veterinarianId);

  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 items-center gap-[var(--emr-reception-veterinarian-identity-gap)] text-left",
        className,
      )}
    >
      <ReceptionVeterinarianAvatar veterinarian={veterinarian} />
      <span className="min-w-0 flex-1 truncate">
        {veterinarian?.name ?? "수의사 미지정"}
      </span>
    </span>
  );
}

function ReceptionVeterinarianSelectItems({
  veterinarians,
}: {
  veterinarians: Veterinarian[];
}) {
  return (
    <>
      <SelectItem value={unassignedVeterinarianValue}>
        <ReceptionVeterinarianIdentity
          veterinarianId={unassignedVeterinarianValue}
          veterinarians={veterinarians}
        />
      </SelectItem>
      {veterinarians.map((veterinarian) => (
        <SelectItem key={veterinarian.id} value={veterinarian.id}>
          <ReceptionVeterinarianIdentity
            veterinarianId={veterinarian.id}
            veterinarians={veterinarians}
          />
        </SelectItem>
      ))}
    </>
  );
}

function ReceptionStaffAssignmentSelect({
  ariaRequired = false,
  compact = false,
  label = "업무 담당자",
  onChange,
  selectedIds,
  selectionMode = "multiple",
  staffMembers,
}: {
  ariaRequired?: boolean;
  compact?: boolean;
  label?: string;
  onChange: (staffUserIds: string[]) => void;
  selectedIds: string[];
  selectionMode?: "multiple" | "single";
  staffMembers: ReceptionStaffMember[];
}) {
  const selectedStaff = staffMembers.filter((staffMember) =>
    selectedIds.includes(staffMember.id),
  );
  const selectedLabel = selectedStaff.length
    ? selectedStaff.map((staffMember) => staffMember.name).join(", ")
    : `${label}를 선택해주세요`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        aria-required={ariaRequired || undefined}
        render={
          <Button
            type="button"
            variant="outline"
            size={compact ? "default" : "lg"}
            className={cn(
              "w-full justify-between bg-card font-medium",
              compact && "bg-[var(--emr-reception-create-field-bg)]",
            )}
          />
        }
      >
        <span className="truncate text-left">{selectedLabel}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 w-[280px] overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {selectionMode === "single" ? (
            <DropdownMenuRadioGroup
              value={selectedIds[0] ?? ""}
              onValueChange={(value) => onChange([value])}
            >
              {staffMembers.map((staffMember) => (
                <DropdownMenuRadioItem key={staffMember.id} value={staffMember.id}>
                  {staffMember.name}
                  {staffMember.title ? ` · ${staffMember.title}` : ""}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          ) : (
            staffMembers.map((staffMember) => {
              const checked = selectedIds.includes(staffMember.id);
              return (
                <DropdownMenuCheckboxItem
                  key={staffMember.id}
                  checked={checked}
                  onCheckedChange={() =>
                    onChange(
                      checked
                        ? selectedIds.filter((id) => id !== staffMember.id)
                        : [...selectedIds, staffMember.id],
                    )
                  }
                >
                  {staffMember.name}
                  {staffMember.title ? ` · ${staffMember.title}` : ""}
                </DropdownMenuCheckboxItem>
              );
            })
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const getReceptionEncounterStatusLabel = (status: Encounter["status"]) => {
  if (status === "waiting") return "진료대기";
  if (status === "ordered") return "진료 진행중";
  return getStatusLabel("encounter", status);
};

const getReceptionEncounterStatusTone = (
  status: Encounter["status"],
): "default" | "green" | "orange" | "sky" | "red" => {
  if (status === "completed") return "green";
  if (status === "waiting" || status === "ready_for_billing") return "orange";
  if (status === "in_consultation" || status === "ordered") return "sky";
  if (status === "cancelled") return "red";
  return "default";
};

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

const calendarTaskBadgeToneClasses: Record<CalendarTaskBadgeType, string> = {
  예약:
    "border-transparent bg-[var(--emr-calendar-task-badge-reservation-bg)] text-[var(--emr-calendar-task-badge-reservation-text)]",
  외래:
    "border-[var(--emr-calendar-task-badge-outpatient-border)] bg-[var(--emr-calendar-task-badge-outpatient-bg)] text-[var(--emr-calendar-task-badge-outpatient-text)]",
  노쇼:
    "border-[var(--emr-calendar-task-badge-noshow-border)] bg-[var(--emr-calendar-task-badge-noshow-bg)] text-[var(--emr-calendar-task-badge-noshow-text)]",
};

const calendarTaskCardToneClasses: Record<CalendarTaskBadgeType, string> = {
  예약:
    "border-[var(--emr-calendar-task-reservation-border)] bg-[var(--emr-calendar-task-reservation-bg)] text-[var(--emr-calendar-task-reservation-text)] hover:bg-[var(--emr-calendar-task-reservation-hover-bg)]",
  외래:
    "border-[var(--emr-calendar-task-outpatient-border)] bg-[var(--emr-calendar-task-outpatient-bg)] text-[var(--emr-calendar-task-outpatient-text)] hover:bg-[var(--emr-calendar-task-outpatient-hover-bg)]",
  노쇼:
    "border-[var(--emr-calendar-task-noshow-border)] bg-[var(--emr-calendar-task-noshow-bg)] text-[var(--emr-calendar-task-noshow-text)]",
};

function CalendarTaskBadge({
  calendarToneClassName,
  tone = "default",
  testId,
  type = "예약",
}: {
  calendarToneClassName?: string;
  tone?: "default" | "neutral";
  testId?: string;
  type?: CalendarTaskBadgeType;
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex h-[18px] min-w-[30px] shrink-0 items-center justify-center whitespace-nowrap rounded-[6px] border px-[4px] py-px font-['Pretendard'] text-[12px] font-medium leading-4 [letter-spacing:0]",
        tone === "neutral"
          ? "border-border bg-card text-muted-foreground"
          : (calendarToneClassName ?? calendarTaskBadgeToneClasses[type]),
      )}
    >
      {type}
    </span>
  );
}

function CalendarQuarterHourLines({ hour, scale }: { hour?: number; scale?: CalendarTimeScale } = {}) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      data-testid="calendar-quarter-hour-lines"
      aria-hidden="true"
    >
      {Array.from({ length: scheduleSlotCountPerHour - 1 }, (_, index) => (
        <span
          key={`quarter-line-${index}`}
          className="absolute left-0 right-0 h-px bg-[var(--emr-border-subtle)]/70"
          style={scale && hour !== undefined
            ? { top: scale.rangeHeight(hour * 60, hour * 60 + (index + 1) * scheduleSlotMinutes) }
            : { top: `${((index + 1) / scheduleSlotCountPerHour) * 100}%` }}
        />
      ))}
    </div>
  );
}

function CalendarCurrentTimeIndicator({
  className,
  currentOperatingMinutes,
  labelTestId,
  style,
  testId,
}: {
  className?: string;
  currentOperatingMinutes: number;
  labelTestId: string;
  style?: CSSProperties;
  testId: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "pointer-events-none absolute z-[35] flex items-center",
        className,
      )}
      style={style}
    >
      <span
        data-testid={labelTestId}
        className="flex h-[var(--emr-calendar-current-time-label-height)] w-[var(--emr-calendar-current-time-label-width)] shrink-0 items-center justify-center gap-0 rounded-[var(--emr-calendar-current-time-label-radius)] bg-[var(--emr-calendar-current-time)] px-[var(--emr-calendar-current-time-label-padding-x)] py-[var(--emr-calendar-current-time-label-padding-y)] text-center text-[11px] font-semibold leading-4 text-white tabular-nums [letter-spacing:0]"
      >
        {getCurrentOperatingTimeLabel(currentOperatingMinutes)}
      </span>
      <span
        data-testid={`${testId}-line`}
        className="flex min-w-0 flex-1 items-center pl-[var(--emr-calendar-current-time-gap)]"
      >
        <span className="size-[var(--emr-calendar-current-time-dot-size)] shrink-0 rounded-full bg-[var(--emr-calendar-current-time)]" />
        <span className="h-px flex-1 bg-[var(--emr-calendar-current-time)]" />
      </span>
    </div>
  );
}

type CalendarTaskCardProps = {
  accentClassName?: string;
  accentTestId?: string;
  ariaLabel: string;
  badgeType: CalendarTaskBadgeType;
  calendarBadgeToneClassName?: string;
  calendarToneClassName?: string;
  className?: string;
  description?: string;
  disabled?: boolean;
  fillHeight?: boolean;
  guardianLabel?: string;
  onClick: () => void;
  onPointerDown?: () => void;
  patientLabel: string;
  purposeLabel: string;
  purposeTestId?: string;
  statusLabel?: string;
  statusTestId?: string;
  testId: string;
  timeLabel?: string;
  tone?: "default" | "neutral";
  type?: "compact" | "default" | "medium" | "noShow";
  statusTone?: "noShow";
};

const calendarTaskTimeLabelClassName =
  "flex h-[var(--emr-calendar-task-line-height)] shrink-0 items-center text-[var(--emr-calendar-task-text-size)] font-normal leading-[var(--emr-calendar-task-line-height)] tabular-nums [letter-spacing:0] opacity-[var(--emr-calendar-task-time-opacity)]";
const calendarTaskIdentityClassName =
  "min-w-0 truncate text-[var(--emr-calendar-task-text-size)] font-medium leading-[var(--emr-calendar-task-line-height)] [letter-spacing:0]";
const calendarTaskCompactContentClassName =
  "flex h-[var(--emr-calendar-task-line-height)] w-full min-w-0 items-center gap-[var(--emr-calendar-task-content-gap)] overflow-hidden";

function CalendarTaskCard({
  accentClassName,
  accentTestId,
  ariaLabel,
  badgeType,
  calendarBadgeToneClassName,
  calendarToneClassName,
  className,
  description,
  disabled,
  fillHeight,
  guardianLabel,
  onClick,
  onPointerDown,
  patientLabel,
  purposeLabel,
  purposeTestId,
  statusLabel,
  statusTestId,
  testId,
  timeLabel,
  tone = "default",
  type = "default",
  statusTone,
}: CalendarTaskCardProps) {
  const noShow = statusTone === "noShow" || type === "noShow";
  const compact = type === "compact";
  const medium = type === "medium";
  const neutral = tone === "neutral";
  const veterinarianToneClassName =
    !neutral && !noShow ? calendarToneClassName : undefined;
  const identityLabel = guardianLabel
    ? `${patientLabel} · ${guardianLabel}`
    : `${patientLabel} · ${purposeLabel}`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        "relative z-10 flex min-w-0 items-start overflow-hidden rounded-[var(--emr-calendar-task-radius)] border text-left font-['Pretendard'] shadow-[var(--emr-calendar-task-shadow)] outline-none transition-[background-color,border-color,box-shadow,color]",
        fillHeight ? "h-full w-full flex-none" : "flex-1",
        "px-[var(--emr-calendar-task-padding-x)] py-[var(--emr-calendar-task-padding-y)]",
        compact
          ? "items-center"
          : "flex-col gap-y-[var(--emr-calendar-task-row-gap)]",
        !fillHeight && compact && "h-[var(--emr-calendar-task-compact-height)]",
        !fillHeight && medium && "h-[var(--emr-calendar-task-medium-height)]",
        !fillHeight &&
          type === "default" &&
          "h-[var(--emr-calendar-task-default-height)]",
        !fillHeight && noShow && "h-[var(--emr-calendar-task-medium-height)]",
        neutral
          ? "border-border bg-muted text-foreground hover:bg-muted/80"
          : (veterinarianToneClassName ?? calendarTaskCardToneClasses[badgeType]),
        "focus-visible:border-[3px] focus-visible:border-[var(--emr-topbar-tab-active-close)] focus-visible:shadow-none",
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
          noShow
            ? "text-[var(--emr-calendar-task-noshow-text)]"
            : neutral
              ? "text-muted-foreground"
              : badgeType === "외래"
              ? "text-[var(--emr-calendar-task-outpatient-text)]"
              : "text-[var(--emr-calendar-task-reservation-text)]",
          accentClassName,
        )}
        aria-hidden="true"
      />
      {compact ? (
        <span className={calendarTaskCompactContentClassName}>
          <CalendarTaskBadge
            calendarToneClassName={calendarBadgeToneClassName}
            testId={`${testId}-badge`}
            tone={tone}
            type={badgeType}
          />
          <span
            data-testid={purposeTestId}
            className={cn("flex-1", calendarTaskIdentityClassName)}
          >
            {identityLabel}
          </span>
          {statusLabel ? (
            <span
              data-testid={statusTestId}
              className="shrink-0 emr-text-micro font-semibold text-current opacity-80"
            >
              {statusLabel}
            </span>
          ) : null}
          {timeLabel ? (
            <span
              data-testid={`${testId}-time`}
              className={calendarTaskTimeLabelClassName}
            >
              {timeLabel}
            </span>
          ) : null}
        </span>
      ) : (
        <>
          <span className={calendarTaskCompactContentClassName}>
            <CalendarTaskBadge
              calendarToneClassName={calendarBadgeToneClassName}
              testId={`${testId}-badge`}
              tone={tone}
              type={badgeType}
            />
            <span
              data-testid={purposeTestId}
              className={cn("flex-1", calendarTaskIdentityClassName)}
            >
              {identityLabel}
            </span>
            {statusLabel ? (
              <span
                data-testid={statusTestId}
                className="shrink-0 emr-text-micro font-semibold text-current opacity-80"
              >
                {statusLabel}
              </span>
            ) : null}
          </span>
          {!noShow && !medium && description ? (
            <span
              data-testid={`${testId}-description`}
              className="line-clamp-2 w-full text-[13px] font-normal leading-[18px] [letter-spacing:0] opacity-90"
            >
              {description}
            </span>
          ) : null}
          {timeLabel ? (
            <span
              data-testid={`${testId}-time`}
              className={calendarTaskTimeLabelClassName}
            >
              {timeLabel}
            </span>
          ) : null}
        </>
      )}
    </button>
  );
}

function ReceptionStatusBadge({
  className,
  label,
  testId,
  tone = "default",
}: {
  className?: string;
  label: string;
  testId?: string;
  tone?: "default" | "green" | "orange" | "sky" | "red";
}) {
  return (
    <Badge
      variant="outline"
      data-testid={testId}
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

const getAppointmentTone = (status: Appointment["status"]) => {
  if (status === "checked_in") return "green";
  if (status === "confirmed") return "sky";
  if (status === "no_show" || status === "cancelled") return "red";
  if (status === "changed") return "orange";

  return "default";
};

type ReceptionCardActionFeedback = {
  body: ReactNode;
  title: string;
};

export function ReceptionSidePanel({ moduleLabel }: ShellComponentProps) {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const queueReadError = useReceptionStore((state) => state.queueReadError);
  const queueReadStatus = useReceptionStore((state) => state.queueReadStatus);
  const queueSummary = useReceptionStore((state) => state.queueSummary);
  const persistedCalendarAppointments = useReceptionStore(
    (state) => state.persistedCalendarAppointments,
  );
  const [listMode, setListMode] = useState<ReceptionSideListMode>("all");
  const [previousOperatingDate, setPreviousOperatingDate] = useState<string>();
  const [searchOpen, setSearchOpen] = useState(false);
  const [cardActionFeedback, setCardActionFeedback] =
    useState<ReceptionCardActionFeedback | null>(null);
  const [collapsedQueueGroups, setCollapsedQueueGroups] = useState<
    Record<ReceptionQueueSideDisplayGroup, boolean>
  >({
    appointment: false,
    billing_handoff: true,
    exception: true,
    reception: false,
  });
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null);
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
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
  const authSession = useMockAuthStore((state) => state.session);
  const setModulePanelOpen = useLayoutStore(
    (state) => state.setModulePanelOpen,
  );
  const requestReceptionReadRetry = useReceptionStore(
    (state) => state.requestReceptionReadRetry,
  );
  const calendarViewByWorkspace = useReceptionStore(
    (state) => state.calendarViewByWorkspace,
  );
  const setCalendarDraftSelection = useReceptionStore(
    (state) => state.setCalendarDraftSelection,
  );
  const setSearchQuery = useReceptionStore((state) => state.setSearchQuery);
  const setWorkspaceOperatingDate = useReceptionStore(
    (state) => state.setWorkspaceOperatingDate,
  );
  const workspaceId = resolveWorkspaceRouteParam(params.workspaceId);
  const defaultOperatingDate = getWorkspaceOperatingDate(workspaceId);
  const operatingDateOverride = useReceptionStore(
    (state) => state.operatingDateByWorkspace[workspaceId],
  );
  const calendarView = calendarViewByWorkspace[workspaceId] ?? "day";
  const routeDateParam = searchParams.get("date");
  const routeOperatingDate = isIsoOperatingDate(routeDateParam)
    ? routeDateParam
    : undefined;
  const operatingDate =
    routeDateParam === null
      ? (operatingDateOverride ?? defaultOperatingDate)
      : (routeOperatingDate ?? defaultOperatingDate);
  const miniCalendarWeekStartDate =
    calendarView === "week" ? getStartOfWeekIsoDate(operatingDate) : undefined;
  const miniCalendarWeekEndDate = miniCalendarWeekStartDate
    ? addDaysToIsoDate(miniCalendarWeekStartDate, 6)
    : undefined;
  const currentOperatingMinutes = getWorkspaceCurrentOperatingMinutes(workspaceId);
  const liveStaffSourceEnabled = isPreparedEmptyClinicWorkspace(workspaceId) ||
    (workspaceId === "workspace-clinical-master-pilot-v1" && shouldUseSupabaseAuth());
  const staffResourceKey = getReceptionStaffResourceKey({
    operatingDate,
    workspaceId,
  });
  const workspaceVeterinarians = useReceptionStaffResourceStore(
    (state) =>
      state.resourcesByKey[staffResourceKey]?.veterinarians ??
      emptyReceptionStaffVeterinarians,
  );
  const veterinarians = liveStaffSourceEnabled
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
  const queueAppointments = useMemo(
    () =>
      getTodayAppointments(draftCheckIns, persistedCalendarAppointments, {
        operatingDate,
        workspaceId,
      }),
    [draftCheckIns, operatingDate, persistedCalendarAppointments, workspaceId],
  );
  const queueRows = useMemo(
    () =>
      getReceptionQueueRows(draftCheckIns, {
        allowMockStaffFallback: !liveStaffSourceEnabled,
        operatingDate,
        profileDataset: { guardians, patientGuardians, patients },
        staffMembers: veterinarianStaffMembers,
        workspaceId,
      }),
    [
      draftCheckIns,
      guardians,
      liveStaffSourceEnabled,
      operatingDate,
      patientGuardians,
      patients,
      veterinarianStaffMembers,
      workspaceId,
    ],
  );
  const queueItems = useMemo(
    () =>
      getReceptionQueueSideItems({
        allowMockStaffFallback: !liveStaffSourceEnabled,
        appointments: queueAppointments,
        guardians,
        patientGuardians,
        patients,
        queueRows,
        staffMembers: veterinarianStaffMembers,
        workspaceId,
      }),
    [
      guardians,
      liveStaffSourceEnabled,
      patientGuardians,
      patients,
      queueAppointments,
      queueRows,
      veterinarianStaffMembers,
      workspaceId,
    ],
  );
  const filteredQueueItems = useMemo(
    () => getFilteredReceptionQueueSideItems(queueItems, searchQuery),
    [queueItems, searchQuery],
  );
  const visibleQueueItems = useMemo(
    () => getReceptionSideQueueItems(filteredQueueItems, listMode),
    [filteredQueueItems, listMode],
  );
  const visibleQueueGroups = useMemo(
    () => getReceptionSideQueueGroups(visibleQueueItems),
    [visibleQueueItems],
  );
  const showQueueLoadingState = queueReadStatus === "loading" && visibleQueueGroups.length === 0;
  const sideListCounts = useMemo(
    () =>
      Object.fromEntries(
        receptionQueueTabItems.map((item) => [
          item.value,
          getReceptionActiveSideQueueItems(filteredQueueItems, item.value).length,
        ]),
      ) as Record<ReceptionSideListMode, number>,
    [filteredQueueItems],
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
    operatingDate,
    listMode,
    queueSummary:
      queueSummary?.workspaceId === workspaceId ? queueSummary : undefined,
    todayDate: defaultOperatingDate,
  });
  const closeSearch = useCallback(() => {
    setSearchQuery("");
    setSearchOpen(false);
  }, [setSearchQuery]);
  const toggleQueueGroup = useCallback((group: ReceptionQueueSideDisplayGroup) => {
    setCollapsedQueueGroups((current) => ({
      ...current,
      [group]: !current[group],
    }));
  }, []);
  const changeSidePanelOperatingDate = useCallback(
    (nextOperatingDate: string, recordHistory = true) => {
      if (nextOperatingDate === operatingDate) return;

      dispatchReceptionCalendarDragClear();
      setCalendarDraftSelection(undefined);
      setPreviousOperatingDate(recordHistory ? operatingDate : undefined);
      setWorkspaceOperatingDate(workspaceId, nextOperatingDate);
      router.replace(
        buildReceptionOperatingDateRoute({
          operatingDate: nextOperatingDate,
          pathname,
          searchParams,
        }),
        { scroll: false },
      );
    },
    [
      operatingDate,
      pathname,
      router,
      searchParams,
      setCalendarDraftSelection,
      setWorkspaceOperatingDate,
      workspaceId,
    ],
  );
  const handleSidePanelDateSelect = useCallback(
    (nextOperatingDate: string) => changeSidePanelOperatingDate(nextOperatingDate),
    [changeSidePanelOperatingDate],
  );
  const handleReturnToPreviousOperatingDate = useCallback(() => {
    if (!previousOperatingDate || previousOperatingDate === operatingDate) return;

    changeSidePanelOperatingDate(previousOperatingDate, false);
  }, [
    changeSidePanelOperatingDate,
    operatingDate,
    previousOperatingDate,
  ]);
  const handleRestoreQueueItem = useCallback(
    async (item: ReceptionQueueSideItem) => {
      if (!isReceptionQueueSideItemRestorable(item) || pendingRestoreId) return;
      if (isReceptionQueueSideItemPast(item, operatingDate, currentOperatingMinutes)) {
        const confirmed = window.confirm(
          "원래 시간이 이미 지났습니다. 그래도 이 접수/예약을 원래 시간대에 복구하시겠습니까?",
        );
        if (!confirmed) return;
      }

      setPendingRestoreId(item.id);
      const result = item.appointment
        ? await submitReceptionAppointmentRestore({
            actorRole: authSession?.role,
            appointmentId: item.appointment.id,
            workspaceId,
          })
        : item.encounter
          ? await submitReceptionEncounterRestore({
              actorRole: authSession?.role,
              encounterId: item.encounter.id,
              workspaceId,
            })
          : ({ ok: false, status: 500, error: "db_write_failed" } as const);
      setPendingRestoreId(null);

      if (result.ok) {
        toast.success("복구가 완료되었습니다.");
        requestReceptionReadRetry();
        return;
      }

      toast.error(getReceptionRestoreFailureMessage(result));
    },
    [
      authSession?.role,
      currentOperatingMinutes,
      operatingDate,
      pendingRestoreId,
      requestReceptionReadRetry,
      workspaceId,
    ],
  );

  return (
    <EmrSubpanel>
      <EmrSubpanelTitle
        title={moduleLabel}
        collapseLabel="사이드 패널 접기"
        onCollapse={() => setModulePanelOpen(false)}
      />
      <EmrSidePanelMiniCalendar
        selectedDate={operatingDate}
        todayDate={defaultOperatingDate}
        rangeStartDate={miniCalendarWeekStartDate}
        rangeEndDate={miniCalendarWeekEndDate}
        previousDate={previousOperatingDate}
        onDateSelect={handleSidePanelDateSelect}
        onReturnToPreviousDate={handleReturnToPreviousOperatingDate}
      />
      <div aria-hidden="true" className="shrink-0 border-t border-[var(--emr-border-default)]" />
      {queueReadStatus === "error" ? (
        <EmrInlineAlert
          className="mx-3 my-2"
          severity="warning"
          title="서버 대기열을 불러오지 못했습니다"
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
              ? "기존 데모 업무는 표시하지 않고 준비된 빈 병원 상태를 유지합니다."
              : "현재 목록은 로컬 데모/세션 데이터 기준으로 유지됩니다.")}
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
          resultCount: visibleQueueItems.length,
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
      <EmrSubpanelBody
        density="queue"
        viewportClassName="scroll-fade-y scroll-fade-8"
      >
        {showQueueLoadingState ? (
          <EmrQueueLoadingState
            placement="panel-center"
            title="접수/예약 정보를 불러오는 중입니다"
          />
        ) : visibleQueueGroups.length ? (
          visibleQueueGroups.map((group) => (
            <ReceptionQueueSideGroup
              key={group.statusGroup}
              collapsed={
                searchQuery.trim()
                  ? false
                  : collapsedQueueGroups[group.statusGroup]
              }
              group={group}
              pendingRestoreId={pendingRestoreId}
              selectedItemId={getReceptionSideSelectedQueueItemId(activeDrawer)}
              onOpenChart={(item) => {
                if (!item.encounter) {
                  setCardActionFeedback({
                    title: "먼저 접수를 생성해야 합니다",
                    body: `${item.patient.name}은 아직 진행 중인 encounter가 없어서 차트로 넘길 live 접수 id가 없습니다.`,
                  });
                  return;
                }

                saveChartLiveEncounterHandoff({
                  encounter: item.encounter,
                  patient: item.patient,
                  primaryGuardian: item.primaryGuardian,
                  veterinarianName: item.veterinarianName,
                });
                selectEncounter(item.encounter.id);
                router.push(
                  buildChartRoute({
                    encounterId: item.encounter.id,
                    patientId: item.patient.id,
                    workspaceId,
                  }),
                );
              }}
              onRestore={handleRestoreQueueItem}
              onSelect={(item) => {
                selectPatient(item.patient.id);
                if (item.encounter) {
                  selectEncounter(item.encounter.id);
                  setRightPanelOpen(true);
                  setActiveDrawer({
                    type: "reception-encounter",
                    id: item.encounter.id,
                  });
                  return;
                }

                if (item.appointment) {
                  selectAppointment(item.appointment.id);
                  setRightPanelOpen(true);
                  setActiveDrawer({
                    type: "reception-appointment",
                    id: item.appointment.id,
                  });
                  return;
                }

                setActiveDrawer({
                  type: "reception-patient",
                  id: item.patient.id,
                  subtitle: item.patient.patientNo,
                });
              }}
              onToggle={() => toggleQueueGroup(group.statusGroup)}
            />
          ))
        ) : searchQuery.trim() ? (
          <EmrListSearchEmptyState
            objectLabel="접수/예약 항목"
            placement="panel-center"
            query={searchQuery}
            onClear={() => setSearchQuery("")}
          />
        ) : (
          <ReceptionEmptyState>
            {emptyStateCopy}
          </ReceptionEmptyState>
        )}
      </EmrSubpanelBody>
    </EmrSubpanel>
  );
}

type ReceptionQueueSideDisplayGroup =
  | "reception"
  | "appointment"
  | "billing_handoff"
  | "exception";

type ReceptionQueueSideItem = {
  appointment?: Appointment;
  encounter?: Encounter;
  id: string;
  kind: "encounter" | "appointment";
  patient: Patient;
  primaryGuardian?: Guardian;
  queueKind: "appointment" | "reception";
  searchText: string;
  sortAt: string;
  statusGroup: ReceptionQueueSideDisplayGroup;
  taskCardItem: EmrTaskQueueCardItem;
  veterinarianName?: string;
};

type ReceptionQueueSideGroup = {
  iconState: EmrSidePanelStateIconState;
  items: ReceptionQueueSideItem[];
  label: string;
  statusGroup: ReceptionQueueSideDisplayGroup;
};

const receptionQueueGroupMeta: Record<
  ReceptionQueueSideDisplayGroup,
  { iconState: EmrSidePanelStateIconState; label: string }
> = {
  reception: { iconState: "in-progress", label: "접수" },
  appointment: { iconState: "to-do", label: "예약" },
  billing_handoff: { iconState: "to-do", label: "수납대기" },
  exception: { iconState: "cancel", label: "취소·노쇼" },
};

function ReceptionQueueSideGroup({
  collapsed,
  group,
  onOpenChart,
  onRestore,
  onSelect,
  onToggle,
  pendingRestoreId,
  selectedItemId,
}: {
  collapsed: boolean;
  group: ReceptionQueueSideGroup;
  onOpenChart: (item: ReceptionQueueSideItem) => void;
  onRestore: (item: ReceptionQueueSideItem) => void;
  onSelect: (item: ReceptionQueueSideItem) => void;
  onToggle: () => void;
  pendingRestoreId: string | null;
  selectedItemId?: string;
}) {
  const colorToken =
    group.statusGroup === "exception"
      ? "--emr-status-danger-bg"
      : group.statusGroup === "billing_handoff"
        ? "--emr-status-warning-bg"
        : "--emr-status-info-bg";

  return (
    <EmrSidePanelCollapsibleGroup
      collapsed={collapsed}
      count={group.items.length}
      countBadgeColorToken={colorToken}
      dataTestId={`reception-queue-group-${group.statusGroup}`}
      indicatorColorToken={colorToken}
      indicatorVisible={false}
      label={group.label}
      onToggle={onToggle}
      stateIconState={group.iconState}
    >
      {group.items.map((item) => {
        const actionItems = getReceptionQueueSideActionItems({
          item,
          onOpenChart,
          onRestore,
          onSelect,
          pendingRestoreId,
        });

        return (
          <EmrTaskQueueCard
            key={item.id}
            item={{
              ...item.taskCardItem,
              actionItems,
              actionMenuDensity: "compact",
            }}
            selected={selectedItemId === item.id}
            onSelect={() => onSelect(item)}
          />
        );
      })}
    </EmrSidePanelCollapsibleGroup>
  );
}

function getReceptionQueueSideActionItems({
  item,
  onOpenChart,
  onRestore,
  onSelect,
  pendingRestoreId,
}: {
  item: ReceptionQueueSideItem;
  onOpenChart: (item: ReceptionQueueSideItem) => void;
  onRestore: (item: ReceptionQueueSideItem) => void;
  onSelect: (item: ReceptionQueueSideItem) => void;
  pendingRestoreId: string | null;
}) {
  const items = [
    {
      key: "open",
      label: item.kind === "appointment" ? "예약 상세 보기" : "접수 상세 보기",
      description: "현재 drawer 열기",
      onSelect: () => onSelect(item),
      testId: `reception-queue-action-open-${item.id}`,
    },
  ];

  if (item.encounter && item.statusGroup === "reception") {
    items.push({
      key: "chart",
      label: "차트 보러가기",
      description: "진료/차트 탭에서 열기",
      onSelect: () => onOpenChart(item),
      testId: `reception-queue-action-chart-${item.id}`,
    });
  }

  if (isReceptionQueueSideItemRestorable(item)) {
    items.push({
      key: "restore",
      label: pendingRestoreId === item.id ? "복구 중" : "복구하기",
      description: "취소 상태를 되돌리기",
      onSelect: () => onRestore(item),
      testId: `reception-queue-action-restore-${item.id}`,
    });
  }

  return items;
}

function getReceptionQueueSideItems({
  allowMockStaffFallback = true,
  appointments,
  guardians,
  patientGuardians,
  patients,
  queueRows,
  staffMembers,
  workspaceId,
}: {
  allowMockStaffFallback?: boolean;
  appointments: Appointment[];
  guardians: Guardian[];
  patientGuardians: PatientGuardian[];
  patients: Patient[];
  queueRows: ReturnType<typeof getReceptionQueueRows>;
  staffMembers: Array<{ displayName: string; id: string }>;
  workspaceId: string;
}) {
  const draftItems = queueRows
    .filter((row) => row.encounter.workspaceId === workspaceId)
    .flatMap((row): ReceptionQueueSideItem[] => {
      const patient =
        patients.find((item) => item.id === row.encounter.patientId) ?? row.patient;
      if (!patient) return [];

      const primaryGuardian = getReceptionQueuePrimaryGuardian({
        guardianId: row.encounter.guardianId,
        guardians,
        patientGuardians,
        patientId: patient.id,
      }) ?? row.primaryGuardian;
      const queueKind = "reception";
      const statusGroup = getReceptionQueueRowSideStatusGroup(row);
      if (!statusGroup) return [];
      const veterinarianName =
        row.veterinarianName ??
        getScopedStaffDisplayName({
          allowMockFallback: allowMockStaffFallback,
          staffMembers,
          userId: row.encounter.primaryVeterinarianId,
        });
      const visitText =
        row.encounter.chiefComplaint ??
        row.encounter.visitPurpose ??
        "접수 내원 목적";
      const sortAt = row.encounter.checkedInAt ?? row.queueEntry.enteredAt;

      return [
        {
          encounter: row.encounter,
          id: `encounter-${row.encounter.id}`,
          kind: "encounter",
          patient,
          primaryGuardian,
          queueKind,
          searchText: getReceptionQueueSideSearchText({
            guardian: primaryGuardian,
            patient,
            veterinarianName,
            visitText,
          }),
          sortAt,
          statusGroup,
          taskCardItem: {
            actionAriaLabel: `${patient.name} 카드 작업`,
            actionTestId: `reception-card-action-${row.encounter.id}`,
            assigneeName: veterinarianName,
            eventKind: isCancelledReceptionQueueRow(row) ? "cancel" : "request",
            eventText:
              isCancelledReceptionQueueRow(row)
                ? `${getShortTime(row.queueEntry.finishedAt ?? sortAt)} 취소`
                : statusGroup === "billing_handoff"
                  ? `${getShortTime(sortAt)} 수납대기`
                : `${getShortTime(sortAt)} 접수`,
            eventTime: getShortTime(sortAt),
            eventActorName: "접수",
            guardianName: primaryGuardian?.name ?? "보호자 미지정",
            patientName: patient.name,
            receptionType: "외래",
            secondLineBadgeLabel: getReceptionQueueSideItemStatusLabel({
              encounter: row.encounter,
              statusGroup,
            }),
            secondLineText: visitText,
            testId: `patient-card-${patient.id}`,
          },
          veterinarianName,
        },
      ];
    });
  const checkedInAppointmentIds = new Set(
    draftItems.flatMap((item) => item.appointment?.id ?? item.encounter?.appointmentId ?? []),
  );
  const appointmentItems = appointments
    .filter((appointment) => !checkedInAppointmentIds.has(appointment.id))
    .flatMap((appointment): ReceptionQueueSideItem[] => {
      const patient = patients.find((item) => item.id === appointment.patientId);
      if (!patient) return [];

      const primaryGuardian = getReceptionQueuePrimaryGuardian({
        guardianId: appointment.guardianId,
        guardians,
        patientGuardians,
        patientId: patient.id,
      });
      const statusGroup = getReceptionAppointmentSideStatusGroup(appointment);
      if (!statusGroup) return [];
      const veterinarianName =
        getScopedStaffDisplayName({
          allowMockFallback: allowMockStaffFallback,
          staffMembers,
          userId: appointment.assignedVeterinarianId,
        });
      const visitText =
        appointment.symptomNote ?? appointment.visitPurpose ?? "예약 내원 목적";

      return [
        {
          appointment,
          id: `appointment-${appointment.id}`,
          kind: "appointment",
          patient,
          primaryGuardian,
          queueKind: "appointment",
          searchText: getReceptionQueueSideSearchText({
            guardian: primaryGuardian,
            patient,
            veterinarianName,
            visitText,
          }),
          sortAt: appointment.scheduledStartAt,
          statusGroup,
          taskCardItem: {
            actionAriaLabel: `${patient.name} 카드 작업`,
            actionTestId: `reception-card-action-${appointment.id}`,
            assigneeName: veterinarianName,
            eventKind: appointment.status === "cancelled" ? "cancel" : "request",
            eventText:
              appointment.status === "cancelled"
                ? `${getShortTime(appointment.updatedAt)} 취소`
                : appointment.status === "no_show"
                  ? `${getShortTime(appointment.updatedAt)} 노쇼`
                : `${getShortTime(appointment.scheduledStartAt)} 예약`,
            eventTime: getShortTime(appointment.scheduledStartAt),
            eventActorName: "예약",
            guardianName: primaryGuardian?.name ?? "보호자 미지정",
            patientName: patient.name,
            receptionType: "예약",
            secondLineBadgeLabel: getReceptionQueueSideItemStatusLabel({
              appointment,
              statusGroup,
            }),
            secondLineText: `${visitText} · ${getAppointmentDurationLabel(appointment)}`,
            testId: `appointment-queue-card-${appointment.id}`,
          },
          veterinarianName,
        },
      ];
    });

  return [...draftItems, ...appointmentItems].sort(
    (a, b) =>
      getReceptionQueueSideStatusOrder(a.statusGroup) -
        getReceptionQueueSideStatusOrder(b.statusGroup) ||
      new Date(a.sortAt).getTime() - new Date(b.sortAt).getTime(),
  );
}

function getReceptionSideQueueItems(
  items: ReceptionQueueSideItem[],
  mode: ReceptionSideListMode,
) {
  if (mode === "reception") {
    return items.filter((item) => item.queueKind === "reception");
  }

  if (mode === "appointment") {
    return items.filter((item) => item.queueKind === "appointment");
  }

  return items;
}

function getReceptionActiveSideQueueItems(
  items: ReceptionQueueSideItem[],
  mode: ReceptionSideListMode,
) {
  return getReceptionSideQueueItems(items, mode).filter(
    (item) =>
      item.statusGroup === "reception" || item.statusGroup === "appointment",
  );
}

function getReceptionSideQueueGroups(items: ReceptionQueueSideItem[]) {
  return (
    ["reception", "appointment", "billing_handoff", "exception"] as const
  ).flatMap((statusGroup) => {
    const groupItems = items.filter((item) => item.statusGroup === statusGroup);
    if (!groupItems.length) return [];

    return [
      {
        ...receptionQueueGroupMeta[statusGroup],
        items: groupItems,
        statusGroup,
      },
    ];
  });
}

function getFilteredReceptionQueueSideItems(
  items: ReceptionQueueSideItem[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return items;

  return items.filter((item) => item.searchText.includes(normalizedQuery));
}

function getReceptionQueueSideItemStatusLabel({
  appointment,
  encounter,
  statusGroup,
}: {
  appointment?: Appointment;
  encounter?: Encounter;
  statusGroup: ReceptionQueueSideDisplayGroup;
}) {
  if (statusGroup === "reception") return "진료대기";
  if (statusGroup === "billing_handoff") return "수납대기";
  if (appointment?.status === "no_show") return "노쇼";
  if (statusGroup === "exception") return "취소";
  if (appointment) return getStatusLabel("appointment", appointment.status);
  if (encounter) return getReceptionEncounterStatusLabel(encounter.status);
  return undefined;
}

function getReceptionQueueSideStatusOrder(statusGroup: ReceptionQueueSideDisplayGroup) {
  if (statusGroup === "reception") return 0;
  if (statusGroup === "appointment") return 1;
  if (statusGroup === "billing_handoff") return 2;
  return 3;
}

function getReceptionQueueRowSideStatusGroup(
  row: ReturnType<typeof getReceptionQueueRows>[number],
): ReceptionQueueSideDisplayGroup | undefined {
  if (isCancelledReceptionQueueRow(row)) return "exception";
  if (
    row.encounter.status === "ready_for_billing" ||
    row.queueEntry.queueType === "billing"
  ) {
    return row.queueEntry.status === "waiting" ? "billing_handoff" : undefined;
  }
  if (
    row.encounter.status === "waiting" &&
    row.queueEntry.status === "waiting" &&
    row.queueEntry.queueType === "consultation"
  ) {
    return "reception";
  }
  return undefined;
}

function getReceptionAppointmentSideStatusGroup(
  appointment: Appointment,
): ReceptionQueueSideDisplayGroup | undefined {
  if (appointment.status === "cancelled" || appointment.status === "no_show") {
    return "exception";
  }
  if (
    appointment.status === "requested" ||
    appointment.status === "confirmed" ||
    appointment.status === "changed"
  ) {
    return "appointment";
  }
  return undefined;
}

function isReceptionQueueSideItemRestorable(item: ReceptionQueueSideItem) {
  return (
    item.statusGroup === "exception" &&
    (item.encounter?.status === "cancelled" ||
      item.appointment?.status === "cancelled")
  );
}

function isCancelledReceptionQueueRow(row: ReturnType<typeof getReceptionQueueRows>[number]) {
  return row.encounter.status === "cancelled" || row.queueEntry.status === "cancelled";
}

function isReceptionDraftCalendarActive(draft: ReceptionDraftCheckIn) {
  return (
    draft.encounter.status !== "cancelled" &&
    draft.queueEntry.status !== "cancelled" &&
    draft.queueEntry.status !== "done"
  );
}

function toStaffCalendarAppointmentStatus(
  status: Appointment["status"],
): StaffCalendarAppointmentWork["status"] {
  if (
    status === "requested" ||
    status === "confirmed" ||
    status === "changed" ||
    status === "checked_in"
  ) {
    return status;
  }
  return "confirmed";
}

function getReceptionQueuePrimaryGuardian({
  guardianId,
  guardians,
  patientGuardians,
  patientId,
}: {
  guardianId?: string;
  guardians: Guardian[];
  patientGuardians: PatientGuardian[];
  patientId: string;
}) {
  const resolvedGuardianId =
    guardianId ??
    patientGuardians.find((link) => link.patientId === patientId && link.isPrimary)
      ?.guardianId;

  return resolvedGuardianId
    ? guardians.find((guardian) => guardian.id === resolvedGuardianId)
    : undefined;
}

function getReceptionQueueSideSearchText({
  guardian,
  patient,
  veterinarianName,
  visitText,
}: {
  guardian?: Guardian;
  patient: Patient;
  veterinarianName?: string;
  visitText: string;
}) {
  return [
    patient.name,
    patient.patientNo,
    patient.breed,
    guardian?.name,
    guardian?.mobilePhone,
    guardian?.phone,
    veterinarianName,
    visitText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getReceptionSideSelectedQueueItemId(
  activeDrawer: { type: string; id: string } | null,
) {
  if (!activeDrawer) return undefined;
  if (activeDrawer.type === "reception-encounter") return `encounter-${activeDrawer.id}`;
  if (activeDrawer.type === "reception-appointment") return `appointment-${activeDrawer.id}`;
  return undefined;
}

function isReceptionQueueSideItemPast(
  item: ReceptionQueueSideItem,
  operatingDate: string,
  currentOperatingMinutes: number,
) {
  const itemDate = getOperatingDateFromIso(item.sortAt);
  const itemMinutes = getOperatingMinutesFromIso(item.sortAt);

  if (!itemDate || itemMinutes === undefined) return false;
  if (itemDate < operatingDate) return true;
  if (itemDate > operatingDate) return false;

  return itemMinutes < currentOperatingMinutes;
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

function ScheduleAppointmentCard({
  fillHeight,
  appointment,
  onClearCalendarTransientSelection,
  onSelect,
  profileDataset,
  veterinarians = allVeterinarians,
}: {
  appointment: Appointment;
  fillHeight?: boolean;
  onClearCalendarTransientSelection: () => void;
  onSelect: () => void;
  profileDataset?: ReceptionProfileDataset;
  veterinarians?: Veterinarian[];
}) {
  const persistedEncounterStatus = useReceptionStore(
    (state) =>
      state.draftCheckIns.find(
        (draft) => draft.appointmentId === appointment.id,
      )?.encounter.status,
  );
  const linkedEncounterStatus =
    persistedEncounterStatus ??
    (isLegacySalesDemoWorkspace(appointment.workspaceId)
      ? mockEncounters.find(
          (encounter) => encounter.appointmentId === appointment.id,
        )?.status
      : undefined);
  const patient = getAppointmentPatient(appointment, profileDataset);
  const guardian = getAppointmentGuardian(appointment, profileDataset);
  const reservationMemo = appointment.visitPurpose ?? appointment.symptomNote;
  const appointmentSummary = reservationMemo ?? "예약";
  const noShow =
    appointment.status === "no_show" || appointment.status === "cancelled";
  const checkedIn = appointment.status === "checked_in";
  const durationMinutes = getAppointmentDurationMinutes(appointment);
  const cardType =
    durationMinutes < 30
      ? "compact"
      : durationMinutes <= 30
        ? "medium"
        : "default";
  const patientLabel = patient?.name ?? "환자 미지정";
  const guardianLabel = guardian?.name ?? "보호자 미지정";
  const timeLabel = getScheduleTimeRangeLabelFromIso({
    endAt: appointment.scheduledEndAt,
    startAt: appointment.scheduledStartAt,
  });

  return (
    <CalendarTaskCard
      accentClassName={getVeterinarianAccentClassName(
        appointment.assignedVeterinarianId,
        veterinarians,
      )}
      accentTestId={`appointment-accent-${appointment.id}`}
      ariaLabel={`${getStatusLabel("appointment", appointment.status)} ${patientLabel} · ${appointmentSummary}`}
      badgeType={noShow ? "노쇼" : "예약"}
      calendarBadgeToneClassName={
        noShow
          ? undefined
          : getVeterinarianCalendarBadgeToneClassName(
              appointment.assignedVeterinarianId,
              veterinarians,
            )
      }
      calendarToneClassName={
        noShow
          ? undefined
          : getVeterinarianCalendarCardToneClassName(
              appointment.assignedVeterinarianId,
              veterinarians,
            )
      }
      description={
        cardType === "default" && !noShow ? reservationMemo : undefined
      }
      disabled={appointment.status !== "confirmed" && !checkedIn}
      fillHeight={fillHeight}
      guardianLabel={guardianLabel}
      onPointerDown={onClearCalendarTransientSelection}
      onClick={onSelect}
      patientLabel={patientLabel}
      purposeLabel={appointmentSummary}
      purposeTestId={`appointment-purpose-${appointment.id}`}
      statusLabel={
        linkedEncounterStatus
          ? getReceptionEncounterStatusLabel(linkedEncounterStatus)
          : getStatusLabel("appointment", appointment.status)
      }
      statusTestId={`appointment-status-${appointment.id}`}
      testId={`appointment-card-${appointment.id}`}
      timeLabel={timeLabel}
      type={cardType}
      statusTone={noShow ? "noShow" : undefined}
    />
  );
}

function ScheduleWalkInQueueCard({
  displayMode = "default",
  draft,
  fillHeight,
  onClearCalendarTransientSelection,
  onSelectEncounter,
  veterinarians = allVeterinarians,
}: {
  displayMode?: "default" | "unassignedCompact";
  draft: ReceptionDraftCheckIn;
  fillHeight?: boolean;
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
  const visitPurpose =
    draft.encounter.visitPurpose ?? draft.encounter.chiefComplaint ?? "현장 접수";
  const scheduledStartAt = getDraftScheduleStartAt(draft);
  const patientLabel = patient?.name ?? "환자 미지정";
  const guardianLabel = guardian?.name ?? "보호자 미지정";
  const timeLabel = getScheduleTimeRangeLabelFromIso({
    durationMinutes:
      draft.durationMinutes ?? getDurationMinutesFromLabel(defaultWalkInDuration),
    startAt: scheduledStartAt,
  });
  const unassignedCompact = displayMode === "unassignedCompact";
  const durationMinutes =
    draft.durationMinutes ?? getDurationMinutesFromLabel(defaultWalkInDuration) ?? 30;
  const cardType = unassignedCompact
    ? "compact"
    : durationMinutes < 30
      ? "compact"
      : durationMinutes <= 30
        ? "medium"
        : "default";

  return (
    <CalendarTaskCard
      accentClassName={getVeterinarianAccentClassName(
        draft.encounter.primaryVeterinarianId,
        veterinarians,
      )}
      accentTestId={`walkin-accent-${draft.encounter.id}`}
      ariaLabel={`${getReceptionEncounterStatusLabel(draft.encounter.status)} ${patientLabel} · ${visitPurpose}`}
      badgeType="외래"
      calendarBadgeToneClassName={
        unassignedCompact
          ? undefined
          : getVeterinarianCalendarBadgeToneClassName(
              draft.encounter.primaryVeterinarianId,
              veterinarians,
            )
      }
      calendarToneClassName={
        unassignedCompact
          ? undefined
          : getVeterinarianCalendarCardToneClassName(
              draft.encounter.primaryVeterinarianId,
              veterinarians,
            )
      }
      className={
        unassignedCompact ? "w-[min(360px,100%)] !flex-none" : undefined
      }
      description={cardType === "default" ? visitPurpose : undefined}
      fillHeight={fillHeight}
      guardianLabel={guardianLabel}
      onPointerDown={onClearCalendarTransientSelection}
      onClick={() => onSelectEncounter(draft)}
      patientLabel={patientLabel}
      purposeLabel={visitPurpose}
      purposeTestId={`walkin-purpose-${draft.encounter.id}`}
      statusLabel={getReceptionEncounterStatusLabel(draft.encounter.status)}
      statusTestId={`walkin-status-${draft.encounter.id}`}
      testId={`walkin-card-${draft.encounter.id}`}
      timeLabel={timeLabel}
      tone={unassignedCompact ? "neutral" : "default"}
      type={cardType}
    />
  );
}

function PositionedScheduleCard({
  children,
  horizontalLayout,
  layout,
}: {
  children: ReactNode;
  horizontalLayout?: CalendarOverlapLayout;
  layout: CalendarTimeRangeLayout;
}) {
  const style: CSSProperties = horizontalLayout
    ? {
        height: layout.height,
        left: `calc(${horizontalLayout.leftPercent}% + 4px)`,
        right: "auto",
        top: layout.top,
        width: `calc(${horizontalLayout.widthPercent}% - 8px)`,
      }
    : { height: layout.height, top: layout.top };

  return (
    <div
      className="pointer-events-auto absolute left-1 right-2 z-20 min-w-0"
      data-overlap-column-count={horizontalLayout?.columnCount}
      data-overlap-column-index={horizontalLayout?.columnIndex}
      style={style}
    >
      {children}
    </div>
  );
}

const receptionDatePickerWeekdays = ["일", "월", "화", "수", "목", "금", "토"];
const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function buildReceptionOperatingDateRoute({
  operatingDate,
  pathname,
  searchParams,
}: {
  operatingDate: string;
  pathname: string;
  searchParams: { toString: () => string };
}) {
  const nextSearchParams = new URLSearchParams(searchParams.toString());

  nextSearchParams.set("date", operatingDate);

  const query = nextSearchParams.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

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

function getReceptionDayHeadingLabel(date: string) {
  const parts = parseIsoDateParts(date);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][
    new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()
  ];

  return `${String(parts.year).slice(2)}년 ${parts.month}월 ${parts.day}일(${weekday})`;
}

function getReceptionDateControlLabels(operatingDate: string) {
  return {
    day: {
      dateLabel: getReceptionDayHeadingLabel(operatingDate),
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

function ReceptionScheduleDateControl({
  operatingSchedule,
  operatingDate,
  view,
}: {
  operatingSchedule: EffectiveOperatingHours;
  operatingDate: string;
  view: ReceptionCalendarView;
}) {
  const dateControlLabel = getReceptionDateControlLabels(operatingDate)[view];

  return (
    <div
      className="flex h-[26px] min-w-0 items-center gap-[var(--clair-spacing-12)] overflow-hidden"
      data-testid="reception-date-control"
    >
      <span
        className="min-w-0 truncate whitespace-nowrap [font-family:var(--clair-typography-heading-2-font-family)] text-[length:var(--clair-typography-headline-1-font-size)] font-[number:var(--clair-typography-heading-2-font-weight)] leading-[26px] tracking-[var(--clair-typography-heading-2-letter-spacing)] text-[var(--clair-color-atomic-neutral-800)] tabular-nums"
        aria-label={`${dateControlLabel.dateLabel} 표시 중`}
        data-testid="reception-date-heading"
      >
        {dateControlLabel.dateLabel}
      </span>
      <Badge
        size="md"
        variant="secondary"
        className="h-[22px] shrink-0 gap-[var(--clair-spacing-4)] rounded-[var(--clair-radius-atomic-6)] border-0 bg-[var(--clair-color-atomic-black-alpha-4)] px-[var(--clair-spacing-8)] py-[3px] emr-text-metadata font-medium leading-4 shadow-none"
        data-testid="reception-business-hours-badge"
      >
        <span className="text-[var(--clair-color-atomic-neutral-500)]">
          업무시간
        </span>
        <span className="text-[var(--clair-color-atomic-sky-500)]">
          {getOperatingScheduleLabel(operatingSchedule)}
        </span>
      </Badge>
    </div>
  );
}

function ScheduleToolbar({
  onOperatingDateChange,
  operatingDate,
  operatingSchedule,
  onCreateReservation,
  onCreateWalkIn,
  onOpenStaffProfile,
  onUnifiedPatientReady,
  onToggleVeterinarian,
  onSelectAllVeterinarians,
  onClearVeterinarians,
  selectedVeterinarianIds,
  staffReadStatus = "ready",
  staffMembers,
  todayDate,
  veterinarians,
  view,
  onViewChange,
}: {
  onOperatingDateChange: (operatingDate: string) => void;
  operatingDate: string;
  operatingSchedule: EffectiveOperatingHours;
  onCreateReservation: () => void;
  onCreateWalkIn: () => void;
  onOpenStaffProfile: (
    staffMember: ReceptionStaffMember,
    opener: HTMLElement | null,
  ) => void;
  onUnifiedPatientReady: (patientId: string) => void;
  onToggleVeterinarian: (veterinarianId: string) => void;
  onSelectAllVeterinarians: () => void;
  onClearVeterinarians: () => void;
  selectedVeterinarianIds: string[];
  staffReadStatus?: WorkspaceStaffReadStatus;
  staffMembers: ReceptionStaffMember[];
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
  const veterinarianLabel =
    staffReadStatus === "loading" || staffReadStatus === "idle"
      ? "수의사 불러오는 중"
      : staffReadStatus === "error" && veterinarians.length === 0
        ? "수의사 확인 필요"
        : veterinarians.length === 0
          ? "근무 수의사 없음"
          : getVeterinarianFilterLabel(selectedVeterinarians);
  const veterinarianFilterDisabled =
    staffReadStatus === "loading" ||
    staffReadStatus === "idle" ||
    veterinarians.length === 0;
  const showingToday = operatingDate === todayDate;

  return (
    <div
      className="flex h-[var(--emr-calendar-toolbar-height)] shrink-0 flex-nowrap items-center justify-between gap-4 overflow-hidden border-b bg-[var(--emr-surface-workspace)] pb-[var(--emr-calendar-toolbar-padding-bottom)] pl-[var(--emr-calendar-toolbar-padding-left)] pr-[var(--emr-calendar-toolbar-padding-right)] pt-[var(--emr-calendar-toolbar-padding-top)]"
      data-testid="schedule-toolbar"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-[var(--clair-spacing-16)]">
        <ReceptionScheduleDateControl
          operatingDate={operatingDate}
          operatingSchedule={operatingSchedule}
          view={view}
        />
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="default"
          className="bg-[var(--emr-surface-panel)] emr-text-metadata font-semibold"
          aria-label="오늘 일자로 이동"
          disabled={showingToday}
          onClick={() => onOperatingDateChange(todayDate)}
        >
          오늘
        </Button>
        <SegmentedControl
          aria-label="접수 캘린더 보기"
          items={calendarViewItems}
          size="md"
          value={view}
          variant="tabs"
          onValueChange={onViewChange}
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={veterinarianFilterDisabled}
            className={buttonVariants({
              variant: "outline",
              size: "default",
              className:
                "min-w-[148px] justify-start border !border-[var(--emr-border-default)] bg-card text-foreground",
            })}
          >
            <CdsActionsSearchIcon data-icon="inline-start" />
            {veterinarianLabel}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[201px] rounded-[var(--clair-radius-atomic-8)] border border-[var(--clair-color-atomic-neutral-200)] bg-[var(--clair-color-atomic-common-100)] p-[var(--clair-spacing-4)] text-[var(--clair-color-atomic-neutral-900)] shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.1)] ring-0"
            data-testid="reception-veterinarian-filter-menu"
          >
            <div className="flex h-[var(--clair-control-height-md)] w-full items-center gap-[var(--clair-spacing-6)] py-[var(--clair-spacing-4)]">
              <div className="flex min-w-0 flex-1 items-center">
                <DropdownMenuItem
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "xs" }),
                    "min-w-0 rounded-[var(--clair-radius-atomic-8)] px-[var(--clair-spacing-6)] text-[var(--emr-type-size-metadata)] leading-[var(--emr-type-leading-metadata)] tracking-[var(--emr-type-tracking-status)]",
                  )}
                  onClick={onSelectAllVeterinarians}
                >
                  전체선택
                </DropdownMenuItem>
              </div>
              <DropdownMenuItem
                className={cn(
                  buttonVariants({ variant: "ghost", size: "xs" }),
                  "min-w-0 rounded-[var(--clair-radius-atomic-8)] px-[var(--clair-spacing-6)] text-[var(--emr-type-size-metadata)] leading-[var(--emr-type-leading-metadata)] tracking-[var(--emr-type-tracking-status)]",
                )}
                onClick={onClearVeterinarians}
              >
                전체해제
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator className="mx-0 my-0 h-[10px] bg-transparent bg-[linear-gradient(to_bottom,transparent_4px,var(--clair-color-atomic-neutral-100)_4px,var(--clair-color-atomic-neutral-100)_5px,transparent_5px)]" />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex h-8 items-center px-2 py-0 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-neutral-600)]">
                오늘 근무 수의사
              </DropdownMenuLabel>
              {todayWorkingVeterinarians.map((veterinarian) => (
                <DropdownMenuCheckboxItem
                  key={veterinarian.id}
                  checked={selectedVeterinarianIds.includes(veterinarian.id)}
                  className="h-8 gap-2 rounded-[4px] px-2 py-[6px] pr-8 text-[14px] font-medium leading-5 tracking-[0.196px] opacity-80"
                  onCheckedChange={() => onToggleVeterinarian(veterinarian.id)}
                >
                  <VeterinarianMenuItemLabel veterinarian={veterinarian} />
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="mx-0 my-0 h-[10px] bg-transparent bg-[linear-gradient(to_bottom,transparent_4px,var(--clair-color-atomic-neutral-100)_4px,var(--clair-color-atomic-neutral-100)_5px,transparent_5px)]" />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex h-8 items-center px-2 py-0 text-[12px] font-medium leading-4 tracking-[0.3px] text-[var(--clair-color-atomic-neutral-600)]">
                그 외 수의사
              </DropdownMenuLabel>
              {otherVeterinarians.map((veterinarian) => (
                <DropdownMenuCheckboxItem
                  key={veterinarian.id}
                  checked={selectedVeterinarianIds.includes(veterinarian.id)}
                  className="h-8 gap-2 rounded-[4px] px-2 py-[6px] pr-8 text-[14px] font-medium leading-5 tracking-[0.196px] opacity-80"
                  onCheckedChange={() => onToggleVeterinarian(veterinarian.id)}
                >
                  <VeterinarianMenuItemLabel veterinarian={veterinarian} />
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <div
          aria-hidden="true"
          className="h-4 w-px shrink-0 bg-[var(--emr-border-subtle)]"
        />
        <NewUnifiedRegistrationButton
          label="환자/보호자 등록"
          onPatientReady={onUnifiedPatientReady}
          size="default"
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            data-testid="schedule-check-in-button"
            render={
              <Button
                type="button"
                variant="default"
                size="default"
                className="px-3 font-semibold"
              />
            }
          >
            <CdsActionsPlusIcon data-icon="inline-start" />
            접수/예약 생성
            <ChevronDownIcon data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              className="h-8 cursor-pointer"
              onClick={onCreateWalkIn}
            >
              접수하기
            </DropdownMenuItem>
            <DropdownMenuItem
              className="h-8 cursor-pointer"
              onClick={onCreateReservation}
            >
              예약하기
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="더보기"
            className={buttonVariants({
              variant: "ghost",
              size: "icon",
            })}
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
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>직원 운영 프로필</DropdownMenuLabel>
              <div className="max-h-56 overflow-y-auto">
                {staffMembers.map((staffMember) => (
                  <DropdownMenuItem
                    key={staffMember.id}
                    className="h-8 cursor-pointer"
                    onClick={(event) =>
                      onOpenStaffProfile(staffMember, event.currentTarget)
                    }
                  >
                    {staffMember.name}
                    {staffMember.title ? ` · ${staffMember.title}` : ""}
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuGroup>
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

function ReceptionReservationDatePicker({
  compact = false,
  minDate,
  onChange,
  value,
}: {
  compact?: boolean;
  minDate: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [pickerMonthDate, setPickerMonthDate] = useState(value);
  const pickerMonthDateParts = parseIsoDateParts(pickerMonthDate);
  const datePickerCells = getReceptionMonthDatePickerCells(pickerMonthDate, value);

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPickerMonthDate(value);
    }
  }, [open, value]);

  const selectDate = (nextDate: string) => {
    if (nextDate < minDate) return;
    onChange(nextDate);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={compact ? "default" : "lg"}
            className={cn(
              "w-full justify-between bg-card px-2.5 text-left font-normal",
              compact &&
                "h-[var(--clair-control-height-md)] bg-[var(--emr-reception-create-field-bg)] emr-control-text font-medium text-[var(--clair-color-atomic-neutral-800)]",
            )}
            aria-label="예약일"
            aria-required="true"
          />
        }
      >
        <span>{formatShortOperatingDate(value)}</span>
        <CdsFilesCalendarIcon aria-hidden="true" className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[292px] gap-3 p-3"
        initialFocus={false}
      >
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
                setPickerMonthDate((current) => addMonthsToIsoDate(current, -1))
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
                setPickerMonthDate((current) => addMonthsToIsoDate(current, 1))
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
              className="h-7 emr-text-micro font-medium leading-7 text-muted-foreground"
            >
              {weekday}
            </span>
          ))}
          {datePickerCells.map((cell) => {
            const disabled = cell.key < minDate;

            return (
              <EmrDatePickerDayButton
                key={cell.key}
                date={cell.key}
                day={cell.day}
                disabled={disabled}
                inMonth={cell.inMonth}
                selected={cell.selected}
                size="md"
                today={cell.key === minDate}
                onClick={() => selectDate(cell.key)}
              />
            );
          })}
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={() => selectDate(minDate)}
          >
            오늘
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

type ReceptionCalendarDraftInput = {
  durationMinutes: number;
  plannedStartAt: string;
  primaryVeterinarianId?: string;
};

function ScheduleDraftSelectionCard({
  selection,
  timeScale,
}: {
  selection: ReceptionCalendarDraftSelection;
  timeScale?: CalendarTimeScale;
}) {
  const startMinutes = getMinutesInDayFromDateTime(selection.plannedStartAt);

  if (startMinutes === undefined) return null;

  const endMinutes = startMinutes + selection.durationMinutes;
  const startHour = Math.floor(startMinutes / 60);
  const selectionTop = timeScale
    ? timeScale.rangeHeight(startHour * 60, startMinutes)
    : ((startMinutes - startHour * 60) / 60) * dayScheduleHourRowHeight;
  const selectionHeight = timeScale
    ? Math.max(36, timeScale.rangeHeight(startMinutes, endMinutes))
    : Math.max(dayScheduleHourRowHeight / (60 / scheduleSlotMinutes), (selection.durationMinutes / 60) * dayScheduleHourRowHeight);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 rounded-[var(--emr-calendar-task-radius)] border border-[var(--emr-calendar-task-reservation-border)] bg-[var(--emr-calendar-task-reservation-bg)] px-[8px] py-[6px] font-['Pretendard'] text-[var(--emr-calendar-task-reservation-text)] shadow-[var(--emr-calendar-task-shadow)]"
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
  currentDate,
  currentOperatingMinutes,
  draftCheckIns,
  hour,
  operatingDate,
  timeScale,
  onAffordancePointerMove,
  onCreateDraft,
  testId,
  veterinarian,
}: {
  affordanceSuspended: boolean;
  calendarDraftSelection?: ReceptionCalendarDraftSelection;
  appointments: Appointment[];
  currentDate: string;
  currentOperatingMinutes: number;
  draftCheckIns: ReceptionDraftCheckIn[];
  hour: number;
  operatingDate: string;
  timeScale: CalendarTimeScale;
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
  const selectionTop = selectionStart !== undefined
    ? timeScale.rangeHeight(hour * 60, selectionStart)
    : 0;
  const selectionHeight =
    selectionStart !== undefined && selectionEnd !== undefined
      ? Math.max(36, timeScale.rangeHeight(selectionStart, selectionEnd))
      : selectionSlotRowHeight;
  const selectionValidation =
    dragState && selectionStart !== undefined && selectionEnd !== undefined
      ? validateReceptionCalendarSelection({
          appointments,
          currentDate,
          currentOperatingMinutes,
          draftCheckIns,
          endMinutes: selectionEnd,
          operatingDate,
          startMinutes: selectionStart,
          timeScale,
          veterinarianId: veterinarian.id,
        })
      : undefined;

  const createDraftFromMinutes = (startMinutes: number, endMinutes: number) => {
    const selection = validateReceptionCalendarSelection({
      appointments,
      currentDate,
      currentOperatingMinutes,
      draftCheckIns,
      endMinutes,
      operatingDate,
      startMinutes,
      timeScale,
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
          timeScale,
        });
        const startSlotValidation = validateReceptionCalendarSelection({
          appointments,
          currentDate,
          currentOperatingMinutes,
          draftCheckIns,
          endMinutes: startMinutes + scheduleSlotMinutes,
          operatingDate,
          startMinutes,
          timeScale,
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
            timeScale,
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
          timeScale,
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
          className="pointer-events-none absolute inset-x-0 z-20 rounded-[var(--emr-calendar-task-radius)] border border-[var(--emr-calendar-task-reservation-border)] bg-[var(--emr-calendar-task-reservation-hover-bg)] px-[8px] py-[6px] font-['Pretendard'] text-[var(--emr-calendar-task-reservation-text)] shadow-[var(--emr-calendar-task-shadow)]"
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
        <ScheduleDraftSelectionCard selection={calendarDraftSelection} timeScale={timeScale} />
      ) : null}
      <CalendarQuarterHourLines hour={hour} scale={timeScale} />
      <div className="relative z-10 flex h-full min-h-0 flex-col">
        {Array.from({ length: scheduleSlotCountPerHour }, (_, index) => {
          const slotMinutes = hour * 60 + index * scheduleSlotMinutes;
          const slotValidation = validateReceptionCalendarSelection({
            appointments,
            currentDate,
            currentOperatingMinutes,
            draftCheckIns,
            endMinutes: slotMinutes + scheduleSlotMinutes,
            operatingDate,
            startMinutes: slotMinutes,
            timeScale,
            veterinarianId: veterinarian.id,
          });

          return (
            <button
              key={slotMinutes}
              type="button"
              aria-label={`${getScheduleTimeLabelFromMinutes(slotMinutes)} ${veterinarian.name} 접수/예약 생성`}
              aria-disabled={!slotValidation.valid}
              className={cn(
                "group/slot flex min-h-0 shrink-0 items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                slotValidation.valid
                  ? "focus-visible:border-[var(--emr-status-info-border)] focus-visible:bg-[var(--emr-status-info-bg)]"
                  : "cursor-default",
              )}
              data-testid={`${testId}-slot-${getScheduleTimeLabelFromMinutes(slotMinutes).replace(":", "")}`}
              style={{ height: timeScale.rangeHeight(slotMinutes, slotMinutes + scheduleSlotMinutes) }}
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

function DayScheduleBoard({
  assignmentVeterinarians,
  calendarDraftSelection,
  currentDate,
  currentOperatingMinutes,
  emptySlotAffordanceSuspended,
  appointments,
  draftCheckIns,
  operatingDate,
  operatingSchedule,
  onEmptySlotAffordancePointerMove,
  onClearCalendarTransientSelection,
  onCreateCalendarDraft,
  onHideVeterinarian,
  onOpenVeterinarianProfile,
  onSelectEncounter,
  onSelectAppointment,
  profileDataset,
  selectedVeterinarians,
}: {
  calendarDraftSelection?: ReceptionCalendarDraftSelection;
  currentDate: string;
  currentOperatingMinutes: number;
  emptySlotAffordanceSuspended: boolean;
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  operatingDate: string;
  operatingSchedule: EffectiveOperatingHours;
  onEmptySlotAffordancePointerMove: () => void;
  onClearCalendarTransientSelection: () => void;
  onCreateCalendarDraft: (draft: ReceptionCalendarDraftInput) => void;
  onHideVeterinarian: (veterinarianId: string) => void;
  onOpenVeterinarianProfile: (
    veterinarian: Veterinarian,
    opener: HTMLButtonElement | null,
  ) => void;
  onSelectEncounter: (draft: ReceptionDraftCheckIn) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  profileDataset: ReceptionProfileDataset;
  selectedVeterinarians: Veterinarian[];
  assignmentVeterinarians: Veterinarian[];
}) {
  const timeScale = createCalendarTimeScale(operatingSchedule);
  const dayScheduleHeight = timeScale.totalHeight;
  const currentTimeOffset = timeScale.minutesToY(currentOperatingMinutes);
  const breakStartMinutes = operatingSchedule.breakStart
    ? toOperatingMinutes(operatingSchedule.breakStart)
    : null;
  const breakEndMinutes = operatingSchedule.breakEnd
    ? toOperatingMinutes(operatingSchedule.breakEnd)
    : null;
  const hasBreakTimeBand =
    operatingSchedule.isOpen &&
    breakStartMinutes !== null &&
    breakEndMinutes !== null &&
    breakStartMinutes < breakEndMinutes;
  const scheduleGridTemplateColumns = `56px repeat(${selectedVeterinarians.length}, minmax(180px, 1fr))`;
  const scheduleBoardMinWidth = `max(100%, calc(56px + ${selectedVeterinarians.length} * 180px))`;
  const assignmentVeterinarianIds = new Set(
    assignmentVeterinarians.map((veterinarian) => veterinarian.id),
  );
  const walkInDrafts = draftCheckIns.filter(
    (draft) =>
      draft.receptionType === "walk_in" &&
      isDraftOnOperatingDate(draft, operatingDate),
  );
  const unassignedWalkIns = walkInDrafts.filter(
    (draft) =>
      !draft.encounter.primaryVeterinarianId ||
      !assignmentVeterinarianIds.has(draft.encounter.primaryVeterinarianId),
  );
  const laneOperationalStatusByVeterinarianId = new Map(
    selectedVeterinarians.map((veterinarian) => [
      veterinarian.id,
      getVeterinarianLaneOperationalStatus({
        appointments,
        currentDate,
        currentOperatingMinutes,
        operatingDate,
        veterinarian,
      }),
    ]),
  );

  return (
    <div
      className="h-full min-h-[720px] overflow-x-auto overflow-y-hidden bg-card"
      data-testid="reception-day-calendar"
    >
      <div
        className="flex h-full min-h-0 flex-col"
        style={{ minWidth: scheduleBoardMinWidth }}
      >
        <div
          className="grid shrink-0 border-b bg-card shadow-xs"
          data-testid="reception-day-calendar-lane-header"
          style={{ gridTemplateColumns: scheduleGridTemplateColumns }}
        >
          <div className="h-[var(--emr-calendar-lane-header-cell-height)] border-r" />
          {selectedVeterinarians.map((veterinarian) => (
            <div
              key={veterinarian.id}
              data-testid="veterinarian-lane-header-cell"
              className="h-[var(--emr-calendar-lane-header-cell-height)] border-r p-[var(--emr-calendar-lane-header-cell-padding)] last:border-r-0"
            >
              <VeterinarianLaneHeader
                onHide={() => onHideVeterinarian(veterinarian.id)}
                onOpenProfile={(opener) =>
                  onOpenVeterinarianProfile(veterinarian, opener)
                }
                selectedLaneCount={selectedVeterinarians.length}
                toneIndex={getVeterinarianToneIndex(
                  veterinarian,
                  assignmentVeterinarians,
                )}
                veterinarian={{
                  ...veterinarian,
                  operationalStatus:
                    laneOperationalStatusByVeterinarianId.get(veterinarian.id),
                }}
              />
            </div>
          ))}
        </div>
        {unassignedWalkIns.length ? (
          <div
            className="grid shrink-0 border-b bg-card/95 shadow-xs backdrop-blur"
            data-testid="unassigned-walkin-row"
            style={{ gridTemplateColumns: scheduleGridTemplateColumns }}
          >
            <div className="flex h-12 items-center justify-center border-r bg-muted/70 emr-text-micro font-medium text-muted-foreground">
              미지정
            </div>
            <div
              className="flex min-w-0 items-center gap-2 overflow-x-auto px-2 py-1.5"
              style={{ gridColumn: "2 / -1" }}
            >
              {unassignedWalkIns.map((draft) => (
                <ScheduleWalkInQueueCard
                  key={draft.encounter.id}
                  displayMode="unassignedCompact"
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

        <ScrollArea
          className="min-h-0 flex-1"
          data-testid="reception-day-calendar-body-scroll"
          viewportClassName="scroll-fade-y scroll-fade-8"
        >
          <div
            className="relative grid"
            style={{ gridTemplateColumns: scheduleGridTemplateColumns }}
          >
        {dayScheduleHours.map((hour) =>
          timeScale.isSelectable(hour * 60, 60) ? null : (
            <div
              key={`off-hour-background-${hour}`}
              className="pointer-events-none absolute inset-x-0 z-0 bg-[var(--clair-color-fill-alternative)]"
              data-testid={`day-off-hour-background-${hour}`}
              style={{
                top: timeScale.minutesToY(hour * 60),
                height: timeScale.rangeHeight(hour * 60, (hour + 1) * 60),
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
                  "absolute left-0 right-0 flex justify-end pr-2 emr-text-micro leading-4 text-muted-foreground tabular-nums",
                  firstLabel && "translate-y-1",
                  lastLabel && "-translate-y-full",
                  !firstLabel && !lastLabel && "-translate-y-1/2",
                )}
                style={{
                  top: timeScale.minutesToY(hour * 60),
                }}
              >
                {getScheduleHourLabel(hour)}
              </div>
            );
          })}
        </div>
        <div className="relative z-10 col-span-full col-start-2 min-w-0">
          {hasBreakTimeBand ? (
            <div
              aria-label={`휴게시간 ${operatingSchedule.breakStart}-${operatingSchedule.breakEnd}`}
              className="pointer-events-none absolute inset-x-0 z-[10] isolate overflow-hidden"
              data-testid="reception-break-time-band"
              role="note"
              style={{
                height: timeScale.rangeHeight(
                  breakStartMinutes,
                  breakEndMinutes,
                ),
                top: timeScale.minutesToY(breakStartMinutes),
              }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 z-0 border-y border-[var(--emr-border-subtle)]"
                data-testid="reception-break-time-hatch"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(120deg, transparent 0, transparent 9px, var(--emr-border-subtle) 9px, var(--emr-border-subtle) 10px)",
                }}
              />
              <span
                className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-[var(--emr-surface-panel)] px-2 py-1 emr-text-micro font-medium text-[var(--emr-text-secondary)]"
                data-testid="reception-break-time-label"
              >
                휴게시간 {operatingSchedule.breakStart}-
                {operatingSchedule.breakEnd}
              </span>
            </div>
          ) : null}
          <CalendarCurrentTimeIndicator
            currentOperatingMinutes={currentOperatingMinutes}
            labelTestId="day-current-time-label"
            style={{
              left: "calc(-1 * var(--emr-calendar-current-time-leading-width))",
              right: 0,
              top: currentTimeOffset,
            }}
            testId="day-current-time-indicator"
          />
          {dayScheduleHours.map((hour) => (
            <div
              key={hour}
              data-testid={`day-hour-row-${hour}`}
              className="grid border-b"
              style={{
                gridTemplateColumns: `repeat(${selectedVeterinarians.length}, minmax(180px, 1fr))`,
                height: timeScale.rangeHeight(hour * 60, (hour + 1) * 60),
              }}
            >
              {selectedVeterinarians.map((veterinarian) => (
                <div
                  key={`${hour}-${veterinarian.id}`}
                  className="relative h-full min-h-0 min-w-0 overflow-visible border-r last:border-r-0"
                >
                  <CalendarQuarterHourLines hour={hour} scale={timeScale} />
                  <ScheduleSelectionCell
                    affordanceSuspended={emptySlotAffordanceSuspended}
                    calendarDraftSelection={calendarDraftSelection}
                    appointments={appointments}
                    currentDate={currentDate}
                    currentOperatingMinutes={currentOperatingMinutes}
                    draftCheckIns={draftCheckIns}
                    hour={hour}
                    operatingDate={operatingDate}
                    timeScale={timeScale}
                    onAffordancePointerMove={
                      onEmptySlotAffordancePointerMove
                    }
                    testId={`day-empty-slot-${hour}-${veterinarian.id}`}
                    veterinarian={veterinarian}
                    onCreateDraft={onCreateCalendarDraft}
                  />
                </div>
              ))}
            </div>
          ))}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 grid"
            style={{
              gridTemplateColumns: `repeat(${selectedVeterinarians.length}, minmax(180px, 1fr))`,
              height: dayScheduleHeight,
            }}
          >
            {selectedVeterinarians.map((veterinarian) => {
              const laneItems = [
                ...appointments
                  .filter(
                    (appointment) =>
                      appointment.assignedVeterinarianId === veterinarian.id,
                  )
                  .map(getAppointmentDayScheduleLaneItem),
                ...walkInDrafts
                  .filter(
                    (draft) =>
                      draft.encounter.primaryVeterinarianId === veterinarian.id,
                  )
                  .map(getDraftDayScheduleLaneItem),
              ].filter(isDayScheduleLaneItem);
              const overlapLayoutById = new Map(
                getCalendarOverlapLayouts(
                  laneItems.map((item) => ({
                    endMinutes: item.block.endMinutes,
                    id: item.id,
                    startMinutes: item.block.startMinutes,
                  })),
                ).map((layout) => [layout.id, layout]),
              );

              return (
                <div
                  key={`day-overlay-${veterinarian.id}`}
                  className="relative min-w-0"
                >
                  {laneItems.map((item) => {
                    const layout = getScheduleCardLayout(item.block, timeScale);
                    if (!layout) return null;
                    const horizontalLayout = overlapLayoutById.get(item.id);
                    const overlappingHorizontalLayout =
                      horizontalLayout && horizontalLayout.columnCount > 1
                        ? horizontalLayout
                        : undefined;

                    return (
                      <PositionedScheduleCard
                        key={`day-positioned-${item.id}`}
                        horizontalLayout={overlappingHorizontalLayout}
                        layout={layout}
                      >
                        {item.kind === "appointment" ? (
                          <ScheduleAppointmentCard
                            fillHeight
                            appointment={item.appointment}
                            profileDataset={profileDataset}
                            veterinarians={selectedVeterinarians}
                            onClearCalendarTransientSelection={
                              onClearCalendarTransientSelection
                            }
                            onSelect={() =>
                              onSelectAppointment(item.appointment)
                            }
                          />
                        ) : (
                          <ScheduleWalkInQueueCard
                            fillHeight
                            draft={item.draft}
                            veterinarians={selectedVeterinarians}
                            onClearCalendarTransientSelection={
                              onClearCalendarTransientSelection
                            }
                            onSelectEncounter={onSelectEncounter}
                          />
                        )}
                      </PositionedScheduleCard>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
          </div>
        </ScrollArea>
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
  profileDataset,
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
  profileDataset: ReceptionProfileDataset;
  veterinarians?: Veterinarian[];
}) {
  const currentTimeOffset = getDayCurrentTimeOffset(currentOperatingMinutes);
  const activeDayIndex = weekDays.findIndex((day) => day.active);
  const dayColumnWidth = "calc((100% - 56px) / 7)";
  const weekScheduleHeight = dayScheduleHours.length * dayScheduleHourRowHeight;
  const weekScheduleMinWidth = "max(100%, 1120px)";
  const walkInDrafts = draftCheckIns.filter(
    (draft) =>
      draft.receptionType === "walk_in" &&
      isDraftOnOperatingDate(draft, operatingDate),
  );

  return (
    <div
      className="h-full min-h-[720px] overflow-x-auto overflow-y-hidden bg-card"
      data-testid="reception-week-calendar"
    >
      <div
        className="flex h-full min-h-0 flex-col"
        style={{ minWidth: weekScheduleMinWidth }}
      >
        <div
          className="grid shrink-0 border-b bg-card shadow-xs"
          data-testid="reception-week-calendar-header"
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

        <ScrollArea
          className="min-h-0 flex-1"
          data-testid="reception-week-calendar-body-scroll"
          viewportClassName="scroll-fade-y scroll-fade-8"
        >
          <div className="relative" style={{ minHeight: weekScheduleHeight }}>
        {activeDayIndex >= 0 ? (
          <CalendarCurrentTimeIndicator
            currentOperatingMinutes={currentOperatingMinutes}
            labelTestId="week-current-time-label"
            style={{
              left: `calc(56px + ${dayColumnWidth} * ${activeDayIndex} - var(--emr-calendar-current-time-leading-width))`,
              top: currentTimeOffset,
              width: `calc(${dayColumnWidth} + var(--emr-calendar-current-time-leading-width))`,
            }}
            testId="week-current-time-indicator"
          />
        ) : null}

        {dayScheduleHours.map((hour) => (
          <div
            key={`week-hour-${hour}`}
            data-testid={`week-hour-row-${hour}`}
            className="grid border-b last:border-b-0"
            style={{
              gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))",
              height: dayScheduleHourRowHeight,
            }}
          >
            <div className="relative border-r">
              <span className="absolute left-0 right-0 top-2 text-center emr-text-micro text-muted-foreground tabular-nums">
                {getScheduleHourLabel(hour)}
              </span>
            </div>
            {weekDays.map((day) => {
              return (
                <div
                  key={`week-${day.day}-${hour}`}
                  className={cn(
                    "relative h-full min-h-0 min-w-0 overflow-hidden border-r last:border-r-0",
                    day.active && "bg-[var(--emr-status-info-bg)]/40",
                    !isBusinessHourRow(hour) &&
                      "bg-[var(--clair-color-fill-alternative)]",
                  )}
                >
                  <CalendarQuarterHourLines />
                  <EmptyReceptionSlotButton
                    affordanceSuspended={emptySlotAffordanceSuspended}
                    ariaLabel={`${day.label} ${getScheduleHourLabel(hour)} 빈 시간 접수 생성`}
                    onAffordancePointerMove={onEmptySlotAffordancePointerMove}
                    testId={`week-empty-slot-${day.day}-${hour}`}
                    onCreateWalkIn={onCreateWalkIn}
                  />
                </div>
              );
            })}
          </div>
        ))}
        <div
          className="pointer-events-none absolute right-0 top-0 z-20 grid"
          style={{
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            height: weekScheduleHeight,
            left: 56,
          }}
        >
          {weekDays.map((day) => {
            const dayAppointments = day.active
              ? appointments
              : appointments.slice(0, 1);
            const dayWalkIns = day.active ? walkInDrafts : [];

            return (
              <div key={`week-overlay-${day.day}`} className="relative min-w-0">
                {dayAppointments.map((appointment) => {
                  const layout = getScheduleCardLayout(
                    getAppointmentScheduleBlock(appointment),
                  );
                  if (!layout) return null;

                  return (
                    <PositionedScheduleCard
                      key={`week-positioned-${day.day}-${appointment.id}`}
                      layout={layout}
                    >
                      <ScheduleAppointmentCard
                        fillHeight
                        appointment={appointment}
                        profileDataset={profileDataset}
                        veterinarians={veterinarians}
                        onClearCalendarTransientSelection={
                          onClearCalendarTransientSelection
                        }
                        onSelect={() => onSelectAppointment(appointment)}
                      />
                    </PositionedScheduleCard>
                  );
                })}
                {dayWalkIns.map((draft) => {
                  const layout = getScheduleCardLayout(
                    getDraftScheduleBlock(draft),
                  );
                  if (!layout) return null;

                  return (
                    <PositionedScheduleCard
                      key={`week-positioned-${day.day}-${draft.encounter.id}`}
                      layout={layout}
                    >
                      <ScheduleWalkInQueueCard
                        fillHeight
                        draft={draft}
                        veterinarians={veterinarians}
                        onClearCalendarTransientSelection={
                          onClearCalendarTransientSelection
                        }
                        onSelectEncounter={onSelectEncounter}
                      />
                    </PositionedScheduleCard>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div
          className="grid"
          style={{ gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" }}
        >
          <div className="relative h-6 border-r">
            <span className="absolute left-0 right-0 -top-3 text-center emr-text-micro text-muted-foreground tabular-nums">
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
        </ScrollArea>
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
          <div className="emr-text-dense font-semibold tabular-nums">{day}</div>
          <div className="mt-3 space-y-1 emr-text-metadata leading-5 text-[var(--emr-text-secondary)] tabular-nums">
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

function CalendarResourceLoadingState() {
  const skeletonLanes = Array.from({ length: 3 }, (_, index) => index);
  const skeletonRows = Array.from({ length: 8 }, (_, index) => index);

  return (
    <div
      aria-busy="true"
      className="flex min-h-[720px] flex-col bg-card"
      data-testid="reception-calendar-resource-loading"
    >
      <span
        className="sr-only"
        data-testid="reception-calendar-resource-loading-status"
        role="status"
      >
        진료 일정을 불러오는 중입니다
      </span>
      <div className="grid border-b bg-card shadow-xs [grid-template-columns:56px_repeat(3,minmax(180px,1fr))]">
        <div className="h-[var(--emr-calendar-lane-header-cell-height)] border-r" />
        {skeletonLanes.map((lane) => (
          <div
            key={`calendar-loading-lane-${lane}`}
            className="h-[var(--emr-calendar-lane-header-cell-height)] border-r p-[var(--emr-calendar-lane-header-cell-padding)] last:border-r-0"
          >
            <div className="flex h-full items-center gap-2 rounded-[var(--emr-calendar-lane-header-radius)] border border-[var(--emr-border-default)] bg-[var(--emr-surface-panel)] px-[var(--emr-calendar-lane-header-padding-x)] py-[var(--emr-calendar-lane-header-padding-y)]">
              <Skeleton className="size-[var(--emr-calendar-lane-avatar-size)] shrink-0 rounded-[var(--emr-calendar-lane-avatar-radius)]" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid flex-1 [grid-template-columns:56px_repeat(3,minmax(180px,1fr))]">
        <div className="relative border-r">
          {skeletonRows.map((row) => (
            <Skeleton
              key={`calendar-loading-time-${row}`}
              className="absolute right-2 h-2.5 w-9"
              style={{ top: 18 + row * 112 }}
            />
          ))}
        </div>
        <div
          className="relative col-span-3 min-w-0"
          data-testid="reception-calendar-resource-loading-grid"
        >
          {skeletonRows.map((row) => (
            <div
              key={`calendar-loading-row-${row}`}
              className="grid h-[112px] border-b [grid-template-columns:repeat(3,minmax(180px,1fr))]"
            >
              {skeletonLanes.map((lane) => (
                <div
                  key={`calendar-loading-cell-${row}-${lane}`}
                  className="relative border-r last:border-r-0"
                />
              ))}
            </div>
          ))}
          <Skeleton className="absolute left-3 top-[112px] h-9 w-[28%] rounded-[var(--emr-calendar-task-radius)]" />
          <Skeleton className="absolute left-[36%] top-[224px] h-9 w-[24%] rounded-[var(--emr-calendar-task-radius)]" />
        </div>
      </div>
    </div>
  );
}

function CalendarResourceEmptyState({
  state,
}: {
  state: Exclude<CalendarResourceState, "loading" | "ready">;
}) {
  const title =
    state === "error"
      ? "수의사 목록을 불러오지 못했습니다"
      : "오늘 근무 수의사가 없습니다";
  const description =
    state === "error"
      ? "근무 수의사 정보가 준비되지 않아 캘린더를 아직 배치할 수 없습니다."
      : "근무 수의사가 등록되면 의사별 캘린더가 표시됩니다.";

  return (
    <div
      className="flex min-h-[720px] items-start justify-center bg-card px-6 pt-24"
      data-testid="reception-calendar-resource-empty"
    >
      <div className="max-w-sm text-center">
        <div className="emr-text-body font-semibold text-[var(--emr-text-primary)]">
          {title}
        </div>
        <div className="mt-2 emr-text-metadata leading-5 text-[var(--emr-text-secondary)]">
          {description}
        </div>
      </div>
    </div>
  );
}

function ReceptionScheduleBoard({
  assignmentVeterinarians,
  calendarDraftSelection,
  calendarResourceState,
  currentDate,
  currentOperatingMinutes,
  emptySlotAffordanceSuspended,
  appointments,
  draftCheckIns,
  operatingDate,
  operatingSchedule,
  onClearCalendarDraft,
  onClearCalendarTransientSelection,
  onEmptySlotAffordancePointerMove,
  onCreateCalendarDraft,
  onCreateWalkIn,
  onHideVeterinarian,
  onOpenVeterinarianProfile,
  onSelectEncounter,
  onSelectAppointment,
  profileDataset,
  selectedVeterinarians,
  view,
}: {
  assignmentVeterinarians: Veterinarian[];
  calendarDraftSelection?: ReceptionCalendarDraftSelection;
  calendarResourceState: CalendarResourceState;
  currentDate: string;
  currentOperatingMinutes: number;
  emptySlotAffordanceSuspended: boolean;
  appointments: Appointment[];
  draftCheckIns: ReceptionDraftCheckIn[];
  operatingDate: string;
  operatingSchedule: EffectiveOperatingHours;
  onClearCalendarDraft: () => void;
  onClearCalendarTransientSelection: () => void;
  onEmptySlotAffordancePointerMove: () => void;
  onCreateCalendarDraft: (draft: ReceptionCalendarDraftInput) => void;
  onCreateWalkIn: () => void;
  onHideVeterinarian: (veterinarianId: string) => void;
  onOpenVeterinarianProfile: (
    veterinarian: Veterinarian,
    opener: HTMLButtonElement | null,
  ) => void;
  onSelectEncounter: (draft: ReceptionDraftCheckIn) => void;
  onSelectAppointment: (appointment: Appointment) => void;
  profileDataset: ReceptionProfileDataset;
  selectedVeterinarians: Veterinarian[];
  view: ReceptionCalendarView;
}) {
  const calendarFrameRef = useRef<HTMLElement | null>(null);
  const centeredCalendarScrollKeyRef = useRef<string | null>(null);
  const calendarInitialScrollLockTimerRef = useRef<number | null>(null);
  const userScrolledCalendarKeyRef = useRef<string | null>(null);
  const [showResourceSkeleton, setShowResourceSkeleton] = useState(false);

  const calendarInitialScrollKey = `${operatingDate}:${view}`;
  const markCalendarUserScrolled = useCallback(() => {
    userScrolledCalendarKeyRef.current = calendarInitialScrollKey;
    centeredCalendarScrollKeyRef.current = calendarInitialScrollKey;

    if (calendarInitialScrollLockTimerRef.current !== null) {
      window.clearTimeout(calendarInitialScrollLockTimerRef.current);
      calendarInitialScrollLockTimerRef.current = null;
    }
  }, [calendarInitialScrollKey]);
  const markCalendarUserScrolledByKeyboard = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (
        [
          "ArrowDown",
          "ArrowUp",
          "End",
          "Home",
          "PageDown",
          "PageUp",
          " ",
        ].includes(event.key)
      ) {
        markCalendarUserScrolled();
      }
    },
    [markCalendarUserScrolled],
  );

  useEffect(() => {
    if (view === "month" || calendarResourceState !== "ready") return;

    if (
      centeredCalendarScrollKeyRef.current === calendarInitialScrollKey ||
      userScrolledCalendarKeyRef.current === calendarInitialScrollKey
    ) {
      return;
    }

    const frame = calendarFrameRef.current;
    if (!frame) return;

    const animationFrameIds: number[] = [];
    const timeoutIds: number[] = [];
    let viewportResizeObserver: ResizeObserver | null = null;
    const requestAnimationFrameForInitialScroll = (
      callback: FrameRequestCallback,
    ) => {
      const animationFrameId = window.requestAnimationFrame(callback);
      animationFrameIds.push(animationFrameId);
    };
    const scheduleInitialScrollLock = () => {
      if (calendarInitialScrollLockTimerRef.current !== null) {
        window.clearTimeout(calendarInitialScrollLockTimerRef.current);
      }
      calendarInitialScrollLockTimerRef.current = window.setTimeout(() => {
        centeredCalendarScrollKeyRef.current = calendarInitialScrollKey;
        calendarInitialScrollLockTimerRef.current = null;
        viewportResizeObserver?.disconnect();
        viewportResizeObserver = null;
      }, 600);
    };
    const centerCurrentTimeIndicator = () => {
      if (
        centeredCalendarScrollKeyRef.current === calendarInitialScrollKey ||
        userScrolledCalendarKeyRef.current === calendarInitialScrollKey
      ) {
        return;
      }

      const viewport = frame.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]',
      );
      const currentTimeIndicator = frame.querySelector<HTMLElement>(
        view === "week"
          ? '[data-testid="week-current-time-indicator"]'
          : '[data-testid="day-current-time-indicator"]',
      );

      if (!viewport || !currentTimeIndicator) return;

      const viewportBox = viewport.getBoundingClientRect();
      const indicatorBox = currentTimeIndicator.getBoundingClientRect();
      const indicatorLineCenter =
        indicatorBox.top + currentTimeIndicator.clientHeight / 2;
      const centeredScrollTop =
        viewport.scrollTop +
        indicatorLineCenter -
        viewportBox.top -
        viewport.clientHeight / 2;
      const maxScrollTop = viewport.scrollHeight - viewport.clientHeight;

      viewport.scrollTop = Math.max(
        0,
        Math.min(centeredScrollTop, maxScrollTop),
      );

      if (!viewportResizeObserver && "ResizeObserver" in window) {
        viewportResizeObserver = new ResizeObserver(() => {
          centerCurrentTimeIndicator();
        });
        viewportResizeObserver.observe(viewport);
      }
      scheduleInitialScrollLock();
    };

    requestAnimationFrameForInitialScroll(() => {
      requestAnimationFrameForInitialScroll(centerCurrentTimeIndicator);
    });
    timeoutIds.push(
      window.setTimeout(centerCurrentTimeIndicator, 150),
      window.setTimeout(centerCurrentTimeIndicator, 400),
    );

    return () => {
      animationFrameIds.forEach((animationFrameId) => {
        window.cancelAnimationFrame(animationFrameId);
      });
      timeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      viewportResizeObserver?.disconnect();
      if (calendarInitialScrollLockTimerRef.current !== null) {
        window.clearTimeout(calendarInitialScrollLockTimerRef.current);
        calendarInitialScrollLockTimerRef.current = null;
      }
    };
  }, [
    calendarInitialScrollKey,
    calendarResourceState,
    currentOperatingMinutes,
    view,
  ]);

  useEffect(() => {
    if (calendarResourceState !== "loading") {
      const timeoutId = window.setTimeout(() => {
        setShowResourceSkeleton(false);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    const timeoutId = window.setTimeout(() => {
      setShowResourceSkeleton(true);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [calendarResourceState]);

  const calendarBoard =
    calendarResourceState === "loading" ? (
      showResourceSkeleton ? (
        <CalendarResourceLoadingState />
      ) : (
        <div
          aria-busy="true"
          aria-label="진료 일정을 불러오는 중입니다"
          className="min-h-[720px] bg-card"
          data-testid="reception-calendar-resource-pending"
        />
      )
    ) : calendarResourceState === "ready" ? (
      <>
        {view === "day" ? (
          <DayScheduleBoard
            assignmentVeterinarians={assignmentVeterinarians}
            calendarDraftSelection={calendarDraftSelection}
            currentDate={currentDate}
            currentOperatingMinutes={currentOperatingMinutes}
            emptySlotAffordanceSuspended={emptySlotAffordanceSuspended}
            appointments={appointments}
            draftCheckIns={draftCheckIns}
            operatingDate={operatingDate}
            operatingSchedule={operatingSchedule}
            onEmptySlotAffordancePointerMove={
              onEmptySlotAffordancePointerMove
            }
            onClearCalendarTransientSelection={
              onClearCalendarTransientSelection
            }
            onCreateCalendarDraft={onCreateCalendarDraft}
            onHideVeterinarian={onHideVeterinarian}
            onOpenVeterinarianProfile={onOpenVeterinarianProfile}
            profileDataset={profileDataset}
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
            profileDataset={profileDataset}
            veterinarians={selectedVeterinarians}
            onSelectAppointment={onSelectAppointment}
            onSelectEncounter={onSelectEncounter}
            onCreateWalkIn={onCreateWalkIn}
          />
        ) : null}
        {view === "month" ? (
          <MonthScheduleBoard appointmentCount={appointments.length} />
        ) : null}
      </>
    ) : (
      <CalendarResourceEmptyState state={calendarResourceState} />
    );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden">
      <section
        ref={calendarFrameRef}
        className="min-h-0 min-w-0 overflow-hidden bg-card shadow-[var(--clair-shadow-xs)]"
        data-testid="reception-calendar-frame"
        onKeyDownCapture={markCalendarUserScrolledByKeyboard}
        onPointerDown={() => {
          if (calendarDraftSelection) onClearCalendarDraft();
        }}
        onTouchMoveCapture={markCalendarUserScrolled}
        onWheelCapture={markCalendarUserScrolled}
      >
        {calendarResourceState === "ready" &&
        (view === "day" || view === "week") ? (
          calendarBoard
        ) : (
          <ScrollArea className="h-full">
            {calendarBoard}
          </ScrollArea>
        )}
      </section>
    </div>
  );
}

export function ReceptionContent() {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const calendarViewByWorkspace = useReceptionStore(
    (state) => state.calendarViewByWorkspace,
  );
  const [emptySlotAffordanceSuspended, setEmptySlotAffordanceSuspended] =
    useState(false);
  const [selectedVeterinarianIds, setSelectedVeterinarianIds] = useState(() =>
    allVeterinarians.map((veterinarian) => veterinarian.id),
  );
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
  const setWorkspaceCalendarView = useReceptionStore(
    (state) => state.setWorkspaceCalendarView,
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
  const clearModuleRefreshAction = useLayoutStore(
    (state) => state.clearModuleRefreshAction,
  );
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
  const setModuleRefreshAction = useLayoutStore(
    (state) => state.setModuleRefreshAction,
  );
  const authSession = useMockAuthStore((state) => state.session);
  const scenario = getDemoScenarioFromParams(searchParams);
  const queryPatientId = searchParams.get("patientId") ?? scenario?.patientId;
  const queryEncounterId =
    searchParams.get("encounterId") ?? scenario?.encounterId;
  const [manualReceptionRefreshing, setManualReceptionRefreshing] =
    useState(false);
  const receptionReadRequestSeqRef = useRef(0);
  const receptionReadInFlightRef = useRef<{
    key: string;
    promise: Promise<ReceptionRefreshResult>;
  } | null>(null);
  const staffReadInFlightRef = useRef<{
    key: string;
    promise: Promise<void>;
  } | null>(null);
  const workspaceId = resolveWorkspaceRouteParam(params.workspaceId);
  const calendarView = calendarViewByWorkspace[workspaceId] ?? "day";
  const defaultOperatingDate = getWorkspaceOperatingDate(workspaceId);
  const operatingDateOverride = useReceptionStore(
    (state) => state.operatingDateByWorkspace[workspaceId],
  );
  const routeDateParam = searchParams.get("date");
  const routeOperatingDate = isIsoOperatingDate(routeDateParam)
    ? routeDateParam
    : undefined;
  const operatingDate =
    routeDateParam === null
      ? (operatingDateOverride ?? defaultOperatingDate)
      : (routeOperatingDate ?? defaultOperatingDate);
  const [operatingSchedule, setOperatingSchedule] = useState<EffectiveOperatingHours>(() =>
    resolveEffectiveOperatingHours(createInitialHospitalBasicSettingsDraft(), operatingDate),
  );
  const selectedDateOperatingSchedule = operatingSchedule.date === operatingDate
    ? operatingSchedule
    : resolveEffectiveOperatingHours(createInitialHospitalBasicSettingsDraft(), operatingDate);
  const currentOperatingMinutes = getWorkspaceCurrentOperatingMinutes(workspaceId);
  const liveStaffSourceEnabled = isPreparedEmptyClinicWorkspace(workspaceId) ||
    (workspaceId === "workspace-clinical-master-pilot-v1" && shouldUseSupabaseAuth());
  const staffResourceKey = getReceptionStaffResourceKey({
    operatingDate,
    workspaceId,
  });
  const staffResource = useReceptionStaffResourceStore(
    (state) => state.resourcesByKey[staffResourceKey],
  );
  const setStaffResourceLoading = useReceptionStaffResourceStore(
    (state) => state.setResourceLoading,
  );
  const setStaffResourceResult = useReceptionStaffResourceStore(
    (state) => state.setResourceResult,
  );
  const workspaceVeterinarians =
    staffResource?.veterinarians ?? emptyReceptionStaffVeterinarians;
  const workspaceStaffMembers =
    staffResource?.staff ?? emptyReceptionStaffMembers;
  const workspaceStaffReadStatus: WorkspaceStaffReadStatus = liveStaffSourceEnabled
    ? (staffResource?.status ?? "idle")
    : "ready";
  const veterinarians = liveStaffSourceEnabled
    ? workspaceVeterinarians
    : allVeterinarians;
  const staffMembers = liveStaffSourceEnabled
    ? workspaceStaffMembers
    : allReceptionStaff;
  const veterinarianIds = useMemo(
    () => veterinarians.map((veterinarian) => veterinarian.id),
    [veterinarians],
  );
  const effectiveSelectedVeterinarianIds = useMemo(() => {
    const selectedIds = selectedVeterinarianIds.filter((id) =>
      veterinarianIds.includes(id),
    );

    return selectedVeterinarianIds.length === 0
      ? []
      : selectedIds.length > 0
        ? selectedIds
        : veterinarianIds;
  }, [selectedVeterinarianIds, veterinarianIds]);
  const workspaceDraftCheckIns = useMemo(
    () =>
      draftCheckIns.filter(
        (draft) => draft.encounter.workspaceId === workspaceId,
      ),
    [draftCheckIns, workspaceId],
  );
  const profileDataset = useMemo(
    () => ({ guardians, patientGuardians, patients }),
    [guardians, patientGuardians, patients],
  );
  const calendarDraftCheckIns = useMemo(
    () => workspaceDraftCheckIns.filter(isReceptionDraftCalendarActive),
    [workspaceDraftCheckIns],
  );
  const appointments = useMemo(
    () =>
      getTodayAppointments(
        calendarDraftCheckIns,
        persistedCalendarAppointments,
        {
          operatingDate,
          workspaceId,
        },
      ),
    [
      calendarDraftCheckIns,
      operatingDate,
      persistedCalendarAppointments,
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
  const calendarResourceState: CalendarResourceState = !liveStaffSourceEnabled
    ? "ready"
    : workspaceStaffReadStatus === "loading" || workspaceStaffReadStatus === "idle"
      ? "loading"
      : workspaceStaffReadStatus === "error" && veterinarians.length === 0
        ? "error"
        : veterinarians.length === 0
          ? "empty"
          : "ready";
  const visibleAppointments = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.status !== "cancelled" &&
          appointment.assignedVeterinarianId &&
          effectiveSelectedVeterinarianIds.includes(
            appointment.assignedVeterinarianId,
          ),
      ),
    [appointments, effectiveSelectedVeterinarianIds],
  );
  const lastMessageDelivery = messageDeliveries.at(-1);
  const toggleVeterinarian = (veterinarianId: string) => {
    setSelectedVeterinarianIds((current) => {
      const currentInWorkspace = current.filter((id) =>
        veterinarianIds.includes(id),
      );

      if (currentInWorkspace.includes(veterinarianId)) {
        return currentInWorkspace.length > 1
          ? currentInWorkspace.filter((id) => id !== veterinarianId)
          : currentInWorkspace;
      }

      return [...currentInWorkspace, veterinarianId];
    });
  };
  const openStaffOperationalProfile = useCallback(
    (staffMember: ReceptionStaffMember | Veterinarian, opener: HTMLElement | null) => {
      const returnFocusId =
        opener?.id || `staff-operational-profile-trigger-${staffMember.id}`;
      if (opener && !opener.id) opener.id = returnFocusId;

      setActiveDrawer({
        type: "staff-operational-profile",
        id: staffMember.id,
        rightPanelPresentation: {
          gap: 10,
          mobileFullWidth: true,
          persistToUrl: false,
          returnFocusId,
          width: 380,
        },
      });
      setRightPanelOpen(true);
    },
    [setActiveDrawer, setRightPanelOpen],
  );
  function clearCalendarTransientSelection() {
    dispatchReceptionCalendarDragClear();
    setCalendarDraftSelection(undefined);
  }
  const openReceptionRightPanelDrawer = useCallback(
    (drawer: NonNullable<DrawerState>) => {
      setRightPanelOpen(true);
      setActiveDrawer(drawer);
    },
    [setActiveDrawer, setRightPanelOpen],
  );
  useEffect(() => {
    if (routeDateParam === null) return;

    const nextOperatingDate = routeOperatingDate ?? defaultOperatingDate;
    if (routeDateParam !== nextOperatingDate) {
      router.replace(
        buildReceptionOperatingDateRoute({
          operatingDate: nextOperatingDate,
          pathname,
          searchParams,
        }),
        { scroll: false },
      );
    }
    if (operatingDateOverride === nextOperatingDate) return;

    dispatchReceptionCalendarDragClear();
    setCalendarDraftSelection(undefined);
    setWorkspaceOperatingDate(workspaceId, nextOperatingDate);
  }, [
    defaultOperatingDate,
    operatingDateOverride,
    pathname,
    routeDateParam,
    routeOperatingDate,
    router,
    searchParams,
    setCalendarDraftSelection,
    setWorkspaceOperatingDate,
    workspaceId,
  ]);

  const handleOperatingDateChange = (nextOperatingDate: string) => {
    clearCalendarTransientSelection();
    setWorkspaceOperatingDate(workspaceId, nextOperatingDate);
    router.replace(
      buildReceptionOperatingDateRoute({
        operatingDate: nextOperatingDate,
        pathname,
        searchParams,
      }),
      { scroll: false },
    );
  };
  const handleCalendarViewChange = (nextView: ReceptionCalendarView) => {
    setWorkspaceCalendarView(workspaceId, nextView);
  };
  const handleSelectAppointment = (appointment: Appointment) => {
    clearCalendarTransientSelection();
    selectAppointment(appointment.id);
    openReceptionRightPanelDrawer({
      type: "reception-appointment",
      id: appointment.id,
    });
  };
  const handleSelectEncounterFromSchedule = (draft: ReceptionDraftCheckIn) => {
    clearCalendarTransientSelection();
    selectPatient(draft.encounter.patientId);
    selectEncounter(draft.encounter.id);
    openReceptionRightPanelDrawer({
      type: "reception-encounter",
      id: draft.encounter.id,
    });
  };
  const openWalkInDialog = () => {
    setCalendarDraftSelection(undefined);
    openReceptionRightPanelDrawer({
      type: "reception-form",
      id: "walk-in",
    });
  };
  const openReservationDialog = () => {
    setCalendarDraftSelection(undefined);
    openReceptionRightPanelDrawer({
      type: "reception-reservation-form",
      id: "new",
    });
  };
  const openCalendarDraftDrawer = (draft: ReceptionCalendarDraftInput) => {
    const draftOperatingDate = getOperatingDateFromIso(draft.plannedStartAt);
    const draftOperatingMinutes = getOperatingMinutesFromIso(draft.plannedStartAt);
    const safeStartKey =
      draftOperatingDate && draftOperatingMinutes !== undefined
        ? `${draftOperatingDate}m${draftOperatingMinutes}`
        : draft.plannedStartAt.replace(/[^a-zA-Z0-9_-]/g, "-");
    const id = `calendar-draft-${safeStartKey}-${draft.durationMinutes}-${draft.primaryVeterinarianId ?? "unassigned"}`;

    dispatchReceptionCalendarDragClear();
    if (!draftOperatingDate || draftOperatingDate < defaultOperatingDate) {
      setCalendarDraftSelection(undefined);
      toast.error("과거 날짜에는 접수/예약을 만들 수 없습니다.");
      return;
    }

    setCalendarDraftSelection({ ...draft, id });
    if (draftOperatingDate > defaultOperatingDate) {
      openReceptionRightPanelDrawer({
        type: "reception-reservation-form",
        id,
        subtitle: `${formatShortOperatingDate(draftOperatingDate)} · ${getShortTime(
          draft.plannedStartAt,
        )} · ${draft.durationMinutes}분`,
      });
      return;
    }

    openReceptionRightPanelDrawer({
      type: "reception-form",
      id,
      subtitle: `${getShortTime(draft.plannedStartAt)} · ${draft.durationMinutes}분`,
    });
  };
  const clearCalendarDraft = () => {
    setCalendarDraftSelection(undefined);
  };

  useEffect(() => {
    if (!calendarDraftSelection) return;

    const activeCalendarDraftDrawer =
      activeDrawer &&
      (activeDrawer.type === "reception-form" ||
        activeDrawer.type === "reception-reservation-form") &&
      activeDrawer.id === calendarDraftSelection.id;

    if (!activeCalendarDraftDrawer) {
      setCalendarDraftSelection(undefined);
    }
  }, [
    activeDrawer,
    calendarDraftSelection,
    setCalendarDraftSelection,
  ]);

  const refreshWorkspaceStaff = useCallback(
    ({
      showLoading = false,
      skipIfFreshMs = 0,
    }: {
      showLoading?: boolean;
      skipIfFreshMs?: number;
    } = {}) => {
      if (!liveStaffSourceEnabled) return Promise.resolve();

      const currentResource =
        useReceptionStaffResourceStore.getState().resourcesByKey[staffResourceKey];
      if (
        skipIfFreshMs > 0 &&
        currentResource?.updatedAt &&
        Date.now() - currentResource.updatedAt < skipIfFreshMs
      ) {
        return Promise.resolve();
      }

      const inFlight = staffReadInFlightRef.current;
      if (inFlight?.key === staffResourceKey) return inFlight.promise;

      if (showLoading) setStaffResourceLoading(staffResourceKey);
      const requestPromise = loadWorkspaceStaff({
        actorId: authSession?.id,
        operatingDate,
        workspaceId,
      }).then((result) => {
        setStaffResourceResult(staffResourceKey, {
          actorUserId: result.ok ? result.actorUserId : undefined,
          status: result.ok ? "ready" : "error",
          staff: mapWorkspaceStaffToReceptionStaff(result),
          veterinarians: mapWorkspaceStaffToVeterinarians(result),
        });
      });

      staffReadInFlightRef.current = {
        key: staffResourceKey,
        promise: requestPromise,
      };
      void requestPromise.finally(() => {
        if (staffReadInFlightRef.current?.promise === requestPromise) {
          staffReadInFlightRef.current = null;
        }
      });

      return requestPromise;
    },
    [
      authSession?.id,
      liveStaffSourceEnabled,
      operatingDate,
      setStaffResourceLoading,
      setStaffResourceResult,
      staffResourceKey,
      workspaceId,
    ],
  );

  useEffect(() => {
    if (!liveStaffSourceEnabled) return;

    const refreshStaff = () => void refreshWorkspaceStaff();
    const refreshStaffOnFocus = () =>
      void refreshWorkspaceStaff({ skipIfFreshMs: 30_000 });

    void refreshWorkspaceStaff({ showLoading: true, skipIfFreshMs: 30_000 });
    const refreshInterval = window.setInterval(refreshStaff, 60_000);
    window.addEventListener("focus", refreshStaffOnFocus);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshStaffOnFocus);
    };
  }, [liveStaffSourceEnabled, refreshWorkspaceStaff]);

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
    ({ showLoading = false }: { showLoading?: boolean } = {}) => {
      const refreshKey = `${workspaceId}\u0000${operatingDate}`;
      const inFlight = receptionReadInFlightRef.current;
      if (inFlight?.key === refreshKey) return inFlight.promise;

      const requestSeq = receptionReadRequestSeqRef.current + 1;
      receptionReadRequestSeqRef.current = requestSeq;
      const isLatestRequest = () => receptionReadRequestSeqRef.current === requestSeq;

      const refreshPromise = (async (): Promise<ReceptionRefreshResult> => {
        if (showLoading) {
          setReceptionCalendarReadStatus("loading");
          setReceptionQueueReadStatus("loading");
        }

        const { calendarResult, queueResult } =
          liveStaffSourceEnabled && shouldUseSupabaseAuth()
            ? await loadReceptionSnapshot({
                actorId: authSession?.id,
                date: operatingDate,
                workspaceId,
              })
            : await Promise.all([
                loadReceptionCalendar({
                  actorId: authSession?.id,
                  date: operatingDate,
                  workspaceId,
                }),
                loadReceptionQueue({
                  actorId: authSession?.id,
                  date: operatingDate,
                  workspaceId,
                }),
              ]).then(([calendarResult, queueResult]) => ({
                calendarResult,
                queueResult,
              }));

        if (!isLatestRequest()) {
          return { ok: false, stale: true };
        }

        const readbackRecords = getReceptionReadbackRecords({
          calendarResult,
          queueResult,
        });
        const embeddedLookupItems = getEmbeddedReadbackLookupItems(readbackRecords);

        embeddedLookupItems.forEach(applyPatientGuardianLookupItem);

        const currentPatients = usePatientProfileStore.getState().patients;
        const knownPatientIds = new Set([
          ...currentPatients.map((patient) => patient.id),
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

          if (!isLatestRequest()) {
            return { ok: false, stale: true };
          }

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
          if (calendarResult.operatingSchedule) {
            setOperatingSchedule(calendarResult.operatingSchedule);
          }
        }

        if (!queueResult.ok) {
          setReceptionQueueReadStatus(
            "error",
            getReceptionReadFailureMessage(queueResult, workspaceId),
          );
        } else {
          applyPersistedReceptionQueue(queueResult.queue, queueResult.summary);
        }

        return { ok: calendarResult.ok && queueResult.ok };
      })();

      receptionReadInFlightRef.current = {
        key: refreshKey,
        promise: refreshPromise,
      };
      void refreshPromise.then(
        () => {
          if (receptionReadInFlightRef.current?.promise === refreshPromise) {
            receptionReadInFlightRef.current = null;
          }
        },
        () => {
          if (receptionReadInFlightRef.current?.promise === refreshPromise) {
            receptionReadInFlightRef.current = null;
          }
        },
      );

      return refreshPromise;
    },
    [
      applyPatientGuardianLookupItem,
      applyPersistedReceptionCalendar,
      applyPersistedReceptionQueue,
      authSession?.id,
      liveStaffSourceEnabled,
      operatingDate,
      setReceptionCalendarReadStatus,
      setReceptionQueueReadStatus,
      setOperatingSchedule,
      workspaceId,
    ],
  );

  const refreshReceptionManually = useCallback(async () => {
    if (manualReceptionRefreshing) return;

    setManualReceptionRefreshing(true);
    try {
      const result = await refreshReceptionReads({ showLoading: false });
      if (result.stale) return;
      if (result.ok) {
        toast.success("접수/예약 정보를 새로고침했습니다.");
      } else {
        toast.error("접수/예약 새로고침에 실패했습니다.");
      }
    } finally {
      setManualReceptionRefreshing(false);
    }
  }, [manualReceptionRefreshing, refreshReceptionReads]);

  useEffect(() => {
    setModuleRefreshAction("reception", {
      isRefreshing: manualReceptionRefreshing,
      label: "접수/예약 새로고침",
      onRefresh: refreshReceptionManually,
    });

    return () => clearModuleRefreshAction("reception");
  }, [
    clearModuleRefreshAction,
    manualReceptionRefreshing,
    refreshReceptionManually,
    setModuleRefreshAction,
  ]);

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
      if (document.visibilityState !== "visible") return;
      void refreshReceptionReads();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const intervalId = window.setInterval(refresh, 60_000);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(intervalId);
    };
  }, [liveStaffSourceEnabled, refreshReceptionReads]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ScheduleToolbar
        onOperatingDateChange={handleOperatingDateChange}
        operatingDate={operatingDate}
        operatingSchedule={selectedDateOperatingSchedule}
        view={calendarView}
        onViewChange={handleCalendarViewChange}
        selectedVeterinarianIds={effectiveSelectedVeterinarianIds}
        onSelectAllVeterinarians={() => setSelectedVeterinarianIds(veterinarianIds)}
        onClearVeterinarians={() => setSelectedVeterinarianIds([])}
        staffReadStatus={workspaceStaffReadStatus}
        staffMembers={staffMembers}
        todayDate={defaultOperatingDate}
        veterinarians={veterinarians}
        onToggleVeterinarian={toggleVeterinarian}
        onCreateReservation={openReservationDialog}
        onCreateWalkIn={openWalkInDialog}
        onOpenStaffProfile={openStaffOperationalProfile}
        onUnifiedPatientReady={(patientId) => {
          selectPatient(patientId);
          setCalendarDraftSelection(undefined);
          openReceptionRightPanelDrawer({
            type: "reception-form",
            id: `walk-in:${patientId}`,
          });
        }}
      />
      {lastMessageDelivery ? (
        <div
          className="border-b bg-[var(--emr-status-success-bg)] px-4 py-2 emr-text-metadata font-semibold text-[var(--emr-status-success-text)]"
          data-testid="check-in-message-delivery"
        >
          카카오톡 발송 완료: {lastMessageDelivery.bodySnapshot}
        </div>
      ) : null}
      {calendarReadStatus === "error" ? (
        <EmrInlineAlert
          className="border-x-0 border-t-0 rounded-none px-4"
          severity="warning"
          title="서버 캘린더를 불러오지 못했습니다"
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
              ? "기존 데모 예약은 표시하지 않고 준비된 빈 병원 캘린더를 유지합니다."
              : "현재 캘린더는 로컬 데모/세션 데이터 기준으로 유지됩니다.")}
        </EmrInlineAlert>
      ) : null}
      <ReceptionScheduleBoard
        assignmentVeterinarians={veterinarians}
        calendarDraftSelection={calendarDraftSelection}
        calendarResourceState={calendarResourceState}
        currentDate={defaultOperatingDate}
        currentOperatingMinutes={currentOperatingMinutes}
        emptySlotAffordanceSuspended={emptySlotAffordanceSuspended}
        appointments={visibleAppointments}
        draftCheckIns={calendarDraftCheckIns}
        operatingDate={operatingDate}
        operatingSchedule={selectedDateOperatingSchedule}
        onClearCalendarDraft={clearCalendarDraft}
        onClearCalendarTransientSelection={clearCalendarTransientSelection}
        onEmptySlotAffordancePointerMove={() =>
          setEmptySlotAffordanceSuspended(false)
        }
        profileDataset={profileDataset}
        selectedVeterinarians={selectedVeterinarians}
        view={calendarView}
        onSelectAppointment={handleSelectAppointment}
        onSelectEncounter={handleSelectEncounterFromSchedule}
        onCreateCalendarDraft={openCalendarDraftDrawer}
        onCreateWalkIn={openWalkInDialog}
        onHideVeterinarian={toggleVeterinarian}
        onOpenVeterinarianProfile={openStaffOperationalProfile}
      />
    </div>
  );
}

function ReceptionFormField({
  children,
  error,
  label,
  required,
}: {
  children: ReactNode;
  error?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 emr-text-metadata font-medium text-[var(--emr-text-secondary)]">
      <span>
        {label}
        {required ? <EmrRequiredIndicator className="ml-0.5" /> : null}
      </span>
      {children}
      {error ? (
        <span className="emr-text-micro font-medium text-destructive">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function ReceptionBreakTimeConfirmDialog({
  mode,
  onConfirm,
  onOpenChange,
  open,
  submitting,
}: {
  mode: "appointment" | "walk-in";
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  submitting: boolean;
}) {
  const isWalkIn = mode === "walk-in";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!submitting) onOpenChange(nextOpen);
      }}
    >
      <EmrConfirmDialogContent
        cancelLabel="취소"
        closeAriaLabel="휴게시간 경고 닫기"
        confirmDisabled={submitting}
        confirmLabel={isWalkIn ? "접수 진행" : "예약 진행"}
        description={`선택한 시간에 휴게시간이 포함되어 있습니다. ${isWalkIn ? "접수를" : "예약을"} 진행하시겠습니까?`}
        title="휴게시간이 포함되어 있습니다"
        onCancel={() => onOpenChange(false)}
        onConfirm={onConfirm}
      />
    </Dialog>
  );
}

function ReceptionDiscardChangesDialog({
  onDiscard,
  onOpenChange,
  open,
}: {
  onDiscard: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EmrConfirmDialogContent
        cancelLabel="계속 작성"
        closeAriaLabel="작성 내용 버리기 확인 닫기"
        confirmLabel="나가기"
        description="입력한 내용은 저장되지 않습니다. 환자 프로필로 돌아갈까요?"
        title="작성 중인 내용을 버릴까요?"
        onCancel={() => onOpenChange(false)}
        onConfirm={onDiscard}
      />
    </Dialog>
  );
}

function ReceptionWalkInFormDrawer({
  currentOperatingMinutes,
  initialDurationMinutes,
  initialAssignedStaffUserId,
  initialPatientId,
  initialVeterinarianId,
  onClose,
  onCreate,
  onDirtyChange,
  operatingDate,
  patientSummaries,
  presentation = "drawer",
  staffMembers,
  veterinarians,
  workspaceId,
}: {
  currentOperatingMinutes: number;
  initialDurationMinutes?: number;
  initialAssignedStaffUserId?: string;
  initialPatientId?: string;
  initialVeterinarianId?: string;
  onClose?: () => void;
  onCreate: (
    input: WalkInReceptionInput,
    walkIn: ReceptionWalkInEncounterRecord,
    selectedSummary: ReceptionPatientSummary,
  ) => void;
  onDirtyChange?: (dirty: boolean) => void;
  operatingDate: string;
  patientSummaries: ReceptionPatientSummary[];
  presentation?: ReceptionDrawerPresentation;
  staffMembers: ReceptionStaffMember[];
  veterinarians: Veterinarian[];
  workspaceId: string;
}) {
  const authSession = useMockAuthStore((state) => state.session);
  const authSessionId = authSession?.id;
  const vitalActorHeaders = useMemo(
    () => authSessionId ? { "x-clair-demo-session-user-id": authSessionId } : undefined,
    [authSessionId],
  );
  const { snapshot: vitalSettings, status: vitalSettingsStatus } = useWorkspaceVitalSettings({
    actorHeaders: vitalActorHeaders,
    workspaceId,
  });
  const {
    schedule: operatingSchedule,
    status: operatingScheduleStatus,
  } = useReceptionOperatingSchedule({
    actorId: authSession?.id,
    date: operatingDate,
    workspaceId,
  });
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const [department, setDepartment] = useState(defaultWalkInDepartment);
  const [duration, setDuration] = useState(
    initialDurationMinutes ? `${initialDurationMinutes}분` : defaultWalkInDuration,
  );
  const [memo, setMemo] = useState("");
  const [patientId, setPatientId] = useState(initialPatientId ?? "");
  const [veterinarianId, setVeterinarianId] = useState(
    initialVeterinarianId ?? "",
  );
  const [assignedStaffUserIds, setAssignedStaffUserIds] = useState<string[]>([]);
  const assignedStaffDefaultAppliedRef = useRef(false);
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
  const lookupRequestSeqRef = useRef(0);
  const lastSuccessfulLookupKeyRef = useRef("");
  const submitLockRef = useRef(false);
  const [breakConfirmOpen, setBreakConfirmOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [visitPurpose, setVisitPurpose] = useState("");
  const [vitalDraft, setVitalDraft] = useState<ReceptionCreateVitalDraft>(() =>
    createReceptionVitalDraft(undefined, vitalSettings),
  );
  const vitalSettingsAppliedRef = useRef(false);
  const [sendKakaoMessage, setSendKakaoMessage] = useState(true);
  const plannedStartAt = getReceptionIsoAtMinutes(
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
    (summary) => summary.patient.id === patientId,
  );
  const patient = selectedSummary?.patient;
  const guardian = selectedSummary?.primaryGuardian;
  const patientOptionText = selectedSummary
    ? getReceptionPatientOptionLabel(selectedSummary)
    : "";
  const lookupMatchesSelectedPatient =
    Boolean(selectedSummary) && lookupQuery === patientOptionText;
  const shouldShowPatientLookup = patientLookupOpen && lookupActive;
  const trimmedVisitPurpose = visitPurpose.trim();
  const vitalBuild = useMemo(
    () => buildReceptionVitalInput(vitalDraft, vitalSettings, patient),
    [patient, vitalDraft, vitalSettings],
  );
  const vitalFieldErrors = useMemo(
    () => ({ ...vitalBuild.fieldErrors, ...vitalDraft.serverErrors }),
    [vitalBuild.fieldErrors, vitalDraft.serverErrors],
  );
  const hasVitalWarnings = Object.keys(vitalBuild.fieldWarnings).length > 0;
  const effectiveVeterinarianId =
    veterinarianId !== unassignedVeterinarianValue &&
    veterinarians.some((veterinarian) => veterinarian.id === veterinarianId)
      ? veterinarianId
      : unassignedVeterinarianValue;
  const durationMinutes = getDurationMinutesFromLabel(duration) ?? 30;
  const durationOptions = useMemo(
    () => Array.from(new Set([...receptionDurationOptions, duration])),
    [duration],
  );
  const timeBlockMessage = getWalkInTimeBlockMessage(
    currentOperatingMinutes,
    durationMinutes,
    operatingSchedule,
  );
  const createBlockMessage =
    timeBlockMessage ??
    (operatingScheduleStatus === "loading"
      ? "운영시간을 확인하는 중입니다."
      : operatingScheduleStatus === "error"
        ? "운영시간을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."
        : undefined);
  const breakTimeWarning =
    getOperatingTimeClassification(
      operatingSchedule,
      currentOperatingMinutes,
      durationMinutes,
    ) === "break-warning";
  const createInputBlocked = Boolean(
    !patient ||
      !department ||
      !duration ||
      assignedStaffUserIds.length !== 1 ||
      !trimmedVisitPurpose ||
      Object.keys(vitalFieldErrors).length > 0,
  );
  const createScheduleBlocked =
    operatingScheduleStatus !== "ready" || Boolean(createBlockMessage);
  const canCreate = !createInputBlocked && !createScheduleBlocked;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (
      assignedStaffDefaultAppliedRef.current ||
      !initialAssignedStaffUserId ||
      !staffMembers.some((staffMember) => staffMember.id === initialAssignedStaffUserId)
    ) {
      return;
    }
    assignedStaffDefaultAppliedRef.current = true;
    setAssignedStaffUserIds([initialAssignedStaffUserId]);
  }, [initialAssignedStaffUserId, staffMembers]);

  useEffect(() => {
    if (vitalSettingsStatus !== "ready" || vitalSettingsAppliedRef.current) return;
    vitalSettingsAppliedRef.current = true;
    setVitalDraft(createReceptionVitalDraft(patient?.weightKg, vitalSettings));
  }, [patient?.weightKg, vitalSettings, vitalSettingsStatus]);

  useEffect(() => {
    const initialSummary = patientSummaryOptions.find(
      (summary) => summary.patient.id === initialPatientId,
    );

    if (!initialSummary) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPatientId(initialSummary.patient.id);
    setSelectedLookupSummary(initialSummary);
    setLookupQuery(getReceptionPatientOptionLabel(initialSummary));
    setVitalDraft(createReceptionVitalDraft(initialSummary.patient.weightKg, vitalSettings));
  }, [initialPatientId, patientSummaryOptions, vitalSettings]);

  useEffect(() => {
    const query = lookupQuery.trim();
    if (!query) {
      lastSuccessfulLookupKeyRef.current = "";
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLookupResults([]);
      setLookupState("idle");
      return;
    }

    if (selectedSummary && query === patientOptionText.trim()) {
      return;
    }

    const lookupKey = `${workspaceId}\u0000${authSession?.id ?? ""}\u0000${query}`;
    if (lookupKey === lastSuccessfulLookupKeyRef.current) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const requestSeq = lookupRequestSeqRef.current + 1;
    lookupRequestSeqRef.current = requestSeq;

    async function loadLookup() {
      if (cancelled || requestSeq !== lookupRequestSeqRef.current) return;
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

        if (cancelled || requestSeq !== lookupRequestSeqRef.current) return;

        if (!response.ok || !result.ok) {
          setLookupResults([]);
          setLookupState("error");
          return;
        }

        setLookupResults(result.patients);
        setLookupState("idle");
        lastSuccessfulLookupKeyRef.current = lookupKey;
      } catch (error) {
        if (
          !cancelled &&
          requestSeq === lookupRequestSeqRef.current &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setLookupResults([]);
          setLookupState("error");
        }
      }
    }

    const debounceTimer = window.setTimeout(() => {
      void loadLookup();
    }, receptionPatientLookupDebounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [
    authSession?.id,
    lookupQuery,
    patientOptionText,
    selectedSummary,
    workspaceId,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVitalDraft(createReceptionVitalDraft(patient?.weightKg, vitalSettings));
  }, [patient?.id, patient?.weightKg, vitalSettings]);

  const selectPatientSummary = (summary: ReceptionPatientSummary) => {
    setDirty(true);
    setPatientId(summary.patient.id);
    setSelectedLookupSummary(summary);
    setLookupQuery(getReceptionPatientOptionLabel(summary));
    setVitalDraft(createReceptionVitalDraft(summary.patient.weightKg, vitalSettings));
    setPatientLookupOpen(false);
  };
  const close = () => {
    if (submitting || submitLockRef.current) return;
    if (dirty && onClose) {
      setDiscardConfirmOpen(true);
      return;
    }
    if (onClose) {
      onClose();
      return;
    }
    setActiveDrawer(null);
  };
  const discardAndClose = () => {
    setDiscardConfirmOpen(false);
    if (onClose) {
      onClose();
      return;
    }
    setActiveDrawer(null);
  };
  const submitCreate = async () => {
    if (
      !patient ||
      !selectedSummary ||
      submitting ||
      submitLockRef.current ||
      !canCreate
    ) {
      return;
    }

    const selectedVeterinarianId =
      effectiveVeterinarianId === unassignedVeterinarianValue
        ? undefined
        : effectiveVeterinarianId;
    if (createBlockMessage) {
      toast.error(createBlockMessage);
      return;
    }

    const input: WalkInReceptionInput = {
      assignedStaffUserIds,
      department: department || defaultWalkInDepartment,
      durationMinutes,
      guardianId: guardian?.id,
      guardianMobilePhone: guardian?.mobilePhone,
      memo: memo.trim() || undefined,
      patientId: patient.id,
      patientName: patient.name,
      plannedStartAt,
      primaryVeterinarianId: selectedVeterinarianId,
      sendKakaoMessage: presentation === "side-panel" ? false : sendKakaoMessage,
      visitPurpose: trimmedVisitPurpose,
      vitals: vitalBuild.input,
    };

    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const result = await submitWalkInEncounter({
        actorRole: authSession?.role,
        input,
        workspaceId,
      });

      if (!result.ok) {
        const responseVitalErrors = getWalkInVitalResponseErrors(
          result.fieldErrors,
        );
        const responseVitalErrorKeys = Object.keys(
          responseVitalErrors,
        ) as Array<keyof ReceptionCreateVitalValues>;
        if (responseVitalErrorKeys.length > 0) {
          setVitalDraft((current) => ({
            ...current,
            serverErrors: responseVitalErrors,
            shownErrors: responseVitalErrorKeys.reduce(
              (shownErrors, key) => ({ ...shownErrors, [key]: true }),
              current.shownErrors,
            ),
          }));
        }
        toast.error(getWalkInRouteErrorMessage(result));
        return;
      }

      onCreate(input, result.walkIn, selectedSummary);
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };
  const requestCreate = () => {
    const vitalErrorKeys = Object.keys(
      vitalFieldErrors,
    ) as Array<keyof ReceptionCreateVitalDraft["values"]>;
    if (vitalErrorKeys.length > 0) {
      setVitalDraft((current) => ({
        ...current,
        shownErrors: vitalErrorKeys.reduce(
          (shownErrors, key) => ({ ...shownErrors, [key]: true }),
          current.shownErrors,
        ),
      }));
      return;
    }
    const vitalWarningKeys = Object.keys(
      vitalBuild.fieldWarnings,
    ) as Array<keyof ReceptionCreateVitalDraft["values"]>;
    if (vitalWarningKeys.length > 0) {
      setVitalDraft((current) => ({
        ...current,
        shownWarnings: vitalWarningKeys.reduce(
          (shownWarnings, key) => ({ ...shownWarnings, [key]: true }),
          current.shownWarnings,
        ),
      }));
    }
    if (
      !patient ||
      !selectedSummary ||
      submitting ||
      submitLockRef.current ||
      !canCreate
    ) {
      return;
    }
    if (createBlockMessage) {
      toast.error(createBlockMessage);
      return;
    }
    if (breakTimeWarning) {
      setBreakConfirmOpen(true);
      return;
    }
    void submitCreate();
  };

  if (presentation === "side-panel") {
    return (
      <>
        <EmrRightPanelBody
        data-testid="walk-in-reception-dialog"
        >
          <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-[var(--clair-spacing-16)] p-[var(--clair-spacing-16)]">
            {createBlockMessage ? (
              <div>
                <EmrInlineAlert
                  severity="warning"
                  title="접수 가능 시간이 아닙니다"
                  testId="walk-in-time-block-alert"
                >
                  {createBlockMessage}
                </EmrInlineAlert>
              </div>
            ) : null}

            <ReceptionSidePanelSection title="환자/보호자" variant="create">
              <ReceptionSidePanelField
                icon={<CdsMedicalPawPrintIcon className="size-3.5" />}
                label="환자명"
                required
                variant="create"
              >
                <div
                  className="relative"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setPatientLookupOpen(false);
                    }
                  }}
                >
                  <Input
                    aria-label="환자 검색"
                    aria-required="true"
                    autoComplete="off"
                    className="bg-[var(--emr-reception-create-field-bg)] pr-[var(--clair-spacing-32)] font-medium"
                    placeholder="환자를 선택해주세요"
                    value={lookupQuery}
                    onFocus={() => setPatientLookupOpen(true)}
                    onValueChange={(value) => {
                      setDirty(true);
                      setLookupQuery(value);
                      if (
                        selectedLookupSummary &&
                        value !==
                          getReceptionPatientOptionLabel(
                            selectedLookupSummary,
                          )
                      ) {
                        setPatientId("");
                        setSelectedLookupSummary(null);
                      }
                      setPatientLookupOpen(true);
                    }}
                  />
                  <ReceptionPatientLookupDecoration
                    hasQuery={Boolean(lookupQuery)}
                    onClear={() => {
                      setDirty(true);
                      setLookupQuery("");
                      setPatientId("");
                      setSelectedLookupSummary(null);
                      setVitalDraft(createReceptionVitalDraft(undefined, vitalSettings));
                      setPatientLookupOpen(true);
                    }}
                  />
                  {shouldShowPatientLookup ? (
                    <div
                      role="listbox"
                      aria-label="검색 결과"
                      className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] grid max-h-72 gap-1 overflow-y-auto rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                    >
                      {lookupState === "loading" ? (
                        <div className="px-2.5 py-2 emr-text-dense text-muted-foreground">
                          DB 환자 검색 중입니다.
                        </div>
                      ) : null}
                      {lookupState === "error" ? (
                        <div className="px-2.5 py-2 emr-text-dense text-[var(--emr-status-danger-text)]">
                          환자 검색을 불러오지 못했습니다.
                        </div>
                      ) : null}
                      {lookupState === "idle" &&
                      !lookupMatchesSelectedPatient &&
                      selectablePatientSummaries.length === 0 ? (
                        <div className="px-2.5 py-2 emr-text-dense text-muted-foreground">
                          검색 결과가 없습니다.
                        </div>
                      ) : null}
                      {selectablePatientSummaries.map((summary) => {
                        const selected = summary.patient.id === patientId;
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
                            onClick={() => selectPatientSummary(summary)}
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
              </ReceptionSidePanelField>

              <ReceptionSidePanelField
                icon={<CdsPeopleUserIcon className="size-3.5" />}
                label="보호자명"
                variant="create"
              >
                <ReceptionSidePanelInput
                  aria-label="보호자명"
                  readOnly
                  placeholder="환자 선택 시 표기됩니다"
                  variant="create"
                  value={
                    guardian
                      ? `${guardian.name}${
                          guardian.mobilePhone ? ` · ${guardian.mobilePhone}` : ""
                        }`
                      : ""
                  }
                />
              </ReceptionSidePanelField>
            </ReceptionSidePanelSection>
            {patient ? (
              <>
                <ReceptionSidePanelDivider />
                <ReceptionSidePanelSection title="바이탈" variant="create">
                  <ReceptionCreateVitalFields
                    draft={vitalDraft}
                    fieldErrors={vitalFieldErrors}
                    fieldWarnings={vitalBuild.fieldWarnings}
                    presentation={presentation}
                    setDraft={(updater) => {
                      setDirty(true);
                      setVitalDraft(updater);
                    }}
                    vitalSettings={vitalSettings}
                  />
                </ReceptionSidePanelSection>
              </>
            ) : null}
            <ReceptionSidePanelDivider />

            <ReceptionSidePanelSection title="진료과/담당의" variant="create">
              <ReceptionSidePanelField
                icon={<CdsMedicalStethoscopeIcon className="size-3.5" />}
                label="진료과"
                required
                variant="create"
              >
                <Select
                  value={department}
                  onValueChange={(value) => {
                    if (!value) return;
                    setDirty(true);
                    setDepartment(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="진료과"
                    aria-required="true"
                    className="w-full bg-[var(--emr-reception-create-field-bg)] font-medium data-placeholder:text-[var(--clair-color-atomic-neutral-500)]"
                  >
                    <SelectValue placeholder="진료과를 선택해주세요" />
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    className="min-w-[var(--emr-reception-create-select-content-min-width)]"
                  >
                    <SelectGroup>
                      <SelectItem value="영상의학과 · 방사선종양학과">
                        영상의학과 · 방사선종양학과
                      </SelectItem>
                      <SelectItem value="내과">내과</SelectItem>
                      <SelectItem value="외과">외과</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </ReceptionSidePanelField>
              <ReceptionSidePanelField
                icon={<CdsMedicalStethoscopeIcon className="size-3.5" />}
                label="담당의"
                variant="create"
              >
                <Select
                  value={veterinarianId}
                  onValueChange={(value) => {
                    if (!value) return;
                    setDirty(true);
                    setVeterinarianId(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="담당의"
                    className="w-full bg-[var(--emr-reception-create-field-bg)] font-medium data-placeholder:text-[var(--clair-color-atomic-neutral-500)]"
                  >
                    {veterinarianId ? (
                      <ReceptionVeterinarianIdentity
                        veterinarianId={veterinarianId}
                        veterinarians={veterinarians}
                      />
                    ) : (
                      <SelectValue placeholder="담당의를 선택해주세요" />
                    )}
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    className="min-w-[var(--emr-reception-create-select-content-min-width)]"
                  >
                    <SelectGroup>
                      <ReceptionVeterinarianSelectItems
                        veterinarians={veterinarians}
                      />
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </ReceptionSidePanelField>
            </ReceptionSidePanelSection>
            <ReceptionSidePanelDivider />

            <ReceptionSidePanelSection title="접수 정보" variant="create">
              <ReceptionSidePanelField
                icon={<CdsFilesCalendarIcon className="size-3.5" />}
                label="접수일"
                variant="create"
              >
                <ReceptionSidePanelInput
                  readOnly
                  aria-label="접수일"
                  value={formatReceptionSidePanelDate(operatingDate)}
                  variant="create"
                />
              </ReceptionSidePanelField>
              <ReceptionSidePanelField
                icon={<CdsFilesClockIcon className="size-3.5" />}
                label="접수시간"
                variant="create"
              >
                <ReceptionSidePanelInput
                  readOnly
                  aria-label="접수시간"
                  value={formatReceptionSidePanelTime(plannedStartAt)}
                  variant="create"
                />
              </ReceptionSidePanelField>
              <ReceptionSidePanelField
                icon={<CdsPeopleUserIcon className="size-3.5" />}
                label="접수 담당자"
                required
                variant="create"
              >
                <ReceptionStaffAssignmentSelect
                  ariaRequired
                  compact
                  label="접수 담당자"
                  selectedIds={assignedStaffUserIds}
                  selectionMode="single"
                  staffMembers={staffMembers}
                  onChange={(ids) => {
                    setDirty(true);
                    setAssignedStaffUserIds(ids);
                  }}
                />
              </ReceptionSidePanelField>
              <ReceptionSidePanelField
                icon={<CdsMedicalActivityIcon className="size-3.5" />}
                label="예상소요시간"
                required
                variant="create"
              >
                <Select
                  value={duration}
                  onValueChange={(value) => {
                    if (!value) return;
                    setDirty(true);
                    setDuration(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="예상소요시간"
                    aria-required="true"
                    className="w-full bg-[var(--emr-reception-create-field-bg)] font-medium"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    className="min-w-[var(--emr-reception-create-select-content-min-width)]"
                  >
                    <SelectGroup>
                      {durationOptions.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </ReceptionSidePanelField>
              <ReceptionSidePanelField
                align="start"
                icon={<CdsMedicalClipboardPenIcon className="size-3.5" />}
                label="방문목적"
                required
                variant="create"
              >
                <Textarea
                  aria-label="방문목적"
                  aria-required="true"
                  className="min-h-[var(--emr-reception-create-textarea-min-height)] resize-none bg-[var(--emr-reception-create-field-bg)] font-medium"
                  placeholder="방문목적을 입력해주세요"
                  value={visitPurpose}
                  onChange={(event) => {
                    setDirty(true);
                    setVisitPurpose(event.target.value);
                  }}
                />
              </ReceptionSidePanelField>
              <ReceptionSidePanelField
                align="start"
                icon={<CdsMedicalClipboardPenIcon className="size-3.5" />}
                label="접수 메모"
                variant="create"
              >
                <Textarea
                  aria-label="접수 메모"
                  className="min-h-[var(--emr-reception-create-textarea-min-height)] resize-none bg-[var(--emr-reception-create-field-bg)] font-medium"
                  placeholder="접수 메모를 입력해주세요"
                  value={memo}
                  onChange={(event) => {
                    setDirty(true);
                    setMemo(event.target.value);
                  }}
                />
              </ReceptionSidePanelField>
            </ReceptionSidePanelSection>
          </div>
          </ScrollArea>
        </EmrRightPanelBody>
        <EmrRightPanelFooter
          size="single"
          className="flex items-center justify-end gap-[var(--clair-spacing-8)] p-[var(--clair-spacing-16)]"
        >
          <div className="flex shrink-0 items-center gap-[var(--clair-spacing-8)]">
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="text-[var(--emr-text-secondary)]"
              onClick={close}
              disabled={submitting}
            >
              취소
            </Button>
            <ReceptionCreateButton
              hasVitalWarnings={hasVitalWarnings}
              inputBlocked={createInputBlocked}
              onClick={requestCreate}
              scheduleBlocked={createScheduleBlocked}
              submitting={submitting}
            />
          </div>
        </EmrRightPanelFooter>
        <ReceptionBreakTimeConfirmDialog
          mode="walk-in"
          open={breakConfirmOpen}
          submitting={submitting}
          onOpenChange={setBreakConfirmOpen}
          onConfirm={() => {
            setBreakConfirmOpen(false);
            void submitCreate();
          }}
        />
        <ReceptionDiscardChangesDialog
          open={discardConfirmOpen}
          onOpenChange={setDiscardConfirmOpen}
          onDiscard={discardAndClose}
        />
      </>
    );
  }

  return (
    <>
    <div
      className={getReceptionDrawerSurfaceClassName(presentation)}
      data-testid="walk-in-reception-dialog"
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          {createBlockMessage ? (
            <EmrInlineAlert
              severity="warning"
              title="접수 가능 시간이 아닙니다"
              testId="walk-in-time-block-alert"
            >
              {createBlockMessage}
            </EmrInlineAlert>
          ) : null}
          <RegistrationFormSection separated={false} title="환자 정보">
            <div className="grid gap-3">
              <RegistrationFormField label="환자명" required>
                <div
                  className="relative"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setPatientLookupOpen(false);
                    }
                  }}
                >
                  <Input
                    aria-label="환자 검색"
                    aria-required="true"
                    autoComplete="off"
                    className="h-9 bg-card pr-[var(--clair-spacing-32)]"
                    placeholder="환자를 선택해주세요"
                    value={lookupQuery}
                    onFocus={() => setPatientLookupOpen(true)}
                    onValueChange={(value) => {
                      setDirty(true);
                      setLookupQuery(value);
                      if (
                        selectedLookupSummary &&
                        value !==
                          getReceptionPatientOptionLabel(
                            selectedLookupSummary,
                          )
                      ) {
                        setPatientId("");
                        setSelectedLookupSummary(null);
                      }
                      setPatientLookupOpen(true);
                    }}
                  />
                  <ReceptionPatientLookupDecoration
                    hasQuery={Boolean(lookupQuery)}
                    onClear={() => {
                      setDirty(true);
                      setLookupQuery("");
                      setPatientId("");
                      setSelectedLookupSummary(null);
                      setVitalDraft(createReceptionVitalDraft(undefined, vitalSettings));
                      setPatientLookupOpen(true);
                    }}
                  />
                  {shouldShowPatientLookup ? (
                    <div
                      role="listbox"
                      aria-label="검색 결과"
                      className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] grid max-h-72 gap-1 overflow-y-auto rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                    >
                      {lookupState === "loading" ? (
                        <div className="px-2.5 py-2 emr-text-dense text-muted-foreground">
                          DB 환자 검색 중입니다.
                        </div>
                      ) : null}
                      {lookupState === "error" ? (
                        <div className="px-2.5 py-2 emr-text-dense text-[var(--emr-status-danger-text)]">
                          환자 검색을 불러오지 못했습니다.
                        </div>
                      ) : null}
                      {lookupState === "idle" &&
                      !lookupMatchesSelectedPatient &&
                      selectablePatientSummaries.length === 0 ? (
                        <div className="px-2.5 py-2 emr-text-dense text-muted-foreground">
                          검색 결과가 없습니다.
                        </div>
                      ) : null}
                      {selectablePatientSummaries.map((summary) => {
                        const selected = summary.patient.id === patientId;
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
                            onClick={() => selectPatientSummary(summary)}
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

            </div>

            <RegistrationFormField label="방문 목적" required>
              <Textarea
                aria-label="방문 목적"
                aria-required="true"
                className="min-h-[104px] resize-none bg-card"
                placeholder="방문목적을 입력해주세요"
                value={visitPurpose}
                onChange={(event) => {
                  setDirty(true);
                  setVisitPurpose(event.target.value);
                }}
              />
            </RegistrationFormField>
          </RegistrationFormSection>

          {patient ? (
            <RegistrationFormSection title="바이탈">
              <ReceptionCreateVitalFields
                draft={vitalDraft}
                fieldErrors={vitalFieldErrors}
                fieldWarnings={vitalBuild.fieldWarnings}
                presentation={presentation}
                setDraft={(updater) => {
                  setDirty(true);
                  setVitalDraft(updater);
                }}
                vitalSettings={vitalSettings}
              />
            </RegistrationFormSection>
          ) : null}

          <RegistrationFormSection title="접수 정보">
            <section className="grid grid-cols-2 gap-3">
              <RegistrationFormField label="진료과" required>
                <Select
                  value={department}
                  onValueChange={(value) => {
                    if (!value) return;
                    setDirty(true);
                    setDepartment(value);
                  }}
                >
                  <SelectTrigger aria-label="진료과" aria-required="true" size="lg" className="w-full bg-card">
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
              <RegistrationFormField label="담당의">
                <Select
                  value={effectiveVeterinarianId}
                  onValueChange={(value) => {
                    if (!value) return;
                    setDirty(true);
                    setVeterinarianId(value);
                  }}
                >
                  <SelectTrigger aria-label="담당의" size="lg" className="w-full bg-card">
                    <ReceptionVeterinarianIdentity
                      veterinarianId={effectiveVeterinarianId}
                      veterinarians={veterinarians}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <ReceptionVeterinarianSelectItems
                        veterinarians={veterinarians}
                      />
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </RegistrationFormField>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <RegistrationFormField label="접수일">
                <Input
                  aria-label="접수일"
                  value={formatShortOperatingDate(operatingDate)}
                  readOnly
                  className="h-9 bg-card"
                />
              </RegistrationFormField>
              <RegistrationFormField label="진료시간">
                <Input
                  aria-label="진료시간"
                  value={getShortTime(plannedStartAt)}
                  readOnly
                  className="h-9 bg-card"
                />
              </RegistrationFormField>
            </section>

            <RegistrationFormField label="접수 담당자" required>
              <ReceptionStaffAssignmentSelect
                ariaRequired
                label="접수 담당자"
                selectedIds={assignedStaffUserIds}
                selectionMode="single"
                staffMembers={staffMembers}
                onChange={(ids) => {
                  setDirty(true);
                  setAssignedStaffUserIds(ids);
                }}
              />
            </RegistrationFormField>

            <RegistrationFormField label="예상시간" required>
              <Select
                value={duration}
                onValueChange={(value) => {
                  if (!value) return;
                  setDirty(true);
                  setDuration(value);
                }}
              >
                <SelectTrigger
                  aria-label="예상시간"
                  aria-required="true"
                  size="lg"
                  className="w-full bg-card"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {durationOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </RegistrationFormField>

            <RegistrationFormField label="접수 메모">
              <Textarea
                aria-label="접수 메모"
                className="min-h-24 resize-none bg-card"
                placeholder="접수 메모를 입력해주세요"
                value={memo}
                onChange={(event) => {
                  setDirty(true);
                  setMemo(event.target.value);
                }}
              />
            </RegistrationFormField>
          </RegistrationFormSection>
        </div>
      </ScrollArea>
      <div className="mt-auto flex shrink-0 items-center justify-between gap-2 border-t bg-card p-4">
        <Button
          type="button"
          variant="ghost"
          size="default"
          aria-pressed={sendKakaoMessage}
          aria-label="카카오톡 발송"
          className="w-fit gap-2 text-[var(--emr-text-secondary)] aria-pressed:bg-accent aria-pressed:text-foreground"
          onClick={() => {
            setDirty(true);
            setSendKakaoMessage((current) => !current);
          }}
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-4 items-center justify-center rounded-[4px] border transition-colors",
              sendKakaoMessage
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-transparent",
            )}
          >
            <CheckIcon className="size-3" />
          </span>
          <span>카카오톡 발송</span>
        </Button>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="default" variant="ghost" onClick={close} disabled={submitting}>
            취소
          </Button>
          <ReceptionCreateButton
            hasVitalWarnings={hasVitalWarnings}
            inputBlocked={createInputBlocked}
            onClick={requestCreate}
            scheduleBlocked={createScheduleBlocked}
            submitting={submitting}
          />
        </div>
      </div>
    </div>
    <ReceptionBreakTimeConfirmDialog
      mode="walk-in"
      open={breakConfirmOpen}
      submitting={submitting}
      onOpenChange={setBreakConfirmOpen}
      onConfirm={() => {
        setBreakConfirmOpen(false);
        void submitCreate();
      }}
    />
    <ReceptionDiscardChangesDialog
      open={discardConfirmOpen}
      onOpenChange={setDiscardConfirmOpen}
      onDiscard={discardAndClose}
    />
    </>
  );
}

function ReceptionReservationFormDrawer({
  appointments,
  currentOperatingMinutes,
  initialDate,
  initialAssignedStaffUserId,
  initialDurationMinutes,
  initialPatientId,
  initialTimeMinutes,
  initialVeterinarianId,
  onClose,
  onCreate,
  onDirtyChange,
  operatingDate,
  patientSummaries,
  presentation = "drawer",
  staffMembers,
  todayDate,
  veterinarians,
  workspaceId,
}: {
  appointments: Appointment[];
  currentOperatingMinutes: number;
  initialDate?: string;
  initialAssignedStaffUserId?: string;
  initialDurationMinutes?: number;
  initialPatientId?: string;
  initialTimeMinutes?: number;
  initialVeterinarianId?: string;
  onClose?: () => void;
  onCreate: (appointment: Appointment) => void;
  onDirtyChange?: (dirty: boolean) => void;
  operatingDate: string;
  patientSummaries: ReceptionPatientSummary[];
  presentation?: ReceptionDrawerPresentation;
  staffMembers: ReceptionStaffMember[];
  todayDate: string;
  veterinarians: Veterinarian[];
  workspaceId: string;
}) {
  const authSession = useMockAuthStore((state) => state.session);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const setCalendarDraftSelection = useReceptionStore(
    (state) => state.setCalendarDraftSelection,
  );
  const initialReservationDate =
    initialDate && initialDate >= todayDate ? initialDate : undefined;
  const [date, setDate] = useState(
    initialReservationDate ??
      (operatingDate < todayDate ? todayDate : operatingDate),
  );
  const [duration, setDuration] = useState(
    initialDurationMinutes ? `${initialDurationMinutes}분` : defaultWalkInDuration,
  );
  const [memo, setMemo] = useState("");
  const submitLockRef = useRef(false);
  const [breakConfirmOpen, setBreakConfirmOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState(
    initialTimeMinutes ?? 0,
  );
  const initialKnownVeterinarianId =
    initialVeterinarianId &&
    veterinarians.some((veterinarian) => veterinarian.id === initialVeterinarianId)
      ? initialVeterinarianId
      : undefined;
  const [veterinarianId, setVeterinarianId] = useState(
    initialKnownVeterinarianId ?? "",
  );
  const [assignedStaffUserIds, setAssignedStaffUserIds] = useState<string[]>([]);
  const assignedStaffDefaultAppliedRef = useRef(false);
  const patientLookup = useReceptionPatientLookup({
    authSessionId: authSession?.id,
    patientSummaries,
    workspaceId,
  });
  const {
    patientId: selectedPatientId,
    selectPatientSummary: selectLookupPatientSummary,
  } = patientLookup;
  const {
    schedule: operatingSchedule,
    status: operatingScheduleStatus,
  } = useReceptionOperatingSchedule({
    actorId: authSession?.id,
    date,
    workspaceId,
  });
  const [patientLookupOpen, setPatientLookupOpen] = useState(false);
  const durationMinutes = getDurationMinutesFromLabel(duration) ?? 30;
  const durationOptions = useMemo(
    () => Array.from(new Set([...receptionDurationOptions, duration])),
    [duration],
  );
  const timeOptions = useMemo(
    () =>
      getReservationTimeOptions(
        date,
        durationMinutes,
        appointments,
        todayDate,
        currentOperatingMinutes,
        operatingSchedule,
      ),
    [appointments, currentOperatingMinutes, date, durationMinutes, operatingSchedule, todayDate],
  );
  const selectedSummary = patientLookup.selectedSummary;
  const selectedPatient = selectedSummary?.patient;
  const selectedGuardian = selectedSummary?.primaryGuardian;
  const selectedTimeOption = timeOptions.find((option) => option.minutes === timeMinutes);
  const breakTimeWarning = Boolean(selectedTimeOption?.breakWarning);
  const closedDay = !operatingSchedule.isOpen;
  const hasElapsedOptions = timeOptions.some((option) => option.reason === "지난 시간");
  const hasAvailableTimeOption = timeOptions.some((option) => !option.disabled);
  const reservationTimeHelper =
    operatingScheduleStatus === "loading"
      ? "운영시간을 확인하는 중입니다."
      : operatingScheduleStatus === "error"
        ? "운영시간을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요."
        : closedDay
          ? "휴진일입니다."
          : !hasAvailableTimeOption
            ? "예약 가능한 시간이 없습니다. 날짜나 예상시간을 변경해 주세요."
            : date === todayDate && hasElapsedOptions
              ? "오늘 예약은 현재 시각 이후만 선택할 수 있어요."
              : undefined;
  const effectiveVeterinarianId =
    veterinarianId !== unassignedVeterinarianValue &&
    veterinarians.some((veterinarian) => veterinarian.id === veterinarianId)
      ? veterinarianId
      : undefined;
  const canCreate =
    operatingScheduleStatus === "ready" &&
    Boolean(selectedPatient) &&
    Boolean(date) &&
    Boolean(duration) &&
    assignedStaffUserIds.length > 0 &&
    Boolean(selectedTimeOption) &&
    !selectedTimeOption?.disabled &&
    !closedDay &&
    date >= todayDate;
  const shouldShowPatientLookup =
    patientLookupOpen && patientLookup.lookupActive;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const close = () => {
    if (submitting || submitLockRef.current) return;
    if (dirty && onClose) {
      setDiscardConfirmOpen(true);
      return;
    }
    setCalendarDraftSelection(undefined);
    if (onClose) {
      onClose();
      return;
    }
    setActiveDrawer(null);
  };
  const discardAndClose = () => {
    setDiscardConfirmOpen(false);
    setCalendarDraftSelection(undefined);
    if (onClose) {
      onClose();
      return;
    }
    setActiveDrawer(null);
  };

  useEffect(() => {
    if (
      assignedStaffDefaultAppliedRef.current ||
      !initialAssignedStaffUserId ||
      !staffMembers.some((staffMember) => staffMember.id === initialAssignedStaffUserId)
    ) {
      return;
    }
    assignedStaffDefaultAppliedRef.current = true;
    setAssignedStaffUserIds([initialAssignedStaffUserId]);
  }, [initialAssignedStaffUserId, staffMembers]);

  useEffect(() => {
    if (!initialPatientId || selectedPatientId === initialPatientId) return;
    const initialSummary = patientSummaries.find(
      (summary) => summary.patient.id === initialPatientId,
    );
    if (!initialSummary) return;

    selectLookupPatientSummary(initialSummary);
  }, [
    initialPatientId,
    patientSummaries,
    selectLookupPatientSummary,
    selectedPatientId,
  ]);

  useEffect(() => {
    if (
      !initialReservationDate &&
      initialDurationMinutes === undefined &&
      initialTimeMinutes === undefined &&
      !initialVeterinarianId
    ) {
      return;
    }

    if (initialReservationDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(initialReservationDate);
    }
    if (initialDurationMinutes !== undefined) {
      setDuration(`${initialDurationMinutes}분`);
    }
    if (initialTimeMinutes !== undefined) {
      setTimeMinutes(initialTimeMinutes);
    }
    if (
      initialVeterinarianId &&
      veterinarians.some((veterinarian) => veterinarian.id === initialVeterinarianId)
    ) {
      setVeterinarianId(initialVeterinarianId);
    }
  }, [
    initialDurationMinutes,
    initialReservationDate,
    initialTimeMinutes,
    initialVeterinarianId,
    veterinarians,
  ]);

  useEffect(() => {
    if (
      !veterinarianId ||
      veterinarianId === unassignedVeterinarianValue ||
      veterinarians.some((veterinarian) => veterinarian.id === veterinarianId)
    ) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVeterinarianId("");
  }, [veterinarianId, veterinarians]);

  useEffect(() => {
    const firstAvailable = timeOptions.find((option) => !option.disabled);
    if (!timeOptions.some((option) => option.minutes === timeMinutes && !option.disabled)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeMinutes(firstAvailable?.minutes ?? getSelectableOperatingStartMinutes(operatingSchedule, durationMinutes)[0] ?? 0);
    }
  }, [durationMinutes, operatingSchedule, timeMinutes, timeOptions]);

  const submitCreate = async () => {
    if (
      !selectedPatient ||
      submitting ||
      submitLockRef.current ||
      !canCreate
    ) {
      return;
    }

    const input: ReceptionAppointmentCreateInput = {
      assignedStaffUserIds,
      assignedVeterinarianId: effectiveVeterinarianId,
      durationMinutes,
      guardianId: selectedGuardian?.id,
      patientId: selectedPatient.id,
      reservationMemo: memo.trim() || undefined,
      scheduledStartAt: getReceptionIsoAtMinutes(date, timeMinutes),
    };

    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const result = await submitAppointmentCreate({
        actorRole: authSession?.role,
        input,
        workspaceId,
      });

      if (!result.ok) {
        toast.error(getAppointmentCreateRouteErrorMessage(result));
        return;
      }

      onCreate(result.appointment);
      setCalendarDraftSelection(undefined);
      toast.success("예약이 완료되었습니다");
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };
  const requestCreate = () => {
    if (
      !selectedPatient ||
      submitting ||
      submitLockRef.current ||
      !canCreate
    ) {
      return;
    }
    if (breakTimeWarning) {
      setBreakConfirmOpen(true);
      return;
    }
    void submitCreate();
  };

  if (presentation === "side-panel") {
    return (
      <>
        <EmrRightPanelBody
        data-testid="reservation-create-drawer"
        >
          <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-[var(--clair-spacing-16)] p-[var(--clair-spacing-16)]">
            <ReceptionSidePanelSection title="환자/보호자" variant="create">
              <ReceptionSidePanelField
                icon={<CdsMedicalPawPrintIcon className="size-3.5" />}
                label="환자명"
                required
                variant="create"
              >
                <div
                  className="relative"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setPatientLookupOpen(false);
                    }
                  }}
                >
                  <Input
                    aria-label="환자 검색"
                    aria-required="true"
                    autoComplete="off"
                    className="bg-[var(--emr-reception-create-field-bg)] pr-[var(--clair-spacing-32)] font-medium"
                    placeholder="환자를 선택해주세요"
                    value={patientLookup.lookupQuery}
                    onFocus={() => setPatientLookupOpen(true)}
                    onValueChange={(value) => {
                      setDirty(true);
                      patientLookup.updateLookupQuery(value);
                      setPatientLookupOpen(true);
                    }}
                  />
                  <ReceptionPatientLookupDecoration
                    hasQuery={Boolean(patientLookup.lookupQuery)}
                    onClear={() => {
                      setDirty(true);
                      patientLookup.clearPatientSelection();
                      setPatientLookupOpen(true);
                    }}
                  />
                  {shouldShowPatientLookup ? (
                    <div
                      role="listbox"
                      aria-label="검색 결과"
                      className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] grid max-h-72 gap-1 overflow-y-auto rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                    >
                      <ReceptionPatientLookupStateMessage
                        lookupActive={patientLookup.lookupActive}
                        lookupState={patientLookup.lookupState}
                        resultCount={
                          patientLookup.selectablePatientSummaries.length
                        }
                      />
                      {patientLookup.selectablePatientSummaries.map(
                        (summary) => {
                          const selected =
                            summary.patient.id === patientLookup.patientId;
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
                              onClick={() => {
                                setDirty(true);
                                patientLookup.selectPatientSummary(summary);
                                setPatientLookupOpen(false);
                              }}
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
                        },
                      )}
                    </div>
                  ) : null}
                </div>
              </ReceptionSidePanelField>

              <ReceptionSidePanelField
                icon={<CdsPeopleUserIcon className="size-3.5" />}
                label="보호자명"
                variant="create"
              >
                <ReceptionSidePanelInput
                  aria-label="보호자명"
                  readOnly
                  placeholder="환자 선택 시 표기됩니다"
                  variant="create"
                  value={
                    selectedGuardian
                      ? `${selectedGuardian.name}${
                          selectedGuardian.mobilePhone
                            ? ` · ${selectedGuardian.mobilePhone}`
                            : ""
                        }`
                      : ""
                  }
                />
              </ReceptionSidePanelField>
            </ReceptionSidePanelSection>
            <ReceptionSidePanelDivider />

            <ReceptionSidePanelSection title="담당의" variant="create">
              <ReceptionSidePanelField
                icon={<CdsMedicalStethoscopeIcon className="size-3.5" />}
                label="담당의"
                variant="create"
              >
                <Select
                  value={veterinarianId}
                  onValueChange={(value) => {
                    if (!value) return;
                    setDirty(true);
                    setVeterinarianId(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="담당의"
                    className="w-full bg-[var(--emr-reception-create-field-bg)] font-medium data-placeholder:text-[var(--clair-color-atomic-neutral-500)]"
                  >
                    {veterinarianId ? (
                      <ReceptionVeterinarianIdentity
                        veterinarianId={veterinarianId}
                        veterinarians={veterinarians}
                      />
                    ) : (
                      <SelectValue placeholder="담당의를 선택해주세요" />
                    )}
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    className="min-w-[var(--emr-reception-create-select-content-min-width)]"
                  >
                    <SelectGroup>
                      <ReceptionVeterinarianSelectItems
                        veterinarians={veterinarians}
                      />
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </ReceptionSidePanelField>
            </ReceptionSidePanelSection>
            <ReceptionSidePanelDivider />

            <ReceptionSidePanelSection title="예약 정보" variant="create">
              <ReceptionSidePanelField
                icon={<CdsFilesCalendarIcon className="size-3.5" />}
                label="예약일"
                required
                variant="create"
              >
                <ReceptionReservationDatePicker
                  compact
                  minDate={todayDate}
                  value={date}
                  onChange={(value) => {
                    setDirty(true);
                    setDate(value);
                  }}
                />
              </ReceptionSidePanelField>
              <ReceptionSidePanelField
                icon={<CdsFilesClockIcon className="size-3.5" />}
                label="예약시간"
                required
                variant="create"
              >
                <div className="min-w-0">
                  <Select
                    value={String(timeMinutes)}
                    onValueChange={(value) => {
                      setDirty(true);
                      setTimeMinutes(Number(value));
                    }}
                    disabled={closedDay}
                  >
                    <SelectTrigger
                      aria-label="예약시간"
                      aria-required="true"
                      className="w-full bg-[var(--emr-reception-create-field-bg)] font-medium"
                    >
                      <span className="flex min-w-0 flex-1 truncate text-left">
                        {selectedTimeOption?.label ??
                          getScheduleTimeLabelFromMinutes(timeMinutes)}
                        {selectedTimeOption?.breakWarning ? " · 휴게시간" : ""}
                      </span>
                    </SelectTrigger>
                    <SelectContent
                      align="end"
                      className="min-w-[var(--emr-reception-create-select-content-min-width)]"
                    >
                      <SelectGroup>
                        {timeOptions.map((option) => (
                          <SelectItem
                            key={option.minutes}
                            value={String(option.minutes)}
                            disabled={option.disabled}
                          >
                            {option.label}
                            {option.reason
                              ? ` · ${option.reason}`
                              : option.breakWarning
                                ? " · 휴게시간"
                                : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {reservationTimeHelper ? (
                    <p className="mt-1 emr-text-micro font-medium text-[var(--emr-text-secondary)]">
                      {reservationTimeHelper}
                    </p>
                  ) : null}
                </div>
              </ReceptionSidePanelField>
              <ReceptionSidePanelField
                icon={<CdsPeopleUserIcon className="size-3.5" />}
                label="예약 담당자"
                required
                variant="create"
              >
                <ReceptionStaffAssignmentSelect
                  ariaRequired
                  compact
                  label="예약 담당자"
                  selectedIds={assignedStaffUserIds}
                  staffMembers={staffMembers}
                  onChange={(ids) => {
                    setDirty(true);
                    setAssignedStaffUserIds(ids);
                  }}
                />
              </ReceptionSidePanelField>
              <ReceptionSidePanelField
                icon={<CdsMedicalActivityIcon className="size-3.5" />}
                label="예상소요시간"
                required
                variant="create"
              >
                <Select
                  value={duration}
                  onValueChange={(value) => {
                    if (!value) return;
                    setDirty(true);
                    setDuration(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="예상소요시간"
                    aria-required="true"
                    className="w-full bg-[var(--emr-reception-create-field-bg)] font-medium"
                  >
                    <span className="flex min-w-0 flex-1 truncate text-left">
                      {duration}
                    </span>
                  </SelectTrigger>
                  <SelectContent
                    align="end"
                    className="min-w-[var(--emr-reception-create-select-content-min-width)]"
                  >
                    <SelectGroup>
                      {durationOptions.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </ReceptionSidePanelField>
            </ReceptionSidePanelSection>
            <ReceptionSidePanelDivider />

            <ReceptionSidePanelSection title="예약 메모" variant="create">
              <ReceptionSidePanelField
                align="start"
                icon={<CdsMedicalClipboardPenIcon className="size-3.5" />}
                label="예약 메모"
                variant="create"
              >
                <Textarea
                  aria-label="예약 메모"
                  className="min-h-[var(--emr-reception-create-textarea-min-height)] resize-none bg-[var(--emr-reception-create-field-bg)] font-medium"
                  placeholder="예약 메모를 입력해주세요"
                  value={memo}
                  onChange={(event) => {
                    setDirty(true);
                    setMemo(event.target.value);
                  }}
                />
              </ReceptionSidePanelField>
            </ReceptionSidePanelSection>
          </div>
          </ScrollArea>
        </EmrRightPanelBody>
        <EmrRightPanelFooter
          size="single"
          className="flex items-center justify-end gap-[var(--clair-spacing-8)] p-[var(--clair-spacing-16)]"
        >
          <div className="flex shrink-0 items-center gap-[var(--clair-spacing-8)]">
            <Button
              type="button"
              variant="ghost"
              size="default"
              className="text-[var(--emr-text-secondary)]"
              onClick={close}
              disabled={submitting}
            >
              취소
            </Button>
            <Button
              type="button"
              size="default"
              onClick={requestCreate}
              disabled={!canCreate || submitting}
            >
              {submitting ? "생성 중" : "생성"}
            </Button>
          </div>
        </EmrRightPanelFooter>
        <ReceptionBreakTimeConfirmDialog
          mode="appointment"
          open={breakConfirmOpen}
          submitting={submitting}
          onOpenChange={setBreakConfirmOpen}
          onConfirm={() => {
            setBreakConfirmOpen(false);
            void submitCreate();
          }}
        />
        <ReceptionDiscardChangesDialog
          open={discardConfirmOpen}
          onOpenChange={setDiscardConfirmOpen}
          onDiscard={discardAndClose}
        />
      </>
    );
  }

  return (
    <>
    <div
      className={getReceptionDrawerSurfaceClassName(presentation)}
      data-testid="reservation-create-drawer"
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <RegistrationFormSection separated={false} title="환자 정보">
            <div className="grid gap-3">
              <RegistrationFormField label="환자명" required>
                <div
                  className="relative"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setPatientLookupOpen(false);
                    }
                  }}
                >
                  <Input
                    aria-label="환자 검색"
                    aria-required="true"
                    autoComplete="off"
                    className="h-9 bg-card pr-[var(--clair-spacing-32)]"
                    placeholder="환자를 선택해주세요"
                    value={patientLookup.lookupQuery}
                    onFocus={() => setPatientLookupOpen(true)}
                    onValueChange={(value) => {
                      setDirty(true);
                      patientLookup.updateLookupQuery(value);
                      setPatientLookupOpen(true);
                    }}
                  />
                  <ReceptionPatientLookupDecoration
                    hasQuery={Boolean(patientLookup.lookupQuery)}
                    onClear={() => {
                      setDirty(true);
                      patientLookup.clearPatientSelection();
                      setPatientLookupOpen(true);
                    }}
                  />
                  {shouldShowPatientLookup ? (
                    <div
                      role="listbox"
                      aria-label="검색 결과"
                      className="absolute left-0 right-0 top-[calc(100%+4px)] z-[80] grid max-h-72 gap-1 overflow-y-auto rounded-lg bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                    >
                      <ReceptionPatientLookupStateMessage
                        lookupActive={patientLookup.lookupActive}
                        lookupState={patientLookup.lookupState}
                        resultCount={
                          patientLookup.selectablePatientSummaries.length
                        }
                      />
                      {patientLookup.selectablePatientSummaries.map(
                        (summary) => {
                          const selected =
                            summary.patient.id === patientLookup.patientId;
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
                              onClick={() => {
                                setDirty(true);
                                patientLookup.selectPatientSummary(summary);
                                setPatientLookupOpen(false);
                              }}
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
                        },
                      )}
                    </div>
                  ) : null}
                </div>
              </RegistrationFormField>
            </div>
          </RegistrationFormSection>

          <RegistrationFormSection title="예약 정보">
            <section className="grid grid-cols-2 gap-3">
              <RegistrationFormField label="예약일" required>
                <ReceptionReservationDatePicker
                  minDate={todayDate}
                  value={date}
                  onChange={(value) => {
                    setDirty(true);
                    setDate(value);
                  }}
                />
              </RegistrationFormField>
              <RegistrationFormField label="담당의">
                <Select
                  value={veterinarianId}
                  onValueChange={(value) => {
                    if (!value) return;
                    setDirty(true);
                    setVeterinarianId(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="담당의"
                    size="lg"
                    className="w-full bg-card"
                  >
                    <ReceptionVeterinarianIdentity
                      veterinarianId={veterinarianId}
                      veterinarians={veterinarians}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <ReceptionVeterinarianSelectItems
                        veterinarians={veterinarians}
                      />
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </RegistrationFormField>
            </section>

            <section className="grid grid-cols-2 gap-3">
              <RegistrationFormField
                label="예약시간"
                required
                helper={reservationTimeHelper}
              >
                <Select
                  value={String(timeMinutes)}
                  onValueChange={(value) => {
                    setDirty(true);
                    setTimeMinutes(Number(value));
                  }}
                  disabled={closedDay}
                >
                  <SelectTrigger
                    aria-label="예약시간"
                    aria-required="true"
                    size="lg"
                    className="w-full bg-card"
                  >
                    <span className="flex flex-1 text-left">
                      {selectedTimeOption?.label ?? getScheduleTimeLabelFromMinutes(timeMinutes)}
                      {selectedTimeOption?.breakWarning ? " · 휴게시간" : ""}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {timeOptions.map((option) => (
                        <SelectItem
                          key={option.minutes}
                          value={String(option.minutes)}
                          disabled={option.disabled}
                        >
                          {option.label}
                          {option.reason
                            ? ` · ${option.reason}`
                            : option.breakWarning
                              ? " · 휴게시간"
                              : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </RegistrationFormField>
              <RegistrationFormField label="예상시간" required>
                <Select
                  value={duration}
                  onValueChange={(value) => {
                    if (!value) return;
                    setDirty(true);
                    setDuration(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="예상시간"
                    aria-required="true"
                    size="lg"
                    className="w-full bg-card"
                  >
                    <span className="flex flex-1 text-left">{duration}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {durationOptions.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </RegistrationFormField>
            </section>

            <RegistrationFormField label="예약 담당자" required>
              <ReceptionStaffAssignmentSelect
                ariaRequired
                label="예약 담당자"
                selectedIds={assignedStaffUserIds}
                staffMembers={staffMembers}
                onChange={(ids) => {
                  setDirty(true);
                  setAssignedStaffUserIds(ids);
                }}
              />
            </RegistrationFormField>

            <RegistrationFormField label="예약 메모">
              <Textarea
                aria-label="예약 메모"
                className="min-h-24 resize-none bg-card"
                placeholder="예약 메모를 입력해주세요"
                value={memo}
                onChange={(event) => {
                  setDirty(true);
                  setMemo(event.target.value);
                }}
              />
            </RegistrationFormField>
          </RegistrationFormSection>
        </div>
      </ScrollArea>
      <div className="mt-auto flex shrink-0 items-center justify-end gap-2 border-t bg-card p-4">
        <Button size="default" variant="ghost" onClick={close} disabled={submitting}>
          취소
        </Button>
        <Button size="default" onClick={requestCreate} disabled={!canCreate || submitting}>
          {submitting ? "생성 중" : "생성"}
        </Button>
      </div>
    </div>
    <ReceptionBreakTimeConfirmDialog
      mode="appointment"
      open={breakConfirmOpen}
      submitting={submitting}
      onOpenChange={setBreakConfirmOpen}
      onConfirm={() => {
        setBreakConfirmOpen(false);
        void submitCreate();
      }}
    />
    <ReceptionDiscardChangesDialog
      open={discardConfirmOpen}
      onOpenChange={setDiscardConfirmOpen}
      onDiscard={discardAndClose}
    />
    </>
  );
}

function ReceptionAppointmentCheckInFormDrawer({
  appointment,
  currentOperatingMinutes,
  guardian,
  onCheckIn,
  patient,
  presentation = "drawer",
  veterinarians,
  workspaceId,
}: {
  appointment: Appointment;
  currentOperatingMinutes: number;
  guardian?: Guardian;
  onCheckIn: (checkIn: ReceptionAppointmentCheckInRecord, weightKg?: number) => void;
  patient: Patient;
  presentation?: ReceptionDrawerPresentation;
  veterinarians: Veterinarian[];
  workspaceId: string;
}) {
  const authSession = useMockAuthStore((state) => state.session);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const appointmentDate =
    getOperatingDateFromIso(appointment.scheduledStartAt) ??
    getWorkspaceOperatingDate(workspaceId);
  const appointmentStartMinutes =
    getOperatingMinutesFromIso(appointment.scheduledStartAt) ??
    currentOperatingMinutes;
  const [department, setDepartment] = useState(defaultWalkInDepartment);
  const [duration, setDuration] = useState(
    getReceptionDrawerDurationLabel({ appointment }),
  );
  const [memo, setMemo] = useState(appointment.symptomNote ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState(
    Math.max(currentOperatingMinutes, appointmentStartMinutes),
  );
  const [veterinarianId, setVeterinarianId] = useState(
    appointment.assignedVeterinarianId ?? unassignedVeterinarianValue,
  );
  const [visitPurpose, setVisitPurpose] = useState(
    appointment.visitPurpose ?? appointment.symptomNote ?? "예약 접수",
  );
  const [weightKg, setWeightKg] = useState(
    formatPatientWeightKgInput(patient.weightKg),
  );
  const durationMinutes = getDurationMinutesFromLabel(duration) ?? 30;
  const {
    schedule: operatingSchedule,
    status: operatingScheduleStatus,
  } = useReceptionOperatingSchedule({
    actorId: authSession?.id,
    date: appointmentDate,
    workspaceId,
  });
  const effectiveVeterinarianId =
    veterinarianId !== unassignedVeterinarianValue &&
    veterinarians.some((veterinarian) => veterinarian.id === veterinarianId)
      ? veterinarianId
      : undefined;
  const parsedWeightKg = parseWeightKgInput(weightKg);
  const timeOptions = useMemo(() => {
    const options = getSelectableOperatingStartMinutes(operatingSchedule, durationMinutes)
      .filter((minutes) => minutes >= currentOperatingMinutes)
      .map((minutes) => ({
        label: getScheduleTimeLabelFromMinutes(minutes),
        minutes,
      }));
    return options;
  }, [currentOperatingMinutes, durationMinutes, operatingSchedule]);
  const canCreate =
    operatingScheduleStatus === "ready" &&
    Boolean(visitPurpose.trim()) &&
    timeOptions.length > 0 &&
    !submitting;

  useEffect(() => {
    if (!timeOptions.some((option) => option.minutes === timeMinutes)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimeMinutes(timeOptions[0]?.minutes ?? currentOperatingMinutes);
    }
  }, [currentOperatingMinutes, timeMinutes, timeOptions]);

  const create = async () => {
    if (!canCreate) return;

    const input: ReceptionAppointmentCheckInInput = {
      checkedInAt: getReceptionIsoAtMinutes(appointmentDate, timeMinutes),
      department,
      durationMinutes,
      memo,
      primaryVeterinarianId: effectiveVeterinarianId,
      visitPurpose,
      weightKg: parsedWeightKg,
    };

    setSubmitting(true);
    const result = await submitAppointmentCheckIn({
      actorRole: authSession?.role,
      appointmentId: appointment.id,
      input,
      workspaceId,
    });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(getAppointmentCheckInRouteErrorMessage(result));
      return;
    }

    onCheckIn(result.checkIn, parsedWeightKg);
    toast.success("예약 건 접수가 완료되었습니다");
  };

  const formContent = (
    <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <section className="rounded-lg border bg-[var(--emr-status-info-bg)] p-3">
            <div className="emr-text-body font-semibold">접수 생성</div>
            <div className="mt-1 emr-text-metadata text-[var(--emr-text-secondary)]">
              {guardian?.name ?? "보호자 미지정"} 보호자 · {patient.name} · 예약 건
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <ReceptionFormField label="진료과" required>
              <Select value={department} onValueChange={(value) => value && setDepartment(value)}>
                <SelectTrigger
                  aria-label="진료과"
                  size="lg"
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
            </ReceptionFormField>
            <ReceptionFormField label="담당의">
              <Select
                value={veterinarianId}
                onValueChange={(value) => value && setVeterinarianId(value)}
              >
                <SelectTrigger
                  aria-label="담당의"
                  size="lg"
                  className="w-full bg-card"
                >
                  <ReceptionVeterinarianIdentity
                    veterinarianId={veterinarianId}
                    veterinarians={veterinarians}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <ReceptionVeterinarianSelectItems
                      veterinarians={veterinarians}
                    />
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
            <ReceptionFormField label="체중">
              <div className="relative">
                <Input
                  aria-label="체중"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={weightKg}
                  className="h-9 bg-card pr-9"
                  onValueChange={(value) =>
                    setWeightKg(value.replace(/[^\d.]/g, ""))
                  }
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 emr-text-dense font-medium leading-4 text-foreground">
                  kg
                </span>
              </div>
            </ReceptionFormField>
          </section>

          <ReceptionFormField label="방문 목적" required>
            <Textarea
              aria-label="방문 목적"
              className="min-h-24 resize-none bg-card"
              value={visitPurpose}
              onChange={(event) => setVisitPurpose(event.target.value)}
            />
          </ReceptionFormField>

          <section className="grid grid-cols-3 gap-3">
            <ReceptionFormField label="접수일">
              <Input
                aria-label="접수일"
                value={formatShortOperatingDate(appointmentDate)}
                readOnly
                className="h-9 bg-card"
              />
            </ReceptionFormField>
            <ReceptionFormField label="접수시간">
              <Select
                value={String(timeMinutes)}
                onValueChange={(value) => setTimeMinutes(Number(value))}
              >
                <SelectTrigger aria-label="접수시간" size="lg" className="w-full bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {timeOptions.map((option) => (
                      <SelectItem key={option.minutes} value={String(option.minutes)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </ReceptionFormField>
            <ReceptionFormField label="소요시간" required>
              <Select value={duration} onValueChange={(value) => value && setDuration(value)}>
                <SelectTrigger aria-label="소요시간" size="lg" className="w-full bg-card">
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

          <ReceptionFormField label="접수 메모">
            <Textarea
              aria-label="접수 메모"
              className="min-h-24 resize-none bg-card"
              placeholder="접수 메모를 입력해주세요"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
          </ReceptionFormField>
        </div>
    </ScrollArea>
  );

  const formActions = (
    <>
      <Button
        size="default"
        variant="ghost"
        onClick={() => setActiveDrawer(null)}
        disabled={submitting}
      >
        취소
      </Button>
      <Button size="default" onClick={create} disabled={!canCreate}>
        {submitting ? "저장 중" : "생성"}
      </Button>
    </>
  );

  if (presentation === "side-panel") {
    return (
      <>
        <EmrRightPanelBody data-testid="appointment-check-in-form-drawer">
          {formContent}
        </EmrRightPanelBody>
        <EmrRightPanelFooter
          size="single"
          className="flex items-center justify-end gap-2 p-4"
        >
          {formActions}
        </EmrRightPanelFooter>
      </>
    );
  }

  return (
    <div
      className={getReceptionDrawerSurfaceClassName(presentation)}
      data-testid="appointment-check-in-form-drawer"
    >
      {formContent}
      <div className="mt-auto flex shrink-0 items-center justify-end gap-2 border-t bg-card p-4">
        {formActions}
      </div>
    </div>
  );
}

export function ReceptionRightPanel({ moduleLabel, workspaceId }: ShellComponentProps) {
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const setCalendarDraftSelection = useReceptionStore(
    (state) => state.setCalendarDraftSelection,
  );
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const persistedCalendarAppointments = useReceptionStore(
    (state) => state.persistedCalendarAppointments,
  );
  const guardians = usePatientProfileStore((state) => state.guardians);
  const patientGuardians = usePatientProfileStore(
    (state) => state.patientGuardians,
  );
  const patients = usePatientProfileStore((state) => state.patients);
  const [isEditing, setIsEditing] = useState(false);
  const title = getReceptionRightPanelTitle(activeDrawer);
  const usesReturnHeader = Boolean(activeDrawer?.returnTo);
  const searchParams = useSearchParams();
  const authSession = useMockAuthStore((state) => state.session);
  const operatingDateOverride = useReceptionStore(
    (state) => state.operatingDateByWorkspace[workspaceId],
  );
  const defaultOperatingDate = getWorkspaceOperatingDate(workspaceId);
  const routeOperatingDate = searchParams.get("date");
  const operatingDate =
    typeof routeOperatingDate === "string" && isIsoOperatingDate(routeOperatingDate)
      ? routeOperatingDate
      : (operatingDateOverride ?? defaultOperatingDate);
  const profileDataset = useMemo(
    () => ({ guardians, patientGuardians, patients }),
    [guardians, patientGuardians, patients],
  );
  const calendarAppointmentWork = useMemo<StaffCalendarAppointmentWork[]>(() => {
    if (activeDrawer?.type !== "staff-operational-profile") return [];

    const appointmentWork = getTodayAppointments(
      draftCheckIns.filter(isReceptionDraftCalendarActive),
      persistedCalendarAppointments,
      { operatingDate, workspaceId },
    )
      .filter(
        (appointment) =>
          isAppointmentAssignedToStaff(appointment, activeDrawer.id) &&
          appointment.status !== "cancelled" &&
          appointment.status !== "no_show",
      )
      .map((appointment) => {
        const patient = getAppointmentPatient(appointment, profileDataset);
        const guardian = getAppointmentGuardian(appointment, profileDataset);
        return {
          href: `/w/${encodeURIComponent(workspaceId)}/reception?appointmentId=${encodeURIComponent(appointment.id)}&modulePanel=open`,
          id: appointment.id,
          operatingDate,
          ...(appointment.scheduledEndAt
            ? { scheduledEndAt: appointment.scheduledEndAt }
            : {}),
          scheduledStartAt: appointment.scheduledStartAt,
          status: toStaffCalendarAppointmentStatus(appointment.status),
          title: [patient?.name, guardian?.name]
            .filter((value): value is string => Boolean(value?.trim()))
            .join(" · ") || "예약 진료",
          workKind: "appointment" as const,
          workLabel: "예약 진료" as const,
        };
      });

    const encounterWork = getEffectiveEncounters(draftCheckIns, {
      operatingDate,
      workspaceId,
    })
      .filter((encounter) => {
        return (
          !encounter.appointmentId &&
          getOperatingDateFromIso(encounter.checkedInAt ?? encounter.createdAt) === operatingDate &&
          encounter.status !== "cancelled" &&
          isEncounterAssignedToStaff(encounter, activeDrawer.id)
        );
      })
      .map((encounter): StaffCalendarAppointmentWork => {
        const scheduledStartAt = encounter.checkedInAt ?? encounter.createdAt;
        const durationMinutes = encounter.durationMinutes ?? 30;
        const scheduledEndAt = new Date(
          new Date(scheduledStartAt).getTime() + durationMinutes * 60_000,
        ).toISOString();
        const patient = profileDataset.patients.find(
          (item) => item.id === encounter.patientId && item.workspaceId === workspaceId,
        );
        const guardian = profileDataset.guardians.find(
          (item) => item.id === encounter.guardianId && item.workspaceId === workspaceId,
        );

        return {
          href: `/w/${encodeURIComponent(workspaceId)}/reception?encounterId=${encodeURIComponent(encounter.id)}&modulePanel=open`,
          id: encounter.id,
          operatingDate,
          scheduledEndAt,
          scheduledStartAt,
          status: "checked_in",
          title: [patient?.name, guardian?.name]
            .filter((value): value is string => Boolean(value?.trim()))
            .join(" · ") || "현장 접수",
          workKind: "encounter",
          workLabel: "현장 접수",
        };
      });

    return [...appointmentWork, ...encounterWork].sort((left, right) =>
      left.scheduledStartAt.localeCompare(right.scheduledStartAt),
    );
  }, [
    activeDrawer,
    draftCheckIns,
    operatingDate,
    persistedCalendarAppointments,
    profileDataset,
    workspaceId,
  ]);

  const closeStaffProfile = useCallback(() => {
    const returnFocusId = activeDrawer?.rightPanelPresentation?.returnFocusId;
    setActiveDrawer(null);
    setRightPanelOpen(false);
    window.setTimeout(() => {
      if (returnFocusId) document.getElementById(returnFocusId)?.focus();
    }, 0);
  }, [activeDrawer?.rightPanelPresentation?.returnFocusId, setActiveDrawer, setRightPanelOpen]);
  const returnFromReceptionPanel = useCallback(() => {
    setDiscardConfirmOpen(false);
    setCalendarDraftSelection(undefined);
    const returnDrawer = getReceptionReturnDrawer(activeDrawer);
    if (returnDrawer) {
      setActiveDrawer(returnDrawer);
      setRightPanelOpen(true);
      return;
    }
    setRightPanelOpen(false);
  }, [
    activeDrawer,
    setActiveDrawer,
    setCalendarDraftSelection,
    setRightPanelOpen,
  ]);
  const closeReceptionPanel = useCallback(() => {
    if (activeDrawer?.hasUnsavedChanges) {
      setDiscardConfirmOpen(true);
      return;
    }
    returnFromReceptionPanel();
  }, [activeDrawer?.hasUnsavedChanges, returnFromReceptionPanel]);

  if (activeDrawer?.type === "staff-operational-profile") {
    return (
      <StaffOperationalProfilePanel
        key={`${workspaceId}:${activeDrawer.id}`}
        actorUserId={
          isPreparedEmptyClinicWorkspace(workspaceId)
            ? authSession?.id
            : getReceptionDemoActorId(authSession?.role)
        }
        calendarAppointments={calendarAppointmentWork}
        date={defaultOperatingDate}
        onClose={closeStaffProfile}
        todayDate={defaultOperatingDate}
        userId={activeDrawer.id}
        workspaceId={workspaceId}
      />
    );
  }

  return (
    <>
      <EmrRightPanel
        aria-label={`${moduleLabel} 우측 사이드 패널`}
        className="bg-[var(--emr-surface-rightpanel)]"
        data-testid="reception-right-panel"
        header={
          <EmrRightPanelHeader
            className={cn(
              "justify-between border-b border-[var(--emr-border-default)]",
              usesReturnHeader && "h-[65px] px-2 py-4",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              {usesReturnHeader ? (
                <EmrRightPanelHeaderIconButton
                  aria-label="환자 프로필로 돌아가기"
                  className="h-8 w-6 shrink-0 rounded-lg p-0"
                  onClick={closeReceptionPanel}
                >
                  <CdsNavigationChevronLeftIcon size={16} />
                </EmrRightPanelHeaderIconButton>
              ) : null}
              <div className="truncate emr-text-panel-title font-semibold text-foreground">
                {title}
              </div>
              {activeDrawer?.type === "reception-encounter" && isEditing ? (
                <Badge
                  size="sm"
                  variant="secondary"
                  className="shrink-0 rounded-[var(--clair-radius-atomic-6)] emr-text-micro font-semibold"
                  data-testid="reception-right-panel-editing-badge"
                >
                  수정 중
                </Badge>
              ) : null}
            </div>
            {usesReturnHeader ? (
              <span aria-hidden="true" className="size-8 shrink-0" />
            ) : (
              <EmrRightPanelHeaderIconButton
                aria-label="우측 사이드 패널 닫기"
                onClick={closeReceptionPanel}
              >
                {activeDrawer?.type === "reception-encounter" ? (
                  <CdsActionsXIcon />
                ) : (
                  <CdsNavigationSidebarIcon />
                )}
              </EmrRightPanelHeaderIconButton>
            )}
          </EmrRightPanelHeader>
        }
      >
        {isReceptionRightPanelDrawer(activeDrawer) ? (
          <ReceptionDrawer
            presentation="side-panel"
            onEditingChange={setIsEditing}
          />
        ) : (
          <ReceptionRightPanelEmptyState />
        )}
      </EmrRightPanel>
      <ReceptionDiscardChangesDialog
        open={discardConfirmOpen}
        onOpenChange={setDiscardConfirmOpen}
        onDiscard={returnFromReceptionPanel}
      />
    </>
  );
}

function getReceptionRightPanelTitle(drawer: DrawerState) {
  if (drawer?.type === "reception-appointment") return "예약 상세";
  if (drawer?.type === "reception-encounter") return "접수 상세";
  if (drawer?.type === "reception-reservation-form") return "예약 생성";
  if (
    drawer?.type === "reception-form" ||
    drawer?.type === "reception-appointment-check-in-form"
  ) {
    return "접수 생성";
  }

  return "접수 상세";
}

function ReceptionRightPanelEmptyState() {
  return (
    <EmrRightPanelBody className="items-center justify-center px-6">
      <EmrEmptyState
        kind="no-data"
        reserveActionSpace={false}
        size="md"
        surface="drawer"
        testId="reception-right-panel-empty-state"
        title="선택된 접수/예약 건이 없습니다"
      />
    </EmrRightPanelBody>
  );
}

type ReceptionSidePanelLayoutVariant = "default" | "create";

function ReceptionSidePanelSection({
  children,
  title,
  variant = "default",
}: {
  children: ReactNode;
  title: string;
  variant?: ReceptionSidePanelLayoutVariant;
}) {
  if (variant === "create") {
    return (
      <section className="flex flex-col gap-[var(--clair-spacing-12)]">
        <h3 className="flex h-[var(--clair-spacing-24)] items-center emr-text-dense-label font-medium text-[var(--clair-color-atomic-neutral-400)]">
          {title}
        </h3>
        <div className="flex flex-col gap-[var(--clair-spacing-12)]">
          {children}
        </div>
      </section>
    );
  }

  return (
    <section className="border-b border-[var(--emr-border-subtle)] py-4 last:border-b-0">
      <h3 className="mb-3 emr-text-metadata font-medium text-[var(--emr-text-placeholder)]">
        {title}
      </h3>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function ReceptionSidePanelDivider() {
  return <div aria-hidden="true" className="h-px bg-[var(--emr-border-subtle)]" />;
}

function ReceptionSidePanelField({
  align = "center",
  children,
  error,
  errorId,
  icon,
  label,
  required = false,
  variant = "default",
}: {
  align?: "center" | "start";
  children: ReactNode;
  error?: string;
  errorId?: string;
  icon: ReactNode;
  label: string;
  required?: boolean;
  variant?: ReceptionSidePanelLayoutVariant;
}) {
  const isCreate = variant === "create";

  return (
    <div
      className={cn(
        isCreate
          ? "grid min-w-0 grid-cols-[var(--emr-reception-create-field-label-width)_minmax(0,1fr)] gap-[var(--clair-spacing-12)]"
          : "grid min-w-0 grid-cols-[96px_minmax(0,1fr)] gap-3",
        align === "center" ? "items-center" : "items-start",
      )}
    >
      <div
        className={cn(
          isCreate
            ? "flex min-w-0 items-center gap-[var(--clair-spacing-8)] emr-text-section font-medium text-[var(--clair-color-atomic-neutral-500)]"
            : "flex min-w-0 items-center gap-2 emr-text-dense-label font-semibold text-[var(--emr-text-secondary)]",
          align === "start" &&
            (isCreate ? "pt-[var(--clair-spacing-6)]" : "pt-2"),
        )}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center",
            isCreate
              ? "size-[var(--emr-reception-create-field-icon-size)] text-[var(--clair-color-atomic-neutral-500)]"
              : "size-4 text-[var(--emr-text-tertiary)]",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 truncate">
          {label}
          {required ? <EmrRequiredIndicator className="ml-0.5" /> : null}
        </span>
      </div>
      <div className="min-w-0">
        {children}
        {error ? (
          <FieldError
            id={errorId}
            className="mt-[var(--clair-spacing-4)] emr-text-metadata leading-[14px]"
          >
            {error}
          </FieldError>
        ) : null}
      </div>
    </div>
  );
}

function ReceptionSidePanelInput({
  className,
  unit,
  variant = "default",
  ...props
}: InputPropsWithUnit) {
  const isCreate = variant === "create";

  return (
    <div className="relative min-w-0">
      <Input
        {...props}
        className={cn(
          isCreate
            ? "bg-[var(--emr-reception-create-field-bg)] font-medium text-[var(--clair-color-atomic-neutral-800)]"
            : "h-8 bg-card emr-text-dense font-semibold",
          unit && "pr-12",
          className,
        )}
      />
      {unit ? (
        <span
          className={cn(
            "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2",
            isCreate
              ? "emr-control-text font-normal text-[var(--clair-color-atomic-neutral-600)]"
              : "emr-text-dense-label font-semibold text-[var(--emr-text-secondary)]",
          )}
        >
          {unit}
        </span>
      ) : null}
    </div>
  );
}

function ReceptionVeterinarianReadonlyInput({
  className,
  value,
  veterinarianId,
  veterinarians,
  variant = "default",
}: {
  className?: string;
  value: string;
  veterinarianId?: string;
  veterinarians: Veterinarian[];
  variant?: ReceptionSidePanelLayoutVariant;
}) {
  const veterinarian = veterinarianId
    ? veterinarians.find((item) => item.id === veterinarianId)
    : undefined;

  return (
    <div className="relative min-w-0">
      <span className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2">
        <ReceptionVeterinarianAvatar veterinarian={veterinarian} />
      </span>
      <ReceptionSidePanelInput
        aria-label="담당의"
        readOnly
        value={value}
        variant={variant}
        className={cn(
          "pl-[calc(var(--emr-reception-veterinarian-avatar-size)+var(--clair-spacing-16))]",
          className,
        )}
      />
    </div>
  );
}

type InputPropsWithUnit = ComponentProps<typeof Input> & {
  unit?: string;
  variant?: ReceptionSidePanelLayoutVariant;
};

function getReceptionSidePanelWeightInputValue(weightKg?: number) {
  if (typeof weightKg !== "number" || !Number.isFinite(weightKg)) return "";

  return Number.isInteger(weightKg) ? `${weightKg}` : `${weightKg}`;
}

const receptionCreateVitalOptions = [
  { id: "weight", label: "체중", unit: "kg", inputMode: "decimal" },
  { id: "temperature", label: "체온", unit: "°C", inputMode: "decimal" },
  { id: "heartRate", label: "심박수", unit: "bpm", inputMode: "numeric" },
  { id: "respiration", label: "호흡", unit: "rpm", inputMode: "numeric" },
  { id: "bloodPressure", label: "혈압", unit: "mmHg", inputMode: "numeric" },
] as const;

const getReceptionCreateVitalIcon = (id: ReceptionCreateVitalId) => {
  if (id === "temperature") return <CdsMedicalThermometerIcon className="size-3.5" />;
  if (id === "respiration" || id === "heartRate") return <CdsMedicalHeartPulseIcon className="size-3.5" />;
  return <CdsMedicalActivityIcon className="size-3.5" />;
};

function ReceptionCreateVitalFields({
  draft,
  fieldErrors,
  fieldWarnings,
  presentation,
  setDraft,
  vitalSettings,
}: {
  draft: ReceptionCreateVitalDraft;
  fieldErrors: ReceptionCreateVitalFieldErrors;
  fieldWarnings: ReceptionCreateVitalFieldWarnings;
  presentation: ReceptionDrawerPresentation;
  setDraft: (
    updater: (current: ReceptionCreateVitalDraft) => ReceptionCreateVitalDraft,
  ) => void;
  vitalSettings: WorkspaceVitalSettingsSnapshot;
}) {
  const [announcement, setAnnouncement] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const addTriggerRef = useRef<HTMLButtonElement | null>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement | null>(null);
  const inputRefs = useRef<Partial<Record<ReceptionCreateVitalId, HTMLElement | null>>>({});
  const enabledIds = getEnabledWorkspaceVitalSettings(vitalSettings).map((item) =>
    workspaceVitalKeyToReceptionId(item.key),
  );
  const configuredOptions = enabledIds.flatMap((id) => {
    const option = receptionCreateVitalOptions.find((candidate) => candidate.id === id);
    return option ? [{ ...option, unit: getReceptionVitalUnit(vitalSettings, workspaceVitalKeyByReceptionId[id]) }] : [];
  });
  const availableOptions: typeof configuredOptions = [];
  const removable = false;

  useEffect(() => {
    if (!menuOpen) return;
    const frame = window.requestAnimationFrame(() => firstMenuItemRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [menuOpen]);

  const updateValue = (
    key: keyof ReceptionCreateVitalDraft["values"],
    value: string,
  ) => {
    setDraft((current) => {
      const serverErrors = { ...current.serverErrors };
      delete serverErrors[key];

      return {
        ...current,
        serverErrors,
        values: { ...current.values, [key]: value },
      };
    });
  };

  const showFeedback = (key: keyof ReceptionCreateVitalDraft["values"]) => {
    if (!fieldErrors[key] && !fieldWarnings[key]) return;
    setDraft((current) =>
      current.shownErrors[key] && current.shownWarnings[key]
        ? current
        : {
            ...current,
            shownErrors: fieldErrors[key]
              ? { ...current.shownErrors, [key]: true }
              : current.shownErrors,
            shownWarnings: fieldWarnings[key]
              ? { ...current.shownWarnings, [key]: true }
              : current.shownWarnings,
          },
    );
  };

  const addVital = (id: ReceptionCreateVitalId) => {
    const option = configuredOptions.find((item) => item.id === id);
    setDraft((current) => ({
      ...current,
      selectedIds: current.selectedIds.includes(id)
        ? current.selectedIds
        : [...current.selectedIds, id],
    }));
    setAnnouncement(`${option?.label ?? "바이탈"} 입력 행이 추가되었습니다.`);
    setMenuOpen(false);
    window.setTimeout(() => inputRefs.current[id]?.focus(), 0);
  };

  const removeVital = (id: ReceptionCreateVitalId) => {
    if (!removable) return;
    const option = configuredOptions.find((item) => item.id === id);
    setDraft((current) => ({
      ...current,
      selectedIds:
        current.selectedIds.length > 1
          ? current.selectedIds.filter((item) => item !== id)
          : current.selectedIds,
    }));
    setAnnouncement(`${option?.label ?? "바이탈"} 입력 행이 삭제되었습니다.`);
    window.setTimeout(() => addTriggerRef.current?.focus(), 0);
  };

  const renderRemoveButton = (id: ReceptionCreateVitalId, label: string) =>
    removable ? (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-8 shrink-0 text-[var(--emr-text-tertiary)]"
        aria-label={`${label} 삭제`}
        onClick={() => removeVital(id)}
      >
        <CdsActionsTrash2Icon className="size-3.5" />
      </Button>
    ) : null;

  const renderSingleInput = (
    id: Exclude<ReceptionCreateVitalId, "bloodPressure">,
    label: string,
    unit: string,
    inputMode: "decimal" | "numeric",
  ) => {
    const key =
      id === "weight"
        ? "weightKg"
        : id === "temperature"
          ? "temperatureC"
          : id === "heartRate"
            ? "heartRateBpm"
            : "respiratoryRateRpm";
    const error = draft.shownErrors[key] ? fieldErrors[key] : undefined;
    const warning = !error && draft.shownWarnings[key]
      ? fieldWarnings[key]
      : undefined;
    const errorId = `walk-in-vital-${key}-error`;
    const warningId = `walk-in-vital-${key}-warning`;
    const describedBy = error ? errorId : warning ? warningId : undefined;
    const placeholder =
      id === "weight" || id === "temperature"
        ? "측정값 입력"
        : "분당 횟수 입력";
    const input =
      presentation === "side-panel" ? (
        <ReceptionSidePanelInput
          ref={(element) => {
            inputRefs.current[id] = element;
          }}
          aria-describedby={describedBy}
          aria-label={label}
          aria-invalid={Boolean(error) || undefined}
          inputMode={inputMode}
          placeholder={placeholder}
          unit={unit}
          value={draft.values[key]}
          variant="create"
          onBlur={() => showFeedback(key)}
          onValueChange={(value) => updateValue(key, value)}
        />
      ) : (
        <div className="relative min-w-0 flex-1">
          <Input
            ref={(element) => {
              inputRefs.current[id] = element;
            }}
            aria-describedby={describedBy}
            aria-label={label}
            aria-invalid={Boolean(error) || undefined}
            className="h-9 bg-card pr-12"
            inputMode={inputMode}
            placeholder={placeholder}
            value={draft.values[key]}
            onBlur={() => showFeedback(key)}
            onValueChange={(value) => updateValue(key, value)}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 emr-text-dense font-medium text-foreground">
            {unit}
          </span>
        </div>
      );

    return (
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">{input}</div>
          {renderRemoveButton(id, label)}
        </div>
        {error ? (
          <FieldError
            id={errorId}
            className="mt-1 emr-text-micro font-medium"
          >
            {error}
          </FieldError>
        ) : null}
        {warning ? (
          <p
            id={warningId}
            role="status"
            className="mt-1 emr-text-micro font-medium text-[var(--emr-status-warning-text)]"
          >
            {warning}
          </p>
        ) : null}
      </div>
    );
  };

  const renderBloodPressureInput = () => {
    const systolicError = draft.shownErrors.bloodPressureSystolicMmhg
      ? fieldErrors.bloodPressureSystolicMmhg
      : undefined;
    const diastolicError = draft.shownErrors.bloodPressureDiastolicMmhg
      ? fieldErrors.bloodPressureDiastolicMmhg
      : undefined;
    const systolicWarning = !systolicError && draft.shownWarnings.bloodPressureSystolicMmhg
      ? fieldWarnings.bloodPressureSystolicMmhg
      : undefined;
    const diastolicWarning = !diastolicError && draft.shownWarnings.bloodPressureDiastolicMmhg
      ? fieldWarnings.bloodPressureDiastolicMmhg
      : undefined;
    const systolicErrorId = "walk-in-vital-bloodPressureSystolicMmhg-error";
    const diastolicErrorId = "walk-in-vital-bloodPressureDiastolicMmhg-error";
    const systolicWarningId = "walk-in-vital-bloodPressureSystolicMmhg-warning";
    const diastolicWarningId = "walk-in-vital-bloodPressureDiastolicMmhg-warning";
    return (
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Input
              ref={(element) => {
                inputRefs.current.bloodPressure = element;
              }}
              aria-describedby={
                systolicError
                  ? systolicErrorId
                  : systolicWarning
                    ? systolicWarningId
                    : undefined
              }
              aria-label="수축기 혈압"
              aria-invalid={Boolean(systolicError) || undefined}
              className={cn(
                presentation === "side-panel"
                  ? "bg-[var(--emr-reception-create-field-bg)] font-medium"
                  : "h-9 bg-card",
              )}
              inputMode="numeric"
              placeholder="수축기"
              value={draft.values.bloodPressureSystolicMmhg}
              onBlur={() => showFeedback("bloodPressureSystolicMmhg")}
              onValueChange={(value) =>
                updateValue("bloodPressureSystolicMmhg", value)
              }
            />
            <span aria-hidden="true" className="text-muted-foreground">/</span>
            <Input
              aria-describedby={
                diastolicError
                  ? diastolicErrorId
                  : diastolicWarning
                    ? diastolicWarningId
                    : undefined
              }
              aria-label="이완기 혈압"
              aria-invalid={Boolean(diastolicError) || undefined}
              className={cn(
                presentation === "side-panel"
                  ? "bg-[var(--emr-reception-create-field-bg)] font-medium"
                  : "h-9 bg-card",
              )}
              inputMode="numeric"
              placeholder="이완기"
              value={draft.values.bloodPressureDiastolicMmhg}
              onBlur={() => showFeedback("bloodPressureDiastolicMmhg")}
              onValueChange={(value) =>
                updateValue("bloodPressureDiastolicMmhg", value)
              }
            />
            <span className="shrink-0 emr-text-dense font-medium text-foreground">mmHg</span>
          </div>
          {renderRemoveButton("bloodPressure", "혈압")}
        </div>
        {systolicError ? (
          <FieldError
            id={systolicErrorId}
            className="mt-1 emr-text-micro font-medium"
          >
            {systolicError}
          </FieldError>
        ) : null}
        {diastolicError ? (
          <FieldError
            id={diastolicErrorId}
            className="mt-1 emr-text-micro font-medium"
          >
            {diastolicError}
          </FieldError>
        ) : null}
        {systolicWarning ? (
          <p
            id={systolicWarningId}
            role="status"
            className="mt-1 emr-text-micro font-medium text-[var(--emr-status-warning-text)]"
          >
            {systolicWarning}
          </p>
        ) : null}
        {diastolicWarning ? (
          <p
            id={diastolicWarningId}
            role="status"
            className="mt-1 emr-text-micro font-medium text-[var(--emr-status-warning-text)]"
          >
            {diastolicWarning}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div data-testid="walk-in-vital-rows" className="grid gap-[10px]">
        {draft.selectedIds.map((id) => {
          const option = configuredOptions.find((item) => item.id === id);
          if (!option) return null;
          const content =
            id === "bloodPressure"
              ? renderBloodPressureInput()
              : renderSingleInput(id, option.label, option.unit, option.inputMode);

          return presentation === "side-panel" ? (
            <ReceptionSidePanelField
              key={id}
              icon={getReceptionCreateVitalIcon(id)}
              label={option.label}
              variant="create"
            >
              {content}
            </ReceptionSidePanelField>
          ) : (
            <RegistrationFormField key={id} label={option.label}>
              {content}
            </RegistrationFormField>
          );
        })}
      </div>
      {availableOptions.length > 0 ? (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger
            render={
              <Button
                ref={addTriggerRef}
                type="button"
                variant="outline"
                aria-controls="walk-in-vital-menu"
                aria-expanded={menuOpen}
                className={cn(
                  "w-full border-dashed shadow-none hover:shadow-none active:shadow-none",
                  presentation === "side-panel"
                    ? "h-[var(--clair-control-height-md)] border-[var(--emr-border-default)] bg-[var(--emr-reception-create-add-vital-bg)] emr-control-text font-medium text-[var(--clair-color-atomic-neutral-500)]"
                    : "h-9 bg-card emr-text-dense-label font-semibold text-[var(--emr-text-secondary)]",
                )}
              />
            }
          >
            <CdsActionsPlusIcon className="size-3.5" />
            바이탈 추가
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="w-[244px] p-1.5">
            <div
              id="walk-in-vital-menu"
              role="menu"
              aria-label="추가할 바이탈 선택"
              className="flex flex-col gap-1"
            >
              {availableOptions.map((option, index) => (
                <button
                  key={option.id}
                  ref={index === 0 ? firstMenuItemRef : undefined}
                  type="button"
                  role="menuitem"
                  className="flex h-10 w-full items-center gap-2 rounded-[var(--emr-radius-control)] px-2 text-left emr-text-dense font-semibold text-foreground hover:bg-[var(--emr-state-hover)] focus-visible:bg-[var(--emr-state-hover)] focus-visible:outline-none"
                  onClick={() => addVital(option.id)}
                >
                  <span
                    data-testid={`walk-in-vital-option-icon-${option.id}`}
                    className="flex size-7 items-center justify-center rounded-md bg-[var(--clair-color-atomic-neutral-50)] text-[var(--emr-text-secondary)]"
                  >
                    {getReceptionCreateVitalIcon(option.id)}
                  </span>
                  <span>{option.label} {option.unit}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </>
  );
}

function ReceptionVitalField({
  editDraft,
  editMode,
  errorMessage,
  onRemove,
  onUpdateExtraVital,
  option,
  removable,
  value,
  variant = "default",
  setEditDraft,
}: {
  editDraft: ReceptionEncounterUpdateInput;
  editMode: boolean;
  errorMessage?: string;
  onRemove: () => void;
  onUpdateExtraVital: (id: ReceptionSidePanelVitalId, value: string) => void;
  option: (typeof receptionSidePanelVitalOptions)[number];
  removable: boolean;
  value: string;
  variant?: ReceptionSidePanelLayoutVariant;
  setEditDraft: (
    updater: (current: ReceptionEncounterUpdateInput) => ReceptionEncounterUpdateInput,
  ) => void;
}) {
  const inputValue =
    option.id === "weight"
      ? editMode
        ? getReceptionSidePanelWeightInputValue(editDraft.weightKg)
        : value
      : value;

  return (
    <ReceptionSidePanelField
      error={errorMessage}
      errorId="reception-encounter-edit-weightKg-error"
      icon={option.icon}
      label={option.label}
      variant={variant}
    >
      <div className="flex min-w-0 items-center gap-2">
        <ReceptionSidePanelInput
          aria-label={option.label}
          aria-describedby={
            errorMessage ? "reception-encounter-edit-weightKg-error" : undefined
          }
          aria-invalid={Boolean(errorMessage) || undefined}
          readOnly={!editMode}
          inputMode={option.id === "bloodPressure" ? "text" : "decimal"}
          value={inputValue}
          unit={option.unit}
          variant={variant}
          onChange={(event) => {
            if (!editMode) return;
            const nextValue = event.target.value;

            if (option.id !== "weight") {
              onUpdateExtraVital(option.id, nextValue);
              return;
            }

            const nextWeight = parseWeightKgInput(nextValue);
            setEditDraft((current) => ({
              ...current,
              weightKg: nextValue.trim() ? nextWeight : undefined,
            }));
          }}
        />
        {editMode && removable ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 text-[var(--emr-text-tertiary)]"
            aria-label={`${option.label} 삭제`}
            onClick={onRemove}
          >
            <CdsActionsTrash2Icon className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </ReceptionSidePanelField>
  );
}

function ReceptionAddVitalMenu({
  onAdd,
  options,
}: {
  onAdd: (id: ReceptionSidePanelVitalId) => void;
  options: typeof receptionSidePanelVitalOptions;
}) {
  const [open, setOpen] = useState(false);

  if (options.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-8 w-full border-dashed bg-card emr-text-dense-label font-semibold text-[var(--emr-text-secondary)]"
          >
            <CdsActionsPlusIcon className="size-3.5" />
            바이탈 추가
          </Button>
        }
      />
      <PopoverContent align="end" sideOffset={6} className="w-[244px] p-1.5">
        <div className="flex flex-col gap-1">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="flex h-8 w-full items-center gap-2 rounded-[var(--emr-radius-control)] px-2 text-left emr-text-dense font-semibold text-foreground hover:bg-[var(--emr-state-hover)] focus-visible:bg-[var(--emr-state-hover)] focus-visible:outline-none"
              onClick={() => {
                onAdd(option.id);
                setOpen(false);
              }}
            >
              <span className="flex size-4 items-center justify-center text-[var(--emr-text-secondary)]">
                {option.icon}
              </span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ReceptionAppointmentBeforeCheckInNotice({
  disabled,
  onCheckIn,
}: {
  disabled: boolean;
  onCheckIn: () => void;
}) {
  return (
    <section
      role="status"
      data-testid="reservation-before-check-in-notice"
      className="flex min-h-[var(--clair-spacing-64)] items-center justify-between gap-[var(--clair-spacing-12)] rounded-[var(--emr-radius-control)] border border-[var(--emr-status-neutral-border)] bg-[var(--clair-color-static-white)] px-[var(--clair-spacing-12)] py-[var(--clair-spacing-8)]"
    >
      <div className="min-w-0">
        <p className="emr-text-body font-semibold text-[var(--emr-text-primary)]">
          접수 전, 예약 건입니다
        </p>
        <p className="mt-[var(--clair-spacing-4)] emr-text-dense font-medium text-[var(--emr-text-tertiary)]">
          보호자 방문 시, 접수 할 수 있습니다.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={disabled}
        onClick={onCheckIn}
        data-testid="reservation-before-check-in-notice-action"
      >
        접수하기
      </Button>
    </section>
  );
}

function ReceptionSidePanelDetail({
  canCancelSelectedEncounter,
  canEditSelectedEncounter,
  checkInDisabled,
  departmentValue,
  editDraft,
  editFeedback,
  editFieldErrors,
  editMode,
  editSubmitting,
  guardian,
  memoLabel,
  onCancelOpen,
  onCheckInOrCreate,
  onClose,
  onEditOpen,
  onSave,
  patient,
  patientWeightLabel,
  primaryActionLabel,
  receptionDate,
  receptionDurationMinutes,
  receptionStartAt,
  selectedAppointment,
  selectedEncounter,
  setEditDraft,
  veterinarianName,
  veterinarians,
  visitReason,
}: {
  canCancelSelectedEncounter?: boolean;
  canEditSelectedEncounter?: boolean;
  checkInDisabled: boolean;
  departmentValue: string;
  editDraft: ReceptionEncounterUpdateInput;
  editFeedback: ReceptionEncounterEditFeedback | null;
  editFieldErrors: ReceptionEncounterEditFieldErrors;
  editMode: boolean;
  editSubmitting: boolean;
  guardian?: Guardian;
  memoLabel: string;
  onCancelOpen: () => void;
  onCheckInOrCreate: () => void;
  onClose: () => void;
  onEditOpen: () => void;
  onSave: () => void;
  patient: Patient;
  patientWeightLabel: string;
  primaryActionLabel?: string;
  receptionDate: string;
  receptionDurationMinutes: number;
  receptionStartAt?: string;
  selectedAppointment?: Appointment;
  selectedEncounter?: Encounter;
  setEditDraft: (
    updater: (current: ReceptionEncounterUpdateInput) => ReceptionEncounterUpdateInput,
  ) => void;
  veterinarianName: string;
  veterinarians: Veterinarian[];
  visitReason: string;
}) {
  const [selectedVitalIds, setSelectedVitalIds] = useState<
    ReceptionSidePanelVitalId[]
  >(["weight"]);
  const [extraVitalValues, setExtraVitalValues] = useState<
    Partial<Record<ReceptionSidePanelVitalId, string>>
  >({});

  const selectedVitalOptions = receptionSidePanelVitalOptions.filter((option) =>
    selectedVitalIds.includes(option.id),
  );
  const availableVitalOptions = receptionSidePanelVitalOptions.filter(
    (option) => !selectedVitalIds.includes(option.id),
  );
  const canRemoveVital = selectedVitalIds.length > 1;
  const appointmentReadyForCheckIn =
    selectedAppointment?.status === "confirmed";
  const detailVariant: ReceptionSidePanelLayoutVariant = "create";
  const usesCreateDetailLayout = detailVariant === "create";
  const detailDateLabel = selectedAppointment ? "예약일" : "접수일";
  const detailTimeLabel = selectedAppointment ? "예약시간" : "접수시간";
  const detailTimeSectionTitle = selectedAppointment ? "예약 정보" : "접수 정보";
  const detailDateValue = selectedAppointment
    ? formatReceptionSidePanelDateFromDateTime(selectedAppointment.scheduledStartAt)
    : receptionDate;
  const detailTimeValue = selectedAppointment
    ? formatReceptionSidePanelTime(selectedAppointment.scheduledStartAt)
    : receptionStartAt
      ? getShortTime(receptionStartAt)
      : "-";

  return (
    <>
      <EmrRightPanelBody>
      <ScrollArea className="min-h-0 flex-1">
        <div
          className={
            usesCreateDetailLayout
              ? "flex flex-col gap-[var(--clair-spacing-16)] p-[var(--clair-spacing-16)]"
              : "px-4"
          }
        >
          {appointmentReadyForCheckIn ? (
            <ReceptionAppointmentBeforeCheckInNotice
              disabled={checkInDisabled}
              onCheckIn={onCheckInOrCreate}
            />
          ) : null}

          {selectedEncounter || selectedAppointment ? (
            <div className="flex justify-end">
              <ReceptionStatusBadge
                label={
                  selectedEncounter
                    ? getReceptionEncounterStatusLabel(selectedEncounter.status)
                    : getStatusLabel("appointment", selectedAppointment!.status)
                }
                testId="reception-detail-status"
                tone={
                  selectedEncounter
                    ? getReceptionEncounterStatusTone(selectedEncounter.status)
                    : getAppointmentTone(selectedAppointment!.status)
                }
              />
            </div>
          ) : null}

          <ReceptionSidePanelSection title="환자/보호자" variant={detailVariant}>
            <ReceptionSidePanelField
              icon={<CdsMedicalPawPrintIcon className="size-3.5" />}
              label="동물명"
              variant={detailVariant}
            >
              <ReceptionSidePanelInput
                aria-label="동물명"
                readOnly
                variant={detailVariant}
                value={`${patient.name} · ${getSpeciesLabel(patient.species)}${
                  patient.breed ? ` · ${patient.breed}` : ""
                }`}
              />
            </ReceptionSidePanelField>
            <ReceptionSidePanelField
              icon={<CdsPeopleUserIcon className="size-3.5" />}
              label="보호자명"
              variant={detailVariant}
            >
              <ReceptionSidePanelInput
                aria-label="보호자명"
                readOnly
                variant={detailVariant}
                value={`${guardian?.name ?? "보호자 미지정"}${
                  guardian?.mobilePhone ? ` · ${guardian.mobilePhone}` : ""
                }`}
              />
            </ReceptionSidePanelField>
          </ReceptionSidePanelSection>
          {usesCreateDetailLayout ? <ReceptionSidePanelDivider /> : null}

          <ReceptionSidePanelSection title="바이탈" variant={detailVariant}>
            {!editMode &&
            selectedEncounter &&
            isPreparedEmptyClinicWorkspace(patient.workspaceId) ? (
              <ReceptionPersistedEncounterVitals
                encounterId={selectedEncounter.id}
                workspaceId={patient.workspaceId}
              />
            ) : (
              <>
                {selectedVitalOptions.map((option) => (
                  <ReceptionVitalField
                    key={option.id}
                    editDraft={editDraft}
                    editMode={editMode}
                    errorMessage={option.id === "weight" ? editFieldErrors.weightKg : undefined}
                    option={option}
                    removable={canRemoveVital}
                    setEditDraft={setEditDraft}
                    variant={detailVariant}
                    value={
                      option.id === "weight"
                        ? patientWeightLabel.replace(/\s*kg$/i, "")
                        : (extraVitalValues[option.id] ?? option.defaultValue)
                    }
                    onRemove={() =>
                      setSelectedVitalIds((current) =>
                        current.length > 1
                          ? current.filter((id) => id !== option.id)
                          : current,
                      )
                    }
                    onUpdateExtraVital={(id, nextValue) =>
                      setExtraVitalValues((current) => ({
                        ...current,
                        [id]: nextValue,
                      }))
                    }
                  />
                ))}
                {editMode ? (
                  <ReceptionAddVitalMenu
                    options={availableVitalOptions}
                    onAdd={(id) =>
                      setSelectedVitalIds((current) =>
                        current.includes(id) ? current : [...current, id],
                      )
                    }
                  />
                ) : null}
              </>
            )}
          </ReceptionSidePanelSection>
          {usesCreateDetailLayout ? <ReceptionSidePanelDivider /> : null}

          <ReceptionSidePanelSection title="진료과/담당의" variant={detailVariant}>
            <ReceptionSidePanelField
              error={editFieldErrors.department}
              errorId="reception-encounter-edit-department-error"
              icon={<CdsMedicalStethoscopeIcon className="size-3.5" />}
              label="진료과"
              required={editMode}
              variant={detailVariant}
            >
              {editMode ? (
                <Select
                  value={editDraft.department ?? defaultWalkInDepartment}
                  onValueChange={(value) =>
                    setEditDraft((current) => ({
                      ...current,
                      department: value ?? undefined,
                    }))
                  }
                >
                  <SelectTrigger
                    aria-describedby={
                      editFieldErrors.department
                        ? "reception-encounter-edit-department-error"
                        : undefined
                    }
                    aria-invalid={Boolean(editFieldErrors.department) || undefined}
                    aria-label="진료과"
                    aria-required="true"
                    className="w-full bg-card"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" className="min-w-[224px]">
                    <SelectGroup>
                      <SelectItem value="영상의학과 · 방사선종양학과">
                        영상의학과 · 방사선종양학과
                      </SelectItem>
                      <SelectItem value="내과">내과</SelectItem>
                      <SelectItem value="외과">외과</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <ReceptionSidePanelInput
                  aria-label="진료과"
                  readOnly
                  value={departmentValue}
                  variant={detailVariant}
                />
              )}
            </ReceptionSidePanelField>
            <ReceptionSidePanelField
              error={editFieldErrors.primaryVeterinarianId}
              errorId="reception-encounter-edit-primaryVeterinarianId-error"
              icon={<CdsMedicalStethoscopeIcon className="size-3.5" />}
              label="담당의"
              variant={detailVariant}
            >
              {editMode ? (
                <Select
                  value={editDraft.primaryVeterinarianId ?? unassignedVeterinarianValue}
                  onValueChange={(value) =>
                    setEditDraft((current) => ({
                      ...current,
                      primaryVeterinarianId: value ?? undefined,
                    }))
                  }
                >
                  <SelectTrigger
                    aria-describedby={
                      editFieldErrors.primaryVeterinarianId
                        ? "reception-encounter-edit-primaryVeterinarianId-error"
                        : undefined
                    }
                    aria-invalid={
                      Boolean(editFieldErrors.primaryVeterinarianId) || undefined
                    }
                    aria-label="담당의"
                    className="w-full bg-card"
                  >
                    <ReceptionVeterinarianIdentity
                      veterinarianId={
                        editDraft.primaryVeterinarianId ??
                        unassignedVeterinarianValue
                      }
                      veterinarians={veterinarians}
                    />
                  </SelectTrigger>
                  <SelectContent align="end" className="min-w-[224px]">
                    <SelectGroup>
                      <ReceptionVeterinarianSelectItems
                        veterinarians={veterinarians}
                      />
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <ReceptionVeterinarianReadonlyInput
                  veterinarianId={
                    selectedEncounter?.primaryVeterinarianId ??
                    selectedAppointment?.assignedVeterinarianId ??
                    unassignedVeterinarianValue
                  }
                  veterinarians={veterinarians}
                  value={veterinarianName}
                  variant={detailVariant}
                />
              )}
            </ReceptionSidePanelField>
          </ReceptionSidePanelSection>
          {usesCreateDetailLayout ? <ReceptionSidePanelDivider /> : null}

          <ReceptionSidePanelSection
            title={detailTimeSectionTitle}
            variant={detailVariant}
          >
            <ReceptionSidePanelField
              icon={<CdsFilesCalendarIcon className="size-3.5" />}
              label={detailDateLabel}
              variant={detailVariant}
            >
              <ReceptionSidePanelInput
                readOnly
                aria-label={detailDateLabel}
                value={detailDateValue}
                variant={detailVariant}
              />
            </ReceptionSidePanelField>
            <ReceptionSidePanelField
              icon={<CdsFilesClockIcon className="size-3.5" />}
              label={detailTimeLabel}
              variant={detailVariant}
            >
              <ReceptionSidePanelInput
                readOnly
                aria-label={detailTimeLabel}
                value={detailTimeValue}
                variant={detailVariant}
              />
            </ReceptionSidePanelField>
            <ReceptionSidePanelField
              error={editFieldErrors.durationMinutes}
              errorId="reception-encounter-edit-durationMinutes-error"
              icon={<CdsMedicalActivityIcon className="size-3.5" />}
              label="예상소요시간"
              required={editMode}
              variant={detailVariant}
            >
              {editMode ? (
                <Select
                  value={`${editDraft.durationMinutes ?? receptionDurationMinutes}분`}
                  onValueChange={(value) =>
                    setEditDraft((current) => ({
                      ...current,
                      durationMinutes: value
                        ? getDurationMinutesFromLabel(value)
                        : undefined,
                    }))
                  }
                >
                  <SelectTrigger
                    aria-describedby={
                      editFieldErrors.durationMinutes
                        ? "reception-encounter-edit-durationMinutes-error"
                        : undefined
                    }
                    aria-invalid={
                      Boolean(editFieldErrors.durationMinutes) || undefined
                    }
                    aria-label="예상소요시간"
                    aria-required="true"
                    className="w-full bg-card"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end" className="min-w-[224px]">
                    <SelectGroup>
                      {receptionDurationOptions.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <ReceptionSidePanelInput
                  readOnly
                  value={getReceptionDrawerDurationLabel({
                    appointment: selectedAppointment,
                    encounter: selectedEncounter,
                  })}
                  variant={detailVariant}
                />
              )}
            </ReceptionSidePanelField>
            <ReceptionSidePanelField
              align="start"
              error={editFieldErrors.visitPurpose}
              errorId="reception-encounter-edit-visitPurpose-error"
              icon={<CdsMedicalClipboardPenIcon className="size-3.5" />}
              label="방문목적"
              required={editMode}
              variant={detailVariant}
            >
              <Textarea
                aria-label="방문목적"
                aria-required={editMode || undefined}
                aria-describedby={
                  editFieldErrors.visitPurpose
                    ? "reception-encounter-edit-visitPurpose-error"
                    : undefined
                }
                aria-invalid={Boolean(editFieldErrors.visitPurpose) || undefined}
                readOnly={!editMode}
                value={editMode ? (editDraft.visitPurpose ?? "") : visitReason}
                placeholder="방문목적을 입력해주세요"
                className={cn(
                  "min-h-[var(--emr-reception-create-textarea-min-height)] resize-none",
                  usesCreateDetailLayout
                    ? "bg-[var(--emr-reception-create-field-bg)] font-medium"
                    : "bg-card emr-text-dense font-semibold",
                )}
                onChange={(event) =>
                  setEditDraft((current) => ({
                    ...current,
                    visitPurpose: event.target.value,
                  }))
                }
              />
            </ReceptionSidePanelField>
            {memoLabel ? (
              <ReceptionSidePanelField
                align="start"
                error={editFieldErrors.memo}
                errorId="reception-encounter-edit-memo-error"
                icon={<CdsMedicalClipboardPenIcon className="size-3.5" />}
                label={memoLabel}
                variant={detailVariant}
              >
                <Textarea
                  aria-label={memoLabel}
                  aria-describedby={
                    editFieldErrors.memo
                      ? "reception-encounter-edit-memo-error"
                      : undefined
                  }
                  aria-invalid={Boolean(editFieldErrors.memo) || undefined}
                  readOnly={!editMode}
                  value={
                    editMode
                      ? (editDraft.memo ?? "")
                      : (selectedEncounter?.receptionMemo ??
                        selectedAppointment?.symptomNote ??
                        "")
                  }
                  placeholder={`${memoLabel}를 입력해주세요`}
                  className={cn(
                    "min-h-[var(--emr-reception-create-textarea-min-height)] resize-none",
                    usesCreateDetailLayout
                      ? "bg-[var(--emr-reception-create-field-bg)] font-medium"
                      : "bg-card emr-text-dense font-semibold",
                  )}
                  onChange={(event) =>
                    setEditDraft((current) => ({
                      ...current,
                      memo: event.target.value,
                    }))
                  }
                />
              </ReceptionSidePanelField>
            ) : null}
          </ReceptionSidePanelSection>
        </div>
      </ScrollArea>
      {editFeedback ? (
        <div
          role="alert"
          aria-live="assertive"
          data-kind={editFeedback.kind}
          data-testid="reception-encounter-edit-feedback"
          className="flex shrink-0 items-center gap-[var(--clair-spacing-4)] px-[var(--clair-spacing-16)] pt-[var(--clair-spacing-8)] text-[12px] leading-[14px] text-[var(--emr-status-danger-text)]"
        >
          <CdsAlertsAlertCircleIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <p className="min-w-0">{editFeedback.message}</p>
          {editFeedback.kind === "save" ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="ml-auto h-auto shrink-0 px-0 text-[12px] leading-[14px] text-[var(--emr-status-danger-text)] hover:bg-transparent hover:text-[var(--emr-status-danger-text)]"
              disabled={editSubmitting}
              onClick={onSave}
            >
              다시 시도
            </Button>
          ) : null}
        </div>
      ) : null}
      </EmrRightPanelBody>
      <EmrRightPanelFooter
        size="single"
        className={cn(
          "flex items-center gap-[var(--clair-spacing-8)] p-[var(--clair-spacing-16)]",
          canCancelSelectedEncounter ? "justify-between" : "justify-end",
        )}
      >
        <div>
          {canCancelSelectedEncounter ? (
            <Button
              type="button"
              variant="destructive"
              size="default"
              className="bg-[var(--emr-status-danger-bg)]"
              onClick={onCancelOpen}
              data-testid="reception-encounter-cancel-open"
            >
              접수 취소
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="default"
            className={cn(
              usesCreateDetailLayout
                ? "text-[var(--emr-text-secondary)]"
                : undefined,
            )}
            onClick={onClose}
          >
            {editMode ? "취소" : "닫기"}
          </Button>
          {editMode ? (
            <Button
              type="button"
              size="default"
              onClick={onSave}
              disabled={editSubmitting}
              data-testid="reception-encounter-edit-save"
            >
              {editSubmitting ? "저장 중" : "저장"}
            </Button>
          ) : canEditSelectedEncounter ? (
            <Button
              type="button"
              size="default"
              onClick={onEditOpen}
              data-testid="reception-encounter-edit-open"
            >
              수정하기
            </Button>
          ) : primaryActionLabel ? (
            <Button
              type="button"
              size="default"
              disabled={checkInDisabled}
              onClick={onCheckInOrCreate}
            >
              {primaryActionLabel}
            </Button>
          ) : null}
        </div>
      </EmrRightPanelFooter>
    </>
  );
}

function ReceptionPersistedEncounterVitals({
  encounterId,
  workspaceId,
}: {
  encounterId: string;
  workspaceId: string;
}) {
  const vital = useReceptionEncounterVital({ encounterId, workspaceId });
  const settings = useWorkspaceVitalSettings({ workspaceId });

  if (vital.status === "loading" || settings.status === "loading") {
    return (
      <div className="grid gap-2" aria-label="바이탈 불러오는 중">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (
    vital.status === "denied" ||
    settings.status === "denied" ||
    vital.status === "error" ||
    settings.status === "error"
  ) {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-2 rounded-[var(--emr-radius-control)] border border-[var(--emr-status-danger-border)] bg-[var(--emr-status-danger-bg)] p-2"
      >
        <p className="emr-text-dense text-[var(--emr-status-danger-text)]">
          바이탈 정보를 불러오지 못했습니다.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void Promise.all([vital.reload(), settings.reload()]);
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  const items =
    vital.vital?.encounterId === encounterId
      ? formatEnteredPatientVitalDisplayItemsForSettings(
          vital.vital,
          settings.snapshot,
        )
      : [];

  if (items.length === 0) {
    return (
      <p className="emr-text-dense text-[var(--emr-text-secondary)]">
        이 접수에 입력된 바이탈 정보가 없습니다.
      </p>
    );
  }

  return (
    <div data-testid="reception-encounter-vitals" className="grid gap-[10px]">
      {items.map((item) => (
        <ReceptionSidePanelField
          key={item.label}
          icon={getReceptionEncounterVitalIcon(
            getReceptionEncounterVitalLabel(item.label),
          )}
          label={getReceptionEncounterVitalLabel(item.label)}
          variant="create"
        >
          <ReceptionSidePanelInput
            aria-label={getReceptionEncounterVitalLabel(item.label)}
            readOnly
            value={item.value}
            variant="create"
          />
        </ReceptionSidePanelField>
      ))}
    </div>
  );
}

function getReceptionEncounterVitalLabel(label: string) {
  return label === "호흡" ? "호흡수" : label;
}

function getReceptionEncounterVitalIcon(label: string) {
  if (label === "체온") return <CdsMedicalThermometerIcon className="size-3.5" />;
  if (label === "심박수" || label === "혈압") {
    return <CdsMedicalHeartPulseIcon className="size-3.5" />;
  }
  return <CdsMedicalActivityIcon className="size-3.5" />;
}

function getReceptionReturnDrawer(drawer: DrawerState): DrawerState {
  if (!drawer?.returnTo) return null;

  return {
    type: drawer.returnTo.type,
    id: drawer.returnTo.id,
    profileTab: drawer.returnTo.profileTab,
  };
}

export function ReceptionDrawer({
  presentation = "drawer",
  onEditingChange,
}: {
  presentation?: ReceptionDrawerPresentation;
  onEditingChange?: (isEditing: boolean) => void;
} = {}) {
  const params = useParams<{ workspaceId?: string | string[] }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeDrawer = useLayoutStore((state) => state.activeDrawer);
  const setActiveDrawer = useLayoutStore((state) => state.setActiveDrawer);
  const setRightPanelOpen = useLayoutStore((state) => state.setRightPanelOpen);
  const treatmentRefreshAction = useLayoutStore(
    (state) => state.moduleRefreshActions.treatment,
  );
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const calendarDraftSelection = useReceptionStore(
    (state) => state.calendarDraftSelection,
  );
  const setCalendarDraftSelection = useReceptionStore(
    (state) => state.setCalendarDraftSelection,
  );
  const applyAppointmentCheckIn = useReceptionStore(
    (state) => state.applyAppointmentCheckIn,
  );
  const applyAppointmentCreate = useReceptionStore(
    (state) => state.applyAppointmentCreate,
  );
  const applyPersistedReceptionCalendar = useReceptionStore(
    (state) => state.applyPersistedReceptionCalendar,
  );
  const applyWalkInCheckIn = useReceptionStore(
    (state) => state.applyWalkInCheckIn,
  );
  const applyEncounterUpdate = useReceptionStore(
    (state) => state.applyEncounterUpdate,
  );
  const applyPatientGuardianLookupItem = usePatientProfileStore(
    (state) => state.applyPatientGuardianLookupItem,
  );
  const updatePatient = usePatientProfileStore((state) => state.updatePatient);
  const removeCancelledReceptionEncounter = useReceptionStore(
    (state) => state.cancelReceptionEncounter,
  );
  const createWalkInCheckIn = useReceptionStore(
    (state) => state.createWalkInCheckIn,
  );
  const persistedCalendarAppointments = useReceptionStore(
    (state) => state.persistedCalendarAppointments,
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
  const {
    hydrated: assigneeAuthHydrated,
    hydrate: hydrateAssigneeAuth,
    session: assigneeAuthSession,
  } = useAuthClient();
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFeedback, setEditFeedback] =
    useState<ReceptionEncounterEditFeedback | null>(null);
  const [editFieldErrors, setEditFieldErrors] =
    useState<ReceptionEncounterEditFieldErrors>({});
  const [appointmentCheckInConfirmOpen, setAppointmentCheckInConfirmOpen] =
    useState(false);
  const [appointmentCheckInSubmitting, setAppointmentCheckInSubmitting] =
    useState(false);
  const [editDraft, setEditDraft] = useState<ReceptionEncounterUpdateInput>({});
  useEffect(() => {
    onEditingChange?.(editMode);

    return () => onEditingChange?.(false);
  }, [editMode, onEditingChange]);

  useEffect(() => {
    if (!assigneeAuthHydrated) hydrateAssigneeAuth();
  }, [assigneeAuthHydrated, hydrateAssigneeAuth]);

  const workspaceId = resolveWorkspaceRouteParam(params.workspaceId);
  const setWorkspaceOperatingDate = useReceptionStore(
    (state) => state.setWorkspaceOperatingDate,
  );
  const operatingDateOverride = useReceptionStore(
    (state) => state.operatingDateByWorkspace[workspaceId],
  );
  const operatingDate =
    operatingDateOverride ?? getWorkspaceOperatingDate(workspaceId);
  const syncOperatingDate = useCallback(
    (nextOperatingDate: string) => {
      setWorkspaceOperatingDate(workspaceId, nextOperatingDate);
      const href = buildReceptionOperatingDateRoute({
        operatingDate: nextOperatingDate,
        pathname,
        searchParams,
      });
      const currentHref =
        typeof window === "undefined"
          ? ""
          : `${window.location.pathname}${window.location.search}`;

      if (href !== currentHref) router.replace(href, { scroll: false });
    },
    [
      pathname,
      router,
      searchParams,
      setWorkspaceOperatingDate,
      workspaceId,
    ],
  );
  const liveStaffSourceEnabled = isPreparedEmptyClinicWorkspace(workspaceId) ||
    (workspaceId === "workspace-clinical-master-pilot-v1" && shouldUseSupabaseAuth());
  const staffResourceKey = getReceptionStaffResourceKey({
    operatingDate,
    workspaceId,
  });
  const workspaceVeterinarians = useReceptionStaffResourceStore(
    (state) =>
      state.resourcesByKey[staffResourceKey]?.veterinarians ??
      emptyReceptionStaffVeterinarians,
  );
  const workspaceActorUserId = useReceptionStaffResourceStore(
    (state) => state.resourcesByKey[staffResourceKey]?.actorUserId,
  );
  const workspaceStaffMembers = useReceptionStaffResourceStore(
    (state) =>
      state.resourcesByKey[staffResourceKey]?.staff ?? emptyReceptionStaffMembers,
  );
  const setStaffResourceLoading = useReceptionStaffResourceStore(
    (state) => state.setResourceLoading,
  );
  const setStaffResourceResult = useReceptionStaffResourceStore(
    (state) => state.setResourceResult,
  );
  const veterinarians = liveStaffSourceEnabled
    ? workspaceVeterinarians
    : allVeterinarians;
  const staffMembers = liveStaffSourceEnabled
    ? workspaceStaffMembers
    : allReceptionStaff;
  const actorStaffUserId = liveStaffSourceEnabled
    ? workspaceActorUserId
    : resolveReceptionMockAssigneeUserId(assigneeAuthSession);
  const initialAssignedStaffUserId = staffMembers.some(
    (staffMember) => staffMember.id === actorStaffUserId,
  )
    ? actorStaffUserId
    : undefined;
  const currentOperatingMinutes = getWorkspaceCurrentOperatingMinutes(workspaceId);
  const veterinarianStaffMembers = useMemo(
    () =>
      veterinarians.map((veterinarian) => ({
        displayName: veterinarian.name,
        id: veterinarian.id,
      })),
    [veterinarians],
  );
  const patientSummaries = useMemo(
    () =>
      getReceptionPatientSummaries(
        draftCheckIns,
        {
          guardians,
          patientGuardians,
          patients,
        },
        {
          allowMockStaffFallback: !liveStaffSourceEnabled,
          operatingDate,
          staffMembers: veterinarianStaffMembers,
          workspaceId,
        },
      ),
    [
      draftCheckIns,
      guardians,
      liveStaffSourceEnabled,
      operatingDate,
      patientGuardians,
      patients,
      veterinarianStaffMembers,
      workspaceId,
    ],
  );
  const appointments = useMemo(
    () =>
      getTodayAppointments(draftCheckIns, persistedCalendarAppointments, {
        operatingDate,
        workspaceId,
      }),
    [draftCheckIns, operatingDate, persistedCalendarAppointments, workspaceId],
  );
  useEffect(() => {
    if (!liveStaffSourceEnabled) return;

    const currentResource =
      useReceptionStaffResourceStore.getState().resourcesByKey[staffResourceKey];
    if (
      currentResource?.status === "ready" &&
      currentResource.updatedAt &&
      Date.now() - currentResource.updatedAt < 30_000
    ) {
      return;
    }

    let cancelled = false;
    setStaffResourceLoading(staffResourceKey);
    void loadWorkspaceStaff({
      actorId: authSession?.id,
      operatingDate,
      workspaceId,
    }).then((result) => {
      if (cancelled) return;
      setStaffResourceResult(staffResourceKey, {
        actorUserId: result.ok ? result.actorUserId : undefined,
        status: result.ok ? "ready" : "error",
        staff: mapWorkspaceStaffToReceptionStaff(result),
        veterinarians: mapWorkspaceStaffToVeterinarians(result),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    authSession?.id,
    liveStaffSourceEnabled,
    operatingDate,
    setStaffResourceLoading,
    setStaffResourceResult,
    staffResourceKey,
    workspaceId,
  ]);
  useEffect(() => {
    if (activeDrawer?.type !== "reception-reservation-form") return;

    let cancelled = false;
    void loadReceptionCalendar({
      actorId: authSession?.id,
      date: operatingDate,
      workspaceId,
    }).then((result) => {
      if (!cancelled && result.ok) {
        applyPersistedReceptionCalendar(result.records);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeDrawer?.type,
    applyPersistedReceptionCalendar,
    authSession?.id,
    operatingDate,
    workspaceId,
  ]);
  const closeCreateFlow = useCallback(() => {
    setCalendarDraftSelection(undefined);
    const returnDrawer = getReceptionReturnDrawer(activeDrawer);
    if (returnDrawer) {
      setActiveDrawer(returnDrawer);
      setRightPanelOpen(true);
      return;
    }
    setActiveDrawer(null);
  }, [activeDrawer, setActiveDrawer, setCalendarDraftSelection, setRightPanelOpen]);
  const closeDetailFlow = useCallback(() => {
    const returnDrawer = getReceptionReturnDrawer(activeDrawer);
    if (returnDrawer) {
      setActiveDrawer(returnDrawer);
      setRightPanelOpen(true);
      return;
    }
    if (presentation === "side-panel") {
      setCalendarDraftSelection(undefined);
      setRightPanelOpen(false);
      return;
    }
    setActiveDrawer(null);
  }, [
    activeDrawer,
    presentation,
    setActiveDrawer,
    setCalendarDraftSelection,
    setRightPanelOpen,
  ]);
  const setCreateFlowDirty = useCallback(
    (dirty: boolean) => {
      const current = useLayoutStore.getState().activeDrawer;
      if (
        !current ||
        current.id !== activeDrawer?.id ||
        current.type !== activeDrawer?.type ||
        Boolean(current.hasUnsavedChanges) === dirty
      ) {
        return;
      }
      setActiveDrawer({
        ...current,
        hasUnsavedChanges: dirty || undefined,
      });
    },
    [activeDrawer?.id, activeDrawer?.type, setActiveDrawer],
  );
  const openReceptionFlowDrawer = useCallback(
    (type: string, id: string) => {
      setActiveDrawer({
        type,
        id,
        ...(activeDrawer?.returnTo
          ? {
              initialPatientId: activeDrawer.initialPatientId,
              initialOperatingDate: activeDrawer.initialOperatingDate,
              returnTo: activeDrawer.returnTo,
              rightPanelPresentation: activeDrawer.rightPanelPresentation,
            }
          : {}),
      });
    },
    [activeDrawer, setActiveDrawer],
  );
  if (activeDrawer?.type === "reception-patient") {
    return <PatientProfileDrawer patientId={activeDrawer.id} />;
  }

  if (activeDrawer?.type === "reception-guardian") {
    return <GuardianProfileDrawer guardianId={activeDrawer.id} />;
  }

  if (activeDrawer?.type === "reception-form") {
    const initialPatientId =
      activeDrawer.initialPatientId ??
      (activeDrawer.id.startsWith("walk-in:")
        ? activeDrawer.id.slice("walk-in:".length)
        : undefined);
    const calendarDraftSelectionForForm =
      calendarDraftSelection?.id === activeDrawer.id
        ? calendarDraftSelection
        : undefined;
    const calendarDraftDate = calendarDraftSelectionForForm
      ? getOperatingDateFromIso(calendarDraftSelectionForForm.plannedStartAt)
      : undefined;
    const calendarDraftTimeMinutes = calendarDraftSelectionForForm
      ? getOperatingMinutesFromIso(calendarDraftSelectionForForm.plannedStartAt)
      : undefined;

    return (
      <ReceptionWalkInFormDrawer
        key={activeDrawer.id}
        currentOperatingMinutes={
          calendarDraftTimeMinutes ?? currentOperatingMinutes
        }
        initialDurationMinutes={
          calendarDraftSelectionForForm?.durationMinutes
        }
        initialAssignedStaffUserId={initialAssignedStaffUserId}
        initialPatientId={initialPatientId}
        initialVeterinarianId={
          calendarDraftSelectionForForm?.primaryVeterinarianId
        }
        onClose={activeDrawer.returnTo ? closeCreateFlow : undefined}
        onDirtyChange={activeDrawer.returnTo ? setCreateFlowDirty : undefined}
        operatingDate={
          calendarDraftDate ?? activeDrawer.initialOperatingDate ?? operatingDate
        }
        patientSummaries={patientSummaries}
        presentation={presentation}
        staffMembers={staffMembers}
        veterinarians={veterinarians}
        workspaceId={workspaceId}
        onCreate={(input, walkIn, selectedSummary) => {
          const weightKg = input.vitals?.weightKg;
          const patient =
            weightKg === undefined
              ? selectedSummary.patient
              : { ...selectedSummary.patient, weightKg };
          applyPatientGuardianLookupItem({
            patient,
            primaryGuardian: selectedSummary.primaryGuardian,
            searchText: selectedSummary.searchText,
          });
          if (weightKg !== undefined) {
            updatePatient(selectedSummary.patient.id, {
              weightKg,
            });
          }
          applyWalkInCheckIn({ ...input, walkIn });
          const persistedOperatingDate = getOperatingDateFromIso(
            walkIn.queueEntry.enteredAt ??
              walkIn.encounter.checkedInAt ??
              walkIn.encounter.createdAt,
          );
          if (persistedOperatingDate) {
            const routeOperatingDate = searchParams.get("date");
            syncOperatingDate(persistedOperatingDate);
            if (
              routeOperatingDate === persistedOperatingDate ||
              (routeOperatingDate === null &&
                persistedOperatingDate === getWorkspaceOperatingDate(workspaceId))
            ) {
              void treatmentRefreshAction?.onRefresh();
            }
          }
          setCalendarDraftSelection(undefined);
          requestReceptionReadRetry();
          saveChartLiveEncounterHandoff({
            encounter: walkIn.encounter,
            patient,
            primaryGuardian: selectedSummary.primaryGuardian,
            veterinarianName: getStaffDisplayName(
              walkIn.encounter.primaryVeterinarianId,
              veterinarians,
            ),
          });
          openReceptionFlowDrawer("reception-encounter", walkIn.encounter.id);
          toast.success("접수가 완료되었습니다");
        }}
      />
    );
  }

  if (activeDrawer?.type === "reception-reservation-form") {
    const reservationDraftSelection =
      calendarDraftSelection?.id === activeDrawer.id
        ? calendarDraftSelection
        : undefined;
    const reservationDraftDate = reservationDraftSelection
      ? getOperatingDateFromIso(reservationDraftSelection.plannedStartAt)
      : undefined;
    const reservationDraftTimeMinutes = reservationDraftSelection
      ? getOperatingMinutesFromIso(reservationDraftSelection.plannedStartAt)
      : undefined;

    return (
      <ReceptionReservationFormDrawer
        key={activeDrawer.id}
        appointments={appointments}
        currentOperatingMinutes={currentOperatingMinutes}
        initialDate={
          reservationDraftDate ?? activeDrawer.initialOperatingDate
        }
        initialAssignedStaffUserId={initialAssignedStaffUserId}
        initialDurationMinutes={reservationDraftSelection?.durationMinutes}
        initialPatientId={activeDrawer.initialPatientId}
        initialTimeMinutes={reservationDraftTimeMinutes}
        initialVeterinarianId={reservationDraftSelection?.primaryVeterinarianId}
        onClose={activeDrawer.returnTo ? closeCreateFlow : undefined}
        onDirtyChange={activeDrawer.returnTo ? setCreateFlowDirty : undefined}
        operatingDate={operatingDate}
        patientSummaries={patientSummaries}
        presentation={presentation}
        todayDate={getWorkspaceOperatingDate(workspaceId)}
        staffMembers={staffMembers}
        veterinarians={veterinarians}
        workspaceId={workspaceId}
        onCreate={(appointment) => {
          const appointmentOperatingDate = getOperatingDateFromIso(
            appointment.scheduledStartAt,
          );
          if (appointmentOperatingDate) {
            syncOperatingDate(appointmentOperatingDate);
          }
          applyAppointmentCreate(appointment);
          requestReceptionReadRetry();
          openReceptionFlowDrawer("reception-appointment", appointment.id);
        }}
      />
    );
  }

  const selectedAppointment =
    activeDrawer?.type === "reception-appointment" ||
    activeDrawer?.type === "reception-appointment-check-in-form"
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
  const mockBundle = isLegacySalesDemoWorkspace(workspaceId)
    ? (getMockPatientBundle(patientId) ?? getMockPatientBundle(selectedPatientId))
    : undefined;
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
  const selectedVeterinarianCandidateId =
    selectedEncounter?.primaryVeterinarianId ??
    selectedAppointment?.assignedVeterinarianId;
  const selectedVeterinarianId =
    selectedVeterinarianCandidateId &&
    veterinarians.some(
      (veterinarian) => veterinarian.id === selectedVeterinarianCandidateId,
    )
      ? selectedVeterinarianCandidateId
      : unassignedVeterinarianValue;
  const veterinarianName =
    selectedVeterinarianId === unassignedVeterinarianValue
      ? "담당의 미지정"
      : (getStaffDisplayName(selectedVeterinarianId, veterinarians, {
          allowMockFallback: !liveStaffSourceEnabled,
        }) ?? "담당의 미지정");
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
  const receptionDurationMinutes =
    selectedEncounter?.durationMinutes ??
    (selectedAppointment
      ? getDurationMinutesFromLabel(getAppointmentDurationLabel(selectedAppointment))
      : getDurationMinutesFromLabel(defaultWalkInDuration)) ??
    30;
  const patientWeightLabel =
    typeof patient?.weightKg === "number" && Number.isFinite(patient.weightKg)
      ? `${patient.weightKg.toFixed(2)} kg`
      : "-";
  const memoLabel = selectedAppointment ? "예약 메모" : "접수 메모";
  const departmentValue = selectedEncounter?.department ?? defaultWalkInDepartment;
  const canCancelSelectedEncounter =
    !selectedAppointment &&
    selectedEncounter &&
    (selectedEncounter.status === "waiting" ||
      selectedEncounter.status === "in_consultation");
  const canEditSelectedEncounter =
    !selectedAppointment &&
    selectedEncounter &&
    (selectedEncounter.status === "waiting" ||
      selectedEncounter.status === "in_consultation");
  const getSelectedEncounterEditDraft = (): ReceptionEncounterUpdateInput => ({
    department: selectedEncounter?.department ?? defaultWalkInDepartment,
    durationMinutes: receptionDurationMinutes,
    memo: selectedEncounter?.receptionMemo,
    primaryVeterinarianId: selectedVeterinarianId,
    visitPurpose: visitReason,
    weightKg: patient?.weightKg,
  });
  const clearEditFeedback = () => {
    setEditFeedback(null);
    setEditFieldErrors({});
  };
  const updateEditDraft = (
    updater: (current: ReceptionEncounterUpdateInput) => ReceptionEncounterUpdateInput,
  ) => {
    clearEditFeedback();
    setEditDraft(updater);
  };
  const applyAppointmentCheckInResult = (
    checkIn: ReceptionAppointmentCheckInRecord,
    weightKg?: number,
  ) => {
    if (!patient) return;

    const nextPatient =
      weightKg === undefined ? patient : { ...patient, weightKg };

    applyAppointmentCheckIn({ appointment: checkIn.appointment, checkIn });
    if (weightKg !== undefined) {
      updatePatient(patient.id, { weightKg });
    }
    requestReceptionReadRetry();
    saveChartLiveEncounterHandoff({
      encounter: checkIn.encounter,
      patient: nextPatient,
      primaryGuardian: guardian,
      veterinarianName: getStaffDisplayName(
        checkIn.encounter.primaryVeterinarianId,
        veterinarians,
      ),
    });
    openReceptionFlowDrawer("reception-encounter", checkIn.encounter.id);
  };
  const handleConfirmAppointmentCheckIn = async () => {
    if (
      !selectedAppointment ||
      selectedAppointment.status !== "confirmed" ||
      appointmentCheckInSubmitting
    ) {
      return;
    }

    setAppointmentCheckInSubmitting(true);
    const result = await submitAppointmentCheckIn({
      actorRole: authSession?.role,
      appointmentId: selectedAppointment.id,
      workspaceId,
    });
    setAppointmentCheckInSubmitting(false);

    if (!result.ok) {
      toast.error(getAppointmentCheckInRouteErrorMessage(result));
      return;
    }

    applyAppointmentCheckInResult(result.checkIn);
    setAppointmentCheckInConfirmOpen(false);
    toast.success("예약 건 접수가 완료되었습니다");
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
    closeDetailFlow();
    toast.success("접수가 취소되었습니다");
  };
  const handleSaveSelectedEncounter = async () => {
    if (!selectedEncounter || !patient || editSubmitting) return;

    const input: ReceptionEncounterUpdateInput = {
      department: editDraft.department,
      durationMinutes: editDraft.durationMinutes,
      memo: editDraft.memo,
      primaryVeterinarianId:
        editDraft.primaryVeterinarianId === unassignedVeterinarianValue
          ? undefined
          : editDraft.primaryVeterinarianId,
      visitPurpose: editDraft.visitPurpose,
      weightKg: editDraft.weightKg,
    };

    clearEditFeedback();
    setEditSubmitting(true);
    const result = await submitReceptionEncounterUpdate({
      actorRole: authSession?.role,
      encounterId: selectedEncounter.id,
      input,
      workspaceId,
    });
    setEditSubmitting(false);

    if (!result.ok) {
      const nextFeedback = getEncounterUpdateEditFeedback(result);
      setEditFieldErrors(nextFeedback.fieldErrors);
      setEditFeedback(nextFeedback.feedback);
      return;
    }

    applyEncounterUpdate(result.update);
    if (result.update.patient) {
      updatePatient(result.update.patient.id, result.update.patient);
    } else if (input.weightKg !== undefined) {
      updatePatient(selectedEncounter.patientId, { weightKg: input.weightKg });
    }
    requestReceptionReadRetry();
    saveChartLiveEncounterHandoff({
      encounter: result.update.encounter,
      patient: result.update.patient ?? patient,
      primaryGuardian: guardian,
      veterinarianName: getStaffDisplayName(
        result.update.encounter.primaryVeterinarianId,
        veterinarians,
      ),
    });
    setEditMode(false);
    clearEditFeedback();
    toast.success("접수 수정이 완료되었습니다");
  };

  if (!patient) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        환자를 선택해 주세요.
      </div>
    );
  }

  if (
    activeDrawer?.type === "reception-appointment-check-in-form" &&
    selectedAppointment
  ) {
    return (
      <ReceptionAppointmentCheckInFormDrawer
        appointment={selectedAppointment}
        currentOperatingMinutes={currentOperatingMinutes}
        guardian={guardian}
        patient={patient}
        presentation={presentation}
        veterinarians={veterinarians}
        workspaceId={workspaceId}
        onCheckIn={(checkIn, weightKg) => {
          applyAppointmentCheckInResult(checkIn, weightKg);
        }}
      />
    );
  }

  if (presentation === "side-panel") {
    return (
      <>
        <ReceptionSidePanelDetail
          key={patient.id}
          canCancelSelectedEncounter={Boolean(canCancelSelectedEncounter)}
          canEditSelectedEncounter={Boolean(canEditSelectedEncounter)}
          checkInDisabled={Boolean(
            (selectedAppointment && selectedAppointment.status !== "confirmed") ||
              appointmentCheckInSubmitting,
          )}
          departmentValue={departmentValue}
          editDraft={editDraft}
          editFeedback={editFeedback}
          editFieldErrors={editFieldErrors}
          editMode={editMode}
          editSubmitting={editSubmitting}
          guardian={guardian}
          memoLabel={memoLabel}
          patient={patient}
          patientWeightLabel={patientWeightLabel}
          primaryActionLabel={
            selectedAppointment
              ? undefined
              : !selectedEncounter
                ? "생성"
                : undefined
          }
          receptionDate={receptionDate}
          receptionDurationMinutes={receptionDurationMinutes}
          receptionStartAt={receptionStartAt}
          selectedAppointment={selectedAppointment}
          selectedEncounter={selectedEncounter}
          setEditDraft={updateEditDraft}
          veterinarianName={veterinarianName}
          veterinarians={veterinarians}
          visitReason={visitReason}
          onCancelOpen={() => setCancelConfirmOpen(true)}
          onCheckInOrCreate={() => {
            if (selectedAppointment) {
              if (selectedAppointment.status === "confirmed") {
                setAppointmentCheckInConfirmOpen(true);
              }
              return;
            }

            createWalkInCheckIn({
              guardianId: guardian?.id,
              patientId: patient.id,
              primaryVeterinarianId:
                veterinarians[0]?.id ?? defaultVeterinarian?.id,
              visitPurpose: "현장 접수",
              workspaceId,
            });
            setActiveDrawer(null);
          }}
          onClose={() => {
            if (editMode) {
              setEditMode(false);
              setEditDraft(getSelectedEncounterEditDraft());
              clearEditFeedback();
              return;
            }
            closeDetailFlow();
          }}
          onEditOpen={() => {
            clearEditFeedback();
            setEditConfirmOpen(true);
          }}
          onSave={() => {
            void handleSaveSelectedEncounter();
          }}
        />
        <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>접수를 취소할까요?</DialogTitle>
              <DialogDescription>
                취소하면 접수 캘린더에서는 사라지고 대기열에는 취소 상태로 남습니다.
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
        <Dialog open={editConfirmOpen} onOpenChange={setEditConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>접수 정보를 수정하시겠습니까?</DialogTitle>
              <DialogDescription>
                환자와 접수일자는 변경하지 않고, 접수 세부 정보만 수정합니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditConfirmOpen(false)}>
                닫기
              </Button>
              <Button
                onClick={() => {
                  setEditDraft(getSelectedEncounterEditDraft());
                  clearEditFeedback();
                  setEditConfirmOpen(false);
                  setEditMode(true);
                }}
                data-testid="reception-encounter-edit-confirm"
              >
                수정하기
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog
          open={appointmentCheckInConfirmOpen}
          onOpenChange={(open) => {
            if (appointmentCheckInSubmitting) return;
            setAppointmentCheckInConfirmOpen(open);
          }}
        >
          <EmrConfirmDialogContent
            title={`${patient.name}/${guardian?.name ?? "보호자 미지정"}의 예약을 접수 확정하시겠습니까?`}
            description="접수하면 예약이 진료 대기 접수로 전환됩니다."
            cancelLabel="취소"
            confirmLabel={appointmentCheckInSubmitting ? "접수 중" : "접수"}
            confirmDisabled={
              appointmentCheckInSubmitting ||
              selectedAppointment?.status !== "confirmed"
            }
            onCancel={() => {
              if (appointmentCheckInSubmitting) return;
              setAppointmentCheckInConfirmOpen(false);
            }}
            onConfirm={() => {
              void handleConfirmAppointmentCheckIn();
            }}
          />
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="flex h-[calc(100%-48px)] flex-col">
        <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <section className="rounded-lg border bg-muted p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-[15px] font-semibold text-foreground">
                    {patient.name}
                  </span>
                  <span className="emr-text-metadata text-muted-foreground">
                    {getSpeciesLabel(patient.species)}
                    {patient.breed ? ` · ${patient.breed}` : ""}
                  </span>
                </div>
                <div className="mt-1 emr-text-metadata text-muted-foreground">
                  {guardian?.name ?? "보호자 미지정"} 보호자
                  {guardian?.mobilePhone ? ` · ${guardian.mobilePhone}` : ""}
                </div>
              </div>
              {selectedAppointment || selectedEncounter ? (
                <ReceptionStatusBadge
                  label={
                    selectedAppointment
                      ? getStatusLabel("appointment", selectedAppointment.status)
                      : getReceptionEncounterStatusLabel(selectedEncounter!.status)
                  }
                  testId="reception-detail-status"
                  tone={
                    selectedAppointment
                      ? getAppointmentTone(selectedAppointment.status)
                      : getReceptionEncounterStatusTone(selectedEncounter!.status)
                  }
                />
              ) : null}
            </div>
          </section>

          <section className="grid grid-cols-2 gap-3">
            <ReceptionFormField label="진료과" required>
              {editMode ? (
                <Select
                  value={editDraft.department ?? defaultWalkInDepartment}
                  onValueChange={(value) =>
                    setEditDraft((current) => ({
                      ...current,
                      department: value ?? undefined,
                    }))
                  }
                >
                  <SelectTrigger
                    aria-label="진료과"
                    size="lg"
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
              ) : (
                <Input value={departmentValue} readOnly className="h-9 bg-card" />
              )}
            </ReceptionFormField>
            <ReceptionFormField label="담당의">
              {editMode ? (
                <Select
                  value={editDraft.primaryVeterinarianId ?? unassignedVeterinarianValue}
                  onValueChange={(value) =>
                    setEditDraft((current) => ({
                      ...current,
                      primaryVeterinarianId: value ?? undefined,
                    }))
                  }
                >
                  <SelectTrigger
                    aria-label="담당의"
                    size="lg"
                    className="w-full bg-card"
                  >
                    <ReceptionVeterinarianIdentity
                      veterinarianId={
                        editDraft.primaryVeterinarianId ??
                        unassignedVeterinarianValue
                      }
                      veterinarians={veterinarians}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <ReceptionVeterinarianSelectItems
                        veterinarians={veterinarians}
                      />
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <ReceptionVeterinarianReadonlyInput
                  className="h-9"
                  veterinarianId={selectedVeterinarianId}
                  veterinarians={veterinarians}
                  value={veterinarianName}
                />
              )}
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
              {editMode ? (
                <div className="relative">
                  <Input
                    value={editDraft.weightKg ?? ""}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setEditDraft((current) => ({
                        ...current,
                        weightKg: Number.isFinite(nextValue) ? nextValue : undefined,
                      }));
                    }}
                    inputMode="decimal"
                    className="h-9 bg-card pr-8 text-right"
                    aria-label="동물 체중"
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 emr-text-micro font-semibold text-muted-foreground">
                    kg
                  </span>
                </div>
              ) : (
                <Input value={patientWeightLabel} readOnly className="h-9 bg-card text-right" />
              )}
            </ReceptionFormField>
            <ReceptionFormField label="접수구분">
              <div className="flex h-9 items-center rounded-lg border border-input px-2.5 emr-text-dense">
                재진
              </div>
            </ReceptionFormField>
          </section>

          <ReceptionFormField label="방문 목적" required>
            {editMode ? (
              <Textarea
                value={editDraft.visitPurpose ?? ""}
                onChange={(event) =>
                  setEditDraft((current) => ({
                    ...current,
                    visitPurpose: event.target.value,
                  }))
                }
                className="min-h-20 bg-card"
              />
            ) : (
              <Textarea value={visitReason} readOnly className="min-h-20 bg-card" />
            )}
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
              {editMode ? (
                <Select
                  value={`${editDraft.durationMinutes ?? receptionDurationMinutes}분`}
                  onValueChange={(value) =>
                    setEditDraft((current) => ({
                      ...current,
                      durationMinutes: value
                        ? getDurationMinutesFromLabel(value)
                        : undefined,
                    }))
                  }
                >
                  <SelectTrigger aria-label="소요시간" size="lg" className="w-full bg-card">
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
              ) : (
                <Input
                  value={getReceptionDrawerDurationLabel({
                    appointment: selectedAppointment,
                    encounter: selectedEncounter,
                  })}
                  readOnly
                  className="h-9 bg-card"
                />
              )}
            </ReceptionFormField>
          </section>

          <ReceptionFormField label={memoLabel}>
            <Textarea
              value={
                editMode
                  ? (editDraft.memo ?? "")
                  : (selectedEncounter?.receptionMemo ??
                    selectedAppointment?.symptomNote ??
                    "")
              }
              readOnly={!editMode}
              onChange={(event) =>
                setEditDraft((current) => ({
                  ...current,
                  memo: event.target.value,
                }))
              }
              className="min-h-20 bg-card"
            />
          </ReceptionFormField>

          <section className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold">Assessment History</h3>
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
        <div className="mt-auto flex shrink-0 items-center justify-between gap-2 border-t bg-card p-4">
          <div>
            {canCancelSelectedEncounter ? (
              <Button
                variant="outline"
                size="default"
                className="border-[var(--emr-status-danger-border)] text-[var(--emr-status-danger-text)] hover:bg-[var(--emr-status-danger-bg)]"
                onClick={() => setCancelConfirmOpen(true)}
                data-testid="reception-encounter-cancel-open"
              >
                접수 취소
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button size="default" variant="ghost" onClick={() => {
              if (editMode) {
                setEditMode(false);
                setEditDraft(getSelectedEncounterEditDraft());
                return;
              }
              closeDetailFlow();
            }}>
              닫기
            </Button>
            {editMode ? (
              <Button
                size="default"
                onClick={() => {
                  void handleSaveSelectedEncounter();
                }}
                disabled={editSubmitting}
                data-testid="reception-encounter-edit-save"
              >
                {editSubmitting ? "저장 중" : "저장"}
              </Button>
            ) : canEditSelectedEncounter ? (
              <Button
                size="default"
                onClick={() => setEditConfirmOpen(true)}
                data-testid="reception-encounter-edit-open"
              >
                수정하기
              </Button>
            ) : selectedAppointment || !selectedEncounter ? (
            <Button
              size="default"
              onClick={() => {
                if (selectedAppointment) {
                  openReceptionFlowDrawer(
                    "reception-appointment-check-in-form",
                    selectedAppointment.id,
                  );
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
              {selectedAppointment ? "접수하기" : "생성"}
            </Button>
            ) : null}
          </div>
        </div>
      </div>
      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>접수를 취소할까요?</DialogTitle>
            <DialogDescription>
              취소하면 접수 캘린더에서는 사라지고 대기열에는 취소 상태로 남습니다.
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
      <Dialog open={editConfirmOpen} onOpenChange={setEditConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>접수 정보를 수정하시겠습니까?</DialogTitle>
            <DialogDescription>
              환자와 접수일자는 변경하지 않고, 접수 세부 정보만 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditConfirmOpen(false)}>
              닫기
            </Button>
            <Button
              onClick={() => {
                setEditDraft(getSelectedEncounterEditDraft());
                setEditConfirmOpen(false);
                setEditMode(true);
              }}
              data-testid="reception-encounter-edit-confirm"
            >
              수정하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
