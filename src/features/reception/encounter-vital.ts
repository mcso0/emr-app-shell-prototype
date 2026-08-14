import type { PatientVitalMeasurement } from "@/features/patient-vitals/patient-vital-types";

export type ReceptionEncounterVitalReadResponse =
  | {
      ok: true;
      status: 200;
      enforcedBy: "reception-encounter-vital-read";
      vital: PatientVitalMeasurement | null;
    }
  | {
      ok: false;
      status?: number;
      denialReason?:
        | "unauthenticated"
        | "inactive_user"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "permission_missing";
      error?:
        | "db_read_failed"
        | "encounter_unavailable"
        | "supabase_client_missing";
    };
