import type { Guardian, Patient } from "@/types/emr-domain";

export type ReceptionPatientGuardianLookupItem = {
  patient: Patient;
  primaryGuardian?: Guardian;
  searchText?: string;
};

export type ReceptionPatientGuardianLookupResponse =
  | {
      ok: true;
      patients: ReceptionPatientGuardianLookupItem[];
      enforcedBy: "reception-patient-guardian-lookup";
    }
  | {
      ok: false;
      error?: "db_read_failed" | "validation_failed";
      denialReason?:
        | "unauthenticated"
        | "inactive_user"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "permission_missing";
      sessionStatus?: string;
      sessionReason?: string;
    };
