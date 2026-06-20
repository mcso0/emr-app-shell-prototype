import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  emitLiveMutationAuditEvent,
  type LiveMutationAuditOptions,
} from "@/features/audit/server-mutation-audit-core";
import type { ReceptionAppointmentRestoreRecord } from "@/features/reception/appointment-restore";
import { getReceptionMutationPermissionContract } from "@/features/reception/reception-mutation-permissions";
import { mockAppointments, mockEncounters } from "@/mocks/emr-domain";
import type { Appointment, Encounter } from "@/types/emr-domain";

export type ReceptionAppointmentRestoreDenial =
  | "appointment_unavailable"
  | "appointment_not_restorable"
  | "appointment_already_active"
  | "appointment_active_encounter_exists";

export type ReceptionAppointmentRestoreGatewayResult =
  | { ok: true; restoration: ReceptionAppointmentRestoreRecord }
  | { ok: false; status: 409; denialReason: ReceptionAppointmentRestoreDenial }
  | { ok: false; status: 500; error: "db_write_failed" };

export type ReceptionAppointmentRestoreGateway = {
  restoreAppointment(input: {
    actorUserId: string;
    appointmentId: string;
    workspaceId: string;
  }): Promise<ReceptionAppointmentRestoreGatewayResult>;
};

export type ReceptionAppointmentRestoreResult =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      restoration: ReceptionAppointmentRestoreRecord;
      enforcedBy: "reception-appointment-restore";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: { appointmentId: string };
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 409;
      denialReason: ReceptionAppointmentRestoreDenial;
    }
  | {
      ok: false;
      status: 500;
      error: "db_write_failed" | "supabase_client_missing";
    };

export async function restoreReceptionAppointment({
  actorUserId,
  appointmentId,
  auditGateway,
  auditNow,
  auditRequestId,
  gateway = createMockReceptionAppointmentRestoreGateway(),
  permissionAdapter = createDemoReceptionAppointmentRestorePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  appointmentId: string;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  gateway?: ReceptionAppointmentRestoreGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReceptionAppointmentRestoreResult> {
  const normalizedAppointmentId = trimToUndefined(appointmentId);
  if (!normalizedAppointmentId) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: { appointmentId: "복구할 예약을 선택해 주세요." },
    };
  }

  const permissionContract = getReceptionMutationPermissionContract("appointment_restore");
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: permissionContract.requiredPermission,
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.restoreAppointment({
    actorUserId: actorUserId ?? "",
    appointmentId: normalizedAppointmentId,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) {
      return { ok: false, status: 409, denialReason: result.denialReason };
    }

    return { ok: false, status: 500, error: result.error };
  }

  const audit = await emitLiveMutationAuditEvent({
    auditGateway,
    auditNow,
    input: {
      workspaceId,
      actorUserId,
      eventType: "reception.appointment_restored",
      targetType: "appointment",
      targetId: result.restoration.appointment.id,
      patientId: result.restoration.appointment.patientId,
      guardianId: result.restoration.appointment.guardianId ?? null,
      requestId: auditRequestId,
      after: {
        scheduledStartAt: result.restoration.appointment.scheduledStartAt,
        scheduledEndAt: result.restoration.appointment.scheduledEndAt,
        status: result.restoration.appointment.status,
      },
      metadata: { source: "reception-appointment-restore" },
    },
  });
  if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };

  return {
    ok: true,
    status: 200,
    workspaceId,
    restoration: result.restoration,
    enforcedBy: "reception-appointment-restore",
  };
}

export function createMockReceptionAppointmentRestoreGateway(
  dataset: {
    appointments?: Appointment[];
    encounters?: Encounter[];
  } = {
    appointments: mockAppointments,
    encounters: mockEncounters,
  },
  now = new Date().toISOString(),
): ReceptionAppointmentRestoreGateway {
  return {
    async restoreAppointment({ appointmentId, workspaceId }) {
      const appointment = (dataset.appointments ?? []).find(
        (item) => item.id === appointmentId && item.workspaceId === workspaceId,
      );
      if (!appointment) return { ok: false, status: 409, denialReason: "appointment_unavailable" };
      if (appointment.status !== "cancelled") {
        return { ok: false, status: 409, denialReason: "appointment_already_active" };
      }

      const activeEncounter = (dataset.encounters ?? []).find(
        (item) =>
          item.workspaceId === workspaceId &&
          item.appointmentId === appointment.id &&
          item.status !== "cancelled",
      );
      if (activeEncounter) {
        return { ok: false, status: 409, denialReason: "appointment_active_encounter_exists" };
      }

      return {
        ok: true,
        restoration: {
          appointment: { ...appointment, status: "confirmed", updatedAt: now },
        },
      };
    },
  };
}

export type SupabaseReceptionAppointmentRestoreRpcClient = {
  rpc(
    functionName: "clair_restore_reception_appointment",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_appointment_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionAppointmentRestoreGateway(
  client: SupabaseReceptionAppointmentRestoreRpcClient,
): ReceptionAppointmentRestoreGateway {
  return {
    async restoreAppointment({ actorUserId, appointmentId, workspaceId }) {
      const { data, error } = await client.rpc("clair_restore_reception_appointment", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_appointment_id: appointmentId,
      });

      if (error) {
        const denialReason = mapAppointmentRestoreDbDenial(error.message);
        if (denialReason) return { ok: false, status: 409, denialReason };
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const restoration = mapAppointmentRestoreRecord(data);
      if (!restoration) return { ok: false, status: 500, error: "db_write_failed" };

      return { ok: true, restoration };
    },
  };
}

function mapAppointmentRestoreDbDenial(message?: string) {
  if (!message) return null;
  if (message.includes("appointment_unavailable")) return "appointment_unavailable" as const;
  if (message.includes("appointment_not_restorable")) {
    return "appointment_not_restorable" as const;
  }
  if (message.includes("appointment_already_active")) return "appointment_already_active" as const;
  if (message.includes("appointment_active_encounter_exists")) {
    return "appointment_active_encounter_exists" as const;
  }
  return null;
}

function mapAppointmentRestoreRecord(value: unknown): ReceptionAppointmentRestoreRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { appointment?: unknown };
  const appointment = mapAppointment(row.appointment);
  if (!appointment) return null;
  return { appointment };
}

function mapAppointment(value: unknown): Appointment | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = getString(row.id);
  const workspaceId = getString(row.workspaceId) ?? getString(row.workspace_id);
  const patientId = getString(row.patientId) ?? getString(row.patient_id);
  const scheduledStartAt = getString(row.scheduledStartAt) ?? getString(row.scheduled_start_at);
  const status = getString(row.status);
  const createdAt = getString(row.createdAt) ?? getString(row.created_at);
  const updatedAt = getString(row.updatedAt) ?? getString(row.updated_at);

  if (!id || !workspaceId || !patientId || !scheduledStartAt || !status || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    workspaceId,
    patientId,
    guardianId: getString(row.guardianId) ?? getString(row.guardian_id),
    assignedVeterinarianId:
      getString(row.assignedVeterinarianId) ?? getString(row.assigned_veterinarian_id),
    scheduledStartAt,
    scheduledEndAt: getString(row.scheduledEndAt) ?? getString(row.scheduled_end_at),
    visitPurpose: getString(row.visitPurpose) ?? getString(row.visit_purpose),
    symptomNote: getString(row.symptomNote) ?? getString(row.symptom_note),
    status: status as Appointment["status"],
    createdByUserId: getString(row.createdByUserId) ?? getString(row.created_by_user_id),
    createdAt,
    updatedAt,
  };
}

function createDemoReceptionAppointmentRestorePermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    now: new Date().toISOString(),
    users: [
      { id: "playwright-default-session", status: "active", displayName: "Playwright Admin" },
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-front-desk", status: "active", displayName: "최유나" },
      { id: "user-vet", status: "active", displayName: "이수지" },
    ],
    memberships: [
      {
        id: "membership-playwright-admin",
        workspaceId: "clair-demo",
        userId: "playwright-default-session",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-admin",
        workspaceId: "clair-demo",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-front-desk",
        workspaceId: "clair-demo",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function trimToUndefined(value?: string) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
