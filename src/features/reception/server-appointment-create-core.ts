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
import type { ReceptionAppointmentCreateInput } from "@/features/reception/appointment-create";
import { createInitialHospitalBasicSettingsDraft, type HospitalBasicSettingsDraft } from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import { isReceptionTimeAllowed } from "@/features/reception/effective-operating-hours";
import { getReceptionMutationPermissionContract } from "@/features/reception/reception-mutation-permissions";
import {
  mockAppointments,
  mockGuardians,
  mockPatientGuardians,
  mockPatients,
  mockStaffUsers,
} from "@/mocks/emr-domain";
import type { Appointment, Guardian, Patient, PatientGuardian } from "@/types/emr-domain";

export type ReceptionAppointmentCreateDenialReason =
  | "patient_unavailable"
  | "guardian_unavailable"
  | "patient_guardian_link_missing"
  | "primary_veterinarian_unavailable"
  | "appointment_slot_unavailable"
  | "appointment_outside_business_hours"
  | "appointment_closed_day";

export type ReceptionAppointmentCreateFieldErrors = Partial<
  Record<"patientId" | "durationMinutes" | "scheduledStartAt", string>
>;

export type ReceptionAppointmentCreateGatewayResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; status: 409; denialReason: ReceptionAppointmentCreateDenialReason }
  | { ok: false; status: 500; error: "db_write_failed" };

export type ReceptionAppointmentCreateGateway = {
  createAppointment(input: {
    actorUserId: string;
    input: ReceptionAppointmentCreateInput;
    workspaceId: string;
  }): Promise<ReceptionAppointmentCreateGatewayResult>;
};

export type ReceptionAppointmentCreateResult =
  | {
      ok: true;
      status: 201;
      workspaceId: string;
      appointment: Appointment;
      enforcedBy: "reception-appointment-create";
    }
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: ReceptionAppointmentCreateFieldErrors }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: ReceptionAppointmentCreateDenialReason }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createReceptionAppointment({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  gateway = createMockReceptionAppointmentCreateGateway(),
  input,
  permissionAdapter = createDemoReceptionAppointmentCreatePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  gateway?: ReceptionAppointmentCreateGateway;
  input: ReceptionAppointmentCreateInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReceptionAppointmentCreateResult> {
  const normalized = normalizeAppointmentCreateInput(input);
  const validation = validateAppointmentCreateInput(normalized);

  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const permissionContract = getReceptionMutationPermissionContract("appointment_create");
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

  const result = await gateway.createAppointment({
    actorUserId: actorUserId ?? "",
    input: normalized,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) {
      return { ok: false, status: 409, denialReason: result.denialReason };
    }
    return { ok: false, status: 500, error: result.error };
  }

  // The appointment has already been persisted. Audit write failures must not
  // make the client believe the reservation was not created.
  await emitLiveMutationAuditEvent({
    auditGateway,
    auditNow,
    input: {
      workspaceId,
      actorUserId,
      eventType: "reception.appointment_created",
      targetType: "appointment",
      targetId: result.appointment.id,
      patientId: result.appointment.patientId,
      guardianId: result.appointment.guardianId ?? null,
      requestId: auditRequestId,
      after: {
        scheduledStartAt: result.appointment.scheduledStartAt,
        scheduledEndAt: result.appointment.scheduledEndAt,
        status: result.appointment.status,
      },
      metadata: { source: "reception-appointment-create" },
    },
  });

  return {
    ok: true,
    status: 201,
    workspaceId,
    appointment: result.appointment,
    enforcedBy: "reception-appointment-create",
  };
}

export function createMockReceptionAppointmentCreateGateway(
  dataset: {
    appointments: Appointment[];
    guardians: Guardian[];
    patientGuardians: PatientGuardian[];
    patients: Patient[];
    operatingHours?: Pick<HospitalBasicSettingsDraft, "timezone" | "weeklyHours" | "exceptions">;
  } = {
    appointments: mockAppointments,
    guardians: mockGuardians,
    patientGuardians: mockPatientGuardians,
    patients: mockPatients,
  },
  now = new Date().toISOString(),
): ReceptionAppointmentCreateGateway {
  return {
    async createAppointment({ actorUserId, input, workspaceId }) {
      const patient = dataset.patients.find(
        (item) =>
          item.id === input.patientId &&
          item.workspaceId === workspaceId &&
          item.status === "active",
      );
      if (!patient) return { ok: false, status: 409, denialReason: "patient_unavailable" };

      if (input.guardianId) {
        const guardian = dataset.guardians.find(
          (item) => item.id === input.guardianId && item.workspaceId === workspaceId,
        );
        if (!guardian) return { ok: false, status: 409, denialReason: "guardian_unavailable" };

        const linked = dataset.patientGuardians.some(
          (link) => link.patientId === patient.id && link.guardianId === guardian.id,
        );
        if (!linked) {
          return { ok: false, status: 409, denialReason: "patient_guardian_link_missing" };
        }
      }

      if (
        input.assignedVeterinarianId &&
        !mockStaffUsers.some(
          (staff) =>
            staff.id === input.assignedVeterinarianId &&
            staff.workspaceId === workspaceId &&
            staff.role === "veterinarian",
        )
      ) {
        return { ok: false, status: 409, denialReason: "primary_veterinarian_unavailable" };
      }

      const slot = getAppointmentSlot(input);
      if (!slot) return { ok: false, status: 409, denialReason: "appointment_outside_business_hours" };
      const availability = isReceptionTimeAllowed({
        scheduledStartAt: input.scheduledStartAt,
        durationMinutes: input.durationMinutes,
        settings: dataset.operatingHours ?? createInitialHospitalBasicSettingsDraft(),
      });
      if (availability.closed) {
        return { ok: false, status: 409, denialReason: "appointment_closed_day" };
      }
      if (!availability.allowed) {
        return { ok: false, status: 409, denialReason: "appointment_outside_business_hours" };
      }
      if (hasAppointmentSlotConflict(dataset.appointments, workspaceId, slot.startMs, slot.endMs)) {
        return { ok: false, status: 409, denialReason: "appointment_slot_unavailable" };
      }

      const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const appointment: Appointment = {
        id: `appointment-${seed}`,
        workspaceId,
        patientId: patient.id,
        guardianId: input.guardianId,
        assignedVeterinarianId: input.assignedVeterinarianId,
        scheduledStartAt: input.scheduledStartAt,
        scheduledEndAt: formatSeoulIsoFromMs(slot.endMs),
        visitPurpose: input.reservationMemo,
        symptomNote: input.reservationMemo,
        status: "confirmed",
        createdByUserId: actorUserId || undefined,
        createdAt: now,
        updatedAt: now,
      };
      dataset.appointments.push(appointment);

      return { ok: true, appointment };
    },
  };
}

export type SupabaseReceptionAppointmentCreateRpcClient = {
  rpc(
    functionName: "clair_create_reception_appointment",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_appointment: ReceptionAppointmentCreateInput;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionAppointmentCreateGateway(
  client: SupabaseReceptionAppointmentCreateRpcClient,
): ReceptionAppointmentCreateGateway {
  return {
    async createAppointment({ actorUserId, input, workspaceId }) {
      const veterinarianId = trimToUndefined(input.assignedVeterinarianId);
      if (veterinarianId && !uuidPattern.test(veterinarianId)) {
        return {
          ok: false,
          status: 409,
          denialReason: "primary_veterinarian_unavailable",
        };
      }

      const { data, error } = await client.rpc("clair_create_reception_appointment", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_appointment: input,
      });

      if (error) {
        const denialReason = mapAppointmentCreateDbDenial(error.message);
        if (denialReason) return { ok: false, status: 409, denialReason };
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const appointment = mapAppointment(data);
      if (!appointment) return { ok: false, status: 500, error: "db_write_failed" };

      return { ok: true, appointment };
    },
  };
}

function normalizeAppointmentCreateInput(
  input: ReceptionAppointmentCreateInput,
): ReceptionAppointmentCreateInput {
  return {
    assignedVeterinarianId: trimToUndefined(input.assignedVeterinarianId),
    durationMinutes:
      typeof input.durationMinutes === "number" ? Math.round(input.durationMinutes) : 0,
    guardianId: trimToUndefined(input.guardianId),
    patientId: input.patientId?.trim() ?? "",
    reservationMemo: trimToUndefined(input.reservationMemo),
    scheduledStartAt: input.scheduledStartAt?.trim() ?? "",
  };
}

function validateAppointmentCreateInput(input: ReceptionAppointmentCreateInput) {
  const fieldErrors: ReceptionAppointmentCreateFieldErrors = {};
  const startMs = Date.parse(input.scheduledStartAt);

  if (!input.patientId) fieldErrors.patientId = "patient_required";
  if (!Number.isFinite(startMs)) fieldErrors.scheduledStartAt = "scheduled_start_required";
  if (!input.durationMinutes || input.durationMinutes < 10 || input.durationMinutes > 240) {
    fieldErrors.durationMinutes = "duration_invalid";
  }
  return Object.keys(fieldErrors).length
    ? { valid: false as const, fieldErrors }
    : { valid: true as const };
}

function getAppointmentSlot(input: ReceptionAppointmentCreateInput) {
  const startMs = Date.parse(input.scheduledStartAt);
  if (!Number.isFinite(startMs)) return null;
  return {
    startMs,
    endMs: startMs + input.durationMinutes * 60_000,
  };
}

function hasAppointmentSlotConflict(
  appointments: Appointment[],
  workspaceId: string,
  startMs: number,
  endMs: number,
) {
  const blockingStatuses = new Set<Appointment["status"]>([
    "requested",
    "confirmed",
    "changed",
  ]);

  return appointments.some((appointment) => {
    if (appointment.workspaceId !== workspaceId || !blockingStatuses.has(appointment.status)) {
      return false;
    }
    const appointmentStartMs = Date.parse(appointment.scheduledStartAt);
    const appointmentEndMs = appointment.scheduledEndAt
      ? Date.parse(appointment.scheduledEndAt)
      : appointmentStartMs + 30 * 60_000;
    return startMs < appointmentEndMs && endMs > appointmentStartMs;
  });
}

function formatSeoulIsoFromMs(ms: number) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(new Date(ms));
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}+09:00`;
}

function mapAppointmentCreateDbDenial(message?: string): ReceptionAppointmentCreateDenialReason | null {
  if (!message) return null;
  if (message.includes("patient_unavailable")) return "patient_unavailable";
  if (message.includes("guardian_unavailable")) return "guardian_unavailable";
  if (message.includes("patient_guardian_link_missing")) return "patient_guardian_link_missing";
  if (message.includes("primary_veterinarian_unavailable")) return "primary_veterinarian_unavailable";
  if (message.includes("appointment_slot_unavailable")) return "appointment_slot_unavailable";
  if (message.includes("appointment_outside_business_hours")) {
    return "appointment_outside_business_hours";
  }
  if (message.includes("appointment_closed_day")) return "appointment_closed_day";
  return null;
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

function createDemoReceptionAppointmentCreatePermissionAdapter() {
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

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function trimToUndefined(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
