import type {
  HospitalSchedulePersistenceAction,
  HospitalSchedulePersistenceAdapter,
  HospitalScheduleRemoteState,
} from "./store";
import type {
  HospitalScheduleRequest,
  HospitalScheduleShift,
  HospitalScheduleStaff,
} from "./types";

export function createHospitalSchedulePersistenceAdapter({
  onError,
  onRefreshed,
  workspaceId,
}: {
  onError: (error: unknown) => void;
  onRefreshed: () => Promise<void>;
  workspaceId: string;
}): HospitalSchedulePersistenceAdapter {
  return {
    onError,
    async persist(action) {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/schedule`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(toApiAction(action)),
        },
      );
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !body?.ok) {
        throw new Error(body?.message ?? "근무표를 저장하지 못했습니다.");
      }
      await onRefreshed();
    },
  };
}

export async function readPersistedHospitalSchedule({
  weekStart,
  workspaceId,
}: {
  weekStart?: string;
  workspaceId: string;
}): Promise<HospitalScheduleRemoteState | null> {
  const params = new URLSearchParams();
  if (weekStart) params.set("weekStart", weekStart);
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/hospital-admin/schedule?${params.toString()}`,
  );
  if (response.status === 503) return null;
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    snapshot?: unknown;
    canonicalWeekStart?: unknown;
    message?: string;
  } | null;
  if (!response.ok || !body?.ok) throw new Error(body?.message ?? "근무표를 불러오지 못했습니다.");
  return parseRemoteState(body.snapshot, body.canonicalWeekStart);
}

function toApiAction(action: HospitalSchedulePersistenceAction) {
  switch (action.type) {
    case "request":
      return {
        type: "request",
        date: action.request.date,
        reason: action.request.reason,
        requestType: action.request.type,
        shiftId: action.request.shiftId,
        requestedStartMinutes: action.request.requestedStartMinutes,
        requestedEndMinutes: action.request.requestedEndMinutes,
      };
    case "review_request":
      return { type: "review_request", requestId: action.requestId, decision: action.decision };
    case "save_shift":
      return { type: "save_shift", shift: action.shift };
    case "delete_shift":
      return { type: "delete_shift", shiftId: action.shiftId };
    case "publish_week":
      return { type: "publish_week", weekStart: action.weekStart };
  }
}

function parseRemoteState(value: unknown, canonicalWeekStart: unknown): HospitalScheduleRemoteState {
  const snapshot = asRecord(value);
  const week = asRecord(snapshot.week);
  const weekStart =
    typeof canonicalWeekStart === "string" && isIsoDate(canonicalWeekStart)
      ? canonicalWeekStart
      : typeof week.weekStart === "string" && isIsoDate(week.weekStart)
        ? week.weekStart
        : null;
  if (!weekStart) throw new Error("근무표 주차 정보가 올바르지 않습니다.");
  return {
    weekStart,
    staff: asArray(snapshot.staff).map(parseStaff).filter(isStaff),
    shifts: asArray(snapshot.shifts).map(parseShift).filter(isShift),
    requests: asArray(snapshot.requests).map(parseRequest).filter(isRequest),
    publication: {
      state: week.publicationState === "published" || week.publicationState === "changed" ? week.publicationState : "draft",
      publishedAtLabel: typeof week.publishedAt === "string" ? "게시됨" : null,
      changedShiftIds: [],
    },
  };
}

function parseStaff(value: unknown): HospitalScheduleStaff | null {
  const record = asRecord(value);
  if (!isString(record.id) || !isString(record.name) || !isRole(record.role)) return null;
  return {
    id: record.id,
    name: record.name,
    initials: isString(record.initials) ? record.initials : record.name.slice(0, 2),
    role: record.role,
    roleLabel: record.role === "veterinarian" ? "수의사" : record.role === "technician" ? "테크니션" : "접수",
    weeklyTargetMinutes: 0,
    unavailableByWeekday: {},
  };
}

function parseShift(value: unknown): HospitalScheduleShift | null {
  const record = asRecord(value);
  if (!isString(record.id) || !isString(record.date) || !isMinute(record.startMinutes) || !isMinute(record.endMinutes) || !isString(record.workLabel) || !isShiftKind(record.kind)) return null;
  return {
    id: record.id,
    staffId: isString(record.staffProfileId) ? record.staffProfileId : null,
    date: record.date,
    startMinutes: record.startMinutes,
    endMinutes: record.endMinutes,
    kind: record.kind,
    workLabel: record.workLabel,
    locationLabel: isString(record.locationLabel) ? record.locationLabel : null,
    note: isString(record.note) ? record.note : null,
  };
}

function parseRequest(value: unknown): HospitalScheduleRequest | null {
  const record = asRecord(value);
  if (!isString(record.id) || !isString(record.staffProfileId) || !isString(record.date) || !isString(record.reason)) return null;
  const type = record.type === "shift_change" ? "shift-change" : record.type;
  if ((type !== "leave" && type !== "shift-change") || !isRequestStatus(record.status)) return null;
  return {
    id: record.id,
    staffId: record.staffProfileId,
    shiftId: isString(record.shiftId) ? record.shiftId : null,
    date: record.date,
    type,
    status: record.status,
    requestedStartMinutes: isNullableMinute(record.requestedStartMinutes) ? record.requestedStartMinutes : null,
    requestedEndMinutes: isNullableMinute(record.requestedEndMinutes) ? record.requestedEndMinutes : null,
    reason: record.reason,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isMinute(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1440;
}

function isNullableMinute(value: unknown): value is number | null {
  return value === null || isMinute(value);
}

function isRole(value: unknown): value is HospitalScheduleStaff["role"] {
  return value === "veterinarian" || value === "technician" || value === "reception";
}

function isShiftKind(value: unknown): value is HospitalScheduleShift["kind"] {
  return value === "clinical" || value === "support" || value === "reception" || value === "leave" || value === "off";
}

function isRequestStatus(value: unknown): value is HospitalScheduleRequest["status"] {
  return value === "pending" || value === "approved" || value === "declined";
}

function isStaff(value: HospitalScheduleStaff | null): value is HospitalScheduleStaff {
  return value !== null;
}

function isShift(value: HospitalScheduleShift | null): value is HospitalScheduleShift {
  return value !== null;
}

function isRequest(value: HospitalScheduleRequest | null): value is HospitalScheduleRequest {
  return value !== null;
}
