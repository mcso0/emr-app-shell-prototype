import type {
  HospitalScheduleOperationsGateway,
  HospitalScheduleOperationalSnapshot,
  HospitalSchedulePayrollPreview,
  HospitalScheduleOperation,
} from "./server-schedule-operations-core";
import type {
  HospitalScheduleRole,
  HospitalScheduleShift,
  HospitalScheduleShiftKind,
  HospitalScheduleStaff,
} from "./types";

type SupabaseRpcError = { code?: string; message?: string };

export type SupabaseHospitalScheduleOperationsRpcClient = {
  rpc(functionName: string, args: Record<string, unknown>): Promise<{
    data: unknown;
    error: SupabaseRpcError | null;
  }>;
};

export function createSupabaseHospitalScheduleOperationsGateway(
  client: SupabaseHospitalScheduleOperationsRpcClient,
): HospitalScheduleOperationsGateway {
  return {
    async createPayrollPreview({ periodEnd, periodStart, workspaceId }) {
      const data = await callRpc(client, "hospital_schedule_create_payroll_preview", {
        p_workspace_id: workspaceId,
        p_period_start: periodStart,
        p_period_end: periodEnd,
      });
      return readPayrollPreview(data);
    },
    async executeOperation({ operation, workspaceId }) {
      const data = await executePersistedOperation(client, workspaceId, operation);
      return { id: readOperationId(data) };
    },
    async readSnapshot({ weekStart, workspaceId }) {
      const data = await callRpc(client, "hospital_schedule_read_snapshot", {
        p_workspace_id: workspaceId,
        p_week_start: weekStart ?? null,
      });
      return readSnapshot(data);
    },
  };
}

async function executePersistedOperation(
  client: SupabaseHospitalScheduleOperationsRpcClient,
  workspaceId: string,
  operation: Exclude<HospitalScheduleOperation, { type: "assignment_suggestions" | "payroll_preview" }>,
) {
  switch (operation.type) {
    case "request":
      return callRpc(client, "hospital_schedule_create_request", {
        p_workspace_id: workspaceId,
        p_shift_id: operation.shiftId,
        p_requested_date: operation.date,
        p_request_type: operation.requestType === "shift-change" ? "shift_change" : "leave",
        p_requested_start_minutes: operation.requestedStartMinutes ?? null,
        p_requested_end_minutes: operation.requestedEndMinutes ?? null,
        p_reason: operation.reason,
      });
    case "review_request":
      return callRpc(client, "hospital_schedule_review_request", {
        p_request_id: operation.requestId,
        p_decision: operation.decision,
      });
    case "clock_in":
      return callRpc(client, "hospital_schedule_clock_in", {
        p_workspace_id: workspaceId,
        p_shift_id: operation.shiftId,
      });
    case "clock_out":
      return callRpc(client, "hospital_schedule_clock_out", { p_workspace_id: workspaceId });
    case "save_shift":
      return callRpc(client, "hospital_schedule_save_shift", {
        p_workspace_id: workspaceId,
        p_shift_id: isUuid(operation.shift.id) ? operation.shift.id : null,
        p_staff_profile_id: operation.shift.staffId,
        p_shift_date: operation.shift.date,
        p_start_minutes: operation.shift.startMinutes,
        p_end_minutes: operation.shift.endMinutes,
        p_shift_kind: operation.shift.kind,
        p_work_label: operation.shift.workLabel,
        p_location_label: operation.shift.locationLabel,
        p_note: operation.shift.note,
      });
    case "delete_shift":
      return callRpc(client, "hospital_schedule_delete_shift", {
        p_workspace_id: workspaceId,
        p_shift_id: operation.shiftId,
      });
    case "publish_week":
      return callRpc(client, "hospital_schedule_publish_week", {
        p_workspace_id: workspaceId,
        p_week_start: operation.weekStart,
      });
  }
}

async function callRpc(
  client: SupabaseHospitalScheduleOperationsRpcClient,
  functionName: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw new Error(error.message ?? error.code ?? "hospital_schedule_rpc_failed");
  return data;
}

function readSnapshot(value: unknown): HospitalScheduleOperationalSnapshot {
  const snapshot = asRecord(value);
  const staff = asArray(snapshot.staff).map(readStaff).filter(isStaff);
  const shifts = asArray(snapshot.shifts).map(readShift).filter(isShift);
  return { staff, shifts };
}

function readStaff(value: unknown): HospitalScheduleStaff | null {
  const record = asRecord(value);
  const role = record.role;
  if (!isRole(role) || typeof record.id !== "string" || typeof record.name !== "string") return null;

  return {
    id: record.id,
    name: record.name,
    initials: typeof record.initials === "string" ? record.initials : record.name.slice(0, 2),
    role,
    roleLabel: role === "veterinarian" ? "수의사" : role === "technician" ? "테크니션" : "접수",
    weeklyTargetMinutes: 0,
    unavailableByWeekday: readAvailability(record.availability),
  };
}

function readShift(value: unknown): HospitalScheduleShift | null {
  const record = asRecord(value);
  if (
    typeof record.id !== "string" ||
    !isShiftKind(record.kind) ||
    typeof record.date !== "string" ||
    !isMinute(record.startMinutes) ||
    !isMinute(record.endMinutes) ||
    record.endMinutes <= record.startMinutes ||
    typeof record.workLabel !== "string"
  ) return null;

  return {
    id: record.id,
    staffId: typeof record.staffProfileId === "string" ? record.staffProfileId : null,
    date: record.date,
    startMinutes: record.startMinutes,
    endMinutes: record.endMinutes,
    kind: record.kind,
    workLabel: record.workLabel,
    locationLabel: typeof record.locationLabel === "string" ? record.locationLabel : null,
    note: typeof record.note === "string" ? record.note : null,
  };
}

function readPayrollPreview(value: unknown): HospitalSchedulePayrollPreview {
  const record = asRecord(value);
  if (
    record.status !== "preview" ||
    !Number.isInteger(record.totalMinutes) ||
    !Number.isInteger(record.totalPayCents)
  ) {
    throw new Error("hospital_schedule_payroll_preview_invalid");
  }
  return {
    status: "preview",
    totalMinutes: record.totalMinutes,
    totalPayCents: record.totalPayCents,
  };
}

function readOperationId(value: unknown) {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return typeof record.id === "string" ? record.id : null;
}

function readAvailability(value: unknown): HospitalScheduleStaff["unavailableByWeekday"] {
  const record = asRecord(value);
  const ranges: HospitalScheduleStaff["unavailableByWeekday"] = {};
  for (const [weekday, rawRanges] of Object.entries(record)) {
    const day = Number(weekday);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    const validRanges = asArray(rawRanges)
      .map((range) => asRecord(range))
      .filter((range) => isMinute(range.startMinutes) && isMinute(range.endMinutes) && range.endMinutes > range.startMinutes)
      .map((range) => ({ startMinutes: range.startMinutes as number, endMinutes: range.endMinutes as number }));
    if (validRanges.length) ranges[day] = validRanges;
  }
  return ranges;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function isRole(value: unknown): value is HospitalScheduleRole {
  return value === "veterinarian" || value === "technician" || value === "reception";
}

function isShiftKind(value: unknown): value is HospitalScheduleShiftKind {
  return value === "clinical" || value === "support" || value === "reception" || value === "leave" || value === "off";
}

function isMinute(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1440;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isStaff(value: HospitalScheduleStaff | null): value is HospitalScheduleStaff {
  return value !== null;
}

function isShift(value: HospitalScheduleShift | null): value is HospitalScheduleShift {
  return value !== null;
}
