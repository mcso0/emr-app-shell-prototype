import {
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";

const maxStatusMessageCodePoints = 60;

export type WorkspaceStatusMessageWriteInput = {
  expectedUpdatedAt: string | null;
  message: string | null;
  userId: string;
  workspaceId: string;
};

export type WorkspaceStatusMessageGateway = {
  writeStatusMessage(
    input: WorkspaceStatusMessageWriteInput,
  ): Promise<
    | { ok: true; message: string | null; updatedAt: string | null }
    | { ok: false; error: "conflict" | "db_write_failed" }
  >;
};

export type SupabaseWorkspaceStatusMessageClient = {
  rpc(
    functionName: "clair_set_my_workspace_status_message",
    args: {
      p_expected_updated_at: string | null;
      p_status_message: string | null;
      p_workspace_id: string;
    },
  ): Promise<{
    data: unknown;
    error: { code?: string; message?: string } | null;
  }>;
};

export type WorkspaceStatusMessageUpdateResult =
  | {
      ok: true;
      status: 200;
      enforcedBy: "workspace-status-message-self-write";
      message: string | null;
      updatedAt: string | null;
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_status_message" | "invalid_version";
    }
  | {
      ok: false;
      status: 401 | 403;
      denialReason: WorkspacePermissionDenialReason;
    }
  | { ok: false; status: 409; error: "status_message_conflict" }
  | { ok: false; status: 500; error: "db_write_failed" };

export async function updateWorkspaceStatusMessage({
  actorUserId,
  expectedUpdatedAt,
  gateway,
  message,
  permissionAdapter,
  workspaceId,
}: {
  actorUserId: string | null;
  expectedUpdatedAt: string | null;
  gateway: WorkspaceStatusMessageGateway;
  message: string;
  permissionAdapter: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<WorkspaceStatusMessageUpdateResult> {
  const permission = resolveWorkspacePermission(permissionAdapter, {
    sessionUserId: actorUserId,
    workspaceId,
  });
  if (!permission.allowed || !actorUserId) {
    return {
      ok: false,
      status: permission.denialReason === "unauthenticated" ? 401 : 403,
      denialReason: permission.denialReason ?? "permission_missing",
    };
  }

  const normalized = message.trim();
  if (Array.from(normalized).length > maxStatusMessageCodePoints) {
    return { ok: false, status: 400, error: "invalid_status_message" };
  }
  if (
    expectedUpdatedAt !== null &&
    (!expectedUpdatedAt || Number.isNaN(Date.parse(expectedUpdatedAt)))
  ) {
    return { ok: false, status: 400, error: "invalid_version" };
  }

  const result = await gateway.writeStatusMessage({
    expectedUpdatedAt,
    message: normalized || null,
    userId: actorUserId,
    workspaceId,
  });
  if (!result.ok) {
    return result.error === "conflict"
      ? { ok: false, status: 409, error: "status_message_conflict" }
      : { ok: false, status: 500, error: "db_write_failed" };
  }

  return {
    ok: true,
    status: 200,
    enforcedBy: "workspace-status-message-self-write",
    message: result.message,
    updatedAt: result.updatedAt,
  };
}

export function createSupabaseWorkspaceStatusMessageGateway(
  client: SupabaseWorkspaceStatusMessageClient,
): WorkspaceStatusMessageGateway {
  return {
    async writeStatusMessage({ expectedUpdatedAt, message, workspaceId }) {
      try {
        const { data, error } = await client.rpc(
          "clair_set_my_workspace_status_message",
          {
            p_expected_updated_at: expectedUpdatedAt,
            p_status_message: message,
            p_workspace_id: workspaceId,
          },
        );
        if (error) {
          return error.message?.includes("status_message_conflict")
            ? { ok: false, error: "conflict" }
            : { ok: false, error: "db_write_failed" };
        }
        const parsed = parseStatusMessageRpcResult(data);
        return parsed ?? { ok: false, error: "db_write_failed" };
      } catch {
        return { ok: false, error: "db_write_failed" };
      }
    },
  };
}

function parseStatusMessageRpcResult(
  value: unknown,
): { ok: true; message: string | null; updatedAt: string | null } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const message = row.message;
  const updatedAt = row.updatedAt;
  if (message !== null && typeof message !== "string") return null;
  if (updatedAt !== null && typeof updatedAt !== "string") return null;
  if (typeof updatedAt === "string" && Number.isNaN(Date.parse(updatedAt)))
    return null;
  if (message === null && updatedAt !== null) return null;
  if (
    typeof message === "string" &&
    (!message ||
      message !== message.trim() ||
      Array.from(message).length > maxStatusMessageCodePoints)
  ) {
    return null;
  }
  return { ok: true, message, updatedAt };
}
