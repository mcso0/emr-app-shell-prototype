import { readServerSession } from "@/features/auth/server-session-reader";
import {
  demoSessionUserIdHeader,
  resolveRoleUpdateActorIdentity,
} from "@/features/auth/server-role-update-identity";

type RouteContext = {
  params: Promise<{
    workspaceId: string;
  }>;
};

type LabResultEntrySnapshot = {
  actorUserId: string;
  createdAt: string;
  encounterId?: string;
  orderId?: string;
  resultId: string;
  rows: Array<{
    analyteName: string;
    id: string;
    judgment?: string;
    unit?: string;
    value?: string;
  }>;
  updatedAt: string;
  workItemId?: string;
  workspaceId: string;
};

const labResultEntrySnapshots = new Map<string, LabResultEntrySnapshot>();

export async function POST(request: Request, { params }: RouteContext) {
  const { workspaceId } = await params;
  const serverSession = await readServerSession();
  const identity = resolveRoleUpdateActorIdentity({
    serverSession,
    demoHeaderUserId: request.headers.get(demoSessionUserIdHeader),
  });

  if (!identity.ok) {
    return Response.json(
      {
        ok: false,
        denialReason: identity.denialReason,
        sessionStatus: identity.sessionStatus,
        sessionReason: identity.sessionReason,
      },
      { status: 401 },
    );
  }

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

  const now = new Date().toISOString();
  const key = `${workspaceId}:${input.resultId}`;
  const existing = labResultEntrySnapshots.get(key);
  const snapshot: LabResultEntrySnapshot = {
    actorUserId: identity.actorUserId,
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

async function readEntryBody(request: Request): Promise<{
  encounterId?: string;
  orderId?: string;
  resultId?: string;
  rows: LabResultEntrySnapshot["rows"];
  workItemId?: string;
}> {
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

function readResultRow(value: unknown): LabResultEntrySnapshot["rows"][number] | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = readString(row.id);
  const analyteName = readString(row.analyteName);
  if (!id || !analyteName) return null;

  return {
    analyteName,
    id,
    judgment: readString(row.judgment),
    unit: readString(row.unit),
    value: readString(row.value),
  };
}

function isLabResultEntryRow(
  row: LabResultEntrySnapshot["rows"][number] | null,
): row is LabResultEntrySnapshot["rows"][number] {
  return row !== null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}
