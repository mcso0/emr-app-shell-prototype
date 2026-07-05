import type { ReceptionPatientGuardianLookupItem } from "@/features/reception/patient-guardian-lookup";

export type CommandSearchFilter =
  | "all"
  | "patient"
  | "guardian"
  | "phone"
  | "chart"
  | "vet"
  | "technician"
  | "desk";

export type CommandSearchResultKind =
  | "patient"
  | "guardian"
  | "appointment"
  | "encounter"
  | "staff";

export type CommandSearchSourceStatus = "ready" | "skipped" | "permission_denied" | "error";

export type CommandSearchResult = {
  badge?: string;
  href: string;
  id: string;
  kind: CommandSearchResultKind;
  lookupItem?: ReceptionPatientGuardianLookupItem;
  subtitle: string;
  title: string;
};

export type CommandSearchSourceState = {
  patientGuardian: CommandSearchSourceStatus;
  reception: CommandSearchSourceStatus;
  staff: CommandSearchSourceStatus;
};

export type CommandSearchResponse =
  | {
      ok: true;
      query: string;
      filter: CommandSearchFilter;
      results: CommandSearchResult[];
      sourceState: CommandSearchSourceState;
      enforcedBy: "command-search";
    }
  | {
      ok: false;
      denialReason?:
        | "unauthenticated"
        | "inactive_user"
        | "workspace_membership_missing"
        | "workspace_membership_inactive"
        | "permission_missing";
      error?: "db_read_failed" | "supabase_client_missing";
      sessionReason?: string;
      sessionStatus?: string;
    };

const maxQueryLength = 80;

export function normalizeCommandSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").slice(0, maxQueryLength);
}

export function shouldRunCommandSearch(query: string) {
  const normalized = normalizeCommandSearchQuery(query);
  return Boolean(normalized);
}
