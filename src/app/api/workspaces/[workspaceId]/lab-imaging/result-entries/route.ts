import { loadWorkspacePermissionAdapterFromDb } from "@/features/auth/db-workspace-permission-adapter";
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

type LabResultEntrySnapshot = {
  actorUserId: string;
  createdAt: string;
  encounterId?: string;
  orderId?: string;
  resultId: string;
  rows: LabResultEntryRow[];
  updatedAt: string;
  workItemId?: string;
  workspaceId: string;
};

type LabResultEntryBody = {
  encounterId?: string;
  orderId?: string;
  resultId?: string;
  rows: LabResultEntryRow[];
  workItemId?: string;
};

type SupabaseLabResultEntryRpcClient = {
  rpc(
    functionName: "clair_get_lab_result_entry",
    args: {
      p_order_id?: string | null;
      p_result_id?: string | null;
      p_work_item_id?: string | null;
      p_workspace_id: string;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  rpc(
    functionName: "clair_save_lab_result_entry",
    args: {
      p_actor_user_id: string;
      p_encounter_id: string;
      p_order_id: string;
      p_result_id: string;
      p_rows: LabResultEntryRow[];
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

  const input = await readEntryBody(request);
  if (!input.resultId || !input.rows.length) {
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
    if (!input.encounterId || !input.orderId) {
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
        workItemId: input.workItemId,
      },
      workspaceId,
    });
    return Response.json(result, { status: result.status });
  }

  const snapshot = saveDemoLabResultEntry({
    actorUserId: identity.actorUserId,
    input: { ...input, resultId: input.resultId },
    workspaceId,
  });

  return Response.json(
    {
      ok: true,
      status: 200,
      savedResult: snapshot,
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
  client,
  input,
  workspaceId,
}: {
  client: SupabaseLabResultEntryRpcClient;
  input: {
    orderId?: string;
    resultId?: string;
    workItemId?: string;
  };
  workspaceId: string;
}) {
  const { data, error } = await client.rpc("clair_get_lab_result_entry", {
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
  input: Required<Pick<LabResultEntryBody, "encounterId" | "orderId" | "resultId" | "rows">> &
    Pick<LabResultEntryBody, "workItemId">;
  workspaceId: string;
}) {
  const { data, error } = await client.rpc("clair_save_lab_result_entry", {
    p_workspace_id: workspaceId,
    p_actor_user_id: actorUserId,
    p_result_id: input.resultId,
    p_encounter_id: input.encounterId,
    p_order_id: input.orderId,
    p_work_item_id: input.workItemId ?? null,
    p_rows: input.rows,
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

async function readEntryBody(request: Request): Promise<LabResultEntryBody> {
  try {
    const value = (await request.json()) as unknown;
    if (!value || typeof value !== "object") return { rows: [] };
    const row = value as Record<string, unknown>;

    return {
      encounterId: readString(row.encounterId),
      orderId: readString(row.orderId),
      resultId: readString(row.resultId),
      rows: Array.isArray(row.rows)
        ? row.rows.map(readResultRow).filter(isLabResultEntryRow)
        : [],
      workItemId: readString(row.workItemId),
    };
  } catch {
    return { rows: [] };
  }
}

function readResultRow(value: unknown): LabResultEntryRow | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = readString(row.id);
  const analyteName = readString(row.analyteName);
  if (!id || !analyteName) return null;

  return {
    analyteName,
    id,
    judgment: readString(row.judgment),
    labTestItemId: readString(row.labTestItemId),
    note: readString(row.note),
    referenceRange: readString(row.referenceRange),
    unit: readString(row.unit),
    value: readString(row.value),
  };
}

function isLabResultEntryRow(row: LabResultEntryRow | null): row is LabResultEntryRow {
  return row !== null;
}

function readOptionalParam(url: URL, key: string) {
  const value = url.searchParams.get(key)?.trim();
  return value ? value : undefined;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}
