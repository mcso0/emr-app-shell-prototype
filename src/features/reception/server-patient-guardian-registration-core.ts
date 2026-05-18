import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import type {
  ReceptionPatientGuardianRegistrationInput,
  ReceptionPatientGuardianRegistrationRecord,
} from "@/features/reception/patient-guardian-registration";
import { getReceptionMutationPermissionContract } from "@/features/reception/reception-mutation-permissions";
import {
  mockConsents,
  mockGuardians,
  mockPatientGuardians,
  mockPatients,
} from "@/mocks/emr-domain";
import type {
  Consent,
  ConsentType,
  Guardian,
  Patient,
  PatientGuardian,
  Species,
} from "@/types/emr-domain";

export type ReceptionPatientGuardianRegistrationFieldErrors = Partial<
  Record<
    | "existingGuardianId"
    | "guardianMobilePhone"
    | "guardianName"
    | "patientBreed"
    | "patientName"
    | "patientSpecies"
    | "privacyConsent",
    string
  >
>;

export type ReceptionPatientGuardianRegistrationGatewayResult =
  | { ok: true; registration: ReceptionPatientGuardianRegistrationRecord }
  | {
      ok: false;
      status: 409;
      denialReason:
        | "duplicate_guardian_mobile_phone"
        | "duplicate_patient_microchip"
        | "duplicate_patient_registration_no"
        | "guardian_unavailable";
    }
  | { ok: false; status: 500; error: "db_write_failed" };

export type ReceptionPatientGuardianRegistrationGateway = {
  registerPatientGuardian(input: {
    actorUserId: string;
    workspaceId: string;
    input: ReceptionPatientGuardianRegistrationInput;
  }): Promise<ReceptionPatientGuardianRegistrationGatewayResult>;
};

export type ReceptionPatientGuardianRegistrationResult =
  | {
      ok: true;
      status: 201;
      workspaceId: string;
      registration: ReceptionPatientGuardianRegistrationRecord;
      enforcedBy: "reception-patient-guardian-registration";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: ReceptionPatientGuardianRegistrationFieldErrors;
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | {
      ok: false;
      status: 409;
      denialReason:
        | "duplicate_guardian_mobile_phone"
        | "duplicate_patient_microchip"
        | "duplicate_patient_registration_no"
        | "guardian_unavailable";
    }
  | {
      ok: false;
      status: 500;
      error: "db_write_failed" | "supabase_client_missing";
    };

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

export async function registerReceptionPatientGuardian({
  actorUserId,
  gateway = createMockReceptionPatientGuardianRegistrationGateway(),
  input,
  permissionAdapter = createDemoReceptionRegistrationPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: ReceptionPatientGuardianRegistrationGateway;
  input: ReceptionPatientGuardianRegistrationInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ReceptionPatientGuardianRegistrationResult> {
  const normalized = normalizeRegistrationInput(input);
  const validation = validateRegistrationInput(normalized);

  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const permissionContract = getReceptionMutationPermissionContract(
    "patient_guardian_registration"
  );
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

  const result = await gateway.registerPatientGuardian({
    actorUserId: actorUserId ?? "",
    workspaceId,
    input: normalized,
  });

  if (!result.ok) {
    if (result.status === 409) {
      return {
        ok: false,
        status: 409,
        denialReason: result.denialReason,
      };
    }

    return { ok: false, status: 500, error: result.error };
  }

  return {
    ok: true,
    status: 201,
    workspaceId,
    registration: result.registration,
    enforcedBy: "reception-patient-guardian-registration",
  };
}

export function createMockReceptionPatientGuardianRegistrationGateway(
  dataset: {
    consents: Consent[];
    guardians: Guardian[];
    patientGuardians: PatientGuardian[];
    patients: Patient[];
  } = {
    consents: mockConsents,
    guardians: mockGuardians,
    patientGuardians: mockPatientGuardians,
    patients: mockPatients,
  },
  now = new Date().toISOString()
): ReceptionPatientGuardianRegistrationGateway {
  return {
    async registerPatientGuardian({ workspaceId, input }) {
      const workspaceGuardians = dataset.guardians.filter(
        (guardian) => guardian.workspaceId === workspaceId
      );
      const workspacePatients = dataset.patients.filter(
        (patient) => patient.workspaceId === workspaceId
      );
      const patientMicrochip = trimToUndefined(input.patient.microchipNo);
      const patientRegistrationNo = trimToUndefined(input.patient.patientRegistrationNo);

      if (
        input.mode === "new_guardian_patient" &&
        workspaceGuardians.some(
          (guardian) =>
            normalizePhone(guardian.mobilePhone) === normalizePhone(input.guardian?.mobilePhone)
        )
      ) {
        return {
          ok: false,
          status: 409,
          denialReason: "duplicate_guardian_mobile_phone",
        };
      }

      if (
        patientMicrochip &&
        workspacePatients.some((patient) => patient.microchipNo === patientMicrochip)
      ) {
        return { ok: false, status: 409, denialReason: "duplicate_patient_microchip" };
      }

      if (
        patientRegistrationNo &&
        workspacePatients.some(
          (patient) => patient.patientRegistrationNo === patientRegistrationNo
        )
      ) {
        return {
          ok: false,
          status: 409,
          denialReason: "duplicate_patient_registration_no",
        };
      }

      const existingGuardian =
        input.mode === "existing_guardian_patient"
          ? workspaceGuardians.find((guardian) => guardian.id === input.existingGuardianId)
          : undefined;

      if (input.mode === "existing_guardian_patient" && !existingGuardian) {
        return { ok: false, status: 409, denialReason: "guardian_unavailable" };
      }

      const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const guardian =
        existingGuardian ??
        ({
          id: `registration-guardian-${seed}`,
          workspaceId,
          name: input.guardian?.name?.trim() ?? "",
          mobilePhone: trimToUndefined(input.guardian?.mobilePhone),
          phone: trimToUndefined(input.guardian?.phone),
          email: trimToUndefined(input.guardian?.email),
          birthDate: trimToUndefined(input.guardian?.birthDate),
          address: trimToUndefined(input.guardian?.address),
          memo: trimToUndefined(input.guardian?.memo),
          createdAt: now,
          updatedAt: now,
        } satisfies Guardian);
      const patient: Patient = {
        id: `registration-patient-${seed}`,
        workspaceId,
        patientNo: createPatientNo(workspacePatients.length),
        name: input.patient.name?.trim() ?? "",
        species: input.patient.species ?? "other",
        breed: trimToUndefined(input.patient.breed),
        birthDate: trimToUndefined(input.patient.birthDate),
        estimatedAgeText: trimToUndefined(input.patient.estimatedAgeText),
        sex: input.patient.sex ?? "unknown",
        neutered: input.patient.neutered ?? false,
        microchipNo: patientMicrochip,
        patientRegistrationNo,
        specialNote: trimToUndefined(input.patient.specialNote),
        handlingCautionLocked: true,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      const patientGuardian: PatientGuardian = {
        id: `registration-pg-${seed}`,
        patientId: patient.id,
        guardianId: guardian.id,
        relationship: "주보호자",
        isPrimary: true,
        canReceiveMessages: true,
        createdAt: now,
      };
      const consents =
        input.mode === "new_guardian_patient"
          ? createRegistrationConsents({
              guardianId: guardian.id,
              marketingConsent: input.guardian?.marketingConsent,
              now,
              workspaceId,
            })
          : [];

      return {
        ok: true,
        registration: { guardian, patient, patientGuardian, consents },
      };
    },
  };
}

export type SupabaseReceptionPatientGuardianRegistrationRpcClient = {
  rpc(
    functionName: "clair_register_reception_patient_guardian",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_registration: ReceptionPatientGuardianRegistrationInput;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseReceptionPatientGuardianRegistrationGateway(
  client: SupabaseReceptionPatientGuardianRegistrationRpcClient
): ReceptionPatientGuardianRegistrationGateway {
  return {
    async registerPatientGuardian({ actorUserId, workspaceId, input }) {
      const { data, error } = await client.rpc(
        "clair_register_reception_patient_guardian",
        {
          p_workspace_id: workspaceId,
          p_actor_user_id: actorUserId,
          p_registration: input,
        }
      );

      if (error) {
        const denialReason = mapRegistrationDbDenial(error.message);
        if (denialReason) return { ok: false, status: 409, denialReason };
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const registration = mapRegistrationRecord(data);
      if (!registration) return { ok: false, status: 500, error: "db_write_failed" };

      return { ok: true, registration };
    },
  };
}

function normalizeRegistrationInput(
  input: ReceptionPatientGuardianRegistrationInput
): ReceptionPatientGuardianRegistrationInput {
  const mode =
    input.mode === "existing_guardian_patient"
      ? "existing_guardian_patient"
      : "new_guardian_patient";

  return {
    mode,
    existingGuardianId: trimToUndefined(input.existingGuardianId),
    guardian: input.guardian
      ? {
          address: trimToUndefined(input.guardian.address),
          birthDate: trimToUndefined(input.guardian.birthDate),
          email: trimToUndefined(input.guardian.email),
          marketingConsent: Boolean(input.guardian.marketingConsent),
          memo: trimToUndefined(input.guardian.memo),
          mobilePhone: trimToUndefined(input.guardian.mobilePhone),
          name: trimToUndefined(input.guardian.name),
          phone: trimToUndefined(input.guardian.phone),
          privacyConsent: Boolean(input.guardian.privacyConsent),
        }
      : undefined,
    patient: {
      birthDate: trimToUndefined(input.patient?.birthDate),
      breed: trimToUndefined(input.patient?.breed),
      estimatedAgeText: trimToUndefined(input.patient?.estimatedAgeText),
      microchipNo: trimToUndefined(input.patient?.microchipNo),
      name: trimToUndefined(input.patient?.name),
      neutered: Boolean(input.patient?.neutered),
      patientRegistrationNo: trimToUndefined(input.patient?.patientRegistrationNo),
      sex:
        input.patient?.sex === "male" || input.patient?.sex === "female"
          ? input.patient.sex
          : "unknown",
      species: speciesValues.has(input.patient?.species as Species)
        ? input.patient.species
        : undefined,
      specialNote: trimToUndefined(input.patient?.specialNote),
    },
  };
}

function validateRegistrationInput(input: ReceptionPatientGuardianRegistrationInput) {
  const fieldErrors: ReceptionPatientGuardianRegistrationFieldErrors = {};

  if (input.mode === "new_guardian_patient") {
    if (!input.guardian?.name) fieldErrors.guardianName = "보호자명은 필수입니다.";
    if (!input.guardian?.mobilePhone || normalizePhone(input.guardian.mobilePhone).length < 10) {
      fieldErrors.guardianMobilePhone = "보호자 휴대전화는 필수입니다.";
    }
    if (!input.guardian?.privacyConsent) {
      fieldErrors.privacyConsent = "개인정보 수집 동의가 필요합니다.";
    }
  } else if (!input.existingGuardianId) {
    fieldErrors.existingGuardianId = "기존 보호자를 선택해 주세요.";
  }

  if (!input.patient.name) fieldErrors.patientName = "환자명은 필수입니다.";
  if (!input.patient.species) fieldErrors.patientSpecies = "동물 종류는 필수입니다.";
  if (!input.patient.breed) fieldErrors.patientBreed = "품종은 필수입니다.";

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function createRegistrationConsents({
  guardianId,
  marketingConsent,
  now,
  workspaceId,
}: {
  guardianId: string;
  marketingConsent?: boolean;
  now: string;
  workspaceId: string;
}): Consent[] {
  const consentTypes: ConsentType[] = marketingConsent ? ["privacy", "marketing"] : ["privacy"];

  return consentTypes.map((consentType) => ({
    id: `registration-consent-${consentType}-${guardianId}`,
    workspaceId,
    guardianId,
    consentType,
    status: "granted",
    signedAt: now,
  }));
}

function mapRegistrationDbDenial(message?: string) {
  if (!message) return null;
  if (message.includes("duplicate_guardian_mobile_phone")) {
    return "duplicate_guardian_mobile_phone" as const;
  }
  if (message.includes("duplicate_patient_microchip")) {
    return "duplicate_patient_microchip" as const;
  }
  if (message.includes("duplicate_patient_registration_no")) {
    return "duplicate_patient_registration_no" as const;
  }
  if (message.includes("guardian_unavailable")) {
    return "guardian_unavailable" as const;
  }
  return null;
}

function mapRegistrationRecord(value: unknown): ReceptionPatientGuardianRegistrationRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    guardian?: unknown;
    patient?: unknown;
    patientGuardian?: unknown;
    patient_guardian?: unknown;
    consents?: unknown;
  };
  const guardian = mapGuardian(row.guardian);
  const patient = mapPatient(row.patient);
  const patientGuardian = mapPatientGuardian(row.patientGuardian ?? row.patient_guardian);
  const consents = Array.isArray(row.consents)
    ? row.consents.map(mapConsent).filter((item): item is Consent => Boolean(item))
    : [];

  if (!guardian || !patient || !patientGuardian) return null;
  return { guardian, patient, patientGuardian, consents };
}

function mapGuardian(value: unknown): Guardian | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Guardian>;
  if (
    typeof row.id !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.name !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    mobilePhone: trimToUndefined(row.mobilePhone),
    phone: trimToUndefined(row.phone),
    email: trimToUndefined(row.email),
    birthDate: trimToUndefined(row.birthDate),
    address: trimToUndefined(row.address),
    occupation: trimToUndefined(row.occupation),
    memo: trimToUndefined(row.memo),
    createdAt: trimToUndefined(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: trimToUndefined(row.updatedAt) ?? new Date(0).toISOString(),
  };
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
    breed: trimToUndefined(row.breed),
    birthDate: trimToUndefined(row.birthDate),
    estimatedAgeText: trimToUndefined(row.estimatedAgeText),
    sex: row.sex as Patient["sex"],
    neutered: typeof row.neutered === "boolean" ? row.neutered : undefined,
    microchipNo: trimToUndefined(row.microchipNo),
    patientRegistrationNo: trimToUndefined(row.patientRegistrationNo),
    allergyNote: trimToUndefined(row.allergyNote),
    specialNote: trimToUndefined(row.specialNote),
    handlingCautionNote: trimToUndefined(row.handlingCautionNote),
    handlingCautionLocked:
      typeof row.handlingCautionLocked === "boolean" ? row.handlingCautionLocked : true,
    status: row.status as Patient["status"],
    createdAt: trimToUndefined(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: trimToUndefined(row.updatedAt) ?? new Date(0).toISOString(),
  };
}

function mapPatientGuardian(value: unknown): PatientGuardian | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<PatientGuardian>;
  if (
    typeof row.id !== "string" ||
    typeof row.patientId !== "string" ||
    typeof row.guardianId !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    patientId: row.patientId,
    guardianId: row.guardianId,
    relationship: trimToUndefined(row.relationship),
    isPrimary: typeof row.isPrimary === "boolean" ? row.isPrimary : true,
    canReceiveMessages:
      typeof row.canReceiveMessages === "boolean" ? row.canReceiveMessages : true,
    createdAt: trimToUndefined(row.createdAt) ?? new Date(0).toISOString(),
  };
}

function mapConsent(value: unknown): Consent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<Consent>;
  if (
    typeof row.id !== "string" ||
    typeof row.workspaceId !== "string" ||
    typeof row.guardianId !== "string" ||
    typeof row.consentType !== "string" ||
    typeof row.status !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    guardianId: row.guardianId,
    patientId: trimToUndefined(row.patientId),
    consentType: row.consentType as Consent["consentType"],
    status: row.status as Consent["status"],
    signedAt: trimToUndefined(row.signedAt),
    revokedAt: trimToUndefined(row.revokedAt),
    documentUrl: trimToUndefined(row.documentUrl),
  };
}

function createDemoReceptionRegistrationPermissionAdapter() {
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

function createPatientNo(index: number) {
  return `P-REG-${String(index + 1).padStart(4, "0")}`;
}

function normalizePhone(value?: string) {
  return value?.replace(/\D/g, "") ?? "";
}

function trimToUndefined(value?: string) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
