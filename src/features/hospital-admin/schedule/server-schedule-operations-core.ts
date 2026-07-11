import {
  calculateSchedulePayrollPreview,
  getScheduleAssignmentSuggestions,
  type HospitalScheduleTimeClockEntry,
} from "./operations-model";
import { hospitalScheduleSeed } from "./fixtures";
import { cloneScheduleSeed } from "./model";
import type {
  HospitalScheduleRequestType,
  HospitalScheduleShift,
  HospitalScheduleStaff,
} from "./types";
import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";

export type HospitalSchedulePayrollPreview = {
  status: "preview";
  totalMinutes: number;
  totalPayCents: number;
};

export type HospitalScheduleOperationalSnapshot = {
  shifts: HospitalScheduleShift[];
  staff: HospitalScheduleStaff[];
};

export type HospitalScheduleOperation =
  | {
      type: "request";
      date: string;
      reason: string;
      requestType: HospitalScheduleRequestType;
      shiftId: string | null;
      requestedEndMinutes?: number | null;
      requestedStartMinutes?: number | null;
    }
  | { type: "review_request"; decision: "approved" | "declined"; requestId: string }
  | { type: "clock_in"; shiftId: string }
  | { type: "clock_out" }
  | { type: "save_shift"; shift: HospitalScheduleShift }
  | { type: "delete_shift"; shiftId: string }
  | { type: "publish_week"; weekStart: string }
  | { type: "assignment_suggestions"; shift: HospitalScheduleShift }
  | { type: "payroll_preview"; periodEnd: string; periodStart: string };

type PersistedOperation = Exclude<
  HospitalScheduleOperation,
  { type: "assignment_suggestions" | "payroll_preview" }
>;

export type HospitalScheduleOperationsGateway = {
  createPayrollPreview(input: {
    actorUserId: string;
    periodEnd: string;
    periodStart: string;
    workspaceId: string;
  }): Promise<HospitalSchedulePayrollPreview>;
  executeOperation(input: {
    actorUserId: string;
    operation: PersistedOperation;
    workspaceId: string;
  }): Promise<{ id: string | null }>;
  readSnapshot(input: {
    actorUserId: string;
    weekStart?: string;
    workspaceId: string;
  }): Promise<HospitalScheduleOperationalSnapshot>;
};

type OperationSuccess =
  | {
      ok: true;
      status: 200 | 201;
      action: Exclude<HospitalScheduleOperation["type"], "assignment_suggestions" | "payroll_preview">;
      id?: string | null;
    }
  | {
      ok: true;
      status: 200;
      action: "assignment_suggestions";
      suggestions: ReturnType<typeof getScheduleAssignmentSuggestions>;
    }
  | {
      ok: true;
      status: 201;
      action: "payroll_preview";
      preview: HospitalSchedulePayrollPreview;
    };

export type HospitalScheduleOperationResult =
  | OperationSuccess
  | {
      ok: false;
      status: 400 | 401 | 403 | 503;
      error:
        | "gateway_unavailable"
        | "invalid_operation"
        | WorkspacePermissionDenialReason;
    };

export async function executeHospitalScheduleOperation({
  action,
  actorUserId,
  gateway,
  permissionAdapter = createMockWorkspacePermissionAdapter(),
  workspaceId,
}: {
  action: HospitalScheduleOperation;
  actorUserId: string | null;
  gateway?: HospitalScheduleOperationsGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<HospitalScheduleOperationResult> {
  const validationError = validateOperation(action);
  if (validationError) {
    return { ok: false, status: 400, error: "invalid_operation" };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    ...(requiresAdmin(action) ? { requiredPermission: "role_permission:manage" as const } : {}),
  });
  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      error: permission.denialReason ?? "permission_missing",
    };
  }

  if (!gateway || !actorUserId) {
    return { ok: false, status: 503, error: "gateway_unavailable" };
  }

  if (action.type === "assignment_suggestions") {
    const snapshot = await gateway.readSnapshot({
      actorUserId,
      workspaceId,
      weekStart: getWeekStart(action.shift.date),
    });
    return {
      ok: true,
      status: 200,
      action: "assignment_suggestions",
      suggestions: getScheduleAssignmentSuggestions({
        shifts: snapshot.shifts,
        staff: snapshot.staff,
        targetShift: action.shift,
      }),
    };
  }

  if (action.type === "payroll_preview") {
    return {
      ok: true,
      status: 201,
      action: "payroll_preview",
      preview: await gateway.createPayrollPreview({
        actorUserId,
        periodEnd: action.periodEnd,
        periodStart: action.periodStart,
        workspaceId,
      }),
    };
  }

  const result = await gateway.executeOperation({ actorUserId, operation: action, workspaceId });
  return {
    ok: true,
    status: action.type === "request" ? 201 : 200,
    action: action.type,
    id: result.id,
  };
}

export function createDemoHospitalScheduleOperationsGateway(): HospitalScheduleOperationsGateway {
  const seed = cloneScheduleSeed(hospitalScheduleSeed);
  const timeEntries: HospitalScheduleTimeClockEntry[] = [
    { staffId: "staff-suji", clockInMinutes: 9 * 60, clockOutMinutes: 17 * 60 },
  ];
  const staffProfiles = seed.staff.map((staff) => ({
    staffId: staff.id,
    hourlyRateCents: staff.id === "staff-suji" ? 2_500 : 2_000,
  }));

  return {
    async createPayrollPreview() {
      return calculateSchedulePayrollPreview({ staffProfiles, timeEntries });
    },
    async executeOperation({ operation }) {
      return { id: operation.type === "clock_out" ? null : `demo-${operation.type}` };
    },
    async readSnapshot() {
      return { shifts: seed.shifts, staff: seed.staff };
    },
  };
}

function requiresAdmin(action: HospitalScheduleOperation) {
  return (
    action.type === "review_request" ||
    action.type === "save_shift" ||
    action.type === "delete_shift" ||
    action.type === "publish_week" ||
    action.type === "assignment_suggestions" ||
    action.type === "payroll_preview"
  );
}

function validateOperation(action: HospitalScheduleOperation) {
  switch (action.type) {
    case "request":
      return (
        !isIsoDate(action.date) ||
        !action.reason.trim() ||
        action.reason.trim().length > 1000 ||
        !isRequestedRangeValid(action.requestedStartMinutes, action.requestedEndMinutes)
      );
    case "review_request":
      return !action.requestId || !["approved", "declined"].includes(action.decision);
    case "clock_in":
      return !action.shiftId;
    case "clock_out":
      return false;
    case "save_shift":
      return (
        !isIsoDate(action.shift.date) ||
        !action.shift.workLabel.trim() ||
        action.shift.workLabel.trim().length > 80 ||
        action.shift.endMinutes <= action.shift.startMinutes ||
        action.shift.startMinutes < 0 ||
        action.shift.endMinutes > 1440
      );
    case "delete_shift":
      return !action.shiftId;
    case "publish_week":
      return !isIsoDate(action.weekStart);
    case "assignment_suggestions":
      return (
        !isIsoDate(action.shift.date) ||
        action.shift.endMinutes <= action.shift.startMinutes ||
        action.shift.startMinutes < 0 ||
        action.shift.endMinutes > 1440
      );
    case "payroll_preview":
      return !isIsoDate(action.periodStart) || !isIsoDate(action.periodEnd) || action.periodEnd < action.periodStart;
  }
}

function isRequestedRangeValid(start: number | null | undefined, end: number | null | undefined) {
  if (start === null || start === undefined || end === null || end === undefined) return true;
  return start >= 0 && end <= 1440 && end > start;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getWeekStart(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const weekday = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - weekday);
  return parsed.toISOString().slice(0, 10);
}
