import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import { mockPatients } from "@/mocks/emr-domain";
import type { Patient, PatientSex, Species } from "@/types/emr-domain";

export type CustomerPatientMessageConsentStatus = "granted" | "refused" | "unknown";
export type CustomerPatientMicrochipType = "none" | "internal" | "external";

export type CustomerPatientProfile = {
  id: string;
  workspaceId: string;
  patientNo: string;
  name: string;
  species: Species;
  breed?: string;
  primaryBreedId?: string;
  primaryBreedName?: string;
  isMixedBreed: boolean;
  additionalBreedIds: string[];
  sex: PatientSex;
  neutered?: boolean;
  birthDate?: string;
  estimatedAgeYears?: number;
  estimatedAgeMonths?: number;
  estimatedAgeDays?: number;
  ageIsEstimated: boolean;
  weightKg?: number;
  color?: string;
  microchipNo?: string;
  microchipType: CustomerPatientMicrochipType;
  patientRegistrationNo?: string;
  allergyNote?: string;
  specialNote?: string;
  handlingCautionNote?: string;
  handlingCautionLocked: boolean;
  profileMemo?: string;
  primaryAttendingVetId?: string;
  messageConsentStatus: CustomerPatientMessageConsentStatus;
  status: "active" | "inactive" | "deceased" | "soft_deleted";
  deceasedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerPatientProfileUpdateInput = Partial<
  Pick<
    CustomerPatientProfile,
    | "additionalBreedIds"
    | "ageIsEstimated"
    | "allergyNote"
    | "birthDate"
    | "breed"
    | "color"
    | "deceasedAt"
    | "estimatedAgeDays"
    | "estimatedAgeMonths"
    | "estimatedAgeYears"
    | "handlingCautionNote"
    | "messageConsentStatus"
    | "microchipNo"
    | "microchipType"
    | "name"
    | "neutered"
    | "patientRegistrationNo"
    | "primaryAttendingVetId"
    | "primaryBreedId"
    | "primaryBreedName"
    | "profileMemo"
    | "sex"
    | "specialNote"
    | "status"
    | "weightKg"
  >
> & { species?: Species; isMixedBreed?: boolean };

export type CustomerPatientProfileFieldErrors = Partial<
  Record<"messageConsentStatus" | "name" | "patientId" | "species" | "status" | "weightKg", string>
>;

export type CustomerPatientProfileGateway = {
  readPatientProfile(input: {
    patientId: string;
    workspaceId: string;
  }): Promise<
    | { ok: true; profile: CustomerPatientProfile }
    | { ok: false; status: 404; denialReason: "patient_not_found" }
    | { ok: false; status: 500; error: "db_read_failed" }
  >;
  updatePatientProfile(input: {
    actorUserId: string;
    patientId: string;
    update: CustomerPatientProfileUpdateInput;
    workspaceId: string;
  }): Promise<
    | { ok: true; profile: CustomerPatientProfile }
    | { ok: false; status: 404; denialReason: "patient_not_found" }
    | { ok: false; status: 500; error: "db_write_failed" }
  >;
};

type SupabaseQueryResponse = { data: unknown; error: { message?: string } | null };
type SupabaseFilterChain = PromiseLike<SupabaseQueryResponse> & {
  eq(column: string, value: unknown): SupabaseFilterChain;
  select(columns?: string): SupabaseFilterChain;
  maybeSingle(): Promise<SupabaseQueryResponse>;
};
type SupabaseTableBuilder = {
  select(columns: string): SupabaseFilterChain;
  update(values: Record<string, unknown>): SupabaseFilterChain;
};
export type SupabaseCustomerPatientProfileClient = {
  from(tableName: string): SupabaseTableBuilder;
};

export type CustomerPatientProfileReadResult =
  | { ok: true; status: 200; profile: CustomerPatientProfile; enforcedBy: "customer-patient-profile-read" }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 404; denialReason: "patient_not_found" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type CustomerPatientProfileUpdateResult =
  | { ok: true; status: 200; profile: CustomerPatientProfile; enforcedBy: "customer-patient-profile-update" }
  | { ok: false; status: 400; error: "invalid_input"; fieldErrors: CustomerPatientProfileFieldErrors }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 404; denialReason: "patient_not_found" }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const speciesValues = new Set<Species>([
  "dog",
  "cat",
  "rabbit",
  "ferret",
  "hamster",
  "guinea_pig",
  "hedgehog",
  "bird",
  "reptile",
  "turtle",
  "other",
]);

export async function readCustomerPatientProfile({
  actorUserId,
  gateway = createMockCustomerPatientProfileGateway(),
  patientId,
  permissionAdapter = createDemoCustomerPatientProfilePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: CustomerPatientProfileGateway;
  patientId: string;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<CustomerPatientProfileReadResult> {
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

  const result = await gateway.readPatientProfile({ patientId, workspaceId });
  if (!result.ok) return result;
  return { ok: true, status: 200, profile: result.profile, enforcedBy: "customer-patient-profile-read" };
}

export async function updateCustomerPatientProfile({
  actorUserId,
  gateway = createMockCustomerPatientProfileGateway(),
  input,
  patientId,
  permissionAdapter = createDemoCustomerPatientProfilePermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: CustomerPatientProfileGateway;
  input: CustomerPatientProfileUpdateInput;
  patientId: string;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<CustomerPatientProfileUpdateResult> {
  const normalized = normalizePatientProfileUpdate(input);
  const validation = validatePatientProfileUpdate(patientId, normalized);
  if (!validation.valid) {
    return { ok: false, status: 400, error: "invalid_input", fieldErrors: validation.fieldErrors };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "patient_profile:manage",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.updatePatientProfile({
    actorUserId: actorUserId ?? "",
    patientId,
    workspaceId,
    update: normalized,
  });
  if (!result.ok) return result;
  return { ok: true, status: 200, profile: result.profile, enforcedBy: "customer-patient-profile-update" };
}

export function createMockCustomerPatientProfileGateway(
  profiles?: CustomerPatientProfile[],
  now = new Date().toISOString()
): CustomerPatientProfileGateway {
  const store =
    profiles === undefined
      ? defaultMockPatientProfileStore
      : new Map(profiles.map((profile) => [profile.id, { ...profile }]));

  return {
    async readPatientProfile({ patientId, workspaceId }) {
      const profile = store.get(patientId);
      if (!profile || profile.workspaceId !== workspaceId) {
        return { ok: false, status: 404, denialReason: "patient_not_found" };
      }
      return { ok: true, profile: { ...profile } };
    },
    async updatePatientProfile({ actorUserId, patientId, update, workspaceId }) {
      const current = store.get(patientId);
      if (!current || current.workspaceId !== workspaceId) {
        return { ok: false, status: 404, denialReason: "patient_not_found" };
      }
      const next = { ...current, ...update, updatedAt: now };
      store.set(patientId, next);
      void actorUserId;
      return { ok: true, profile: { ...next } };
    },
  };
}

export function createSupabaseCustomerPatientProfileGateway(
  client: SupabaseCustomerPatientProfileClient,
): CustomerPatientProfileGateway {
  return {
    async readPatientProfile({ patientId, workspaceId }) {
      return readSupabasePatientProfile(client, { patientId, workspaceId });
    },
    async updatePatientProfile({ actorUserId, patientId, update, workspaceId }) {
      const { data, error } = await client
        .from("patients")
        .update(mapPatientUpdatePayload(update, actorUserId))
        .eq("workspace_id", workspaceId)
        .eq("id", patientId)
        .select(patientSelectColumns)
        .maybeSingle();

      if (error) return { ok: false, status: 500, error: "db_write_failed" };
      if (!data) return { ok: false, status: 404, denialReason: "patient_not_found" };
      return { ok: true, profile: mapPatientProfileRow(data) };
    },
  };
}

export function createDemoCustomerPatientProfilePermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active" },
      { id: "user-admin", status: "active" },
      { id: "user-front-desk", status: "active" },
      { id: "user-vet", status: "active" },
      { id: "user-tech", status: "active" },
    ],
    memberships: [
      { id: "membership-playwright-admin", workspaceId: "clair-demo", userId: "playwright-default-session", roles: ["hospital_admin"], status: "active" },
      { id: "membership-admin", workspaceId: "clair-demo", userId: "user-admin", roles: ["hospital_admin"], status: "active" },
      { id: "membership-front-desk", workspaceId: "clair-demo", userId: "user-front-desk", roles: ["front_desk"], status: "active" },
      { id: "membership-vet", workspaceId: "clair-demo", userId: "user-vet", roles: ["vet"], status: "active" },
      { id: "membership-tech", workspaceId: "clair-demo", userId: "user-tech", roles: ["technician"], status: "active" },
    ],
  });
}

function normalizePatientProfileUpdate(input: CustomerPatientProfileUpdateInput) {
  const next: CustomerPatientProfileUpdateInput = {};
  const copyString = <K extends keyof CustomerPatientProfileUpdateInput>(key: K) => {
    if (key in input) next[key] = trimToUndefined(input[key]) as never;
  };

  copyString("allergyNote");
  copyString("birthDate");
  copyString("breed");
  copyString("color");
  copyString("deceasedAt");
  copyString("handlingCautionNote");
  copyString("microchipNo");
  copyString("name");
  copyString("patientRegistrationNo");
  copyString("primaryAttendingVetId");
  copyString("primaryBreedId");
  copyString("primaryBreedName");
  copyString("profileMemo");
  copyString("specialNote");
  if ("additionalBreedIds" in input) next.additionalBreedIds = normalizeStringList(input.additionalBreedIds);
  if ("ageIsEstimated" in input) next.ageIsEstimated = Boolean(input.ageIsEstimated);
  if ("estimatedAgeDays" in input) next.estimatedAgeDays = normalizeNumber(input.estimatedAgeDays);
  if ("estimatedAgeMonths" in input) next.estimatedAgeMonths = normalizeNumber(input.estimatedAgeMonths);
  if ("estimatedAgeYears" in input) next.estimatedAgeYears = normalizeNumber(input.estimatedAgeYears);
  if ("isMixedBreed" in input) next.isMixedBreed = Boolean(input.isMixedBreed);
  if ("messageConsentStatus" in input) next.messageConsentStatus = input.messageConsentStatus;
  if ("microchipType" in input) next.microchipType = input.microchipType;
  if ("neutered" in input) next.neutered = Boolean(input.neutered);
  if ("sex" in input) next.sex = input.sex;
  if ("species" in input) next.species = input.species;
  if ("status" in input) next.status = input.status;
  if ("weightKg" in input) next.weightKg = normalizeNumber(input.weightKg);
  return next;
}

function validatePatientProfileUpdate(patientId: string, input: CustomerPatientProfileUpdateInput) {
  const fieldErrors: CustomerPatientProfileFieldErrors = {};
  if (!patientId.trim()) fieldErrors.patientId = "환자를 찾을 수 없습니다.";
  if ("name" in input && !input.name) fieldErrors.name = "환자명은 필수입니다.";
  if (input.species && !speciesValues.has(input.species)) fieldErrors.species = "동물 종을 확인해 주세요.";
  if (input.weightKg !== undefined && input.weightKg <= 0) fieldErrors.weightKg = "체중은 0보다 커야 합니다.";
  if (
    input.messageConsentStatus &&
    input.messageConsentStatus !== "granted" &&
    input.messageConsentStatus !== "refused" &&
    input.messageConsentStatus !== "unknown"
  ) {
    fieldErrors.messageConsentStatus = "알림 수신 상태를 확인해 주세요.";
  }
  if (
    input.status &&
    input.status !== "active" &&
    input.status !== "inactive" &&
    input.status !== "deceased" &&
    input.status !== "soft_deleted"
  ) {
    fieldErrors.status = "환자 상태를 확인해 주세요.";
  }

  if (Object.keys(fieldErrors).length > 0) return { valid: false as const, fieldErrors };
  return { valid: true as const, fieldErrors: {} };
}

function mapLegacyPatientProfile(patient: Patient): CustomerPatientProfile {
  return {
    id: patient.id,
    workspaceId: patient.workspaceId,
    patientNo: patient.patientNo,
    name: patient.name,
    species: patient.species,
    breed: patient.breed,
    primaryBreedName: patient.breed,
    isMixedBreed: false,
    additionalBreedIds: [],
    sex: patient.sex,
    neutered: patient.neutered,
    birthDate: patient.birthDate,
    ageIsEstimated: Boolean(patient.estimatedAgeText),
    microchipNo: patient.microchipNo,
    microchipType: patient.microchipNo ? "internal" : "none",
    patientRegistrationNo: patient.patientRegistrationNo,
    weightKg: patient.weightKg,
    allergyNote: patient.allergyNote,
    specialNote: patient.specialNote,
    handlingCautionNote: patient.handlingCautionNote,
    handlingCautionLocked: patient.handlingCautionLocked,
    messageConsentStatus: "granted",
    status: patient.status,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };
}

const defaultMockPatientProfileStore = new Map(
  mockPatients.map(mapLegacyPatientProfile).map((profile) => [profile.id, { ...profile }])
);

const patientSelectColumns = `
  id,
  workspace_id,
  patient_no,
  name,
  species,
  breed,
  primary_breed_id,
  primary_breed_name,
  is_mixed_breed,
  additional_breed_ids,
  sex,
  neutered,
  birth_date,
  estimated_age_years,
  estimated_age_months,
  estimated_age_days,
  age_is_estimated,
  weight_kg,
  color,
  microchip_no,
  microchip_type,
  patient_registration_no,
  allergy_note,
  special_note,
  handling_caution_note,
  handling_caution_locked,
  profile_memo,
  primary_attending_vet_id,
  message_consent_status,
  status,
  deceased_at,
  created_at,
  updated_at
`;

async function readSupabasePatientProfile(
  client: SupabaseCustomerPatientProfileClient,
  { patientId, workspaceId }: { patientId: string; workspaceId: string },
): Promise<
  | { ok: true; profile: CustomerPatientProfile }
  | { ok: false; status: 404; denialReason: "patient_not_found" }
  | { ok: false; status: 500; error: "db_read_failed" }
> {
  const { data, error } = await client
    .from("patients")
    .select(patientSelectColumns)
    .eq("workspace_id", workspaceId)
    .eq("id", patientId)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: "db_read_failed" };
  if (!data) return { ok: false, status: 404, denialReason: "patient_not_found" };
  return { ok: true, profile: mapPatientProfileRow(data) };
}

function mapPatientUpdatePayload(
  input: CustomerPatientProfileUpdateInput,
  actorUserId: string,
) {
  const payload: Record<string, unknown> = { last_updated_by_user_id: actorUserId };
  const set = (key: string, value: unknown) => {
    if (value !== undefined) payload[key] = value;
  };

  set("additional_breed_ids", input.additionalBreedIds);
  set("age_is_estimated", input.ageIsEstimated);
  set("allergy_note", input.allergyNote);
  set("birth_date", input.birthDate);
  set("breed", input.breed);
  set("color", input.color);
  set("deceased_at", input.deceasedAt);
  set("estimated_age_days", input.estimatedAgeDays);
  set("estimated_age_months", input.estimatedAgeMonths);
  set("estimated_age_years", input.estimatedAgeYears);
  set("handling_caution_note", input.handlingCautionNote);
  set("is_mixed_breed", input.isMixedBreed);
  set("message_consent_status", input.messageConsentStatus);
  set("microchip_no", input.microchipNo);
  set("microchip_type", input.microchipType);
  set("name", input.name);
  set("neutered", input.neutered);
  set("patient_registration_no", input.patientRegistrationNo);
  set("primary_attending_vet_id", input.primaryAttendingVetId);
  set("primary_breed_id", input.primaryBreedId);
  set("primary_breed_name", input.primaryBreedName);
  set("profile_memo", input.profileMemo);
  set("sex", input.sex);
  set("special_note", input.specialNote);
  set("species", input.species);
  set("status", input.status);
  set("weight_kg", input.weightKg);
  return payload;
}

function mapPatientProfileRow(data: unknown): CustomerPatientProfile {
  const row = data as Record<string, unknown>;
  const status = row.status;
  return {
    id: getString(row.id) ?? "",
    workspaceId: getString(row.workspace_id) ?? "",
    patientNo: getString(row.patient_no) ?? "",
    name: getString(row.name) ?? "",
    species: getSpecies(row.species),
    breed: getString(row.breed),
    primaryBreedId: getString(row.primary_breed_id),
    primaryBreedName: getString(row.primary_breed_name),
    isMixedBreed: row.is_mixed_breed === true,
    additionalBreedIds: readStringArray(row.additional_breed_ids),
    sex: row.sex === "male" || row.sex === "female" ? row.sex : "unknown",
    neutered: typeof row.neutered === "boolean" ? row.neutered : undefined,
    birthDate: getString(row.birth_date),
    estimatedAgeYears: getNumber(row.estimated_age_years),
    estimatedAgeMonths: getNumber(row.estimated_age_months),
    estimatedAgeDays: getNumber(row.estimated_age_days),
    ageIsEstimated: row.age_is_estimated === true,
    weightKg: getNumber(row.weight_kg),
    color: getString(row.color),
    microchipNo: getString(row.microchip_no),
    microchipType:
      row.microchip_type === "internal" || row.microchip_type === "external"
        ? row.microchip_type
        : "none",
    patientRegistrationNo: getString(row.patient_registration_no),
    allergyNote: getString(row.allergy_note),
    specialNote: getString(row.special_note),
    handlingCautionNote: getString(row.handling_caution_note),
    handlingCautionLocked: row.handling_caution_locked !== false,
    profileMemo: getString(row.profile_memo),
    primaryAttendingVetId: getString(row.primary_attending_vet_id),
    messageConsentStatus:
      row.message_consent_status === "refused" || row.message_consent_status === "unknown"
        ? row.message_consent_status
        : "granted",
    status:
      status === "inactive" || status === "deceased" || status === "soft_deleted"
        ? status
        : "active",
    deceasedAt: getString(row.deceased_at),
    createdAt: getString(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: getString(row.updated_at) ?? new Date(0).toISOString(),
  };
}

function getSpecies(value: unknown): Species {
  return typeof value === "string" && speciesValues.has(value as Species)
    ? (value as Species)
    : "other";
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeStringList(values?: string[]) {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function trimToUndefined(value: unknown) {
  const next = typeof value === "string" ? value.trim() : "";
  return next.length > 0 ? next : undefined;
}
