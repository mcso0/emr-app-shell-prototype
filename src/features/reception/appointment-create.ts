import type { Appointment } from "@/types/emr-domain";

export type ReceptionAppointmentCreateInput = {
  assignedVeterinarianId?: string;
  durationMinutes: number;
  guardianId?: string;
  patientId: string;
  reservationMemo?: string;
  scheduledStartAt: string;
  weightKg?: number;
};

export type ReceptionAppointmentCreateResponse =
  | {
      ok: true;
      status: 201;
      workspaceId: string;
      appointment: Appointment;
      enforcedBy: "reception-appointment-create";
    }
  | {
      ok: false;
      status?: number;
      error?: "invalid_input" | "db_write_failed" | "supabase_client_missing" | "rate_limited";
      denialReason?:
        | "unauthenticated"
        | "inactive_user"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "permission_missing"
        | "patient_unavailable"
        | "guardian_unavailable"
        | "patient_guardian_link_missing"
        | "primary_veterinarian_unavailable"
        | "appointment_slot_unavailable"
        | "appointment_outside_business_hours"
        | "appointment_closed_day";
      fieldErrors?: Record<string, string>;
    };
