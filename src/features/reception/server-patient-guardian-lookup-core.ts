import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  getFilteredReceptionPatients,
  getReceptionPatientSummaries,
  type ReceptionProfileDataset,
} from "@/features/reception/data";
import type { ReceptionPatientGuardianLookupItem } from "@/features/reception/patient-guardian-lookup";
import {
  mockGuardians,
  mockPatientGuardians,
  mockPatients,
} from "@/mocks/emr-domain";
import type { Guardian, Patient } from "@/types/emr-domain";

export type ReceptionPatientGuardianLookupGateway = {
  searchPatientGuardianLookup(input: {
    workspaceId: string;
    query: string;
  }): Promise<
    | { ok: true; patients: ReceptionPatientGuardianLookupItem[] }
    | { ok: false; error: "db_read_failed" }
  >;
};

export type ReceptionPatientGuardianLookupResult =
  | {
      ok: true;
      status: 200;
      patients: ReceptionPatientGuardianLookupItem[];
      enforcedBy: "reception-patient-guardian-lookup";
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

const maxLookupResults = 25;
const maxQueryLength = 80;

export async function lookupReceptionPatientGuardians({
  actorUserId,
  gateway = createMockReceptionPatientGuardianLookupGateway(),
  permissionAdapter = createDemoReceptionLookupPermissionAdapter(),
  query,
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: ReceptionPatientGuardianLookupGateway;
  permissionAdapter?: WorkspacePermissionAdapter;
  query: string;
  workspaceId: string;
}): Promise<ReceptionPatientGuardianLookupResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "patient:view",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.searchPatientGuardianLookup({
    workspaceId,
    query: normalizeLookupQuery(query),
  });

  if (!result.ok) {
    return { ok: false, status: 500, error: result.error };
  }

  return {
    ok: true,
    status: 200,
    patients: result.patients,
    enforcedBy: "reception-patient-guardian-lookup",
  };
}

export function createMockReceptionPatientGuardianLookupGateway(
  dataset: ReceptionProfileDataset = {
    guardians: mockGuardians,
    patientGuardians: mockPatientGuardians,
    patients: mockPatients,
  }
): ReceptionPatientGuardianLookupGateway {
  return {
    async searchPatientGuardianLookup({ workspaceId, query }) {
      const workspaceDataset = filterDatasetByWorkspace(dataset, workspaceId);
      const summaries = getFilteredReceptionPatients(
        getReceptionPatientSummaries([], workspaceDataset),
        query
      );

      return {
        ok: true,
        patients: summaries
          .filter((summary) => summary.patient.status === "active")
          .slice(0, maxLookupResults)
          .map((summary) => ({
            patient: summary.patient,
            primaryGuardian: summary.primaryGuardian,
            searchText: summary.searchText,
          })),
      };
    },
  };
}

export type SupabaseReceptionPatientGuardianLookupRpcClient = {
  rpc(
    functionName: "clair_search_reception_patient_guardian_lookup",
    args: {
      p_workspace_id: string;
      p_query: string;
      p_limit: number;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionPatientGuardianLookupGateway(
  client: SupabaseReceptionPatientGuardianLookupRpcClient
): ReceptionPatientGuardianLookupGateway {
  return {
    async searchPatientGuardianLookup({ workspaceId, query }) {
      for (const candidateQuery of getStagingSyntheticLookupQueryCandidates(query)) {
        const { data, error } = await client.rpc(
          "clair_search_reception_patient_guardian_lookup",
          {
            p_workspace_id: workspaceId,
            p_query: candidateQuery,
            p_limit: maxLookupResults,
          }
        );

        if (error) {
          return { ok: false, error: "db_read_failed" };
        }

        const patients = mapLookupRows(data);
        if (patients.length > 0) {
          return { ok: true, patients };
        }
      }

      return { ok: true, patients: [] };
    },
  };
}

export function getStagingSyntheticLookupQueryCandidates(query: string) {
  const normalizedQuery = normalizeLookupQuery(query);
  const lowerQuery = normalizedQuery.toLowerCase();
  const candidates = [normalizedQuery];

  stagingSyntheticLookupAliases.forEach(({ alias, terms }) => {
    if (normalizedQuery.includes(alias) || terms.some((term) => lowerQuery.includes(term))) {
      terms.forEach((term) => candidates.push(term));
    }
  });

  return Array.from(new Set(candidates));
}

function normalizeLookupQuery(query: string) {
  return query.trim().slice(0, maxQueryLength);
}

const stagingSyntheticLookupAliases = [
  { alias: "콩이", terms: ["kong"] },
  { alias: "나비", terms: ["nabi"] },
  { alias: "코코", terms: ["choco", "coco"] },
  { alias: "하루", terms: ["mango", "haru"] },
  { alias: "두부", terms: ["dubu"] },
  { alias: "김하늘", terms: ["kong"] },
  { alias: "오세아", terms: ["nabi"] },
  { alias: "이지은", terms: ["choco", "coco"] },
  { alias: "강서윤", terms: ["mango", "haru"] },
  { alias: "정하린", terms: ["dubu"] },
];

function filterDatasetByWorkspace(
  dataset: ReceptionProfileDataset,
  workspaceId: string
): ReceptionProfileDataset {
  const patients = dataset.patients.filter((patient) => patient.workspaceId === workspaceId);
  const patientIds = new Set(patients.map((patient) => patient.id));
  const patientGuardians = dataset.patientGuardians.filter((link) =>
    patientIds.has(link.patientId)
  );
  const guardianIds = new Set(patientGuardians.map((link) => link.guardianId));
  const guardians = dataset.guardians.filter(
    (guardian) => guardian.workspaceId === workspaceId && guardianIds.has(guardian.id)
  );

  return { guardians, patientGuardians, patients };
}

function mapLookupRows(data: unknown): ReceptionPatientGuardianLookupItem[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((row): ReceptionPatientGuardianLookupItem | null => {
      const value = row as {
        patient?: unknown;
        primaryGuardian?: unknown;
        primary_guardian?: unknown;
        searchText?: unknown;
        search_text?: unknown;
      };
      const patient = mapPatient(value.patient);

      if (!patient) return null;

      const primaryGuardian = mapGuardian(value.primaryGuardian ?? value.primary_guardian);
      const searchText = getString(value.searchText) ?? getString(value.search_text);

      return {
        patient,
        ...(primaryGuardian ? { primaryGuardian } : {}),
        ...(searchText ? { searchText } : {}),
      };
    })
    .filter((item): item is ReceptionPatientGuardianLookupItem => Boolean(item));
}

function mapPatient(value: unknown): Patient | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Patient>;

  if (
    typeof row.id !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.patientNo !== "string" ||
    typeof row.name !== "string" ||
    typeof row.species !== "string" ||
    typeof row.sex !== "string" ||
    typeof row.status !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    patientNo: row.patientNo,
    name: row.name,
    species: row.species as Patient["species"],
    breed: getString(row.breed),
    birthDate: getString(row.birthDate),
    estimatedAgeText: getString(row.estimatedAgeText),
    sex: row.sex as Patient["sex"],
    neutered: typeof row.neutered === "boolean" ? row.neutered : undefined,
    microchipNo: getString(row.microchipNo),
    patientRegistrationNo: getString(row.patientRegistrationNo),
    allergyNote: getString(row.allergyNote),
    specialNote: getString(row.specialNote),
    handlingCautionNote: getString(row.handlingCautionNote),
    handlingCautionLocked:
      typeof row.handlingCautionLocked === "boolean" ? row.handlingCautionLocked : true,
    status: row.status as Patient["status"],
    createdAt: getString(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: getString(row.updatedAt) ?? new Date(0).toISOString(),
  };
}

function mapGuardian(value: unknown): Guardian | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Partial<Guardian>;

  if (
    typeof row.id !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.name !== "string"
  ) {
    return undefined;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    mobilePhone: getString(row.mobilePhone),
    phone: getString(row.phone),
    email: getString(row.email),
    birthDate: getString(row.birthDate),
    address: getString(row.address),
    occupation: getString(row.occupation),
    memo: getString(row.memo),
    createdAt: getString(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: getString(row.updatedAt) ?? new Date(0).toISOString(),
  };
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function createDemoReceptionLookupPermissionAdapter() {
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
