import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type {
  ChartPatientHistoryPage,
  ChartPatientHistoryRecord,
} from "@/features/chart/chart-patient-history";
import { mapSoapNote } from "@/features/chart/server-soap-note-persistence-core";
import type {
  EncounterStatus,
  Guardian,
  SoapNoteStatus,
  WaitingQueueEntry,
  WaitingQueueStatus,
  WaitingQueueType,
} from "@/types/emr-domain";

export type ChartPatientHistoryGateway = {
  listHistory(input: {
    cursor?: string;
    limit: number;
    patientId: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; page: ChartPatientHistoryPage }
    | {
        ok: false;
        error: "db_read_failed" | "invalid_cursor" | "patient_unavailable";
      }
  >;
};

export type ChartPatientHistoryReadResult =
  | {
      ok: true;
      status: 200;
      items: ChartPatientHistoryRecord[];
      nextCursor: string | null;
      totalCount: number;
      enforcedBy: "chart-patient-history-read";
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_cursor";
    }
  | {
      ok: false;
      status: 404;
      error: "patient_unavailable";
    }
  | {
      ok: false;
      status: 500;
      error: "db_read_failed" | "supabase_client_missing";
    };

export async function readChartPatientHistory({
  actorUserId,
  cursor,
  gateway,
  limit,
  patientId,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null;
  cursor?: string;
  gateway: ChartPatientHistoryGateway | null;
  limit?: number;
  patientId: string;
  permissionAdapter: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartPatientHistoryReadResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:view",
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

  const result = await gateway.listHistory({
    cursor,
    limit: Math.min(
      Math.max(Number.isFinite(limit) ? Math.floor(limit as number) : 50, 1),
      50,
    ),
    patientId,
    workspaceId,
  });

  if (!result.ok) {
    if (result.error === "invalid_cursor") {
      return { ok: false, status: 400, error: result.error };
    }
    if (result.error === "patient_unavailable") {
      return { ok: false, status: 404, error: result.error };
    }
    return { ok: false, status: 500, error: result.error };
  }

  return {
    ok: true,
    status: 200,
    ...result.page,
    enforcedBy: "chart-patient-history-read",
  };
}

export type SupabaseChartPatientHistoryClient = {
  rpc(
    functionName: "clair_list_chart_patient_history",
    args: {
      p_cursor?: string;
      p_limit: number;
      p_patient_id: string;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartPatientHistoryGateway(
  client: SupabaseChartPatientHistoryClient,
): ChartPatientHistoryGateway {
  return {
    async listHistory({ cursor, limit, patientId, workspaceId }) {
      const { data, error } = await client.rpc(
        "clair_list_chart_patient_history",
        {
          ...(cursor ? { p_cursor: cursor } : {}),
          p_limit: limit,
          p_patient_id: patientId,
          p_workspace_id: workspaceId,
        },
      );

      if (error) {
        const message = error.message ?? "";
        return {
          ok: false,
          error: message.includes("invalid_cursor")
            ? "invalid_cursor"
            : message.includes("patient_unavailable")
              ? "patient_unavailable"
              : "db_read_failed",
        };
      }

      const page = parseChartPatientHistoryPage(data);
      return page ? { ok: true, page } : { ok: false, error: "db_read_failed" };
    },
  };
}

export function parseChartPatientHistoryPage(
  value: unknown,
): ChartPatientHistoryPage | null {
  if (!isRecord(value) || !Array.isArray(value.items)) return null;

  const totalCount = getFiniteNumber(value.totalCount);
  const nextCursor = value.nextCursor;
  if (
    totalCount === undefined ||
    totalCount < 0 ||
    (nextCursor !== null && typeof nextCursor !== "string")
  ) {
    return null;
  }

  const items: ChartPatientHistoryRecord[] = [];
  for (const item of value.items) {
    const record = parseChartPatientHistoryRecord(item);
    if (!record) return null;
    items.push(record);
  }

  return {
    items,
    nextCursor,
    totalCount: Math.floor(totalCount),
  };
}

function parseChartPatientHistoryRecord(
  value: unknown,
): ChartPatientHistoryRecord | null {
  if (!isRecord(value)) return null;
  if (!("chart" in value)) return null;
  const encounter = parseEncounter(value.encounter);
  const chart = value.chart === null ? null : mapSoapNote(value.chart);
  const queueEntry = parseQueueEntry(value.queueEntry);
  if (!encounter) {
    return null;
  }
  if (
    chart &&
    (chart.encounterId !== encounter.id || !historyChartStatuses.has(chart.status))
  ) {
    return null;
  }
  if (
    !chart &&
    (encounter.status !== "waiting" ||
      queueEntry?.encounterId !== encounter.id ||
      queueEntry.queueType !== "consultation" ||
      queueEntry.status !== "waiting")
  ) {
    return null;
  }

  const diagnoses = Array.isArray(value.diagnoses)
    ? value.diagnoses.flatMap((diagnosis) => {
        if (!isRecord(diagnosis)) return [];
        const diagnosisText = getString(diagnosis.diagnosisText);
        return diagnosisText ? [{ diagnosisText }] : [];
      })
    : [];
  const primaryGuardian = parseGuardian(value.primaryGuardian);
  const veterinarianName = getString(value.veterinarianName);

  return {
    chart,
    diagnoses,
    encounter,
    ...(primaryGuardian ? { primaryGuardian } : {}),
    ...(queueEntry ? { queueEntry } : {}),
    ...(veterinarianName ? { veterinarianName } : {}),
  };
}

const historyChartStatuses = new Set<SoapNoteStatus>([
  "draft",
  "autosaved",
  "signed",
  "amended",
]);

const encounterStatuses = new Set<EncounterStatus>([
  "waiting",
  "in_consultation",
  "ordered",
  "ready_for_billing",
  "completed",
  "cancelled",
]);

const waitingQueueTypes = new Set<WaitingQueueType>([
  "reception",
  "consultation",
  "treatment",
  "billing",
]);

const waitingQueueStatuses = new Set<WaitingQueueStatus>([
  "waiting",
  "called",
  "in_progress",
  "done",
  "cancelled",
]);

function parseQueueEntry(value: unknown): WaitingQueueEntry | undefined {
  if (!isRecord(value)) return undefined;
  const id = getString(value.id);
  const workspaceId = getString(value.workspaceId);
  const encounterId = getString(value.encounterId);
  const queueType = getString(value.queueType) as WaitingQueueType | undefined;
  const status = getString(value.status) as WaitingQueueStatus | undefined;
  const priority = getString(value.priority) as WaitingQueueEntry["priority"] | undefined;
  const enteredAt = getString(value.enteredAt);
  if (
    !id ||
    !workspaceId ||
    !encounterId ||
    !queueType ||
    !waitingQueueTypes.has(queueType) ||
    !status ||
    !waitingQueueStatuses.has(status) ||
    !priority ||
    !["urgent", "high", "normal", "low"].includes(priority) ||
    !enteredAt
  ) {
    return undefined;
  }

  const queueEntry: WaitingQueueEntry = {
    id,
    workspaceId,
    encounterId,
    queueType,
    status,
    priority,
    enteredAt,
    ...optionalStringFields(value, ["calledAt", "finishedAt"]),
  };
  const sortOrder = getFiniteNumber(value.sortOrder);
  if (sortOrder !== undefined) queueEntry.sortOrder = sortOrder;
  return queueEntry;
}

function parseEncounter(
  value: unknown,
): ChartPatientHistoryRecord["encounter"] | null {
  if (!isRecord(value)) return null;
  const id = getString(value.id);
  const workspaceId = getString(value.workspaceId);
  const patientId = getString(value.patientId);
  const encounterNo = getString(value.encounterNo);
  const status = getString(value.status) as EncounterStatus | undefined;
  const checkedInAt = getString(value.checkedInAt);
  const createdAt = getString(value.createdAt);
  const updatedAt = getString(value.updatedAt);
  const receptionType = getString(value.receptionType);
  if (
    !id ||
    !workspaceId ||
    !patientId ||
    !encounterNo ||
    !status ||
    !encounterStatuses.has(status) ||
    !checkedInAt ||
    !createdAt ||
    !updatedAt ||
    (receptionType !== "appointment" && receptionType !== "walk_in")
  ) {
    return null;
  }

  const encounter: ChartPatientHistoryRecord["encounter"] = {
    id,
    workspaceId,
    patientId,
    encounterNo,
    status,
    receptionType,
    checkedInAt,
    createdAt,
    updatedAt,
    ...optionalStringFields(value, [
      "guardianId",
      "appointmentId",
      "primaryVeterinarianId",
      "department",
      "chiefComplaint",
      "visitPurpose",
      "receptionMemo",
      "checkedInByUserId",
      "startedAt",
      "chartCompletedAt",
      "chartCompletedByUserId",
      "completedAt",
    ]),
  };
  const durationMinutes = getFiniteNumber(value.durationMinutes);
  if (durationMinutes !== undefined) {
    encounter.durationMinutes = durationMinutes;
  }
  return encounter;
}

function parseGuardian(value: unknown): Guardian | undefined {
  if (!isRecord(value)) return undefined;
  const id = getString(value.id);
  const workspaceId = getString(value.workspaceId);
  const name = getString(value.name);
  const createdAt = getString(value.createdAt);
  const updatedAt = getString(value.updatedAt);
  if (!id || !workspaceId || !name || !createdAt || !updatedAt)
    return undefined;

  return {
    id,
    workspaceId,
    name,
    createdAt,
    updatedAt,
    ...optionalStringFields(value, [
      "mobilePhone",
      "phone",
      "email",
      "birthDate",
      "address",
      "occupation",
      "memo",
    ]),
  };
}

function optionalStringFields<T extends string>(
  value: Record<string, unknown>,
  keys: T[],
) {
  return keys.reduce<Partial<Record<T, string>>>((result, key) => {
    const field = getString(value[key]);
    if (field) result[key] = field;
    return result;
  }, {});
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
