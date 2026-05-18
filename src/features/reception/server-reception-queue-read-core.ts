import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type { ReceptionQueueReadRecord } from "@/features/reception/reception-queue-read";
import { mockEncounters, mockWaitingQueueEntries } from "@/mocks/emr-domain";
import type { Encounter, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionQueueReadGateway = {
  listReceptionQueue(input: {
    workspaceId: string;
  }): Promise<
    | { ok: true; queue: ReceptionQueueReadRecord[] }
    | { ok: false; error: "db_read_failed" }
  >;
};

export type ReceptionQueueReadResult =
  | {
      ok: true;
      status: 200;
      queue: ReceptionQueueReadRecord[];
      enforcedBy: "reception-queue-read";
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

export async function readReceptionQueue({
  actorUserId,
  gateway = createMockReceptionQueueReadGateway({ queue: [] }),
  permissionAdapter = createDemoReceptionQueueReadPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: ReceptionQueueReadGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReceptionQueueReadResult> {
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

  const result = await gateway.listReceptionQueue({ workspaceId });

  if (!result.ok) return { ok: false, status: 500, error: result.error };

  return {
    ok: true,
    status: 200,
    queue: result.queue,
    enforcedBy: "reception-queue-read",
  };
}

export function createMockReceptionQueueReadGateway(
  dataset: {
    encounters?: Encounter[];
    queue?: ReceptionQueueReadRecord[];
    waitingQueueEntries?: WaitingQueueEntry[];
  } = {
    encounters: mockEncounters,
    waitingQueueEntries: mockWaitingQueueEntries,
  }
): ReceptionQueueReadGateway {
  return {
    async listReceptionQueue({ workspaceId }) {
      if (dataset.queue) {
        return {
          ok: true,
          queue: dataset.queue.filter((record) => record.encounter.workspaceId === workspaceId),
        };
      }

      const encounters = dataset.encounters ?? [];
      const waitingQueueEntries = dataset.waitingQueueEntries ?? [];

      return {
        ok: true,
        queue: waitingQueueEntries
          .filter(
            (entry) =>
              entry.workspaceId === workspaceId &&
              (entry.queueType === "consultation" || entry.queueType === "billing")
          )
          .map((queueEntry) => {
            const encounter = encounters.find(
              (item) => item.id === queueEntry.encounterId && item.workspaceId === workspaceId
            );
            return encounter ? { encounter, queueEntry } : null;
          })
          .filter((record): record is ReceptionQueueReadRecord => Boolean(record)),
      };
    },
  };
}

export type SupabaseReceptionQueueReadRpcClient = {
  rpc(
    functionName: "clair_list_reception_queue",
    args: {
      p_workspace_id: string;
      p_limit: number;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionQueueReadGateway(
  client: SupabaseReceptionQueueReadRpcClient
): ReceptionQueueReadGateway {
  return {
    async listReceptionQueue({ workspaceId }) {
      const { data, error } = await client.rpc("clair_list_reception_queue", {
        p_workspace_id: workspaceId,
        p_limit: 100,
      });

      if (error) return { ok: false, error: "db_read_failed" };

      return { ok: true, queue: mapQueueRows(data) };
    },
  };
}

export function createDemoReceptionQueueReadPermissionAdapter() {
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

function mapQueueRows(data: unknown): ReceptionQueueReadRecord[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((row): ReceptionQueueReadRecord | null => {
      const value = row as {
        encounter?: unknown;
        queueEntry?: unknown;
        queue_entry?: unknown;
      };
      const encounter = mapEncounter(value.encounter);
      const queueEntry = mapQueueEntry(value.queueEntry ?? value.queue_entry);

      if (!encounter || !queueEntry) return null;

      return { encounter, queueEntry };
    })
    .filter((record): record is ReceptionQueueReadRecord => Boolean(record));
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
    receptionType:
      row.receptionType === "walk_in" || row.receptionType === "appointment"
        ? row.receptionType
        : undefined,
    department: getString(row.department),
    durationMinutes: typeof row.durationMinutes === "number" ? row.durationMinutes : undefined,
    chiefComplaint: getString(row.chiefComplaint),
    visitPurpose: getString(row.visitPurpose),
    receptionMemo: getString(row.receptionMemo),
    status: row.status as Encounter["status"],
    checkedInAt: getString(row.checkedInAt),
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
    priority: row.priority ?? "normal",
    sortOrder: typeof row.sortOrder === "number" ? row.sortOrder : undefined,
    enteredAt: row.enteredAt,
    calledAt: getString(row.calledAt),
    finishedAt: getString(row.finishedAt),
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}
