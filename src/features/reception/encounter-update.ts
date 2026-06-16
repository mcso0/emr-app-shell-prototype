import type { Encounter, Patient, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionEncounterUpdateInput = {
  department?: string;
  durationMinutes?: number;
  memo?: string;
  primaryVeterinarianId?: string;
  visitPurpose?: string;
  weightKg?: number;
};

export type ReceptionEncounterUpdateRecord = {
  encounter: Encounter;
  patient?: Patient;
  queueEntry?: WaitingQueueEntry;
};

export type ReceptionEncounterUpdateResponse =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      update: ReceptionEncounterUpdateRecord;
      enforcedBy: "reception-encounter-update";
    }
  | {
      ok: false;
      status?: number;
      error?: "db_write_failed" | "invalid_input" | "rate_limited" | "supabase_client_missing";
      fieldErrors?: Partial<Record<keyof ReceptionEncounterUpdateInput, string>>;
      denialReason?:
        | "unauthenticated"
        | "inactive_user"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "permission_missing"
        | "encounter_unavailable"
        | "encounter_not_editable"
        | "patient_unavailable"
        | "primary_veterinarian_unavailable"
        | "queue_entry_unavailable";
    };
