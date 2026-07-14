import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type { ReceptionCalendarReadRecord } from "@/features/reception/reception-calendar-read";
import {
  createInitialHospitalBasicSettingsDraft,
  resolveEffectiveOperatingHours,
  type EffectiveOperatingHours,
} from "@/features/hospital-admin/settings/hospital-basic-settings-model";
import { getOperatingDateFromIso } from "@/lib/emr-domain/demo-date";
import { mockAppointments, mockEncounters, mockWaitingQueueEntries } from "@/mocks/emr-domain";
import type { Appointment, Encounter, Guardian, Patient, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionCalendarReadGateway = {
  listReceptionDay(input: {
    date: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; records: ReceptionCalendarReadRecord[]; operatingSchedule: EffectiveOperatingHours }
    | { ok: false; error: "db_read_failed" }
  >;
};

export type ReceptionCalendarReadResult =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      date: string;
      records: ReceptionCalendarReadRecord[];
      operatingSchedule: EffectiveOperatingHours;
      enforcedBy: "reception-calendar-read";
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 500;
      error: "db_read_failed" | "supabase_client_missing";
    };

export async function readReceptionDayCalendar({
  actorUserId,
  date,
  gateway = createMockReceptionCalendarReadGateway({ records: [] }),
  permissionAdapter = createDemoReceptionCalendarReadPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  date: string;
  gateway?: ReceptionCalendarReadGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReceptionCalendarReadResult> {
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

  const result = await gateway.listReceptionDay({ date, workspaceId });

  if (!result.ok) return { ok: false, status: 500, error: result.error };

  return {
    ok: true,
    status: 200,
    workspaceId,
    date,
    records: result.records,
    operatingSchedule: result.operatingSchedule,
    enforcedBy: "reception-calendar-read",
  };
}

export function createMockReceptionCalendarReadGateway(
  dataset: {
    appointments?: Appointment[];
    encounters?: Encounter[];
    records?: ReceptionCalendarReadRecord[];
    waitingQueueEntries?: WaitingQueueEntry[];
  } = {
    appointments: mockAppointments,
    encounters: mockEncounters,
    waitingQueueEntries: mockWaitingQueueEntries,
  }
): ReceptionCalendarReadGateway {
  return {
    async listReceptionDay({ date, workspaceId }) {
      const operatingSchedule = resolveEffectiveOperatingHours(
        createInitialHospitalBasicSettingsDraft(), date
      );
      if (dataset.records) {
        return {
          ok: true,
          operatingSchedule,
          records: dataset.records.filter((record) => {
            const workspace =
              record.appointment?.workspaceId ??
              record.encounter?.workspaceId ??
              record.queueEntry?.workspaceId;
            return workspace === workspaceId;
          }),
        };
      }

	      const appointments = (dataset.appointments ?? []).filter(
	        (appointment) =>
	          appointment.workspaceId === workspaceId &&
	          getOperatingDateFromIso(appointment.scheduledStartAt) === date
	      );
      const appointmentRecords = appointments.map((appointment) => {
        const encounter = (dataset.encounters ?? []).find(
          (item) => item.workspaceId === workspaceId && item.appointmentId === appointment.id
        );
        const queueEntry = encounter
          ? (dataset.waitingQueueEntries ?? []).find(
              (item) => item.workspaceId === workspaceId && item.encounterId === encounter.id
            )
          : undefined;
        return { appointment, encounter, queueEntry };
      });
      const appointmentEncounterIds = new Set(
        appointmentRecords.flatMap((record) => (record.encounter ? [record.encounter.id] : []))
      );
      const walkInRecords = (dataset.encounters ?? [])
        .filter(
          (encounter) =>
	            encounter.workspaceId === workspaceId &&
	            !encounter.appointmentId &&
	            getOperatingDateFromIso(encounter.checkedInAt) === date &&
	            !appointmentEncounterIds.has(encounter.id)
	        )
        .map((encounter) => ({
          encounter,
          queueEntry: (dataset.waitingQueueEntries ?? []).find(
            (entry) => entry.workspaceId === workspaceId && entry.encounterId === encounter.id
          ),
        }));

      return { ok: true, records: [...appointmentRecords, ...walkInRecords], operatingSchedule };
    },
  };
}

export type SupabaseReceptionCalendarReadRpcClient = {
  rpc(
    functionName: "clair_list_reception_day_calendar",
    args: {
      p_workspace_id: string;
      p_day: string;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionCalendarReadGateway(
  client: SupabaseReceptionCalendarReadRpcClient
): ReceptionCalendarReadGateway {
  return {
    async listReceptionDay({ date, workspaceId }) {
      const { data, error } = await client.rpc("clair_list_reception_day_calendar", {
        p_workspace_id: workspaceId,
        p_day: date,
      });

      if (error) return { ok: false, error: "db_read_failed" };

      const payload = data && typeof data === "object" && !Array.isArray(data)
        ? data as { records?: unknown; operatingSchedule?: unknown }
        : { records: data, operatingSchedule: undefined };
      return {
        ok: true,
        records: mapCalendarRows(payload.records),
        operatingSchedule: mapOperatingSchedule(payload.operatingSchedule, date),
      };
    },
  };
}

function mapOperatingSchedule(value: unknown, date: string): EffectiveOperatingHours {
  const fallback = resolveEffectiveOperatingHours(createInitialHospitalBasicSettingsDraft(), date);
  if (!value || typeof value !== "object") return fallback;
  const row = value as Record<string, unknown>;
  if (typeof row.timezone !== "string" || typeof row.isOpen !== "boolean") return fallback;
  return {
    date: typeof row.date === "string" ? row.date : date,
    timezone: row.timezone,
    isOpen: row.isOpen,
    source: row.source === "exception" ? "exception" : "weekly",
    treatmentStart: typeof row.treatmentStart === "string" ? row.treatmentStart : null,
    treatmentEnd: typeof row.treatmentEnd === "string" ? row.treatmentEnd : null,
    breakStart: typeof row.breakStart === "string" ? row.breakStart : null,
    breakEnd: typeof row.breakEnd === "string" ? row.breakEnd : null,
  };
}

export function createDemoReceptionCalendarReadPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-vet", status: "active" },
    ],
    memberships: [
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

function mapCalendarRows(data: unknown): ReceptionCalendarReadRecord[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((row): ReceptionCalendarReadRecord | null => {
      const value = row as {
        appointment?: unknown;
        encounter?: unknown;
        patient?: unknown;
        primaryGuardian?: unknown;
        primary_guardian?: unknown;
        queueEntry?: unknown;
        queue_entry?: unknown;
      };
      const appointment = mapAppointment(value.appointment);
      const encounter = mapEncounter(value.encounter);
      const patient = mapPatient(value.patient);
      const primaryGuardian = mapGuardian(value.primaryGuardian ?? value.primary_guardian);
      const queueEntry = mapQueueEntry(value.queueEntry ?? value.queue_entry);

      if (!appointment && !encounter) return null;

      return {
        appointment: appointment ?? undefined,
        encounter: encounter ?? undefined,
        patient,
        primaryGuardian,
        queueEntry: queueEntry ?? undefined,
      };
    })
    .filter((record): record is ReceptionCalendarReadRecord => Boolean(record));
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

function mapEncounter(value: unknown): Encounter | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = getString(row.id);
  const workspaceId = getString(row.workspaceId) ?? getString(row.workspace_id);
  const patientId = getString(row.patientId) ?? getString(row.patient_id);
  const encounterNo = getString(row.encounterNo) ?? getString(row.encounter_no);
  const status = getString(row.status);
  const createdAt = getString(row.createdAt) ?? getString(row.created_at);
  const updatedAt = getString(row.updatedAt) ?? getString(row.updated_at);

  if (!id || !workspaceId || !patientId || !encounterNo || !status || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    workspaceId,
    patientId,
    guardianId: getString(row.guardianId) ?? getString(row.guardian_id),
    appointmentId: getString(row.appointmentId) ?? getString(row.appointment_id),
    primaryVeterinarianId:
      getString(row.primaryVeterinarianId) ?? getString(row.primary_veterinarian_id),
    encounterNo,
    receptionType: (getString(row.receptionType) ??
      getString(row.reception_type)) as Encounter["receptionType"],
    department: getString(row.department),
    durationMinutes: getNumber(row.durationMinutes) ?? getNumber(row.duration_minutes),
    chiefComplaint: getString(row.chiefComplaint) ?? getString(row.chief_complaint),
    visitPurpose: getString(row.visitPurpose) ?? getString(row.visit_purpose),
    receptionMemo: getString(row.receptionMemo) ?? getString(row.reception_memo),
    status: status as Encounter["status"],
    checkedInAt: getString(row.checkedInAt) ?? getString(row.checked_in_at),
    checkedInByUserId: getString(row.checkedInByUserId) ?? getString(row.checked_in_by_user_id),
    startedAt: getString(row.startedAt) ?? getString(row.started_at),
    completedAt: getString(row.completedAt) ?? getString(row.completed_at),
    createdAt,
    updatedAt,
  };
}

function mapQueueEntry(value: unknown): WaitingQueueEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = getString(row.id);
  const workspaceId = getString(row.workspaceId) ?? getString(row.workspace_id);
  const encounterId = getString(row.encounterId) ?? getString(row.encounter_id);
  const queueType = getString(row.queueType) ?? getString(row.queue_type);
  const status = getString(row.status);
  const enteredAt = getString(row.enteredAt) ?? getString(row.entered_at);

  if (!id || !workspaceId || !encounterId || !queueType || !status || !enteredAt) {
    return null;
  }

  return {
    id,
    workspaceId,
    encounterId,
    queueType: queueType as WaitingQueueEntry["queueType"],
    status: status as WaitingQueueEntry["status"],
    priority: (getString(row.priority) as WaitingQueueEntry["priority"] | undefined) ?? "normal",
    sortOrder: getNumber(row.sortOrder) ?? getNumber(row.sort_order),
    enteredAt,
    calledAt: getString(row.calledAt) ?? getString(row.called_at),
    finishedAt: getString(row.finishedAt) ?? getString(row.finished_at),
  };
}

function mapPatient(value: unknown): Patient | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const id = getString(row.id);
  const workspaceId = getString(row.workspaceId) ?? getString(row.workspace_id);
  const patientNo = getString(row.patientNo) ?? getString(row.patient_no);
  const name = getString(row.name);
  const species = getString(row.species);
  const sex = getString(row.sex);
  const status = getString(row.status);

  if (!id || !workspaceId || !patientNo || !name || !species || !sex || !status) {
    return undefined;
  }

  return {
    id,
    workspaceId,
    patientNo,
    name,
    species: species as Patient["species"],
    breed: getString(row.breed),
    birthDate: getString(row.birthDate) ?? getString(row.birth_date),
    estimatedAgeText: getString(row.estimatedAgeText) ?? getString(row.estimated_age_text),
    sex: sex as Patient["sex"],
    neutered: getBoolean(row.neutered),
    microchipNo: getString(row.microchipNo) ?? getString(row.microchip_no),
    patientRegistrationNo:
      getString(row.patientRegistrationNo) ?? getString(row.patient_registration_no),
    weightKg: getNumber(row.weightKg) ?? getNumber(row.weight_kg),
    allergyNote: getString(row.allergyNote) ?? getString(row.allergy_note),
    specialNote: getString(row.specialNote) ?? getString(row.special_note),
    handlingCautionNote:
      getString(row.handlingCautionNote) ?? getString(row.handling_caution_note),
    handlingCautionLocked:
      getBoolean(row.handlingCautionLocked) ?? getBoolean(row.handling_caution_locked) ?? true,
    status: status as Patient["status"],
    createdAt: getString(row.createdAt) ?? getString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: getString(row.updatedAt) ?? getString(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function mapGuardian(value: unknown): Guardian | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  const id = getString(row.id);
  const workspaceId = getString(row.workspaceId) ?? getString(row.workspace_id);
  const name = getString(row.name);

  if (!id || !workspaceId || !name) return undefined;

  return {
    id,
    workspaceId,
    name,
    mobilePhone: getString(row.mobilePhone) ?? getString(row.mobile_phone),
    phone: getString(row.phone),
    email: getString(row.email),
    birthDate: getString(row.birthDate) ?? getString(row.birth_date),
    address: getString(row.address),
    occupation: getString(row.occupation),
    memo: getString(row.memo),
    createdAt: getString(row.createdAt) ?? getString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: getString(row.updatedAt) ?? getString(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
