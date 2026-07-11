import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import { resolveWorkspacePermission } from "@/features/auth/permission-resolver";
import {
  executeHospitalScheduleOperation,
  type HospitalScheduleOperation,
} from "@/features/hospital-admin/schedule/server-schedule-operations-core";
import {
  createSupabaseHospitalScheduleOperationsGateway,
  type SupabaseHospitalScheduleOperationsRpcClient,
} from "@/features/hospital-admin/schedule/supabase-schedule-operations-gateway";
import type { HospitalScheduleShift } from "@/features/hospital-admin/schedule/types";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ workspaceId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = await readIdentity(request);
  if (!identity.ok) return identity.response;

  const client = identity.source === "supabase_session" ? await createClient() : null;
  if (!client) {
    return Response.json(
      { ok: false, sourceStatus: "mock_session_only", error: "schedule_persistence_unavailable" },
      { status: 503 },
    );
  }

  const weekStart = new URL(request.url).searchParams.get("weekStart");
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return Response.json({ ok: false, error: "invalid_week_start" }, { status: 400 });
  }

  try {
    const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
      gateway: createSupabaseWorkspacePermissionGateway(
        client as unknown as SupabaseWorkspacePermissionClient,
      ),
      workspaceId,
      sessionUserId: identity.actorUserId,
    });
    const permission = resolveWorkspacePermission(permissionAdapter, {
      sessionUserId: identity.actorUserId,
      workspaceId,
    });
    if (!permission.allowed) {
      return Response.json(
        { ok: false, error: permission.denialReason ?? "permission_missing" },
        { status: permission.denialReason === "unauthenticated" ? 401 : 403 },
      );
    }
    const { data, error } = await (
      client as unknown as SupabaseHospitalScheduleOperationsRpcClient
    ).rpc("hospital_schedule_read_snapshot", {
      p_workspace_id: workspaceId,
      p_week_start: weekStart,
    });
    if (error) throw new Error(error.message ?? error.code ?? "schedule_read_failed");
    return Response.json({ ok: true, sourceStatus: "live", snapshot: data });
  } catch (error) {
    return Response.json(
      { ok: false, error: "schedule_read_failed", message: toSafeMessage(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = await readIdentity(request);
  if (!identity.ok) return identity.response;

  const client = identity.source === "supabase_session" ? await createClient() : null;
  if (!client) {
    return Response.json(
      {
        ok: false,
        sourceStatus: "mock_session_only",
        error: "schedule_persistence_unavailable",
      },
      { status: 503 },
    );
  }

  const action = parseScheduleOperation(await request.json().catch(() => null));
  if (!action) {
    return Response.json({ ok: false, error: "invalid_operation" }, { status: 400 });
  }

  try {
    const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
      gateway: createSupabaseWorkspacePermissionGateway(
        client as unknown as SupabaseWorkspacePermissionClient,
      ),
      workspaceId,
      sessionUserId: identity.actorUserId,
    });
    const result = await executeHospitalScheduleOperation({
      action,
      actorUserId: identity.actorUserId,
      gateway: createSupabaseHospitalScheduleOperationsGateway(
        client as unknown as SupabaseHospitalScheduleOperationsRpcClient,
      ),
      permissionAdapter,
      workspaceId,
    });
    return Response.json(result, { status: result.status });
  } catch (error) {
    return Response.json(
      { ok: false, error: "schedule_operation_failed", message: toSafeMessage(error) },
      { status: 500 },
    );
  }
}

async function readIdentity(request: Request) {
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });
  if (identity.ok) return identity;

  return {
    ok: false as const,
    response: Response.json(
      {
        ok: false,
        error: identity.denialReason,
        sessionStatus: identity.sessionStatus,
        sessionReason: identity.sessionReason,
      },
      { status: 401 },
    ),
  };
}

function parseScheduleOperation(value: unknown): HospitalScheduleOperation | null {
  const record = asRecord(value);
  switch (record.type) {
    case "request": {
      const requestType = record.requestType;
      if (
        !isString(record.date) ||
        !isString(record.reason) ||
        (requestType !== "leave" && requestType !== "shift-change")
      ) return null;
      return {
        type: "request",
        date: record.date,
        reason: record.reason,
        requestType: requestType === "shift-change" ? "shift-change" : "leave",
        shiftId: isString(record.shiftId) ? record.shiftId : null,
        requestedStartMinutes: isNullableMinute(record.requestedStartMinutes) ? record.requestedStartMinutes : undefined,
        requestedEndMinutes: isNullableMinute(record.requestedEndMinutes) ? record.requestedEndMinutes : undefined,
      };
    }
    case "review_request":
      return isString(record.requestId) && (record.decision === "approved" || record.decision === "declined")
        ? { type: "review_request", requestId: record.requestId, decision: record.decision }
        : null;
    case "clock_in":
      return isString(record.shiftId) ? { type: "clock_in", shiftId: record.shiftId } : null;
    case "clock_out":
      return { type: "clock_out" };
    case "save_shift": {
      const shift = parseShift(record.shift);
      return shift ? { type: "save_shift", shift } : null;
    }
    case "delete_shift":
      return isString(record.shiftId) ? { type: "delete_shift", shiftId: record.shiftId } : null;
    case "publish_week":
      return isString(record.weekStart) ? { type: "publish_week", weekStart: record.weekStart } : null;
    case "assignment_suggestions": {
      const shift = parseShift(record.shift);
      return shift ? { type: "assignment_suggestions", shift } : null;
    }
    case "payroll_preview":
      return isString(record.periodStart) && isString(record.periodEnd)
        ? { type: "payroll_preview", periodStart: record.periodStart, periodEnd: record.periodEnd }
        : null;
    default:
      return null;
  }
}

function parseShift(value: unknown): HospitalScheduleShift | null {
  const record = asRecord(value);
  if (
    !isString(record.id) ||
    !isString(record.date) ||
    !isMinute(record.startMinutes) ||
    !isMinute(record.endMinutes) ||
    !isString(record.workLabel) ||
    !isShiftKind(record.kind)
  ) return null;
  return {
    id: record.id,
    date: record.date,
    startMinutes: record.startMinutes,
    endMinutes: record.endMinutes,
    kind: record.kind,
    workLabel: record.workLabel,
    staffId: isString(record.staffId) ? record.staffId : null,
    locationLabel: isString(record.locationLabel) ? record.locationLabel : null,
    note: isString(record.note) ? record.note : null,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isMinute(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1440;
}

function isNullableMinute(value: unknown): value is number | null {
  return value === null || isMinute(value);
}

function isShiftKind(value: unknown): value is HospitalScheduleShift["kind"] {
  return value === "clinical" || value === "support" || value === "reception" || value === "leave" || value === "off";
}

function toSafeMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 160) : "unknown_error";
}
