import "server-only";

import {
  createSessionWorkspace,
  type SessionWorkspaceCreation,
  type WorkspaceCreationFieldErrors,
  type WorkspaceCreationInput,
  validateWorkspaceCreationInput,
} from "@/features/auth/workspace-session";

export type WorkspaceCreationRouteInput = {
  hospitalName: string;
  adminDisplayName: string;
  contactEmail: string;
  contactPhone: string;
};

export type WorkspaceCreationWrite = {
  workspaceId: string;
  displayName: string;
  representativeName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  creatorUserId: string;
  subscriptionStatus: "trialing";
  now: string;
};

export type WorkspaceCreationGatewayResult =
  | { ok: true; creation: SessionWorkspaceCreation }
  | { ok: false; status: 409; denialReason: "duplicate_workspace" }
  | { ok: false; status: 500; error: "db_write_failed" };

export type WorkspaceCreationGateway = {
  createWorkspaceWithCreator(
    write: WorkspaceCreationWrite
  ): Promise<WorkspaceCreationGatewayResult>;
};

export type WorkspaceCreationResult =
  | {
      ok: true;
      status: 201;
      workspace: SessionWorkspaceCreation["workspace"];
      membership: SessionWorkspaceCreation["membership"];
      enforcedBy: "workspace-creation-server-route";
    }
  | {
      ok: false;
      status: 400;
      error: "invalid_input";
      fieldErrors: WorkspaceCreationFieldErrors;
    }
  | {
      ok: false;
      status: 401;
      denialReason: "unauthenticated";
    }
  | {
      ok: false;
      status: 409;
      denialReason: "duplicate_workspace";
    }
  | {
      ok: false;
      status: 500;
      error: "db_write_failed" | "supabase_client_missing";
    };

export async function createWorkspaceWithCreator({
  actorUserId,
  input,
  gateway,
  now = new Date().toISOString(),
}: {
  actorUserId: string | null;
  input: WorkspaceCreationRouteInput;
  gateway?: WorkspaceCreationGateway;
  now?: string;
}): Promise<WorkspaceCreationResult> {
  if (!actorUserId) {
    return { ok: false, status: 401, denialReason: "unauthenticated" };
  }

  const normalizedInput: WorkspaceCreationInput = {
    hospitalName: input.hospitalName,
    adminDisplayName: input.adminDisplayName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    subscriptionStatus: "trialing",
  };
  const validation = validateWorkspaceCreationInput(normalizedInput);

  if (!validation.valid) {
    return {
      ok: false,
      status: 400,
      error: "invalid_input",
      fieldErrors: validation.fieldErrors,
    };
  }

  const mockCreation = createSessionWorkspace(
    normalizedInput,
    { sessionId: actorUserId, storageMode: "cookie" },
    now
  );

  if (!gateway) {
    return {
      ok: true,
      status: 201,
      workspace: mockCreation.workspace,
      membership: mockCreation.membership,
      enforcedBy: "workspace-creation-server-route",
    };
  }

  const persisted = await gateway.createWorkspaceWithCreator({
    workspaceId: mockCreation.workspace.id,
    displayName: mockCreation.workspace.displayName,
    representativeName: mockCreation.workspace.representativeName,
    contactEmail: mockCreation.workspace.contactEmail,
    contactPhone: mockCreation.workspace.contactPhone,
    creatorUserId: actorUserId,
    subscriptionStatus: "trialing",
    now,
  });

  if (!persisted.ok) {
    return persisted.status === 409
      ? { ok: false, status: 409, denialReason: persisted.denialReason }
      : { ok: false, status: 500, error: persisted.error };
  }

  return {
    ok: true,
    status: 201,
    workspace: persisted.creation.workspace,
    membership: persisted.creation.membership,
    enforcedBy: "workspace-creation-server-route",
  };
}

export type SupabaseWorkspaceCreationRpcClient = {
  rpc(
    functionName: "clair_create_workspace_with_creator",
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export function createSupabaseWorkspaceCreationGateway(
  client: SupabaseWorkspaceCreationRpcClient
): WorkspaceCreationGateway {
  return {
    async createWorkspaceWithCreator(write) {
      const { data, error } = await client.rpc("clair_create_workspace_with_creator", {
        p_workspace_id: write.workspaceId,
        p_display_name: write.displayName,
        p_admin_display_name: write.representativeName,
        p_contact_email: write.contactEmail,
        p_contact_phone: write.contactPhone,
      });

      if (error) {
        if (
          error.code === "23505" ||
          error.message?.includes("workspace_already_exists")
        ) {
          return { ok: false, status: 409, denialReason: "duplicate_workspace" };
        }

        return { ok: false, status: 500, error: "db_write_failed" };
      }

      return {
        ok: true,
        creation: mapWorkspaceCreationRpcData(data, write),
      };
    },
  };
}

function mapWorkspaceCreationRpcData(
  data: unknown,
  fallback: WorkspaceCreationWrite
): SessionWorkspaceCreation {
  const value = data as {
    workspace?: Partial<SessionWorkspaceCreation["workspace"]>;
    membership?: Partial<SessionWorkspaceCreation["membership"]>;
  };

  return {
    workspace: {
      id: value.workspace?.id ?? fallback.workspaceId,
      displayName: value.workspace?.displayName ?? fallback.displayName,
      representativeName:
        value.workspace?.representativeName ?? fallback.representativeName,
      contactEmail: value.workspace?.contactEmail ?? fallback.contactEmail,
      contactPhone: value.workspace?.contactPhone ?? fallback.contactPhone,
      subscriptionStatus: "trialing",
      createdBySessionId: value.workspace?.createdBySessionId ?? fallback.creatorUserId,
      createdAt: value.workspace?.createdAt ?? fallback.now,
    },
    membership: {
      id:
        value.membership?.id ??
        `${fallback.workspaceId}:${fallback.creatorUserId}:hospital_admin`,
      workspaceId: value.membership?.workspaceId ?? fallback.workspaceId,
      userSessionId: value.membership?.userSessionId ?? fallback.creatorUserId,
      displayName: value.membership?.displayName ?? fallback.representativeName,
      email: value.membership?.email ?? fallback.contactEmail,
      roles: ["hospital_admin"],
      status: "active",
      title: value.membership?.title ?? "워크스페이스 생성자",
      department: value.membership?.department ?? "병원관리",
      createdAt: value.membership?.createdAt ?? fallback.now,
      activatedAt: value.membership?.activatedAt ?? fallback.now,
      deactivatedAt: null,
    },
  };
}
