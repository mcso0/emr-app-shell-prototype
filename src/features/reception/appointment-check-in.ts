import type { Appointment, Encounter, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionAppointmentCheckInRecord = {
  appointment: Appointment;
  encounter: Encounter;
  queueEntry: WaitingQueueEntry;
};

export type ReceptionAppointmentCheckInResponse =
  | {
      ok: true;
      status: 201;
      workspaceId: string;
      checkIn: ReceptionAppointmentCheckInRecord;
      enforcedBy: "reception-appointment-check-in";
    }
  | {
      ok: false;
      status?: number;
      error?: "db_write_failed" | "rate_limited";
      denialReason?:
        | "unauthenticated"
        | "inactive_user"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "permission_missing"
        | "appointment_unavailable"
        | "appointment_not_check_in_ready"
        | "appointment_already_checked_in";
    };
