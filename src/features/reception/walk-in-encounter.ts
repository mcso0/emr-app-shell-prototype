import type { Encounter, WaitingQueueEntry } from "@/types/emr-domain";

export type ReceptionVitalMeasurementInput = {
  weightKg?: number;
  temperatureC?: number;
  respiratoryRateRpm?: number;
  bloodPressure?: {
    systolicMmhg: number;
    diastolicMmhg: number;
  };
};

export type ReceptionWalkInEncounterInput = {
  assignedStaffUserIds?: string[];
  department?: string;
  durationMinutes?: number;
  guardianId?: string;
  memo?: string;
  patientId: string;
  plannedStartAt?: string;
  primaryVeterinarianId?: string;
  visitPurpose?: string;
  vitals?: ReceptionVitalMeasurementInput;
};

export type ReceptionWalkInEncounterRecord = {
  encounter: Encounter;
  queueEntry: WaitingQueueEntry;
};

export type ReceptionWalkInEncounterResponse =
  | {
      ok: true;
      status: 201;
      workspaceId: string;
      walkIn: ReceptionWalkInEncounterRecord;
      enforcedBy: "reception-walk-in-encounter";
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
            | "assigned_staff_unavailable"
            | "walk_in_outside_business_hours";
      fieldErrors?: Record<string, string>;
    };
