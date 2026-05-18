import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type { ReceptionAppointmentCheckInRecord } from "@/features/reception/appointment-check-in";
import { getReceptionMutationPermissionContract } from "@/features/reception/reception-mutation-permissions";
import { mockAppointments, mockEncounters } from "@/mocks/emr-domain";
import type { Appointment, Encounter, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionAppointmentCheckInDenialReason =
  | "appointment_unavailable"
  | "appointment_not_check_in_ready"
  | "appointment_already_checked_in";

export type ReceptionAppointmentCheckInGatewayResult =
  | { ok: true; checkIn: ReceptionAppointmentCheckInRecord }
  | { ok: false; status: 409; denialReason: ReceptionAppointmentCheckInDenialReason }
  | { ok: false; status: 500; error: "db_write_failed" };

export type ReceptionAppointmentCheckInGateway = {
  checkInAppointment(input: {
    actorUserId: string;
    appointmentId: string;
    workspaceId: string;
  }): Promise<ReceptionAppointmentCheckInGatewayResult>;
};

export type ReceptionAppointmentCheckInResult =
  | {
      ok: true;
      status: 201;
      workspaceId: string;
      checkIn: ReceptionAppointmentCheckInRecord;
      enforcedBy: "reception-appointment-check-in";
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | { ok: false; status: 409; denialReason: ReceptionAppointmentCheckInDenialReason }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

export async function createReceptionAppointmentCheckIn({
  actorUserId,
  appointmentId,
  gateway = createMockReceptionAppointmentCheckInGateway(),
  permissionAdapter = createDemoReceptionAppointmentCheckInPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  appointmentId: string;
  gateway?: ReceptionAppointmentCheckInGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReceptionAppointmentCheckInResult> {
  const permissionContract = getReceptionMutationPermissionContract("appointment_check_in");
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

  const result = await gateway.checkInAppointment({
    actorUserId: actorUserId ?? "",
    appointmentId: appointmentId.trim(),
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) {
      return { ok: false, status: 409, denialReason: result.denialReason };
    }

    return { ok: false, status: 500, error: result.error };
  }

  return {
    ok: true,
    status: 201,
    workspaceId,
    checkIn: result.checkIn,
    enforcedBy: "reception-appointment-check-in",
  };
}

export function createMockReceptionAppointmentCheckInGateway(
  dataset: {
    appointments: Appointment[];
    encounters: Encounter[];
  } = {
    appointments: mockAppointments,
    encounters: mockEncounters,
  },
  now = new Date().toISOString()
): ReceptionAppointmentCheckInGateway {
  return {
    async checkInAppointment({ appointmentId, workspaceId }) {
      const appointment = dataset.appointments.find(
        (item) => item.id === appointmentId && item.workspaceId === workspaceId
      );

      if (!appointment) {
        return { ok: false, status: 409, denialReason: "appointment_unavailable" };
      }

      const existingEncounter = dataset.encounters.find(
        (item) => item.appointmentId === appointment.id && item.workspaceId === workspaceId
      );
      if (existingEncounter || appointment.status === "checked_in") {
        return { ok: false, status: 409, denialReason: "appointment_already_checked_in" };
      }

      if (appointment.status !== "confirmed") {
        return { ok: false, status: 409, denialReason: "appointment_not_check_in_ready" };
      }

      const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const durationMinutes = appointment.scheduledEndAt
        ? Math.max(
            10,
            Math.round(
              (new Date(appointment.scheduledEndAt).getTime() -
                new Date(appointment.scheduledStartAt).getTime()) /
                60000
            )
          )
        : undefined;
      const encounter: Encounter = {
        id: `encounter-appointment-${seed}`,
        workspaceId,
        patientId: appointment.patientId,
        guardianId: appointment.guardianId,
        appointmentId: appointment.id,
        primaryVeterinarianId: appointment.assignedVeterinarianId,
        encounterNo: `E-APPT-${seed.slice(-6).toUpperCase()}`,
        receptionType: "appointment",
        durationMinutes,
        chiefComplaint: appointment.visitPurpose,
        visitPurpose: appointment.visitPurpose ?? "예약 접수",
        status: "waiting",
        checkedInAt: now,
        createdAt: now,
        updatedAt: now,
      };
      const queueEntry: WaitingQueueEntry = {
        id: `queue-${encounter.id}`,
        workspaceId,
        encounterId: encounter.id,
        queueType: "consultation",
        status: "waiting",
        priority: "normal",
        enteredAt: now,
      };

      return {
        ok: true,
        checkIn: {
          appointment: { ...appointment, status: "checked_in", updatedAt: now },
          encounter,
          queueEntry,
        },
      };
    },
  };
}

export type SupabaseReceptionAppointmentCheckInRpcClient = {
  rpc(
    functionName: "clair_check_in_reception_appointment",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_appointment_id: string;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionAppointmentCheckInGateway(
  client: SupabaseReceptionAppointmentCheckInRpcClient
): ReceptionAppointmentCheckInGateway {
  return {
    async checkInAppointment({ actorUserId, appointmentId, workspaceId }) {
      const { data, error } = await client.rpc("clair_check_in_reception_appointment", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_appointment_id: appointmentId,
      });

      if (error) {
        const denialReason = mapAppointmentCheckInDbDenial(error.message);
        if (denialReason) return { ok: false, status: 409, denialReason };
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const checkIn = mapAppointmentCheckInRecord(data);
      if (!checkIn) return { ok: false, status: 500, error: "db_write_failed" };

      return { ok: true, checkIn };
    },
  };
}

function mapAppointmentCheckInDbDenial(message?: string) {
  if (!message) return null;
  if (message.includes("appointment_unavailable")) return "appointment_unavailable" as const;
  if (message.includes("appointment_not_check_in_ready")) {
    return "appointment_not_check_in_ready" as const;
  }
  if (message.includes("appointment_already_checked_in")) {
    return "appointment_already_checked_in" as const;
  }
  return null;
}

function mapAppointmentCheckInRecord(value: unknown): ReceptionAppointmentCheckInRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { appointment?: unknown; encounter?: unknown; queueEntry?: unknown; queue_entry?: unknown };
  const appointment = mapAppointment(row.appointment);
  const encounter = mapEncounter(row.encounter);
  const queueEntry = mapQueueEntry(row.queueEntry ?? row.queue_entry);
  if (!appointment || !encounter || !queueEntry) return null;
  return { appointment, encounter, queueEntry };
}

function mapAppointment(value: unknown): Appointment | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Appointment>;
  if (
    typeof row.id !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.patientId !== "string" ||
    typeof row.scheduledStartAt !== "string" ||
    typeof row.status !== "string" ||
    typeof row.createdAt !== "string" ||
    typeof row.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    patientId: row.patientId,
    guardianId: trimToUndefined(row.guardianId),
    assignedVeterinarianId: trimToUndefined(row.assignedVeterinarianId),
    scheduledStartAt: row.scheduledStartAt,
    scheduledEndAt: trimToUndefined(row.scheduledEndAt),
    visitPurpose: trimToUndefined(row.visitPurpose),
    symptomNote: trimToUndefined(row.symptomNote),
    status: row.status as Appointment["status"],
    createdByUserId: trimToUndefined(row.createdByUserId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapEncounter(value: unknown): Encounter | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Encounter> & { receptionType?: string; reception_type?: string };
  if (
    typeof row.id !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.patientId !== "string" ||
    typeof row.encounterNo !== "string" ||
    typeof row.status !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    patientId: row.patientId,
    guardianId: trimToUndefined(row.guardianId),
    appointmentId: trimToUndefined(row.appointmentId),
    primaryVeterinarianId: trimToUndefined(row.primaryVeterinarianId),
    encounterNo: row.encounterNo,
    receptionType: (row.receptionType ?? row.reception_type) as Encounter["receptionType"],
    department: trimToUndefined(row.department),
    durationMinutes: typeof row.durationMinutes === "number" ? row.durationMinutes : undefined,
    chiefComplaint: trimToUndefined(row.chiefComplaint),
    visitPurpose: trimToUndefined(row.visitPurpose),
    receptionMemo: trimToUndefined(row.receptionMemo),
    status: row.status as Encounter["status"],
    checkedInAt: trimToUndefined(row.checkedInAt) ?? new Date(0).toISOString(),
    checkedInByUserId: trimToUndefined(row.checkedInByUserId),
    createdAt: trimToUndefined(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: trimToUndefined(row.updatedAt) ?? new Date(0).toISOString(),
  };
}

function mapQueueEntry(value: unknown): WaitingQueueEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<WaitingQueueEntry>;
  if (
    typeof row.id !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.encounterId !== "string" ||
    typeof row.queueType !== "string" ||
    typeof row.status !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    encounterId: row.encounterId,
    queueType: row.queueType as WaitingQueueEntry["queueType"],
    status: row.status as WaitingQueueEntry["status"],
    priority: row.priority ?? "normal",
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : undefined,
    enteredAt: trimToUndefined(row.enteredAt) ?? new Date(0).toISOString(),
    calledAt: trimToUndefined(row.calledAt),
    finishedAt: trimToUndefined(row.finishedAt),
  };
}

function createDemoReceptionAppointmentCheckInPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    now: new Date().toISOString(),
    users: [
      { id: "playwright-default-session", status: "active", displayName: "Playwright Admin" },
      { id: "user-admin", status: "active", displayName: "Admin" },
      { id: "user-front-desk", status: "active", displayName: "Front Desk" },
      { id: "user-vet", status: "active", displayName: "Vet" },
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

function trimToUndefined(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
