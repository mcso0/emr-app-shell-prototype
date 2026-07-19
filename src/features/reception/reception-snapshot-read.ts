import type { ReceptionCalendarReadResponse } from "@/features/reception/reception-calendar-read";
import type { ReceptionQueueReadResponse } from "@/features/reception/reception-queue-read";

export type ReceptionSnapshotReadResponse =
  | {
      ok: boolean;
      status: number;
      calendar: ReceptionCalendarReadResponse;
      queue: ReceptionQueueReadResponse;
      enforcedBy: "reception-snapshot-read";
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
