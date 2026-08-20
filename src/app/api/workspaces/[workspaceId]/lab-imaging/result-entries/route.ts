import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
import { demoClientSessionIdHeader } from "@/features/auth/demo-actor";
import { resolveWorkspacePermission } from "@/features/auth/permission-resolver";
import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";
import {
  createSupabaseWorkspacePermissionGateway,
  type SupabaseWorkspacePermissionClient,
} from "@/features/auth/supabase-workspace-permission-gateway";
import {
  emitLiveNotificationEvent,
  type LiveNotificationEventInput,
} from "@/features/notifications/server-notifications";
import {
  emitPersistedLiveNotificationEvent,
  type NotificationPersistenceGateway,
} from "@/features/notifications/server-notification-persistence";
import { enforceWorkspaceMutationRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

type LabResultEntryRow = {
  analyteName: string;
  id: string;
  judgment?: string;
  labTestItemId?: string;
  note?: string;
  referenceRange?: string;
  unit?: string;
  value?: string;
};

type LabResultEntryWriteRow = {
  note: string | null;
  rowId: string;
  value: string | null;
};

type LabResultEntrySnapshot = {
  actorUserId?: string;
  createdAt: string;
  encounterId?: string;
  orderId?: string;
  resultId: string;
  rows: Array<LabResultEntryRow | LabResultEntryWriteRow>;
  updatedAt: string;
  workItemId?: string;
  workspaceId: string;
};

type LabResultEntryBody = {
  encounterId?: string;
  expectedEntryWriteRevision?: number;
  invalidPayload?: boolean;
  orderId?: string;
  resultId?: string;
  requestId?: string;
  rows: Array<LabResultEntryRow | LabResultEntryWriteRow>;
  workItemId?: string;
};

type SupabaseLabResultEntryRpcClient = {
  rpc(
    functionName: "clair_get_lab_result_entry",
    args: {
      p_actor_user_id: string;
      p_order_id?: string | null;
      p_result_id?: string | null;
      p_work_item_id?: string | null;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_save_lab_result_entry_v2",
    args: {
      p_actor_user_id: string;
      p_encounter_id: string;
      p_expected_entry_write_revision: number;
      p_order_id: string;
      p_result_id: string;
      p_request_id: string;
      p_rows: LabResultEntryWriteRow[];
      p_work_item_id?: string | null;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

const labResultEntrySnapshots = new Map<string, LabResultEntrySnapshot>();

export async function GET(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = await resolveRequestIdentity(request);

  if (!identity.ok) return Response.json(identity.body, { status: 401 });

  const url = new URL(request.url);
  const input = {
    orderId: readOptionalParam(url, "orderId"),
    resultId: readOptionalParam(url, "resultId"),
    workItemId: readOptionalParam(url, "workItemId"),
  };

  if (identity.source === "supabase_session") {
    const client = await createClient();
    if (!client) {
      return Response.json(
        { ok: false, status: 500, error: "supabase_client_missing" },
        { status: 500 },
      );
    }

    const permission = await resolveLabResultRoutePermission({
      client,
      requiredPermission: "lab:view",
      sessionUserId: identity.actorUserId,
      workspaceId,
    });
    if (!permission.ok) return Response.json(permission.body, { status: permission.status });

    const result = await readSupabaseLabResultEntry({
      actorUserId: identity.actorUserId,
      client: client as unknown as SupabaseLabResultEntryRpcClient,
      input,
      workspaceId,
    });
    return Response.json(result, { status: result.status });
  }

  return Response.json(
    {
      ok: true,
      status: 200,
      savedResult: readDemoLabResultEntry({ workspaceId, ...input }),
      enforcedBy: "lab-result-entry-server-boundary",
    },
    { status: 200 },
  );
}

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const identity = await resolveRequestIdentity(request);

  if (!identity.ok) return Response.json(identity.body, { status: 401 });

  const rateLimitResponse = enforceWorkspaceMutationRateLimit({
    request,
    actorUserId: identity.actorUserId,
    workspaceId,
    operation: "lab_result_entry_save",
  });
  if (rateLimitResponse) return rateLimitResponse;

  const input = await readEntryBody(request);
  if (input.invalidPayload || !input.resultId || !input.rows.length) {
    return Response.json(
      {
        ok: false,
        status: 400,
        error: "invalid_lab_result_entry_payload",
      },
      { status: 400 },
    );
  }

  if (identity.source === "supabase_session") {
    if (
      !input.encounterId ||
      !input.orderId ||
      input.expectedEntryWriteRevision === undefined ||
      !input.requestId ||
      !isUuid(input.requestId)
    ) {
      return Response.json(
        {
          ok: false,
          status: 400,
          error: "invalid_lab_result_entry_payload",
        },
        { status: 400 },
      );
    }

    const client = await createClient();
    if (!client) {
      return Response.json(
        { ok: false, status: 500, error: "supabase_client_missing" },
        { status: 500 },
      );
    }

    const permission = await resolveLabResultRoutePermission({
      client,
      requiredPermission: "lab:complete",
      sessionUserId: identity.actorUserId,
      workspaceId,
    });
    if (!permission.ok) return Response.json(permission.body, { status: permission.status });

    const result = await saveSupabaseLabResultEntry({
      actorUserId: identity.actorUserId,
      client: client as unknown as SupabaseLabResultEntryRpcClient,
      input: {
        encounterId: input.encounterId,
        orderId: input.orderId,
        resultId: input.resultId,
        rows: input.rows,
        expectedEntryWriteRevision: input.expectedEntryWriteRevision,
        requestId: input.requestId,
        workItemId: input.workItemId,
      },
      workspaceId,
    });
    // Canonical B1 saves mutate only values/notes. They intentionally do not
    // call createSupabaseNotificationPersistenceGateway or emit a completion
    // event; that belongs to a later review transition. Demo mode below keeps
    // the existing in-memory notification behavior.
    return Response.json(result, { status: result.status });
  }

  const snapshot = saveDemoLabResultEntry({
    actorUserId: identity.actorUserId,
    input: { ...input, resultId: input.resultId },
    workspaceId,
  });
  const emittedNotifications = await emitClinicalResultCompletedNotification({
    actorUserId: identity.actorUserId,
    eventScopeId: getDemoNotificationEventScopeId({ identity, request }),
    snapshot,
  });

  return Response.json(
    {
      ok: true,
      status: 200,
      savedResult: snapshot,
      emittedNotifications,
      enforcedBy: "lab-result-entry-server-boundary",
    },
    { status: 200 },
  );
}

async function resolveRequestIdentity(request: Request): Promise<
  | {
      ok: true;
      actorUserId: string;
      source: "demo_header_mock_mode" | "supabase_session";
    }
  | {
      ok: false;
      body: {
        denialReason: "unauthenticated";
        ok: false;
        sessionReason?: string;
        sessionStatus: string;
      };
    }
> {
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (identity.ok) return identity;

  return {
    ok: false,
    body: {
      ok: false,
      denialReason: identity.denialReason,
      sessionStatus: identity.sessionStatus,
      sessionReason: identity.sessionReason,
    },
  };
}

async function resolveLabResultRoutePermission({
  client,
  requiredPermission,
  sessionUserId,
  workspaceId,
}: {
  client: unknown;
  requiredPermission: "lab:complete" | "lab:view";
  sessionUserId: string;
  workspaceId: string;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      status: 401 | 403 | 500;
      body: {
        denialReason?: string;
        error?: "permission_read_failed";
        ok: false;
        status: 401 | 403 | 500;
      };
    }
> {
  try {
    const permissionAdapter = await loadWorkspacePermissionAdapterFromDb({
      gateway: createSupabaseWorkspacePermissionGateway(
        client as SupabaseWorkspacePermissionClient,
      ),
      workspaceId,
      sessionUserId,
    });
    const permission = resolveWorkspacePermission(permissionAdapter, {
      requiredPermission,
      sessionUserId,
      workspaceId,
    });

    if (!permission.allowed) {
      const status = permission.denialReason === "unauthenticated" ? 401 : 403;
      return {
        ok: false,
        status,
        body: {
          ok: false,
          status,
          denialReason: permission.denialReason ?? "permission_missing",
        },
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      status: 500,
      body: { ok: false, status: 500, error: "permission_read_failed" },
    };
  }
}

async function readSupabaseLabResultEntry({
  actorUserId,
  client,
  input,
  workspaceId,
}: {
  actorUserId: string;
  client: SupabaseLabResultEntryRpcClient;
  input: {
    orderId?: string;
    resultId?: string;
    workItemId?: string;
  };
  workspaceId: string;
}) {
  const { data, error } = await client.rpc("clair_get_lab_result_entry", {
    p_actor_user_id: actorUserId,
    p_workspace_id: workspaceId,
    p_result_id: input.resultId ?? null,
    p_work_item_id: input.workItemId ?? null,
    p_order_id: input.orderId ?? null,
  });

  if (error) return mapSupabaseLabResultError(error.message, "read");
  return normalizeSupabaseLabResultEntryResponse(data, "read");
}

async function saveSupabaseLabResultEntry({
  actorUserId,
  client,
  input,
  workspaceId,
}: {
  actorUserId: string;
  client: SupabaseLabResultEntryRpcClient;
  input: Required<
    Pick<LabResultEntryBody, "encounterId" | "orderId" | "resultId" | "rows">
  > &
    Pick<
      LabResultEntryBody,
      "expectedEntryWriteRevision" | "requestId" | "workItemId"
    >;
  workspaceId: string;
}) {
  const writeRows = input.rows.filter(isLabResultEntryWriteRow);
  if (
    writeRows.length !== input.rows.length ||
    input.expectedEntryWriteRevision === undefined ||
    !input.requestId ||
    !isUuid(input.requestId)
  ) {
    return {
      ok: false,
      status: 400,
      error: "invalid_lab_result_entry_payload",
    };
  }

  const { data, error } = await client.rpc("clair_save_lab_result_entry_v2", {
    p_workspace_id: workspaceId,
    p_actor_user_id: actorUserId,
    p_result_id: input.resultId,
    p_encounter_id: input.encounterId,
    p_order_id: input.orderId,
    p_work_item_id: input.workItemId ?? null,
    p_expected_entry_write_revision: input.expectedEntryWriteRevision,
    p_request_id: input.requestId,
    p_rows: writeRows,
  });

  if (error) return mapSupabaseLabResultError(error.message, "write");
  return normalizeSupabaseLabResultEntryResponse(data, "write");
}

function normalizeSupabaseLabResultEntryResponse(data: unknown, operation: "read" | "write") {
  if (!data || typeof data !== "object") {
    return {
      ok: false,
      status: 500,
      error: operation === "read" ? "db_read_failed" : "db_write_failed",
    };
  }

  const response = data as Record<string, unknown>;
  return {
    ...response,
    ok: response.ok === true,
    status: typeof response.status === "number" ? response.status : 200,
  } as {
    ok: boolean;
    status: number;
    [key: string]: unknown;
  };
}

function mapSupabaseLabResultError(message: string | undefined, operation: "read" | "write") {
  if (message?.includes("workspace_membership_missing")) {
    return { ok: false, status: 403, denialReason: "workspace_membership_missing" };
  }
  if (message?.includes("permission_missing")) {
    return { ok: false, status: 403, denialReason: "permission_missing" };
  }
  if (message?.includes("actor_mismatch")) {
    return { ok: false, status: 403, denialReason: "actor_mismatch" };
  }
  if (message?.includes("invalid_lab_result_entry_payload")) {
    return { ok: false, status: 400, error: "invalid_lab_result_entry_payload" };
  }
  if (message?.includes("encounter_unavailable")) {
    return { ok: false, status: 409, denialReason: "encounter_unavailable" };
  }
  if (message?.includes("order_unavailable")) {
    return { ok: false, status: 409, denialReason: "order_unavailable" };
  }
  if (message?.includes("work_item_unavailable")) {
    return { ok: false, status: 409, denialReason: "work_item_unavailable" };
  }
  if (message?.includes("entry_write_revision_conflict")) {
    return { ok: false, status: 409, denialReason: "entry_write_revision_conflict" };
  }
  if (message?.includes("entry_request_id_conflict")) {
    return { ok: false, status: 409, denialReason: "entry_request_id_conflict" };
  }
  if (
    message?.includes("entry_write_revision_required") ||
    message?.includes("invalid_request_id")
  ) {
    return { ok: false, status: 400, error: "invalid_lab_result_entry_payload" };
  }
  if (message?.includes("lab_result_identity_mismatch")) {
    return { ok: false, status: 409, denialReason: "lab_result_identity_mismatch" };
  }
  if (message?.includes("lab_result_status_read_only")) {
    return { ok: false, status: 409, denialReason: "lab_result_status_read_only" };
  }
  if (message?.includes("lab_result_not_frozen")) {
    return { ok: false, status: 409, denialReason: "lab_result_not_frozen" };
  }

  return {
    ok: false,
    status: 500,
    error: operation === "read" ? "db_read_failed" : "db_write_failed",
  };
}

function saveDemoLabResultEntry({
  actorUserId,
  input,
  workspaceId,
}: {
  actorUserId: string;
  input: LabResultEntryBody & { resultId: string };
  workspaceId: string;
}) {
  const now = new Date().toISOString();
  const key = `${workspaceId}:${input.resultId}`;
  const existing = labResultEntrySnapshots.get(key);
  const snapshot: LabResultEntrySnapshot = {
    actorUserId,
    createdAt: existing?.createdAt ?? now,
    encounterId: input.encounterId,
    orderId: input.orderId,
    resultId: input.resultId,
    rows: input.rows,
    updatedAt: now,
    workItemId: input.workItemId,
    workspaceId,
  };
  labResultEntrySnapshots.set(key, snapshot);
  return snapshot;
}

function readDemoLabResultEntry({
  orderId,
  resultId,
  workItemId,
  workspaceId,
}: {
  orderId?: string;
  resultId?: string;
  workItemId?: string;
  workspaceId: string;
}) {
  if (resultId) return labResultEntrySnapshots.get(`${workspaceId}:${resultId}`) ?? null;

  return (
    Array.from(labResultEntrySnapshots.values()).find(
      (snapshot) =>
        snapshot.workspaceId === workspaceId &&
        (!orderId || snapshot.orderId === orderId) &&
        (!workItemId || snapshot.workItemId === workItemId),
    ) ?? null
  );
}

async function emitClinicalResultCompletedNotification({
  actorUserId,
  eventScopeId,
  notificationPersistenceGateway,
  snapshot,
}: {
  actorUserId: string;
  eventScopeId?: string | null;
  notificationPersistenceGateway?: NotificationPersistenceGateway;
  snapshot: LabResultEntrySnapshot;
}): Promise<{
  clinicalResultCompleted: number;
  emissionIssues?: Array<{
    eventKey: "clinical_result_completed";
    reason: string;
  }>;
}> {
  const event = buildClinicalResultCompletedNotificationEvent({
    actorUserId,
    eventScopeId,
    snapshot,
  });

  if (notificationPersistenceGateway) {
    const result = await emitPersistedLiveNotificationEvent({
      event,
      gateway: notificationPersistenceGateway,
    });

    if (result.ok) return { clinicalResultCompleted: 1 };

    return {
      clinicalResultCompleted: 0,
      emissionIssues: [
        {
          eventKey: "clinical_result_completed",
          reason:
            result.denialReason ??
            result.error ??
            "notification_persistence_failed",
        },
      ],
    };
  }

  emitLiveNotificationEvent({ event });
  return { clinicalResultCompleted: 1 };
}

function buildClinicalResultCompletedNotificationEvent({
  actorUserId,
  eventScopeId,
  snapshot,
}: {
  actorUserId: string;
  eventScopeId?: string | null;
  snapshot: LabResultEntrySnapshot;
}): LiveNotificationEventInput {
  const sourceRoute = `/w/${snapshot.workspaceId}/lab?modulePanel=open&labResultId=${encodeURIComponent(snapshot.resultId)}`;
  const resultLabel = snapshot.orderId ?? snapshot.resultId;

  return {
    workspaceId: snapshot.workspaceId,
    eventKey: "clinical_result_completed",
    dedupeKey: `${snapshot.encounterId ?? snapshot.resultId}-${snapshot.orderId ?? snapshot.resultId}-clinical_result_completed`,
    domain: "lab",
    priority: "normal",
    toastPolicy: "role_active",
    title: "검사 결과가 도착했습니다",
    preview: "담당 수의사 확인 대기 · 결과 화면에서 세부 수치를 확인하세요.",
    detail:
      "검사 결과 입력이 완료되었습니다. 담당 수의사는 원본 검사 결과 화면에서 세부 수치와 판정을 확인하세요.",
    workTypeLabel: "검사",
    sourceLabel: `임상병리검사 · ${resultLabel}`,
    sourceActionLabel: "검사 결과 열기",
    recipient: { kind: "role_queue", id: "vet", label: "수의사" },
    source: {
      kind: "lab_result",
      route: sourceRoute,
      entity_id: snapshot.resultId,
    },
    requiresAction: true,
    badgeCount: true,
    actorUserId,
    eventScopeId,
    occurredAt: snapshot.updatedAt,
    issuedAtLabel: "방금 전",
  };
}

function getDemoNotificationEventScopeId({
  identity,
  request,
}: {
  identity: Extract<Awaited<ReturnType<typeof resolveRequestIdentity>>, { ok: true }>;
  request: Request;
}) {
  if (identity.source !== "demo_header_mock_mode") return null;
  return request.headers.get(demoClientSessionIdHeader);
}

async function readEntryBody(request: Request): Promise<LabResultEntryBody> {
  try {
    const value = (await request.json()) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { rows: [], invalidPayload: true };
    }
    const row = value as Record<string, unknown>;
    const allowedKeys = new Set([
      "encounterId",
      "expectedEntryWriteRevision",
      "orderId",
      "resultId",
      "requestId",
      "rows",
      "workItemId",
    ]);
    if (Object.keys(row).some((key) => !allowedKeys.has(key))) {
      return { rows: [], invalidPayload: true };
    }
    if ("rows" in row && !Array.isArray(row.rows)) {
      return { rows: [], invalidPayload: true };
    }
    const parsedRows = Array.isArray(row.rows)
      ? row.rows.map(readStrictResultWriteRow)
      : [];
    if (parsedRows.some((parsed) => parsed === null)) {
      return { rows: [], invalidPayload: true };
    }
    const optionalStringKeys = [
      "encounterId",
      "orderId",
      "resultId",
      "requestId",
      "workItemId",
    ] as const;
    if (
      optionalStringKeys.some(
        (key) => key in row && typeof row[key] !== "string",
      )
    ) {
      return { rows: [], invalidPayload: true };
    }
    if (
      "expectedEntryWriteRevision" in row &&
      !(
        typeof row.expectedEntryWriteRevision === "number" &&
        Number.isInteger(row.expectedEntryWriteRevision) &&
        row.expectedEntryWriteRevision >= 0
      )
    ) {
      return { rows: [], invalidPayload: true };
    }

    return {
      encounterId: readString(row.encounterId),
      expectedEntryWriteRevision: row.expectedEntryWriteRevision as
        | number
        | undefined,
      orderId: readString(row.orderId),
      resultId: readString(row.resultId),
      rows: parsedRows.filter(
        (parsed): parsed is LabResultEntryRow | LabResultEntryWriteRow =>
          parsed !== null,
      ),
      requestId: readString(row.requestId),
      workItemId: readString(row.workItemId),
    };
  } catch {
    return { rows: [], invalidPayload: true };
  }
}

function readStrictResultWriteRow(
  value: unknown,
): LabResultEntryRow | LabResultEntryWriteRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if ("rowId" in row) {
    if (
      Object.keys(row).some((key) => !["rowId", "value", "note"].includes(key)) ||
      Object.keys(row).length !== 3 ||
      typeof row.rowId !== "string" ||
      !row.rowId.trim() ||
      !(row.value === null || typeof row.value === "string") ||
      !(row.note === null || typeof row.note === "string")
    ) {
      return null;
    }
    return {
      note: row.note,
      rowId: row.rowId,
      value: row.value,
    };
  }
  const allowedLegacyKeys = [
    "analyteName",
    "id",
    "judgment",
    "labTestItemId",
    "note",
    "referenceRange",
    "unit",
    "value",
  ];
  if (
    Object.keys(row).some((key) => !allowedLegacyKeys.includes(key)) ||
    typeof row.id !== "string" ||
    typeof row.analyteName !== "string" ||
    Object.entries(row).some(
      ([key, field]) =>
        key !== "id" &&
        key !== "analyteName" &&
        field !== undefined &&
        field !== null &&
        typeof field !== "string",
    )
  ) {
    return null;
  }
  return {
    analyteName: row.analyteName,
    id: row.id,
    judgment: typeof row.judgment === "string" ? row.judgment : undefined,
    labTestItemId:
      typeof row.labTestItemId === "string" ? row.labTestItemId : undefined,
    note: typeof row.note === "string" ? row.note : undefined,
    referenceRange:
      typeof row.referenceRange === "string" ? row.referenceRange : undefined,
    unit: typeof row.unit === "string" ? row.unit : undefined,
    value: typeof row.value === "string" ? row.value : undefined,
  };
}

function isLabResultEntryWriteRow(
  row: LabResultEntryRow | LabResultEntryWriteRow,
): row is LabResultEntryWriteRow {
  return "rowId" in row;
}

function readOptionalParam(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim();
  return value ? value : undefined;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
