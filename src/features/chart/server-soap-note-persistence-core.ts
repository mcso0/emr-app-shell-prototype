import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";
import {
  emitLiveMutationAuditEvent,
  type LiveMutationAuditOptions,
} from "@/features/audit/server-mutation-audit-core";
import { mockEncounters, mockSoapNotes } from "@/mocks/emr-domain";
import type { Encounter, SoapNote } from "@/types/emr-domain";

export type ChartSoapSaveMode = "autosave" | "manual_save";

export type ChartSoapNoteInput = {
  encounterId?: string;
  expectedUpdatedAt?: string | null;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  mode?: ChartSoapSaveMode;
};

export type ChartSoapNoteGatewayResult =
  | { ok: true; soapNote: SoapNote | null }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "soap_note_conflict" | "stale_status" }
  | { ok: false; status: 409; denialReason: "soap_note_conflict" }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type ChartSoapNoteGateway = {
  readSoapNote(input: {
    encounterId: string;
    workspaceId: string;
  }): Promise<ChartSoapNoteGatewayResult>;
  saveSoapNote(input: {
    actorUserId: string;
    fields: Required<Pick<ChartSoapNoteInput, "assessment" | "objective" | "plan" | "subjective">>;
    encounterId: string;
    expectedUpdatedAt?: string | null;
    mode: ChartSoapSaveMode;
    workspaceId: string;
  }): Promise<ChartSoapNoteGatewayResult>;
};

export type ChartSoapNoteReadResult =
  | {
      ok: true;
      status: 200;
      soapNote: SoapNote | null;
      enforcedBy: "chart-soap-note-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<"encounterId", string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type ChartSoapNoteSaveResult =
  | {
      ok: true;
      status: 200;
      soapNote: SoapNote;
      enforcedBy: "chart-soap-note-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<keyof ChartSoapNoteInput, string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: "encounter_unavailable" | "soap_note_conflict" | "stale_status" }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const mockSoapNoteStore = new Map<string, SoapNote>();

export async function readChartSoapNote({
  actorUserId,
  encounterId,
  gateway = createMockChartSoapNoteGateway(),
  permissionAdapter = createDemoChartSoapPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string | null | undefined;
  gateway?: Pick<ChartSoapNoteGateway, "readSoapNote">;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartSoapNoteReadResult> {
  const normalizedEncounterId = trimToUndefined(encounterId);

  if (!normalizedEncounterId) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: { encounterId: "진료 차트를 선택해 주세요." },
    };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:view",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.readSoapNote({
    encounterId: normalizedEncounterId,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409 && result.denialReason === "encounter_unavailable") {
      return { ok: false, status: 409, denialReason: "encounter_unavailable" };
    }
    return { ok: false, status: 500, error: "db_read_failed" };
  }

  return {
    ok: true,
    status: 200,
    soapNote: result.soapNote,
    enforcedBy: "chart-soap-note-persistence",
  };
}

export async function saveChartSoapNote({
  actorUserId,
  auditGateway,
  auditNow,
  auditRequestId,
  gateway = createMockChartSoapNoteGateway(),
  input,
  permissionAdapter = createDemoChartSoapPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  auditGateway?: LiveMutationAuditOptions["auditGateway"];
  auditNow?: LiveMutationAuditOptions["auditNow"];
  auditRequestId?: LiveMutationAuditOptions["auditRequestId"];
  gateway?: Pick<ChartSoapNoteGateway, "saveSoapNote">;
  input: ChartSoapNoteInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<ChartSoapNoteSaveResult> {
  const normalized = normalizeSoapInput(input);
  const validation = validateSoapInput(normalized);

  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
    requiredPermission: "chart:update",
  });

  if (!permission.allowed) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const result = await gateway.saveSoapNote({
    actorUserId: actorUserId ?? "",
    encounterId: normalized.encounterId,
    expectedUpdatedAt: normalized.expectedUpdatedAt,
    fields: {
      assessment: normalized.assessment,
      objective: normalized.objective,
      plan: normalized.plan,
      subjective: normalized.subjective,
    },
    mode: normalized.mode,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  if (!result.soapNote) {
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  const audit = await emitLiveMutationAuditEvent({
    auditGateway,
    auditNow,
    input: {
      workspaceId,
      actorUserId,
      eventType: "chart.soap_saved",
      targetType: "soap_note",
      targetId: result.soapNote.id,
      encounterId: normalized.encounterId,
      requestId: auditRequestId,
      after: {
        mode: normalized.mode,
        noteStatus: result.soapNote.status,
        updatedAt: result.soapNote.updatedAt,
      },
      metadata: { source: "chart-soap-note-persistence" },
    },
  });
  if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };

  return {
    ok: true,
    status: 200,
    soapNote: result.soapNote,
    enforcedBy: "chart-soap-note-persistence",
  };
}

export function createMockChartSoapNoteGateway(
  dataset: {
    encounters?: Encounter[];
    soapNotes?: SoapNote[];
  } = {
    encounters: mockEncounters,
    soapNotes: mockSoapNotes,
  },
  now = () => new Date().toISOString()
): ChartSoapNoteGateway {
  const encounters = dataset.encounters ?? [];
  const seedSoapNotes = dataset.soapNotes ?? [];

  return {
    async readSoapNote({ encounterId, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };

      return {
        ok: true,
        soapNote: getStoredOrSeedSoapNote({
          encounterId,
          seedSoapNotes,
          workspaceId,
        }),
      };
    },
    async saveSoapNote({ actorUserId, encounterId, expectedUpdatedAt, fields, mode, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };
      if (!canMutateChart(encounter)) return { ok: false, status: 409, denialReason: "stale_status" };

      const stored = getStoredOrSeedSoapNote({
        encounterId,
        seedSoapNotes,
        workspaceId,
      });
      if (expectedUpdatedAt !== undefined) {
        if (stored && expectedUpdatedAt !== stored.updatedAt) {
          return { ok: false, status: 409, denialReason: "soap_note_conflict" };
        }
        if (!stored && expectedUpdatedAt !== null) {
          return { ok: false, status: 409, denialReason: "soap_note_conflict" };
        }
      }
      const timestamp = now();
      const soapNote: SoapNote = {
        id: stored?.id ?? `soap-${encounterId}`,
        encounterId,
        authorUserId: stored?.authorUserId ?? actorUserId,
        subjective: fields.subjective,
        objective: fields.objective,
        assessment: fields.assessment,
        plan: fields.plan,
        status: mode === "autosave" ? "autosaved" : "draft",
        autosavedAt: mode === "autosave" ? timestamp : stored?.autosavedAt,
        signedAt: stored?.signedAt,
        createdAt: stored?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      mockSoapNoteStore.set(buildSoapKey(workspaceId, encounterId), soapNote);

      return { ok: true, soapNote };
    },
  };
}

export type SupabaseChartSoapNoteRpcClient = {
  rpc(
    functionName: "clair_get_chart_soap_note",
    args: {
      p_workspace_id: string;
      p_encounter_id: string;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_save_chart_soap_note",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_note: Required<Pick<ChartSoapNoteInput, "assessment" | "objective" | "plan" | "subjective">>;
      p_expected_updated_at?: string | null;
      p_mode: ChartSoapSaveMode;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartSoapNoteGateway(
  client: SupabaseChartSoapNoteRpcClient
): ChartSoapNoteGateway {
  return {
    async readSoapNote({ encounterId, workspaceId }) {
      const { data, error } = await client.rpc("clair_get_chart_soap_note", {
        p_workspace_id: workspaceId,
        p_encounter_id: encounterId,
      });

      if (error) {
        if (error.message?.includes("encounter_unavailable")) {
          return { ok: false, status: 409, denialReason: "encounter_unavailable" };
        }
        return { ok: false, status: 500, error: "db_read_failed" };
      }

      return { ok: true, soapNote: mapSoapNote(data) };
    },
    async saveSoapNote({ actorUserId, encounterId, expectedUpdatedAt, fields, mode, workspaceId }) {
      const { data, error } = await client.rpc("clair_save_chart_soap_note", {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_note: fields,
        p_expected_updated_at: expectedUpdatedAt ?? null,
        p_mode: mode,
      });

      if (error) {
        if (error.message?.includes("encounter_unavailable")) {
          return { ok: false, status: 409, denialReason: "encounter_unavailable" };
        }
        if (error.message?.includes("soap_note_conflict")) {
          return { ok: false, status: 409, denialReason: "soap_note_conflict" };
        }
        if (error.message?.includes("stale_status")) {
          return { ok: false, status: 409, denialReason: "stale_status" };
        }
        return { ok: false, status: 500, error: "db_write_failed" };
      }

      const soapNote = mapSoapNote(data);
      if (!soapNote) return { ok: false, status: 500, error: "db_write_failed" };

      return { ok: true, soapNote };
    },
  };
}

export function createDemoChartSoapPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active", displayName: "Playwright Admin" },
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-front-desk", status: "active", displayName: "최유나" },
      { id: "user-vet", status: "active", displayName: "이수지" },
      { id: "user-tech", status: "active", displayName: "송하윤" },
    ],
    memberships: [
      {
        id: "membership-playwright-admin",
        workspaceId: "clair-demo",
        userId: "playwright-default-session",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-admin",
        workspaceId: "clair-demo",
        userId: "user-admin",
        roles: ["hospital_admin"],
        status: "active",
      },
      {
        id: "membership-front-desk",
        workspaceId: "clair-demo",
        userId: "user-front-desk",
        roles: ["front_desk"],
        status: "active",
      },
      {
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
      {
        id: "membership-tech",
        workspaceId: "clair-demo",
        userId: "user-tech",
        roles: ["technician"],
        status: "active",
      },
    ],
  });
}

function findEncounter(encounters: Encounter[], workspaceId: string, encounterId: string) {
  return encounters.find(
    (encounter) =>
      encounter.id === encounterId &&
      encounter.workspaceId === workspaceId &&
      encounter.status !== "cancelled"
  );
}

function canMutateChart(encounter: Encounter) {
  return encounter.status === "in_consultation" || encounter.status === "ordered";
}

function getStoredOrSeedSoapNote({
  encounterId,
  seedSoapNotes,
  workspaceId,
}: {
  encounterId: string;
  seedSoapNotes: SoapNote[];
  workspaceId: string;
}) {
  const stored = mockSoapNoteStore.get(buildSoapKey(workspaceId, encounterId));
  if (stored) return stored;

  return seedSoapNotes.find((soapNote) => soapNote.encounterId === encounterId) ?? null;
}

function buildSoapKey(workspaceId: string, encounterId: string) {
  return `${workspaceId}:${encounterId}`;
}

function normalizeSoapInput(input: ChartSoapNoteInput) {
  return {
    encounterId: trimToUndefined(input.encounterId) ?? "",
    expectedUpdatedAt: normalizeExpectedUpdatedAt(input.expectedUpdatedAt),
    subjective: normalizeField(input.subjective),
    objective: normalizeField(input.objective),
    assessment: normalizeField(input.assessment),
    plan: normalizeField(input.plan),
    mode: input.mode === "manual_save" ? "manual_save" as const : "autosave" as const,
  };
}

function validateSoapInput(input: ReturnType<typeof normalizeSoapInput>) {
  const fieldErrors: Partial<Record<keyof ChartSoapNoteInput, string>> = {};

  if (!input.encounterId) fieldErrors.encounterId = "진료 차트를 선택해 주세요.";
  if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== null && Number.isNaN(Date.parse(input.expectedUpdatedAt))) {
    fieldErrors.expectedUpdatedAt = "SOAP 기준 저장 시각이 올바르지 않습니다.";
  }

  for (const field of ["assessment", "objective", "plan", "subjective"] as const) {
    if (input[field].length > 10000) {
      fieldErrors[field] = "SOAP 내용이 너무 깁니다.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return { valid: true as const, fieldErrors: {} };
}

function normalizeField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeExpectedUpdatedAt(value: unknown) {
  if (value === null) return null;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function trimToUndefined(value?: string | null) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function mapSoapNote(value: unknown): SoapNote | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<SoapNote>;

  if (
    typeof row.id !== "string" ||
    typeof row.encounterId !== "string" ||
    typeof row.authorUserId !== "string" ||
    typeof row.status !== "string" ||
    typeof row.createdAt !== "string" ||
    typeof row.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    encounterId: row.encounterId,
    authorUserId: row.authorUserId,
    subjective: trimToUndefined(row.subjective),
    objective: trimToUndefined(row.objective),
    assessment: trimToUndefined(row.assessment),
    plan: trimToUndefined(row.plan),
    status: row.status as SoapNote["status"],
    autosavedAt: trimToUndefined(row.autosavedAt),
    signedAt: trimToUndefined(row.signedAt),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
