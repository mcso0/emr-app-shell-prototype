import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type { ReceptionCalendarReadRecord } from "@/features/reception/reception-calendar-read";
import { getOperatingDateFromIso } from "@/lib/emr-domain/demo-date";
import { mockAppointments, mockEncounters, mockWaitingQueueEntries } from "@/mocks/emr-domain";
import type { Appointment, Encounter, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionCalendarReadGateway = {
  listReceptionDay(input: {
    date: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; records: ReceptionCalendarReadRecord[] }
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
      if (dataset.records) {
        return {
          ok: true,
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

      return { ok: true, records: [...appointmentRecords, ...walkInRecords] };
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

      return { ok: true, records: mapCalendarRows(data) };
    },
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
        queueEntry?: unknown;
        queue_entry?: unknown;
      };
      const appointment = mapAppointment(value.appointment);
      const encounter = mapEncounter(value.encounter);
      const queueEntry = mapQueueEntry(value.queueEntry ?? value.queue_entry);

      if (!appointment && !encounter) return null;

      return { appointment: appointment ?? undefined, encounter: encounter ?? undefined, queueEntry: queueEntry ?? undefined };
    })
    .filter((record): record is ReceptionCalendarReadRecord => Boolean(record));
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
    guardianId: getString(row.guardianId),
    assignedVeterinarianId: getString(row.assignedVeterinarianId),
    scheduledStartAt: row.scheduledStartAt,
    scheduledEndAt: getString(row.scheduledEndAt),
    visitPurpose: getString(row.visitPurpose),
    symptomNote: getString(row.symptomNote),
    status: row.status as Appointment["status"],
    createdByUserId: getString(row.createdByUserId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapEncounter(value: unknown): Encounter | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Encounter>;

  if (
    typeof row.id !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.patientId !== "string" ||
    typeof row.encounterNo !== "string" ||
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
    guardianId: getString(row.guardianId),
    appointmentId: getString(row.appointmentId),
    primaryVeterinarianId: getString(row.primaryVeterinarianId),
    encounterNo: row.encounterNo,
    receptionType: row.receptionType,
    department: getString(row.department),
    durationMinutes: getNumber(row.durationMinutes),
    chiefComplaint: getString(row.chiefComplaint),
    visitPurpose: getString(row.visitPurpose),
    receptionMemo: getString(row.receptionMemo),
    status: row.status as Encounter["status"],
    checkedInAt: getString(row.checkedInAt),
    checkedInByUserId: getString(row.checkedInByUserId),
    startedAt: getString(row.startedAt),
    completedAt: getString(row.completedAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
    typeof row.status !== "string" ||
    typeof row.priority !== "string" ||
    typeof row.enteredAt !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    encounterId: row.encounterId,
    queueType: row.queueType as WaitingQueueEntry["queueType"],
    status: row.status as WaitingQueueEntry["status"],
    priority: row.priority as WaitingQueueEntry["priority"],
    sortOrder: getNumber(row.sortOrder),
    enteredAt: row.enteredAt,
    calledAt: getString(row.calledAt),
    finishedAt: getString(row.finishedAt),
  };
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}
