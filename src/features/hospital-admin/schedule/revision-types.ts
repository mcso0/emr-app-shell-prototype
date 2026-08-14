import type { HospitalScheduleRole, HospitalScheduleShiftKind } from "./types";

export type HospitalScheduleRevisionState = "draft" | "published" | "superseded";

export type HospitalScheduleWorkKind = Exclude<
  HospitalScheduleShiftKind,
  "leave" | "off"
>;

export type HospitalScheduleIssueSeverity = "blocker" | "warning";

export type HospitalScheduleIssueCode =
  | "invalid_time_range"
  | "date_outside_week"
  | "overlapping_assignment"
  | "work_overlaps_non_work"
  | "inactive_staff_profile"
  | "missing_required_assignment"
  | "hospital_closed"
  | "overnight_not_supported"
  | "stale_schedule_revision"
  | "roster_revalidation_required"
  | "operating_calendar_revalidation_required"
  | "outside_operating_hours"
  | "missing_location";

export type HospitalScheduleIssue = {
  code: HospitalScheduleIssueCode;
  entryId: string | null;
  message: string;
  severity: HospitalScheduleIssueSeverity;
  staffProfileId: string | null;
  date: string | null;
};

export type HospitalScheduleWorkBlock = {
  id: string;
  staffProfileId: string | null;
  shiftDate: string;
  startMinutes: number;
  endMinutes: number;
  workKind: HospitalScheduleWorkKind;
  workLabelSnapshot: string;
  locationLabelSnapshot: string | null;
  privateNote: string | null;
};

export type HospitalScheduleNonWorkEntry = {
  id: string;
  staffProfileId: string;
  entryDate: string;
  entryKind: "leave" | "off";
  leaveSubtype: string | null;
  startMinutes: number | null;
  endMinutes: number | null;
  privateNote: string | null;
};

export type HospitalScheduleRevision = {
  id: string;
  revisionNo: number;
  state: HospitalScheduleRevisionState;
  basedOnRevisionId: string | null;
  lockVersion: number;
  publishedAt: string | null;
};

export type HospitalScheduleRevisionStaff = {
  id: string;
  membershipId: string;
  name: string;
  initials: string;
  role: HospitalScheduleRole;
  availability: Record<string, unknown>;
  jobPositionId: string | null;
};

export type HospitalScheduleRevisionSnapshot = {
  weekId: string | null;
  weekStart: string;
  revision: HospitalScheduleRevision | null;
  latestPublishedRevision: HospitalScheduleRevision | null;
  publishedRevisions: HospitalScheduleRevision[];
  staff: HospitalScheduleRevisionStaff[];
  workBlocks: HospitalScheduleWorkBlock[];
  nonWorkEntries: HospitalScheduleNonWorkEntry[];
  issues: HospitalScheduleIssue[];
  canManage: boolean;
  modelVersion: "v1" | "v2";
};

export type HospitalScheduleCompletenessStaff = {
  staffProfileId: string;
  role: HospitalScheduleRole;
  required: boolean;
  active: boolean;
};
