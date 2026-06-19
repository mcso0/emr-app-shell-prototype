import type { Encounter, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionEncounterRestoreRecord = {
  encounter: Encounter;
  queueEntry: WaitingQueueEntry;
};

export type ReceptionEncounterRestoreResponse =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      restoration: ReceptionEncounterRestoreRecord;
      enforcedBy: "reception-encounter-restore";
    }
  | {
      ok: false;
      status?: number;
      error?: "invalid_input" | "db_write_failed" | "rate_limited" | "supabase_client_missing";
      denialReason?:
        | "unauthenticated"
        | "inactive_user"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "permission_missing"
        | "encounter_unavailable"
        | "encounter_not_restorable"
        | "encounter_already_active"
        | "queue_entry_unavailable";
      fieldErrors?: Record<string, string>;
    };
