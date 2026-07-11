import type {
  WorkspaceRoleCatalogMutation,
  WorkspaceRoleCatalogSnapshot,
} from "@/features/auth/server-workspace-role-catalog";

export type WorkspaceRoleCatalogFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type WorkspaceRoleCatalogApi = {
  load(workspaceId: string): Promise<WorkspaceRoleCatalogSnapshot>;
  mutate(workspaceId: string, input: WorkspaceRoleCatalogMutation): Promise<WorkspaceRoleCatalogSnapshot>;
};

export class WorkspaceRoleCatalogApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(code);
    this.name = "WorkspaceRoleCatalogApiError";
  }
}

export function createWorkspaceRoleCatalogApi(
  fetchImpl: WorkspaceRoleCatalogFetch = fetch
): WorkspaceRoleCatalogApi {
  return {
    async load(workspaceId) {
      const response = await fetchImpl(getCatalogUrl(workspaceId), {
        method: "GET",
        headers: { accept: "application/json" },
      });
      return readSnapshotResponse(response);
    },
    async mutate(workspaceId, input) {
      const response = await fetchImpl(getCatalogUrl(workspaceId), {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      return readSnapshotResponse(response);
    },
  };
}

async function readSnapshotResponse(response: Response): Promise<WorkspaceRoleCatalogSnapshot> {
  const body = await readJsonResponse(response);
  if (!response.ok || !isCatalogResponse(body)) {
    throw new WorkspaceRoleCatalogApiError(getCatalogErrorCode(body), response.status);
  }

  return body.snapshot;
}

function getCatalogUrl(workspaceId: string) {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/role-permission-management`;
}

async function readJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isCatalogResponse(value: unknown): value is { ok: true; snapshot: WorkspaceRoleCatalogSnapshot } {
  return (
    value !== null &&
    typeof value === "object" &&
    "ok" in value &&
    value.ok === true &&
    "snapshot" in value
  );
}

function getCatalogErrorCode(value: unknown) {
  return (
    value !== null &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
      ? value.error
      : "catalog_request_failed"
  );
}
