import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type { ChartLiveQueueRecord } from "@/features/chart/chart-live-queue";
import { getChartQueueRows, getChartStaffName } from "@/features/chart/data";
import {
  createSupabaseReceptionQueueReadGateway,
  type SupabaseReceptionQueueReadRpcClient,
} from "@/features/reception/server-reception-queue-read-core";
import type { ReceptionEncounterQueueReadRecord } from "@/features/reception/reception-queue-read";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
import type { Guardian, Patient } from "@/types/emr-domain";

export type ChartLiveQueueGateway = {
  listChartQueue(input: {
    workspaceId: string;
  }): Promise<
    | { ok: true; queue: ChartLiveQueueRecord[] }
    | { ok: false; error: "db_read_failed" }
  >;
};

export type ChartLiveQueueReadResult =
  | {
      ok: true;
      status: 200;
      queue: ChartLiveQueueRecord[];
      enforcedBy: "chart-live-queue-read";
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

const activeEncounterStatuses = new Set(["waiting", "in_consultation", "ordered"]);

export async function readChartLiveQueue({
  actorUserId,
  gateway = createMockChartLiveQueueGateway(),
  permissionAdapter = createDemoChartLiveQueuePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: ChartLiveQueueGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartLiveQueueReadResult> {
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

  const result = await gateway.listChartQueue({ workspaceId });
  if (!result.ok) return { ok: false, status: 500, error: result.error };

  return {
    ok: true,
    status: 200,
    queue: result.queue,
    enforcedBy: "chart-live-queue-read",
  };
}

export function createMockChartLiveQueueGateway(): ChartLiveQueueGateway {
  return {
    async listChartQueue({ workspaceId }) {
      return {
        ok: true,
        queue: getChartQueueRows().filter((row) => row.encounter.workspaceId === workspaceId),
      };
    },
  };
}

export type SupabaseChartLiveQueueClient = SupabaseReceptionQueueReadRpcClient & {
  from(tableName: "patients" | "guardians" | "users"): SupabaseChartLiveQueueTableBuilder;
  rpc(
    functionName: "clair_search_reception_patient_guardian_lookup",
    args: {
      p_workspace_id: string;
      p_query: string;
      p_limit: number;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

type SupabaseChartLiveQueueTableBuilder = {
  select(columns: string): SupabaseChartLiveQueueFilterBuilder;
};

type SupabaseChartLiveQueueFilterBuilder = PromiseLike<{
  data: unknown;
  error: { message?: string } | null;
}> & {
  eq(column: string, value: string): SupabaseChartLiveQueueFilterBuilder;
  in(column: string, values: string[]): SupabaseChartLiveQueueFilterBuilder;
};

export function createSupabaseChartLiveQueueGateway(
  client: SupabaseChartLiveQueueClient,
): ChartLiveQueueGateway {
  const receptionQueueGateway = createSupabaseReceptionQueueReadGateway(client);

  return {
    async listChartQueue({ workspaceId }) {
      const queueResult = await receptionQueueGateway.listReceptionQueue({
        date: getWorkspaceOperatingDate(workspaceId),
        workspaceId,
      });
      if (!queueResult.ok) return queueResult;

      const consultationRecords = queueResult.queue
        .filter(
          (record): record is ReceptionEncounterQueueReadRecord =>
            record.kind === "encounter_queue" &&
            record.queueEntry.queueType === "consultation" &&
            record.queueEntry.status !== "done" &&
            activeEncounterStatuses.has(record.encounter.status),
        )
        .sort((a, b) => (a.queueEntry.sortOrder ?? 0) - (b.queueEntry.sortOrder ?? 0));
      const patientIds = uniqueStrings(consultationRecords.map((record) => record.encounter.patientId));
      const guardianIds = uniqueStrings(
        consultationRecords
          .map((record) => record.encounter.guardianId)
          .filter((value): value is string => Boolean(value)),
      );
      const veterinarianIds = uniqueStrings(
        consultationRecords
          .map((record) => record.encounter.primaryVeterinarianId)
          .filter((value): value is string => Boolean(value)),
      );
      const patients = await readSupabasePatients(client, workspaceId, patientIds);
      const guardians = await readSupabaseGuardians(client, workspaceId, guardianIds);
      const staffUsers = await readSupabaseStaffDisplayNames(client, veterinarianIds);
      const lookupProfiles =
        patients.ok && guardians.ok
          ? { ok: true as const, patients: [], guardians: [] }
          : await readSupabaseLookupProfiles(client, workspaceId);

      if (!patients.ok && !lookupProfiles.ok) {
        return { ok: false, error: "db_read_failed" };
      }

      const hydratedPatients: Patient[] = patients.ok
        ? patients.patients
        : lookupProfiles.ok
          ? lookupProfiles.patients
          : [];
      const hydratedGuardians: Guardian[] = guardians.ok
        ? guardians.guardians
        : lookupProfiles.ok
          ? lookupProfiles.guardians
          : [];
      const patientById = new Map(
        hydratedPatients.map((patient) => [patient.id, patient]),
      );
      const guardianById = new Map(
        hydratedGuardians.map((guardian) => [guardian.id, guardian]),
      );
      const veterinarianNameById = new Map(
        staffUsers.ok
          ? staffUsers.users.map((user) => [user.id, user.displayName])
          : [],
      );

      const queue = consultationRecords
        .map((record): ChartLiveQueueRecord | null => {
          const patient = patientById.get(record.encounter.patientId);
          if (!patient) return null;
          const primaryGuardian = record.encounter.guardianId
            ? guardianById.get(record.encounter.guardianId)
            : undefined;

          return {
            encounter: record.encounter,
            patient,
            ...(primaryGuardian ? { primaryGuardian } : {}),
            queueEntry: record.queueEntry,
            veterinarianName: record.encounter.primaryVeterinarianId
              ? veterinarianNameById.get(record.encounter.primaryVeterinarianId) ??
                getChartStaffName(record.encounter.primaryVeterinarianId)
              : undefined,
          };
        })
        .filter((record): record is ChartLiveQueueRecord => Boolean(record));

      return { ok: true, queue };
    },
  };
}

function createDemoChartLiveQueuePermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active", displayName: "Playwright Admin" },
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-front-desk", status: "active", displayName: "최유나" },
      { id: "user-vet", status: "active", displayName: "이수지" },
      { id: "user-tech", status: "active", displayName: "송하윤" },
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
      {
        id: "membership-tech",
        workspaceId: "clair-demo",
        userId: "user-tech",
        roles: ["technician"],
        status: "active",
      },
    ],
  });
}

const patientSelectColumns = `
  id,
  workspace_id,
  patient_no,
  name,
  species,
  breed,
  birth_date,
  estimated_age_text,
  sex,
  neutered,
  microchip_no,
  patient_registration_no,
  allergy_note,
  special_note,
  handling_caution_note,
  handling_caution_locked,
  status,
  created_at,
  updated_at
`;

const guardianSelectColumns = `
  id,
  workspace_id,
  name,
  mobile_phone,
  phone,
  email,
  birth_date,
  address,
  memo,
  created_at,
  updated_at
`;

const staffUserSelectColumns = "id, display_name";

async function readSupabasePatients(
  client: SupabaseChartLiveQueueClient,
  workspaceId: string,
  patientIds: string[],
): Promise<{ ok: true; patients: Patient[] } | { ok: false }> {
  if (patientIds.length === 0) return { ok: true, patients: [] };

  const { data, error } = await client
    .from("patients")
    .select(patientSelectColumns)
    .eq("workspace_id", workspaceId)
    .in("id", patientIds);

  if (error) return { ok: false };

  return { ok: true, patients: mapPatientRows(data) };
}

async function readSupabaseGuardians(
  client: SupabaseChartLiveQueueClient,
  workspaceId: string,
  guardianIds: string[],
): Promise<{ ok: true; guardians: Guardian[] } | { ok: false }> {
  if (guardianIds.length === 0) return { ok: true, guardians: [] };

  const { data, error } = await client
    .from("guardians")
    .select(guardianSelectColumns)
    .eq("workspace_id", workspaceId)
    .in("id", guardianIds);

  if (error) return { ok: false };

  return { ok: true, guardians: mapGuardianRows(data) };
}

async function readSupabaseStaffDisplayNames(
  client: SupabaseChartLiveQueueClient,
  userIds: string[],
): Promise<{ ok: true; users: Array<{ displayName: string; id: string }> } | { ok: false }> {
  if (userIds.length === 0) return { ok: true, users: [] };

  const { data, error } = await client
    .from("users")
    .select(staffUserSelectColumns)
    .in("id", userIds);

  if (error) return { ok: false };

  return { ok: true, users: mapStaffUserRows(data) };
}

async function readSupabaseLookupProfiles(
  client: SupabaseChartLiveQueueClient,
  workspaceId: string,
): Promise<{ ok: true; patients: Patient[]; guardians: Guardian[] } | { ok: false }> {
  const { data, error } = await client.rpc("clair_search_reception_patient_guardian_lookup", {
    p_workspace_id: workspaceId,
    p_query: "",
    p_limit: 100,
  });

  if (error || !Array.isArray(data)) return { ok: false };

  const patients: Patient[] = [];
  const guardians: Guardian[] = [];

  data.forEach((row) => {
    const value = row as Record<string, unknown>;
    const patient = mapPatientRows([value.patient]).at(0);
    const guardian = mapGuardianRows([value.primaryGuardian ?? value.primary_guardian]).at(0);

    if (patient) patients.push(patient);
    if (guardian) guardians.push(guardian);
  });

  return { ok: true, guardians, patients };
}

function mapPatientRows(data: unknown): Patient[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((row): Patient | null => {
      const value = row as Record<string, unknown>;
      const id = getString(value.id);
      const workspaceId = getString(value.workspace_id) ?? getString(value.workspaceId);
      const patientNo = getString(value.patient_no) ?? getString(value.patientNo);
      const name = getString(value.name);
      const species = getString(value.species);
      const sex = getString(value.sex);
      const status = getString(value.status);

      if (!id || !workspaceId || !patientNo || !name || !species || !sex || !status) return null;

      return {
        id,
        workspaceId,
        patientNo,
        name,
        species: species as Patient["species"],
        breed: getString(value.breed),
        birthDate: getString(value.birth_date) ?? getString(value.birthDate),
        estimatedAgeText:
          getString(value.estimated_age_text) ?? getString(value.estimatedAgeText),
        sex: sex as Patient["sex"],
        neutered: getBoolean(value.neutered),
        microchipNo: getString(value.microchip_no) ?? getString(value.microchipNo),
        patientRegistrationNo:
          getString(value.patient_registration_no) ?? getString(value.patientRegistrationNo),
        allergyNote: getString(value.allergy_note) ?? getString(value.allergyNote),
        specialNote: getString(value.special_note) ?? getString(value.specialNote),
        handlingCautionNote:
          getString(value.handling_caution_note) ?? getString(value.handlingCautionNote),
        handlingCautionLocked:
          getBoolean(value.handling_caution_locked) ?? getBoolean(value.handlingCautionLocked) ?? true,
        status: status as Patient["status"],
        createdAt:
          getString(value.created_at) ?? getString(value.createdAt) ?? new Date(0).toISOString(),
        updatedAt:
          getString(value.updated_at) ?? getString(value.updatedAt) ?? new Date(0).toISOString(),
      };
    })
    .filter((patient): patient is Patient => Boolean(patient));
}

function mapGuardianRows(data: unknown): Guardian[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((row): Guardian | null => {
      const value = row as Record<string, unknown>;
      const id = getString(value.id);
      const workspaceId = getString(value.workspace_id) ?? getString(value.workspaceId);
      const name = getString(value.name);

      if (!id || !workspaceId || !name) return null;

      return {
        id,
        workspaceId,
        name,
        mobilePhone: getString(value.mobile_phone) ?? getString(value.mobilePhone),
        phone: getString(value.phone),
        email: getString(value.email),
        birthDate: getString(value.birth_date) ?? getString(value.birthDate),
        address: getString(value.address),
        memo: getString(value.memo),
        createdAt:
          getString(value.created_at) ?? getString(value.createdAt) ?? new Date(0).toISOString(),
        updatedAt:
          getString(value.updated_at) ?? getString(value.updatedAt) ?? new Date(0).toISOString(),
      };
    })
    .filter((guardian): guardian is Guardian => Boolean(guardian));
}

function mapStaffUserRows(data: unknown): Array<{ displayName: string; id: string }> {
  if (!Array.isArray(data)) return [];

  return data
    .map((row): { displayName: string; id: string } | null => {
      const value = row as Record<string, unknown>;
      const id = getString(value.id);
      const displayName = getString(value.display_name) ?? getString(value.displayName);

      return id && displayName ? { displayName, id } : null;
    })
    .filter((user): user is { displayName: string; id: string } => Boolean(user));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim())));
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
