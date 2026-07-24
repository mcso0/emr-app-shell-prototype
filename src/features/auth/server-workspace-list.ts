import "server-only";

import {
  mapActiveWorkspaceListData,
  mergeWorkspaceLogoSummaries,
  type WorkspaceListItem,
  type WorkspaceLogoSummary,
} from "@/features/auth/server-workspace-list-core";
import {
  HOSPITAL_LOGO_SIGNED_READ_SECONDS,
  PRIVATE_HOSPITAL_LOGO_BUCKET,
} from "@/features/hospital-admin/settings/server-hospital-logo-core";

export type WorkspaceListGateway = {
  listActiveWorkspacesForCurrentUser(): Promise<
    | { ok: true; workspaces: WorkspaceListItem[] }
    | { ok: false; error: "db_read_failed" }
  >;
};

export type WorkspaceListResult =
  | {
      ok: true;
      status: 200;
      workspaces: WorkspaceListItem[];
      enforcedBy: "workspace-membership-reader";
    }
  | {
      ok: false;
      status: 401;
      denialReason: "unauthenticated";
    }
  | {
      ok: false;
      status: 500;
      error: "db_read_failed" | "supabase_client_missing";
    };

export async function listActorWorkspaces({
  actorUserId,
  gateway,
}: {
  actorUserId: string | null;
  gateway?: WorkspaceListGateway;
}): Promise<WorkspaceListResult> {
  if (!actorUserId) {
    return { ok: false, status: 401, denialReason: "unauthenticated" };
  }

  if (!gateway) {
    return {
      ok: true,
      status: 200,
      workspaces: [],
      enforcedBy: "workspace-membership-reader",
    };
  }

  const result = await gateway.listActiveWorkspacesForCurrentUser();

  if (!result.ok) {
    return { ok: false, status: 500, error: result.error };
  }

  return {
    ok: true,
    status: 200,
    workspaces: result.workspaces,
    enforcedBy: "workspace-membership-reader",
  };
}

export type SupabaseWorkspaceListRpcClient = {
  rpc(
    functionName: "clair_list_active_workspaces_for_current_user",
    args?: Record<string, never>
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
  from(table: "workspace_hospital_profiles"): {
    select(columns: "workspace_id, logo_storage_path, revision"): {
      in(
        column: "workspace_id",
        values: string[]
      ): Promise<{ data: unknown; error: { message?: string } | null }>;
    };
  };
  storage: {
    from(bucket: typeof PRIVATE_HOSPITAL_LOGO_BUCKET): {
      createSignedUrl(
        path: string,
        expiresIn: number
      ): Promise<{ data: unknown; error: { message?: string } | null }>;
    };
  };
};

export function createSupabaseWorkspaceListGateway(
  client: SupabaseWorkspaceListRpcClient
): WorkspaceListGateway {
  return {
    async listActiveWorkspacesForCurrentUser() {
      const { data, error } = await client.rpc(
        "clair_list_active_workspaces_for_current_user"
      );

      if (error) {
        return { ok: false, error: "db_read_failed" };
      }

      const workspaces = mapActiveWorkspaceListData(data);
      const logoSummaries = await readWorkspaceLogoSummaries(client, workspaces);

      return {
        ok: true,
        workspaces: mergeWorkspaceLogoSummaries(workspaces, logoSummaries),
      };
    },
  };
}

async function readWorkspaceLogoSummaries(
  client: SupabaseWorkspaceListRpcClient,
  workspaces: WorkspaceListItem[]
): Promise<WorkspaceLogoSummary[]> {
  if (workspaces.length === 0) return [];

  try {
    const { data, error } = await client
      .from("workspace_hospital_profiles")
      .select("workspace_id, logo_storage_path, revision")
      .in(
        "workspace_id",
        workspaces.map((workspace) => workspace.id)
      );
    if (error || !Array.isArray(data)) return [];

    const rows = data.filter(isWorkspaceLogoRow);
    return Promise.all(
      rows.map(async (row) => {
        if (!row.logo_storage_path) {
          return {
            workspaceId: row.workspace_id,
            revision: row.revision,
            url: null,
          };
        }

        const signed = await client.storage
          .from(PRIVATE_HOSPITAL_LOGO_BUCKET)
          .createSignedUrl(
            row.logo_storage_path,
            HOSPITAL_LOGO_SIGNED_READ_SECONDS
          );
        const url =
          !signed.error &&
          isRecord(signed.data) &&
          typeof signed.data.signedUrl === "string"
            ? signed.data.signedUrl
            : null;

        return {
          workspaceId: row.workspace_id,
          revision: row.revision,
          url,
        };
      })
    );
  } catch {
    return [];
  }
}

function isWorkspaceLogoRow(
  value: unknown
): value is {
  workspace_id: string;
  logo_storage_path: string | null;
  revision: number;
} {
  if (!isRecord(value)) return false;
  return (
    typeof value.workspace_id === "string" &&
    (value.logo_storage_path === null ||
      typeof value.logo_storage_path === "string") &&
    Number.isSafeInteger(value.revision) &&
    Number(value.revision) > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
