import type { Encounter, Guardian, Patient, WaitingQueueEntry } from "@/types/emr-domain";

export type ChartLiveQueueRecord = {
  encounter: Encounter;
  patient: Patient;
  primaryGuardian?: Guardian;
  queueEntry: WaitingQueueEntry;
  veterinarianName?: string;
};

export type ChartLiveQueueResponse =
  | {
      ok: true;
      status: 200;
      queue: ChartLiveQueueRecord[];
      enforcedBy: "chart-live-queue-read";
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
      sessionReason?: string;
      sessionStatus?: string;
    };
