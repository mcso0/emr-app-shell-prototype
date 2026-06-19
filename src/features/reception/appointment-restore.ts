import type { Appointment } from "@/types/emr-domain";

export type ReceptionAppointmentRestoreRecord = {
  appointment: Appointment;
};

export type ReceptionAppointmentRestoreResponse =
  | {
      ok: true;
      status: 200;
      workspaceId: string;
      restoration: ReceptionAppointmentRestoreRecord;
      enforcedBy: "reception-appointment-restore";
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
        | "appointment_unavailable"
        | "appointment_not_restorable"
        | "appointment_already_active"
        | "appointment_active_encounter_exists";
      fieldErrors?: Record<string, string>;
    };
