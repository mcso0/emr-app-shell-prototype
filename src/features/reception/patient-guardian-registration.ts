import type {
  Consent,
  Guardian,
  Patient,
  PatientGuardian,
  PatientSex,
  Species,
} from "@/types/emr-domain";

export type ReceptionPatientGuardianRegistrationMode =
  | "new_guardian_patient"
  | "existing_guardian_patient";

export type ReceptionPatientGuardianRegistrationInput = {
  mode: ReceptionPatientGuardianRegistrationMode;
  existingGuardianId?: string;
  guardian?: {
    address?: string;
    birthDate?: string;
    email?: string;
    marketingConsent?: boolean;
    memo?: string;
    mobilePhone?: string;
    name?: string;
    phone?: string;
    privacyConsent?: boolean;
  };
  patient: {
    birthDate?: string;
    breed?: string;
    estimatedAgeText?: string;
    microchipNo?: string;
    name?: string;
    neutered?: boolean;
    patientRegistrationNo?: string;
    sex?: PatientSex;
    species?: Species;
    specialNote?: string;
  };
};

export type ReceptionPatientGuardianRegistrationRecord = {
  guardian: Guardian;
  patient: Patient;
  patientGuardian: PatientGuardian;
  consents: Consent[];
};

export type ReceptionPatientGuardianRegistrationResponse =
  | {
      ok: true;
      status: 201;
      workspaceId: string;
      registration: ReceptionPatientGuardianRegistrationRecord;
      enforcedBy: "reception-patient-guardian-registration";
    }
  | {
      ok: false;
      status?: number;
      error?: "invalid_input" | "db_write_failed" | "supabase_client_missing" | "rate_limited";
      denialReason?:
        | "unauthenticated"
        | "inactive_user"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "permission_missing"
        | "duplicate_guardian_mobile_phone"
        | "duplicate_patient_microchip"
        | "duplicate_patient_registration_no"
        | "guardian_unavailable";
      fieldErrors?: Record<string, string>;
    };
