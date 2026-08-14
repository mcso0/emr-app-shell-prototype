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
  executeHospitalScheduleRevisionCommand,
  parseHospitalScheduleRevisionCommand,
  type HospitalScheduleRevisionRpcClient,
} from "@/features/hospital-admin/schedule/revision-api";
import {
  createSupabaseHospitalScheduleOperationsGateway,
  type SupabaseHospitalScheduleOperationsRpcClient,
} from "@/features/hospital-admin/schedule/supabase-schedule-operations-gateway";
import type { HospitalScheduleShift } from "@/features/hospital-admin/schedule/types";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
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

  const searchParams = new URL(request.url).searchParams;
  const requestedWeekStart = searchParams.get("weekStart");
  const profileReadbackRevisionId = searchParams.get("profileReadbackRevisionId");
  if (requestedWeekStart && !/^\d{4}-\d{2}-\d{2}$/.test(requestedWeekStart)) {
    return Response.json({ ok: false, error: "invalid_week_start" }, { status: 400 });
  }
  if (profileReadbackRevisionId && !isUuid(profileReadbackRevisionId)) {
    return Response.json({ ok: false, error: "invalid_schedule_revision" }, { status: 400 });
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
    const weekStart = await resolveWeekStart({
      client: client as unknown as SupabaseHospitalScheduleOperationsRpcClient,
      requestedWeekStart,
      workspaceId,
    });
    const rolloutMode = await readScheduleRolloutMode(
      client as unknown as SupabaseHospitalScheduleOperationsRpcClient,
      workspaceId,
    );
    const managePermission = resolveWorkspacePermission(permissionAdapter, {
      sessionUserId: identity.actorUserId,
      workspaceId,
      requiredPermission: "role_permission:manage",
    });

    if (profileReadbackRevisionId) {
      if (rolloutMode !== "v2") {
        return Response.json({ ok: false, error: "schedule_v2_not_enabled" }, { status: 409 });
      }
      if (!managePermission.allowed) {
        return Response.json(
          { ok: false, error: managePermission.denialReason ?? "permission_missing" },
          { status: managePermission.denialReason === "unauthenticated" ? 401 : 403 },
        );
      }
      const profileReadback = await callScheduleRpc(
        client as unknown as SupabaseHospitalScheduleOperationsRpcClient,
        "hospital_schedule_verify_profile_readback_v2",
        { p_workspace_id: workspaceId, p_revision_id: profileReadbackRevisionId },
      );
      return Response.json({
        ok: true,
        sourceStatus: "live",
        modelVersion: "v2",
        profileReadback,
      });
    }

    if (rolloutMode === "v2" || rolloutMode === "compare") {
      if (rolloutMode === "v2" && !managePermission.allowed) {
        return Response.json(
          { ok: false, error: managePermission.denialReason ?? "permission_missing" },
          { status: managePermission.denialReason === "unauthenticated" ? 401 : 403 },
        );
      }

      if (managePermission.allowed) {
        const revisionSnapshot = await callScheduleRpc(
          client as unknown as SupabaseHospitalScheduleOperationsRpcClient,
          "hospital_schedule_read_revision_snapshot",
          { p_workspace_id: workspaceId, p_week_start: weekStart },
        );
        if (rolloutMode === "v2") {
          return Response.json({
            ok: true,
            sourceStatus: "live",
            modelVersion: "v2",
            canonicalWeekStart: weekStart,
            snapshot: revisionSnapshot,
          });
        }

        const v1Snapshot = await callScheduleRpc(
          client as unknown as SupabaseHospitalScheduleOperationsRpcClient,
          "hospital_schedule_read_snapshot",
          { p_workspace_id: workspaceId, p_week_start: weekStart },
        );
        return Response.json({
          ok: true,
          sourceStatus: "live",
          modelVersion: "v1",
          canonicalWeekStart: weekStart,
          snapshot: v1Snapshot,
          comparison: compareScheduleSnapshots(v1Snapshot, revisionSnapshot),
        });
      }
    }

    const { data, error } = await (
      client as unknown as SupabaseHospitalScheduleOperationsRpcClient
    ).rpc("hospital_schedule_read_snapshot", {
      p_workspace_id: workspaceId,
      p_week_start: weekStart,
    });
    if (error) throw new Error(error.message ?? error.code ?? "schedule_read_failed");
    return Response.json({
      ok: true,
      sourceStatus: "live",
      modelVersion: "v1",
      canonicalWeekStart: weekStart,
      snapshot: data,
    });
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

  const input = await request.json().catch(() => null);
  const revisionCommand = parseHospitalScheduleRevisionCommand(input);
  const action = revisionCommand ? null : parseScheduleOperation(input);
  if (!revisionCommand && !action) {
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
    if (revisionCommand) {
      const idempotencyKey = request.headers.get("idempotency-key");
      if (!idempotencyKey || idempotencyKey.trim().length < 8) {
        return Response.json({ ok: false, error: "idempotency_key_required" }, { status: 400 });
      }
      const rolloutMode = await readScheduleRolloutMode(
        client as unknown as SupabaseHospitalScheduleOperationsRpcClient,
        workspaceId,
      );
      if (rolloutMode !== "v2") {
        return Response.json(
          { ok: false, error: "schedule_v2_not_enabled" },
          { status: 409 },
        );
      }
      const permission = resolveWorkspacePermission(permissionAdapter, {
        sessionUserId: identity.actorUserId,
        workspaceId,
        requiredPermission: "role_permission:manage",
      });
      if (!permission.allowed) {
        return Response.json(
          { ok: false, error: permission.denialReason ?? "permission_missing" },
          { status: permission.denialReason === "unauthenticated" ? 401 : 403 },
        );
      }
      const result = await executeHospitalScheduleRevisionCommand({
        client: client as unknown as HospitalScheduleRevisionRpcClient,
        command: revisionCommand,
        idempotencyKey: idempotencyKey.trim(),
        workspaceId,
      });
      const weekStart = revisionCommand.type === "create_draft"
        ? revisionCommand.weekStart
        : await findRevisionWeekStart({
            client: client as unknown as SupabaseHospitalScheduleOperationsRpcClient,
            workspaceId,
            revisionId: revisionCommand.revisionId,
          });
      const snapshot = await callScheduleRpc(
        client as unknown as SupabaseHospitalScheduleOperationsRpcClient,
        "hospital_schedule_read_revision_snapshot",
        { p_workspace_id: workspaceId, p_week_start: weekStart },
      );
      const profileReadback = revisionCommand.type === "publish_revision"
        ? await verifyProfileReadback({
            client: client as unknown as SupabaseHospitalScheduleOperationsRpcClient,
            revisionId: revisionCommand.revisionId,
            workspaceId,
          })
        : null;
      return Response.json({
        ok: true,
        action: revisionCommand.type,
        result,
        snapshot,
        modelVersion: "v2",
        canonicalWeekStart: weekStart,
        profileReadback,
      });
    }
    if (!action) {
      return Response.json({ ok: false, error: "invalid_operation" }, { status: 400 });
    }
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
    const revisionFailure = toRevisionFailureResponse(error);
    if (revisionFailure) return revisionFailure;
    return Response.json(
      { ok: false, error: "schedule_operation_failed", message: toSafeMessage(error) },
      { status: 500 },
    );
  }
}

async function resolveWeekStart({
  client,
  requestedWeekStart,
  workspaceId,
}: {
  client: SupabaseHospitalScheduleOperationsRpcClient;
  requestedWeekStart: string | null;
  workspaceId: string;
}) {
  if (requestedWeekStart) return requestedWeekStart;
  const { data, error } = await client.rpc("hospital_schedule_resolve_week_start", {
    p_workspace_id: workspaceId,
  });
  if (!error && typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data)) return data;
  return getMonday(getWorkspaceOperatingDate(workspaceId));
}

async function readScheduleRolloutMode(
  client: SupabaseHospitalScheduleOperationsRpcClient,
  workspaceId: string,
) {
  const { data, error } = await client.rpc("hospital_schedule_get_rollout_mode", {
    p_workspace_id: workspaceId,
  });
  if (error || (data !== "v1" && data !== "compare" && data !== "v2")) return "v1" as const;
  return data;
}

async function callScheduleRpc(
  client: SupabaseHospitalScheduleOperationsRpcClient,
  functionName: string,
  args: Record<string, unknown>,
) {
  const { data, error } = await client.rpc(functionName, args);
  if (error) {
    const failure = new Error(error.message ?? error.code ?? "schedule_rpc_failed") as Error & { code?: string };
    failure.code = error.code;
    throw failure;
  }
  return data;
}

async function findRevisionWeekStart({
  client,
  revisionId,
  workspaceId,
}: {
  client: SupabaseHospitalScheduleOperationsRpcClient;
  revisionId: string;
  workspaceId: string;
}) {
  const weekStart = await callScheduleRpc(
    client,
    "hospital_schedule_resolve_revision_week_start",
    { p_workspace_id: workspaceId, p_revision_id: revisionId },
  );
  if (typeof weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return weekStart;
  throw new Error("schedule_revision_week_not_resolved");
}

async function verifyProfileReadback({
  client,
  revisionId,
  workspaceId,
}: {
  client: SupabaseHospitalScheduleOperationsRpcClient;
  revisionId: string;
  workspaceId: string;
}) {
  try {
    return await callScheduleRpc(
      client,
      "hospital_schedule_verify_profile_readback_v2",
      { p_workspace_id: workspaceId, p_revision_id: revisionId },
    );
  } catch {
    return { status: "verification_failed" };
  }
}

function compareScheduleSnapshots(v1Snapshot: unknown, v2Snapshot: unknown) {
  const v1 = asRecord(v1Snapshot);
  const v2 = asRecord(v2Snapshot);
  const v1Shifts = asArray(v1.shifts);
  const v2Entries = [...asArray(v2.workBlocks), ...asArray(v2.nonWorkEntries)];
  const v1Week = asRecord(v1.week);
  const v2Published = asRecord(v2.latestPublishedRevision);
  return {
    matches:
      v1Shifts.length === v2Entries.length &&
      (v1Week.publicationState === "published" || v1Week.publicationState === "changed") ===
        (v2Published.state === "published"),
    v1: {
      entryCount: v1Shifts.length,
      published: v1Week.publicationState === "published" || v1Week.publicationState === "changed",
      checksum: scheduleSnapshotChecksum(v1Shifts),
    },
    v2: {
      entryCount: v2Entries.length,
      published: v2Published.state === "published",
      checksum: scheduleSnapshotChecksum(v2Entries),
    },
  };
}

function scheduleSnapshotChecksum(entries: unknown[]) {
  let hash = 2166136261;
  const normalized = entries
    .map((entry) => {
      const record = asRecord(entry);
      return {
        staffProfileId: record.staffProfileId ?? record.staff_profile_id ?? null,
        date: record.date ?? record.shiftDate ?? record.shift_date ?? record.entryDate ?? record.entry_date,
        startMinutes: record.startMinutes ?? record.start_minutes ?? null,
        endMinutes: record.endMinutes ?? record.end_minutes ?? null,
        kind: record.kind ?? record.workKind ?? record.work_kind ?? record.entryKind ?? record.entry_kind,
      };
    })
    .sort((first, second) => JSON.stringify(first).localeCompare(JSON.stringify(second)));
  for (const entry of normalized) {
    const value = JSON.stringify(entry);
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function getMonday(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const weekday = (parsed.getUTCDay() + 6) % 7;
  parsed.setUTCDate(parsed.getUTCDate() - weekday);
  return parsed.toISOString().slice(0, 10);
}

function toRevisionFailureResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const code = error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : "";
  if (message.includes("stale_schedule_revision")) {
    return Response.json({ ok: false, error: "stale_schedule_revision" }, { status: 409 });
  }
  if (message.includes("idempotency_key_reused") || message.includes("idempotency_request_in_progress")) {
    return Response.json({ ok: false, error: "idempotency_conflict" }, { status: 409 });
  }
  if (message.startsWith("publication_blocked:")) {
    return Response.json(
      { ok: false, error: "publication_blocked", issues: parsePublicationIssues(message) },
      { status: 422 },
    );
  }
  if (
    code === "23P01" ||
    code === "23503" ||
    code === "23514" ||
    message.includes("schedule_work_block_") ||
    message.includes("schedule_non_work_entry_")
  ) {
    return Response.json({ ok: false, error: "schedule_revision_invalid" }, { status: 422 });
  }
  return null;
}

function parsePublicationIssues(message: string) {
  const raw = message.slice("publication_blocked:".length);
  try {
    return JSON.parse(raw);
  } catch {
    return [];
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

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isMinute(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 1440;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
