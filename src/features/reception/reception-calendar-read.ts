import type { Appointment, Encounter, Guardian, Patient, WaitingQueueEntry } from "@/types/emr-domain";
import type { EffectiveOperatingHours } from "@/features/hospital-admin/settings/hospital-basic-settings-model";

export type ReceptionCalendarReadRecord = {
  appointment?: Appointment;
  encounter?: Encounter;
  patient?: Patient;
  primaryGuardian?: Guardian;
  queueEntry?: WaitingQueueEntry;
};

export type ReceptionCalendarReadResponse =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      date: string;
      records: ReceptionCalendarReadRecord[];
      operatingSchedule: EffectiveOperatingHours;
      enforcedBy: "reception-calendar-read";
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
