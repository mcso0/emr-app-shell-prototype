export const hospitalScheduleRoles = [
  "veterinarian",
  "technician",
  "reception",
] as const;

export type HospitalScheduleRole = (typeof hospitalScheduleRoles)[number];

export type HospitalScheduleShiftKind =
  | "clinical"
  | "support"
  | "reception"
  | "leave"
  | "off";

export type HospitalScheduleViewMode = "week" | "day";
export type HospitalScheduleSurface = "admin" | "personal";
export type HospitalSchedulePublicationState = "draft" | "published" | "changed";
export type HospitalScheduleRequestType = "leave" | "shift-change";
export type HospitalScheduleRequestStatus = "pending" | "approved" | "declined";
export type HospitalScheduleDataState =
  | "ready"
  | "loading"
  | "empty"
  | "error"
  | "read-only";

export type HospitalScheduleTimeRange = {
  startMinutes: number;
  endMinutes: number;
};

export type HospitalScheduleStaff = {
  id: string;
  name: string;
  initials: string;
  role: HospitalScheduleRole;
  roleLabel: string;
  weeklyTargetMinutes: number;
  unavailableByWeekday: Partial<Record<number, HospitalScheduleTimeRange[]>>;
};

export type HospitalScheduleShift = {
  id: string;
  staffId: string | null;
  date: string;
  startMinutes: number;
  endMinutes: number;
  kind: HospitalScheduleShiftKind;
  workLabel: string;
  locationLabel: string | null;
  note: string | null;
};

export type HospitalScheduleRequest = {
  id: string;
  staffId: string;
  shiftId: string | null;
  date: string;
  type: HospitalScheduleRequestType;
  status: HospitalScheduleRequestStatus;
  requestedStartMinutes: number | null;
  requestedEndMinutes: number | null;
  reason: string;
};

export type HospitalScheduleCoverageRule = {
  date: string;
  role: HospitalScheduleRole;
  startMinutes: number;
  endMinutes: number;
  minimumStaff: number;
};

export type HospitalSchedulePublication = {
  state: HospitalSchedulePublicationState;
  publishedAtLabel: string | null;
  changedShiftIds: string[];
};

export type HospitalScheduleSettings = {
  weekStartsOn: "monday" | "sunday";
  lockDay: "thursday" | "friday" | "sunday";
  lockMinutes: number;
  vacancyAlerts: boolean;
  homeStaffingSignal: boolean;
};

export type HospitalScheduleSeed = {
  weekStart: string;
  staff: HospitalScheduleStaff[];
  shifts: HospitalScheduleShift[];
  requests: HospitalScheduleRequest[];
  coverageRules: HospitalScheduleCoverageRule[];
  publication: HospitalSchedulePublication;
  settings: HospitalScheduleSettings;
};

export type HospitalScheduleConflict = {
  kind: "availability" | "overlap";
  shiftId: string;
  staffId: string;
  message: string;
};

export type HospitalScheduleCoverageIssue = HospitalScheduleCoverageRule & {
  assignedStaffCount: number;
};
