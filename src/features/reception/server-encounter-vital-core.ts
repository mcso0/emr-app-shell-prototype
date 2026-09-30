import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type { PatientVitalMeasurement } from "@/features/patient-vitals/patient-vital-types";
import {
  cloneWorkspaceVitalSettingsSnapshot,
  type WorkspaceVitalSettingsSnapshot,
} from "@/features/patient-vitals/workspace-vital-settings";
import type { WorkspaceVitalSettingsGateway } from "@/features/hospital-admin/vital-settings/server-workspace-vital-settings-core";

export type ReceptionEncounterVitalGateway = {
  readEncounterVital(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; vital: PatientVitalMeasurement | null }
    | { ok: false; error: "db_read_failed" | "encounter_unavailable" }
  >;
};

export type ReceptionEncounterVitalReadResult =
  | {
      ok: true;
      status: 200;
      enforcedBy: "reception-encounter-vital-read";
      vital: PatientVitalMeasurement | null;
      vitalSettings: WorkspaceVitalSettingsSnapshot;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | { ok: false; status: 404; error: "encounter_unavailable" }
  | {
      ok: false;
      status: 500;
      error: "db_read_failed" | "supabase_client_missing" | "vital_settings_read_failed";
    };

export async function readReceptionEncounterVital({
  actorUserId,
  encounterId,
  gateway,
  permissionAdapter,
  settingsGateway,
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string;
  gateway: ReceptionEncounterVitalGateway | null;
  permissionAdapter: WorkspacePermissionAdapter;
  settingsGateway: Pick<WorkspaceVitalSettingsGateway, "get"> | null;
  workspaceId: string;
}): Promise<ReceptionEncounterVitalReadResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "reception:view",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  if (!gateway) {
    return { ok: false, status: 500, error: "supabase_client_missing" };
  }

  const result = await gateway.readEncounterVital({ encounterId, workspaceId });
  if (!result.ok) {
    return result.error === "encounter_unavailable"
      ? { ok: false, status: 404, error: result.error }
      : { ok: false, status: 500, error: result.error };
  }

  // Display metadata is read only after the selected encounter's authorization.
  // Hospital administration GET/PUT retain their separate settings permissions.
  const settings = await settingsGateway?.get(workspaceId);
  if (!settings?.ok) {
    return { ok: false, status: 500, error: "vital_settings_read_failed" };
  }

  return {
    ok: true,
    status: 200,
    enforcedBy: "reception-encounter-vital-read",
    vital: result.vital,
    vitalSettings: cloneWorkspaceVitalSettingsSnapshot({
      ...settings.snapshot,
      canManage: false,
    }),
  };
}
