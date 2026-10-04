import { resolveWorkspacePermission, type WorkspacePermissionAdapter } from "@/features/auth/permission-resolver";
import { readCustomerProfileOverview, type CustomerProfileOverviewGateway, type CustomerProfileSubjectType } from "@/features/customer/server-profile-overview-core";
import { getProfileTodayItems, type ProfileTodayEncounter } from "@/features/reception/profile-today";
import { createSupabaseReceptionCalendarReadGateway, type SupabaseReceptionCalendarReadRpcClient } from "@/features/reception/server-reception-calendar-read-core";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
import type { Appointment, Encounter } from "@/types/emr-domain";

export type ProfileTodaySourceGateway = {
  readSources(input: { workspaceId: string; date: string; patientIds: Set<string> }): Promise<
    { ok: true; appointments: Appointment[]; encounters: ProfileTodayEncounter[] } | { ok: false; error: "db_read_failed" }
  >;
};

export async function readCustomerProfileToday({ actorUserId, permissionAdapter, overviewGateway, sourceGateway, subjectId, subjectType, workspaceId, now }: {
  actorUserId: string | null;
  permissionAdapter: WorkspacePermissionAdapter;
  overviewGateway: CustomerProfileOverviewGateway;
  sourceGateway: ProfileTodaySourceGateway;
  subjectId: string;
  subjectType: CustomerProfileSubjectType;
  workspaceId: string;
  now?: Date;
}) {
  for (const requiredPermission of ["patient:view", "reception:view"] as const) {
    const permission = resolveWorkspacePermission(permissionAdapter, { sessionUserId: actorUserId, workspaceId, requiredPermission });
    if (!permission.allowed) return { ok: false as const, status: permission.denialReason === "unauthenticated" ? 401 : 403, denialReason: permission.denialReason ?? "permission_missing" };
  }
  const result = await readCustomerProfileOverview({ actorUserId, permissionAdapter, gateway: overviewGateway, subjectId, subjectType, workspaceId });
  if (!result.ok) return result;
  const overview = result.overview;
  if (overview.subjectId !== subjectId || overview.subjectType !== subjectType || overview.profile.id !== subjectId || overview.profile.workspaceId !== workspaceId) return { ok: false as const, status: 404, error: "subject_not_found" };
  if (!overview.access.reservations.allowed) return { ok: false as const, status: 403, denialReason: "permission_missing" };
  const patientNames = new Map<string, string>();
  if (subjectType === "patient") patientNames.set(subjectId, String(overview.profile.name ?? "환자"));
  else if (Array.isArray(overview.relationships.patients)) {
    // The authenticated overview RPC scopes current relationships in SQL.
    // Its canonical patient rows omit workspaceId; reject explicit mismatches.
    for (const row of overview.relationships.patients) {
      if (row && typeof row === "object" && typeof row.id === "string" && (row.workspaceId === undefined || row.workspaceId === workspaceId)) patientNames.set(row.id, typeof row.name === "string" ? row.name : "환자");
    }
  }
  const date = getWorkspaceOperatingDate(workspaceId, now);
  const source = patientNames.size ? await sourceGateway.readSources({ workspaceId, date, patientIds: new Set(patientNames.keys()) }) : { ok: true as const, appointments: [], encounters: [] };
  if (!source.ok) return { ok: false as const, status: 500, error: source.error };
  return { ok: true as const, status: 200, workspaceId, subjectId, subjectType, date, items: getProfileTodayItems({ ...source, date, patientNames, workspaceId }), enforcedBy: "customer-profile-today-read" };
}

type SnapshotRpcClient = { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> };

export function createSupabaseProfileTodaySourceGateway(client: SnapshotRpcClient): ProfileTodaySourceGateway {
  const calendar = createSupabaseReceptionCalendarReadGateway(client as SupabaseReceptionCalendarReadRpcClient);
  return {
    async readSources({ workspaceId, date, patientIds }) {
      try {
        const encounters = new Map<string, ProfileTodayEncounter>();
        // Reuse Home's complete operational snapshot, including active encounters
        // linked to older appointments. No historical offset scan or queue side effect.
        const snapshot = await client.rpc("clair_get_home_operations_source_snapshot_v2", {
          p_workspace_id: workspaceId, p_date: date,
          p_include_completed: true, p_include_cancelled: true,
        });
        const data = snapshot.data as { encounters?: Array<Record<string, unknown>> } | null;
        if (snapshot.error || !Array.isArray(data?.encounters)) return { ok: false, error: "db_read_failed" };
        for (const row of data.encounters) {
          if (row.workspace_id !== workspaceId || typeof row.patient_id !== "string" || !patientIds.has(row.patient_id) || typeof row.id !== "string") continue;
          const text = (key: string) => typeof row[key] === "string" ? row[key] as string : undefined;
          encounters.set(row.id, { id: row.id, workspaceId, patientId: row.patient_id, appointmentId: text("appointment_id"), status: row.status as Encounter["status"], checkedInAt: text("checked_in_at"), createdAt: "", visitPurpose: text("visit_purpose"), chiefComplaint: text("chief_complaint") });
        }
        const day = await calendar.listReceptionDay({ workspaceId, date });
        if (!day.ok) return day;
        const appointments: Appointment[] = [];
        for (const row of day.records) {
          if (row.appointment) appointments.push(row.appointment);
          if (row.encounter && row.encounter.workspaceId === workspaceId && patientIds.has(row.encounter.patientId)) encounters.set(row.encounter.id, row.encounter);
        }
        return { ok: true, appointments, encounters: [...encounters.values()] };
      } catch {
        return { ok: false, error: "db_read_failed" };
      }
    },
  };
}
