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
import {
  validateAndProjectSoapDocument,
  type SoapDocumentProjection,
} from "@/features/chart/chart-soap-document";
import { mockEncounters, mockSoapNotes } from "@/mocks/emr-domain";
import type { Encounter, SoapBlockDocument, SoapNote } from "@/types/emr-domain";

export type ChartSoapSaveMode = "autosave" | "manual_save";

export type ChartSoapNoteInput = {
  encounterId?: string;
  chartId?: string;
  amendmentReason?: string;
  expectedUpdatedAt?: string | null;
  blockDocument?: unknown;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  mode?: ChartSoapSaveMode;
};

export type ChartSoapConflictReason = "encounter_unavailable" | "soap_note_conflict" | "stale_status" | "chart_unavailable" | "chart_id_required" | "amendment_reason_required" | "unfinished_charts";

export type ChartSoapNoteGatewayResult =
  | {
      ok: true;
      soapNote: SoapNote | null;
      auditHandledBy?: "database_transaction";
      auditRecorded?: boolean;
      auditEventId?: string;
    }
  | { ok: false; status: 409; denialReason: ChartSoapConflictReason }
  | { ok: false; status: 500; error: "db_read_failed" | "db_write_failed" };

export type ChartSoapNoteGateway = {
  readSoapNote(input: {
    encounterId: string;
    chartId?: string;
    workspaceId: string;
  }): Promise<ChartSoapNoteGatewayResult>;
  saveSoapNote(input: {
    actorUserId: string;
    chartId?: string;
    amendmentReason?: string;
    blockDocument: SoapBlockDocument;
    fields: SoapDocumentProjection;
    encounterId: string;
    expectedUpdatedAt?: string | null;
    mode: ChartSoapSaveMode;
    requestId?: string | null;
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
  | { ok: false; status: 409; denialReason: ChartSoapConflictReason }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type ChartSoapNoteSaveResult =
  | {
      ok: true;
      status: 200;
      soapNote: SoapNote;
      auditRecorded: boolean;
      enforcedBy: "chart-soap-note-persistence";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: Partial<Record<keyof ChartSoapNoteInput, string>>;
    }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 409; denialReason: ChartSoapConflictReason }
  | { ok: false; status: 500; error: "db_write_failed" | "supabase_client_missing" };

const mockSoapNoteStore = new Map<string, SoapNote>();
const mockChartCreationRequests = new Map<string, string>();
export function getMockEncounterCharts(workspaceId: string, encounterId: string, seedSoapNotes = mockSoapNotes): SoapNote[] {
  const rows = new Map(seedSoapNotes.filter((note) => note.encounterId === encounterId).map((note) => [note.id, note]));
  for (const [key, note] of mockSoapNoteStore) {
    if (key.startsWith(`${workspaceId}:${encounterId}:`)) rows.set(note.id, note);
  }
  return [...rows.values()].filter((note) => note.status !== "voided")
    .sort((a, b) => (b.clinicalAt ?? b.createdAt).localeCompare(a.clinicalAt ?? a.createdAt) || b.id.localeCompare(a.id));
}
export function putMockEncounterChart(workspaceId: string, note: SoapNote) {
  mockSoapNoteStore.set(`${workspaceId}:${note.encounterId}:${note.id}`, note);
}
export function createMockEncounterChart(workspaceId: string, encounterId: string, actorUserId: string, requestId: string, clinicalAt?: string, actorDisplayName?: string): SoapNote {
  const key = `${workspaceId}:${encounterId}:${requestId}`;
  const existingId = mockChartCreationRequests.get(key);
  const existing = getMockEncounterCharts(workspaceId, encounterId).find((note) => note.id === existingId);
  if (existing) return existing;
  const timestamp = new Date().toISOString();
  const note: SoapNote = { id: crypto.randomUUID(), encounterId, authorUserId: actorUserId,
    authorDisplayName: actorDisplayName,
    status: "draft", clinicalAt: clinicalAt ?? timestamp, createdAt: timestamp, updatedAt: timestamp };
  putMockEncounterChart(workspaceId, note);
  mockChartCreationRequests.set(key, note.id);
  return note;
}


export async function readChartSoapNote({
  actorUserId,
  encounterId,
  chartId,
  gateway = createMockChartSoapNoteGateway(),
  permissionAdapter = createDemoChartSoapPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  encounterId: string | null | undefined;
  chartId?: string | null;
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
    chartId: trimToUndefined(chartId),
    encounterId: normalizedEncounterId,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) return result;
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
    chartId: normalized.chartId,
    amendmentReason: normalized.amendmentReason,
    blockDocument: validation.blockDocument,
    encounterId: normalized.encounterId,
    expectedUpdatedAt: normalized.expectedUpdatedAt,
    fields: validation.fields,
    mode: normalized.mode,
    requestId: auditRequestId,
    workspaceId,
  });

  if (!result.ok) {
    if (result.status === 409) return result;
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  if (!result.soapNote) {
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  const hasTransactionalAudit =
    result.auditHandledBy === "database_transaction" &&
    result.auditRecorded === true &&
    typeof result.auditEventId === "string" &&
    result.auditEventId.trim().length > 0;
  let auditRecorded = hasTransactionalAudit;

  if (!hasTransactionalAudit) {
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
          documentSchemaVersion: validation.blockDocument.schemaVersion,
          blockCount: validation.blockCount,
        },
        metadata: { source: "chart-soap-note-persistence" },
      },
    });
    if (!audit.ok) return { ok: false, status: 500, error: "db_write_failed" };
    auditRecorded = true;
  }

  return {
    ok: true,
    status: 200,
    soapNote: result.soapNote,
    auditRecorded,
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
    async readSoapNote({ encounterId, chartId, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };

      const rows = getMockEncounterCharts(workspaceId, encounterId, seedSoapNotes);
      if (!chartId && rows.length > 1) return { ok: false, status: 409, denialReason: "chart_id_required" };
      const note = chartId ? rows.find((note) => note.id === chartId) ?? null : rows[0] ?? null;
      if (chartId && !note) return { ok: false, status: 409, denialReason: "chart_unavailable" };
      return { ok: true, soapNote: note };
    },
    async saveSoapNote({ actorUserId, chartId, amendmentReason, blockDocument, encounterId, expectedUpdatedAt, fields, mode, workspaceId }) {
      const encounter = findEncounter(encounters, workspaceId, encounterId);
      if (!encounter) return { ok: false, status: 409, denialReason: "encounter_unavailable" };
      if (!canMutateChart(encounter)) return { ok: false, status: 409, denialReason: "stale_status" };

      const rows = getMockEncounterCharts(workspaceId, encounterId, seedSoapNotes);
      if (!chartId && rows.length > 1) return { ok: false, status: 409, denialReason: "chart_id_required" };
      const stored = chartId ? rows.find((note) => note.id === chartId) : rows[0];
      if (chartId && !stored) return { ok: false, status: 409, denialReason: "chart_unavailable" };
      const isAmendment = stored?.status === "signed" || stored?.status === "amended";
      if (isAmendment && (mode !== "manual_save" || !amendmentReason?.trim())) {
        return { ok: false, status: 409, denialReason: "amendment_reason_required" };
      }
      if (chartId && expectedUpdatedAt === undefined) return { ok: false, status: 409, denialReason: "soap_note_conflict" };
      if (expectedUpdatedAt !== undefined) {
        if (stored && expectedUpdatedAt !== stored.updatedAt) {
          return { ok: false, status: 409, denialReason: "soap_note_conflict" };
        }
        if (!stored && expectedUpdatedAt !== null) {
          return { ok: false, status: 409, denialReason: "soap_note_conflict" };
        }
      }
      const timestamp = chartId && stored
        ? new Date(Math.max(Date.parse(now()), Date.parse(stored.updatedAt) + 1)).toISOString() : now();
      const soapNote: SoapNote = {
        id: stored?.id ?? `soap-${encounterId}`,
        encounterId,
        authorUserId: stored?.authorUserId ?? actorUserId,
        subjective: fields.subjective,
        objective: fields.objective,
        assessment: fields.assessment,
        plan: fields.plan,
        blockDocument,
        status: isAmendment ? "amended" : mode === "autosave" ? "autosaved" : "draft",
        autosavedAt: mode === "autosave" ? timestamp : stored?.autosavedAt,
        signedAt: stored?.signedAt,
        clinicalAt: stored?.clinicalAt ?? stored?.createdAt ?? timestamp,
        createdAt: stored?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };

      putMockEncounterChart(workspaceId, soapNote);

      return { ok: true, soapNote };
    },
  };
}

export type SupabaseChartSoapNoteRpcClient = {
  rpc(functionName: "clair_get_chart_soap_note_by_id", args: {
    p_workspace_id: string; p_encounter_id: string; p_chart_id: string;
  }): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(functionName: "clair_save_chart_soap_note_v4", args: {
    p_workspace_id: string; p_actor_user_id: string; p_encounter_id: string; p_chart_id: string;
    p_note: SoapDocumentProjection & { blockDocument: SoapBlockDocument };
    p_expected_updated_at: string | null; p_mode: ChartSoapSaveMode;
    p_request_id: string | null; p_amendment_reason: string | null;
  }): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_get_chart_soap_note",
    args: {
      p_workspace_id: string;
      p_encounter_id: string;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_save_chart_soap_note_v3",
    args: {
      p_workspace_id: string;
      p_actor_user_id: string;
      p_encounter_id: string;
      p_note: SoapDocumentProjection & { blockDocument: SoapBlockDocument };
      p_expected_updated_at?: string | null;
      p_mode: ChartSoapSaveMode;
      p_request_id?: string | null;
    }
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

export function createSupabaseChartSoapNoteGateway(
  client: SupabaseChartSoapNoteRpcClient
): ChartSoapNoteGateway {
  return {
    async readSoapNote({ encounterId, chartId, workspaceId }) {
      const { data, error } = chartId
        ? await client.rpc("clair_get_chart_soap_note_by_id", { p_workspace_id: workspaceId, p_encounter_id: encounterId, p_chart_id: chartId })
        : await client.rpc("clair_get_chart_soap_note", {
        p_workspace_id: workspaceId,
        p_encounter_id: encounterId,
      });

      if (error) {
        const conflict = mapChartSoapConflict(error.message);
        if (conflict) return { ok: false, status: 409, denialReason: conflict };
        if (error.message?.includes("encounter_unavailable")) {
          return { ok: false, status: 409, denialReason: "encounter_unavailable" };
        }
        return { ok: false, status: 500, error: "db_read_failed" };
      }

      return { ok: true, soapNote: mapSoapNote(data) };
    },
    async saveSoapNote({ actorUserId, chartId, amendmentReason, blockDocument, encounterId, expectedUpdatedAt, fields, mode, requestId, workspaceId }) {
      const args = {
        p_workspace_id: workspaceId,
        p_actor_user_id: actorUserId,
        p_encounter_id: encounterId,
        p_note: {
          ...fields,
          blockDocument,
        },
        p_expected_updated_at: expectedUpdatedAt ?? null,
        p_mode: mode,
        p_request_id: requestId ?? null,
      };
      const { data, error } = chartId
        ? await client.rpc("clair_save_chart_soap_note_v4", { ...args, p_chart_id: chartId, p_amendment_reason: amendmentReason ?? null })
        : await client.rpc("clair_save_chart_soap_note_v3", args);

      if (error) {
        const conflict = mapChartSoapConflict(error.message);
        if (conflict) return { ok: false, status: 409, denialReason: conflict };
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

      const transactionalAudit = mapTransactionalSoapAudit(data);
      return {
        ok: true,
        soapNote,
        ...(transactionalAudit ?? {}),
      };
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

function normalizeSoapInput(input: ChartSoapNoteInput) {
  return {
    encounterId: trimToUndefined(input.encounterId) ?? "",
    chartId: trimToUndefined(input.chartId),
    amendmentReason: trimToUndefined(input.amendmentReason),
    expectedUpdatedAt: normalizeExpectedUpdatedAt(input.expectedUpdatedAt),
    blockDocument: input.blockDocument,
    subjective: normalizeField(input.subjective),
    objective: normalizeField(input.objective),
    assessment: normalizeField(input.assessment),
    plan: normalizeField(input.plan),
    mode: input.mode === "manual_save" ? "manual_save" as const : "autosave" as const,
  };
}

function validateSoapInput(input: ReturnType<typeof normalizeSoapInput>) {
  const fieldErrors: Partial<Record<keyof ChartSoapNoteInput, string>> = {};
  let fields: SoapDocumentProjection = {
    assessment: input.assessment,
    objective: input.objective,
    plan: input.plan,
    subjective: input.subjective,
  };
  let blockDocument: SoapBlockDocument | undefined;
  let blockCount: number | undefined;

  if (input.amendmentReason && input.amendmentReason.length > 2000) fieldErrors.amendmentReason = "수정 사유는 2,000자 이내로 입력해 주세요.";
  if (!input.encounterId) fieldErrors.encounterId = "진료 차트를 선택해 주세요.";
  if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== null && Number.isNaN(Date.parse(input.expectedUpdatedAt))) {
    fieldErrors.expectedUpdatedAt = "SOAP 기준 저장 시각이 올바르지 않습니다.";
  }

  if (input.blockDocument === undefined) {
    fieldErrors.blockDocument = "SOAP 블록 문서가 필요합니다.";
  } else {
    const documentResult = validateAndProjectSoapDocument(input.blockDocument);
    if (!documentResult.ok) {
      fieldErrors.blockDocument = getSoapDocumentValidationMessage(documentResult.error);
    } else {
      fields = documentResult.projection;
      blockDocument = documentResult.document;
      blockCount = documentResult.blockCount;
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { valid: false as const, fieldErrors };
  }

  return {
    valid: true as const,
    fieldErrors: {},
    fields,
    blockDocument: blockDocument as SoapBlockDocument,
    blockCount: blockCount ?? 0,
  };
}

function getSoapDocumentValidationMessage(error: string) {
  if (error === "unsupported_schema_version") {
    return "지원하지 않는 SOAP 문서 버전입니다.";
  }
  if (error === "document_too_large" || error === "field_too_long") {
    return "SOAP 문서가 허용된 크기를 초과했습니다.";
  }
  return "SOAP 문서 구조가 올바르지 않습니다.";
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

function projectionToUndefined(value?: string | null) {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/^[ \t\n\r\f\v]+|[ \t\n\r\f\v]+$/g, "");
  return normalized || undefined;
}

export function mapSoapNote(value: unknown): SoapNote | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<SoapNote>;

  if (
    typeof row.id !== "string" ||
    typeof row.encounterId !== "string" ||
    typeof row.status !== "string" ||
    typeof row.createdAt !== "string" ||
    typeof row.updatedAt !== "string"
  ) {
    return null;
  }

  const mapped: SoapNote = {
    id: row.id,
    encounterId: row.encounterId,
    authorUserId: trimToUndefined(row.authorUserId),
    authorDisplayName: trimToUndefined(row.authorDisplayName),
    subjective: projectionToUndefined(row.subjective),
    objective: projectionToUndefined(row.objective),
    assessment: projectionToUndefined(row.assessment),
    plan: projectionToUndefined(row.plan),
    status: row.status as SoapNote["status"],
    autosavedAt: trimToUndefined(row.autosavedAt),
    signedAt: trimToUndefined(row.signedAt),
    createdAt: row.createdAt,
    clinicalAt: trimToUndefined(row.clinicalAt) ?? row.createdAt,
    updatedAt: row.updatedAt,
  };

  if (row.blockDocument !== undefined) {
    const documentResult = validateAndProjectSoapDocument(row.blockDocument);
    if (documentResult.ok) {
      mapped.blockDocument = documentResult.document;
    } else {
      mapped.blockDocumentError = "invalid_stored_document";
    }
  }

  return mapped;
}

function mapTransactionalSoapAudit(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    auditHandledBy?: unknown;
    auditRecorded?: unknown;
    auditEventId?: unknown;
    audit_handled_by?: unknown;
    audit_recorded?: unknown;
    audit_event_id?: unknown;
  };
  const handledBy = row.auditHandledBy ?? row.audit_handled_by;
  const recorded = row.auditRecorded ?? row.audit_recorded;
  const eventId = row.auditEventId ?? row.audit_event_id;
  if (handledBy !== "database_transaction" || typeof recorded !== "boolean") {
    return null;
  }

  return {
    auditHandledBy: "database_transaction" as const,
    auditRecorded: recorded,
    ...(typeof eventId === "string" && eventId.trim()
      ? { auditEventId: eventId.trim() }
      : {}),
  };
}

export function mapChartSoapConflict(message?: string): ChartSoapConflictReason | undefined {
  return (["encounter_unavailable", "soap_note_conflict", "stale_status", "chart_unavailable", "chart_id_required", "amendment_reason_required", "unfinished_charts"] as const)
    .find((reason) => message?.includes(reason));
}
