import type {
  Appointment,
  Encounter,
  Guardian,
  Patient,
  WaitingQueueEntry,
} from "@/types/emr-domain";

export type ReceptionEncounterQueueReadRecord = {
  kind: "encounter_queue";
  encounter: Encounter;
  appointment?: Appointment;
  patient?: Patient;
  primaryGuardian?: Guardian;
  queueEntry: WaitingQueueEntry;
};

export type ReceptionAppointmentQueueReadRecord = {
  kind: "appointment";
  appointment: Appointment;
  patient?: Patient;
  primaryGuardian?: Guardian;
};

export type ReceptionQueueReadRecord =
  | ReceptionEncounterQueueReadRecord
  | ReceptionAppointmentQueueReadRecord;

export type ReceptionQueueReadSummary = {
  appointmentCount: number;
  date: string;
  receptionCount: number;
  totalCount: number;
  workspaceId: string;
};

export type ReceptionQueueReadResponse =
  | {
      ok: true;
      status: 200;
      queue: ReceptionQueueReadRecord[];
      summary: ReceptionQueueReadSummary;
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
