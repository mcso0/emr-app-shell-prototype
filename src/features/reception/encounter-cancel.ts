import type { Encounter, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionEncounterCancelRecord = {
  encounter: Encounter;
  queueEntry: WaitingQueueEntry;
};

export type ReceptionEncounterCancelResponse =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      cancellation: ReceptionEncounterCancelRecord;
      enforcedBy: "reception-encounter-cancel";
    }
  | {
      ok: false;
      status?: number;
      error?: "db_write_failed" | "rate_limited" | "supabase_client_missing";
      denialReason?:
        | "unauthenticated"
        | "inactive_user"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "permission_missing"
        | "encounter_unavailable"
        | "encounter_not_cancelable"
        | "encounter_already_cancelled"
        | "queue_entry_unavailable";
    };
