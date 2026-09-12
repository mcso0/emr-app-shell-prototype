import type { Encounter, Guardian, SoapNote } from "@/types/emr-domain";

export type ChartPatientHistoryRecord = {
  chart: SoapNote;
  diagnoses: Array<{ diagnosisText: string }>;
  encounter: Encounter;
  primaryGuardian?: Guardian;
  veterinarianName?: string;
};

export type ChartPatientHistoryPage = {
  items: ChartPatientHistoryRecord[];
  nextCursor: string | null;
  totalCount: number;
};

export type ChartPatientHistoryResponse =
  | {
      ok: true;
      status: 200;
      items: ChartPatientHistoryRecord[];
      nextCursor: string | null;
      totalCount: number;
      enforcedBy: "chart-patient-history-read";
    }
  | {
      ok: false;
      status?: number;
      error?:
        | "db_read_failed"
        | "invalid_cursor"
        | "patient_unavailable"
        | "supabase_client_missing";
      denialReason?:
        | "unauthenticated"
        | "inactive_user"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "permission_missing";
      sessionReason?: string;
      sessionStatus?: string;
    };
