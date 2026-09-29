import { getRequiredWorkspaceVitalFieldErrors } from "@/features/patient-vitals/workspace-vital-settings";
import { createSupabaseWorkspaceVitalSettingsGateway, type SupabaseWorkspaceVitalSettingsClient } from "@/features/hospital-admin/vital-settings/server-workspace-vital-settings-core";
import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { resolveWorkspacePermission } from "@/features/auth/permission-resolver";
import { readServerSession } from "@/features/auth/server-session-reader";
import { demoSessionUserIdHeader, resolveRoleUpdateActorIdentity } from "@/features/auth/server-role-update-identity";
import { createSupabaseWorkspacePermissionGateway, type SupabaseWorkspacePermissionClient } from "@/features/auth/supabase-workspace-permission-gateway";
import { canWritePatientVitals, validatePatientVitalWriteInput } from "@/features/patient-vitals/server-patient-vital-core";
import { parsePatientVitalMeasurement } from "@/features/patient-vitals/server-patient-vital";
import { createClient } from "@/lib/supabase/server";

type VitalHistoryClient = {
  rpc(name: "clair_list_patient_vital_history" | "clair_write_patient_vital_measurement", args: Record<string, unknown>): Promise<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handlePatientVitalHistoryRequest({ request, workspaceId }: {
  request: Request;
  workspaceId: string;
}) {
  const identity = resolveRoleUpdateActorIdentity({
    serverSession: await readServerSession(),
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });
  if (!identity.ok) return Response.json({ ok: false, denialReason: identity.denialReason }, { status: 401 });
  const reading = request.method === "GET";
  const body = reading ? null : await request.json().catch(() => null) as Record<string, unknown> | null;
  const url = new URL(request.url);
  const encounterId = reading ? url.searchParams.get("encounterId") : body?.encounterId;
  if (typeof encounterId !== "string" || !uuidPattern.test(encounterId)) {
    return Response.json({ ok: false, error: "invalid_input", fieldErrors: { vitals: "진료 접수를 다시 선택해 주세요." } }, { status: 400 });
  }
  const client = identity.source === "supabase_session" ? await createClient() : null;
  if (!client) return Response.json({ ok: false, error: "supabase_client_missing" }, { status: 500 });
  const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
    gateway: createSupabaseWorkspacePermissionGateway(client as unknown as SupabaseWorkspacePermissionClient),
    sessionUserId: identity.actorUserId,
    workspaceId,
  });
  const readAccess = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: identity.actorUserId, workspaceId, requiredPermission: "patient:view",
  });
  const writeAccess = canWritePatientVitals({ actorUserId: identity.actorUserId, permissionAdapter, workspaceId });
  if (!readAccess.allowed || (!reading && !writeAccess.allowed)) {
    return Response.json({ ok: false, denialReason: !readAccess.allowed ? readAccess.denialReason : writeAccess.denialReason }, { status: 403 });
  }
  const gateway = client as unknown as VitalHistoryClient;
  if (reading) {
    const beforeId = url.searchParams.get("beforeId");
    if (beforeId && !uuidPattern.test(beforeId)) return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
    const { data, error } = await gateway.rpc("clair_list_patient_vital_history", {
      p_workspace_id: workspaceId, p_encounter_id: encounterId, p_before_id: beforeId,
    });
    if (error) return historyError(error.message, "db_read_failed");
    if (!isRecord(data) || !Array.isArray(data.measurements)) return historyError(undefined, "db_read_failed");
    const measurements = data.measurements.map(parsePatientVitalMeasurement);
    if (measurements.some((item) => !item)) return historyError(undefined, "db_read_failed");
    return Response.json({ ok: true, measurements, nextCursor: typeof data.nextCursor === "string" ? data.nextCursor : null, canWriteVitals: writeAccess.allowed });
  }
  const settings = await createSupabaseWorkspaceVitalSettingsGateway(client as unknown as SupabaseWorkspaceVitalSettingsClient).get(workspaceId);
  if (!settings.ok) return historyError(undefined, "db_read_failed");
  const validation = validatePatientVitalWriteInput(body?.vitals, settings.snapshot);
  if (!validation.valid) {
    const required = getRequiredWorkspaceVitalFieldErrors(settings.snapshot, isRecord(body?.vitals) ? body.vitals : {});
    return Response.json({ ok: false, error: "invalid_input", fieldErrors: validation.fieldErrors, reloadSettings: Object.keys(required).length > 0 }, { status: 400 });
  }
  const creating = request.method === "POST";
  const measurementId = body?.measurementId;
  const measuredAt = body?.measuredAt;
  const expectedUpdatedAt = body?.expectedUpdatedAt;
  if (typeof measurementId !== "string" || !uuidPattern.test(measurementId) ||
    (creating && (typeof measuredAt !== "string" || !Number.isFinite(Date.parse(measuredAt)))) ||
    (!creating && (typeof expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(expectedUpdatedAt))))) {
    return Response.json({ ok: false, error: "invalid_input", fieldErrors: { vitals: "측정 기록을 다시 선택해 주세요." } }, { status: 400 });
  }
  const { data, error } = await gateway.rpc("clair_write_patient_vital_measurement", {
    p_workspace_id: workspaceId, p_actor_user_id: identity.actorUserId, p_encounter_id: encounterId,
    p_measurement_id: measurementId, p_action: creating ? "create" : "update",
    p_expected_updated_at: creating ? null : expectedUpdatedAt,
    p_measured_at: creating ? measuredAt : null, p_vitals: validation.values,
  });
  if (error) return historyError(error.message, "db_write_failed");
  const vital = parsePatientVitalMeasurement(data);
  return vital ? Response.json({ ok: true, vital }) : historyError(undefined, "db_write_failed");
}

function historyError(message: string | undefined, fallback: string) {
  const denials = ["actor_mismatch", "workspace_membership_missing", "permission_missing", "vital_writer_role_required"];
  const denial = denials.find((reason) => message?.includes(reason));
  if (denial) return Response.json({ ok: false, denialReason: denial }, { status: 403 });
  const conflict = ["measurement_conflict", "stale_status", "vital_value_required"].find((reason) => message?.includes(reason));
  if (conflict) return Response.json({ ok: false, denialReason: conflict }, { status: 409 });
  if (message?.includes("encounter_unavailable") || message?.includes("measurement_unavailable")) {
    return Response.json({ ok: false, error: "measurement_unavailable" }, { status: 404 });
  }
  if (message?.includes("required_vital_value_missing")) {
    return Response.json({ ok: false, error: "invalid_input", reloadSettings: true, fieldErrors: { vitals: "바이탈 필수 입력 설정이 바뀌었어요. 다시 불러온 뒤 필수 항목을 입력해 주세요." } }, { status: 400 });
  }
  if (message?.includes("invalid_vitals") || message?.includes("out of range")) {
    return Response.json({ ok: false, error: "invalid_input", fieldErrors: { vitals: "입력한 수치를 다시 확인해 주세요." } }, { status: 400 });
  }
  return Response.json({ ok: false, error: fallback }, { status: 500 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
