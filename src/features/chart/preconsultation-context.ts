export type ChartPreconsultationVitalMeasurement = {
  id: string;
  encounterId: string;
  measuredAt: string;
  weightKg?: number;
  temperatureC?: number;
  respiratoryRateRpm?: number;
  bloodPressureSystolicMmhg?: number;
  bloodPressureDiastolicMmhg?: number;
};

export type ChartPreconsultationHistoryEntry = {
  encounterId: string;
  encounterNo: string;
  checkedInAt: string;
  visitPurpose?: string;
  chiefComplaint?: string;
  receptionMemo?: string;
  status: string;
  subjective?: string;
  assessment?: string;
  plan?: string;
  primaryDiagnosis?: string;
};

export type ChartPreconsultationContext = {
  encounter: {
    id: string;
    encounterNo: string;
    appointmentId?: string;
    receptionType: "appointment" | "walk_in";
    visitPurpose?: string;
    chiefComplaint?: string;
    receptionMemo?: string;
    checkedInAt: string;
    status: string;
  };
  queue: {
    id: string;
    status: string;
  };
  patient: {
    id: string;
    patientNo: string;
    name: string;
    species: string;
    breed?: string;
    birthDate?: string;
    estimatedAgeText?: string;
    sex: string;
    neutered?: boolean;
    weightKg?: number;
    allergyNote?: string;
    specialNote?: string;
    handlingCautionNote?: string;
  };
  guardian?: {
    id: string;
    name: string;
    memo?: string;
  };
  appointment?: {
    id: string;
    visitPurpose?: string;
    symptomNote?: string;
  };
  veterinarian?: {
    id: string;
    displayName: string;
  };
  priorEncounterCount: number;
  vitals: ChartPreconsultationVitalMeasurement[];
  history: ChartPreconsultationHistoryEntry[];
};

export type ChartPreconsultationContextResponse =
  | {
      ok: true;
      status: 200;
      context: ChartPreconsultationContext;
      canWriteVitals: boolean;
      enforcedBy: "chart-preconsultation-context-read";
    }
  | {
      ok: false;
      status?: number;
      error?: "db_read_failed" | "encounter_unavailable" | "supabase_client_missing";
      denialReason?:
        | "unauthenticated"
        | "inactive_user"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "permission_missing";
      sessionReason?: string;
      sessionStatus?: string;
    };
