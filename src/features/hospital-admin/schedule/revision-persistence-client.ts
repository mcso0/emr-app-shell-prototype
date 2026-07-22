import type {
  HospitalScheduleIssue,
  HospitalScheduleNonWorkEntry,
  HospitalScheduleRevision,
  HospitalScheduleRevisionSnapshot,
  HospitalScheduleRevisionStaff,
  HospitalScheduleWorkBlock,
} from "./revision-types";

export type HospitalScheduleRevisionRemoteSnapshot = HospitalScheduleRevisionSnapshot & {
  canonicalWeekStart: string;
};

export type HospitalScheduleProfileReadbackStatus = "confirmed" | "verification_failed";

export type HospitalScheduleRevisionCommandResponse = {
  profileReadback: HospitalScheduleProfileReadbackStatus | null;
  result: unknown;
  snapshot: HospitalScheduleRevisionRemoteSnapshot;
};

export class HospitalScheduleRevisionRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly issues: HospitalScheduleIssue[] = [],
  ) {
    super(message);
  }
}

export async function readHospitalScheduleRevision({
  weekStart,
  workspaceId,
}: {
  weekStart?: string;
  workspaceId: string;
}): Promise<HospitalScheduleRevisionRemoteSnapshot | null> {
  const params = new URLSearchParams();
  if (weekStart) params.set("weekStart", weekStart);
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/schedule?${params.toString()}`,
  );
  if (response.status === 503) return null;
  const body = (await response.json().catch(() => null)) as ScheduleResponseBody | null;
  if (!response.ok || !body?.ok) {
    throw new HospitalScheduleRevisionRequestError(
      body?.message ?? "근무표를 불러오지 못했어.",
      body?.error ?? "schedule_read_failed",
      parseIssues(body?.issues),
    );
  }
  if (body.modelVersion !== "v2") return null;
  return parseRevisionRemoteSnapshot(body.snapshot, body.canonicalWeekStart);
}

export async function sendHospitalScheduleRevisionCommand({
  command,
  workspaceId,
}: {
  command: Record<string, unknown>;
  workspaceId: string;
}): Promise<HospitalScheduleRevisionCommandResponse> {
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/schedule`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": createIdempotencyKey(),
      },
      body: JSON.stringify(command),
    },
  );
  const body = (await response.json().catch(() => null)) as ScheduleResponseBody | null;
  if (!response.ok || !body?.ok) {
    throw new HospitalScheduleRevisionRequestError(
      body?.message ?? "근무표 저장에 실패했어.",
      body?.error ?? "schedule_command_failed",
      parseIssues(body?.issues),
    );
  }
  if (body.modelVersion !== "v2") {
    throw new HospitalScheduleRevisionRequestError(
      "v2 근무표 응답을 받지 못했어.",
      "schedule_v2_response_invalid",
    );
  }
  return {
    snapshot: parseRevisionRemoteSnapshot(body.snapshot, body.canonicalWeekStart),
    profileReadback: parseProfileReadbackStatus(body.profileReadback),
    result: body.result,
  };
}

export async function verifyHospitalScheduleProfileReadback({
  revisionId,
  workspaceId,
}: {
  revisionId: string;
  workspaceId: string;
}): Promise<HospitalScheduleProfileReadbackStatus> {
  const params = new URLSearchParams({ profileReadbackRevisionId: revisionId });
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/schedule?${params.toString()}`,
  );
  const body = (await response.json().catch(() => null)) as ScheduleResponseBody | null;
  if (!response.ok || !body?.ok) {
    throw new HospitalScheduleRevisionRequestError(
      body?.message ?? "프로필 반영을 확인하지 못했어.",
      body?.error ?? "schedule_profile_readback_failed",
    );
  }
  return parseProfileReadbackStatus(body.profileReadback) ?? "verification_failed";
}

function parseRevisionRemoteSnapshot(
  value: unknown,
  canonicalWeekStart: unknown,
): HospitalScheduleRevisionRemoteSnapshot {
  const snapshot = asRecord(value);
  const week = asRecord(snapshot.week);
  const fallbackWeekStart = typeof week.weekStart === "string" ? week.weekStart : "";
  const parsedWeekStart =
    typeof canonicalWeekStart === "string" && isIsoDate(canonicalWeekStart)
      ? canonicalWeekStart
      : fallbackWeekStart;
  if (!isIsoDate(parsedWeekStart)) {
    throw new HospitalScheduleRevisionRequestError(
      "근무표 주차 정보가 올바르지 않아.",
      "schedule_week_invalid",
    );
  }
  return {
    canonicalWeekStart: parsedWeekStart,
    weekId: isString(week.id) ? week.id : null,
    weekStart: parsedWeekStart,
    revision: parseRevision(snapshot.draftRevision),
    latestPublishedRevision: parseRevision(snapshot.latestPublishedRevision),
    publishedRevisions: asArray(snapshot.publishedRevisions)
      .map(parseRevision)
      .filter(isRevision),
    staff: asArray(snapshot.staff).map(parseStaff).filter(isStaff),
    workBlocks: asArray(snapshot.workBlocks).map(parseWorkBlock).filter(isWorkBlock),
    nonWorkEntries: asArray(snapshot.nonWorkEntries)
      .map(parseNonWorkEntry)
      .filter(isNonWorkEntry),
    issues: parseIssues(snapshot.issues),
    canManage: true,
    modelVersion: "v2",
  };
}

function parseRevision(value: unknown): HospitalScheduleRevision | null {
  const record = asRecord(value);
  if (
    !isString(record.id) ||
    !isInteger(record.revision_no) ||
    (record.state !== "draft" && record.state !== "published" && record.state !== "superseded") ||
    !isInteger(record.lock_version)
  ) {
    return null;
  }
  return {
    id: record.id,
    revisionNo: record.revision_no,
    state: record.state,
    basedOnRevisionId: isString(record.based_on_revision_id) ? record.based_on_revision_id : null,
    lockVersion: record.lock_version,
    publishedAt: isString(record.published_at) ? record.published_at : null,
  };
}

function parseStaff(value: unknown): HospitalScheduleRevisionStaff | null {
  const record = asRecord(value);
  if (
    !isString(record.id) ||
    !isString(record.membershipId) ||
    !isString(record.name) ||
    !isRole(record.role)
  ) {
    return null;
  }
  return {
    id: record.id,
    membershipId: record.membershipId,
    name: record.name,
    initials: isString(record.initials) ? record.initials : record.name.slice(0, 2),
    role: record.role,
    availability: asRecord(record.availability),
    jobPositionId: isString(record.jobPositionId) ? record.jobPositionId : null,
  };
}

function parseWorkBlock(value: unknown): HospitalScheduleWorkBlock | null {
  const record = asRecord(value);
  if (
    !isString(record.id) ||
    !isNullableString(record.staff_profile_id) ||
    !isIsoDate(record.shift_date) ||
    !isMinute(record.start_minutes) ||
    !isMinute(record.end_minutes) ||
    record.end_minutes <= record.start_minutes ||
    !isWorkKind(record.work_kind) ||
    !isString(record.work_label_snapshot)
  ) {
    return null;
  }
  return {
    id: record.id,
    staffProfileId: record.staff_profile_id,
    shiftDate: record.shift_date,
    startMinutes: record.start_minutes,
    endMinutes: record.end_minutes,
    workKind: record.work_kind,
    workLabelSnapshot: record.work_label_snapshot,
    locationLabelSnapshot: isString(record.location_label_snapshot)
      ? record.location_label_snapshot
      : null,
    privateNote: isString(record.private_note) ? record.private_note : null,
  };
}

function parseNonWorkEntry(value: unknown): HospitalScheduleNonWorkEntry | null {
  const record = asRecord(value);
  if (
    !isString(record.id) ||
    !isString(record.staff_profile_id) ||
    !isIsoDate(record.entry_date) ||
    (record.entry_kind !== "leave" && record.entry_kind !== "off") ||
    !isNullableMinute(record.start_minutes) ||
    !isNullableMinute(record.end_minutes)
  ) {
    return null;
  }
  return {
    id: record.id,
    staffProfileId: record.staff_profile_id,
    entryDate: record.entry_date,
    entryKind: record.entry_kind,
    leaveSubtype: isString(record.leave_subtype) ? record.leave_subtype : null,
    startMinutes: record.start_minutes,
    endMinutes: record.end_minutes,
    privateNote: isString(record.private_note) ? record.private_note : null,
  };
}

function parseIssues(value: unknown): HospitalScheduleIssue[] {
  return asArray(value).map(parseIssue).filter(isIssue);
}

function parseIssue(value: unknown): HospitalScheduleIssue | null {
  const record = asRecord(value);
  if (
    !isIssueCode(record.code) ||
    !isString(record.message) ||
    (record.severity !== "blocker" && record.severity !== "warning") ||
    !isNullableString(record.entryId) ||
    !isNullableString(record.staffProfileId) ||
    !isNullableString(record.date)
  ) {
    return null;
  }
  return {
    code: record.code,
    message: record.message,
    severity: record.severity,
    entryId: record.entryId,
    staffProfileId: record.staffProfileId,
    date: record.date,
  };
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `schedule-v2-${crypto.randomUUID()}`;
  }
  return `schedule-v2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

type ScheduleResponseBody = {
  ok?: boolean;
  error?: string;
  issues?: unknown;
  message?: string;
  modelVersion?: "v1" | "v2";
  canonicalWeekStart?: unknown;
  profileReadback?: unknown;
  result?: unknown;
  snapshot?: unknown;
};

function parseProfileReadbackStatus(value: unknown): HospitalScheduleProfileReadbackStatus | null {
  const record = asRecord(value);
  return record.status === "confirmed" || record.status === "verification_failed"
    ? record.status
    : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isMinute(value: unknown): value is number {
  return isInteger(value) && value >= 0 && value <= 1440;
}

function isNullableMinute(value: unknown): value is number | null {
  return value === null || isMinute(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isRole(value: unknown): value is HospitalScheduleRevisionStaff["role"] {
  return value === "veterinarian" || value === "technician" || value === "reception";
}

function isWorkKind(value: unknown): value is HospitalScheduleWorkBlock["workKind"] {
  return value === "clinical" || value === "support" || value === "reception";
}

function isIssueCode(value: unknown): value is HospitalScheduleIssue["code"] {
  return (
    value === "invalid_time_range" ||
    value === "date_outside_week" ||
    value === "overlapping_assignment" ||
    value === "work_overlaps_non_work" ||
    value === "inactive_staff_profile" ||
    value === "missing_required_assignment" ||
    value === "hospital_closed" ||
    value === "overnight_not_supported" ||
    value === "stale_schedule_revision" ||
    value === "roster_revalidation_required" ||
    value === "operating_calendar_revalidation_required" ||
    value === "outside_operating_hours" ||
    value === "missing_location"
  );
}

function isStaff(value: HospitalScheduleRevisionStaff | null): value is HospitalScheduleRevisionStaff {
  return value !== null;
}

function isRevision(value: HospitalScheduleRevision | null): value is HospitalScheduleRevision {
  return value !== null;
}

function isWorkBlock(value: HospitalScheduleWorkBlock | null): value is HospitalScheduleWorkBlock {
  return value !== null;
}

function isNonWorkEntry(
  value: HospitalScheduleNonWorkEntry | null,
): value is HospitalScheduleNonWorkEntry {
  return value !== null;
}

function isIssue(value: HospitalScheduleIssue | null): value is HospitalScheduleIssue {
  return value !== null;
}
