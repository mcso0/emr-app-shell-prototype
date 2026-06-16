import type { Encounter, Guardian, Patient, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionQueueReadRecord = {
  encounter: Encounter;
  patient?: Patient;
  primaryGuardian?: Guardian;
  queueEntry: WaitingQueueEntry;
};

export type ReceptionQueueReadResponse =
  | {
      ok: true;
      status: 200;
      queue: ReceptionQueueReadRecord[];
      enforcedBy: "reception-queue-read";
    }
  | {
      ok: false;
      status?: number;
      error?: "db_read_failed" | "supabase_client_missing";
      denialReason?:
        | "unauthenticated"
        | "inactive_user"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "permission_missing";
    };
