import {
  createMockWorkspacePermissionAdapter,
  resolveWorkspacePermission,
  type WorkspacePermissionAdapter,
  type WorkspacePermissionDenialReason,
} from "@/features/auth/permission-resolver";

export type DiagnosisCatalogClassification = {
  id: string;
  name: string;
};

export type DiagnosisCatalogSearchItem = {
  catalogId: string;
  masterId: string;
  masterRevision: number;
  code: string | null;
  name: string;
  synonyms: string[];
  system: DiagnosisCatalogClassification;
  diseaseGroup: DiagnosisCatalogClassification;
};

export type DiagnosisCatalogFacet = DiagnosisCatalogClassification & {
  count: number;
  systemId?: string;
};

export type DiagnosisCatalogSearchPage = {
  systems: DiagnosisCatalogFacet[];
  diseaseGroups: DiagnosisCatalogFacet[];
  diagnoses: DiagnosisCatalogSearchItem[];
  nextCursor: string | null;
};

export type DiagnosisCatalogSearchInput = {
  query?: string | null;
  systemId?: string | null;
  diseaseGroupId?: string | null;
  cursor?: string | null;
  limit?: number | null;
};

export type DiagnosisCatalogSearchResult =
  | { ok: true; status: 200; page: DiagnosisCatalogSearchPage; enforcedBy: "diagnosis-catalog-search" }
  | { ok: false; status: 400; error: "invalid_input" }
  | { ok: false; status: 401 | 403; denialReason: WorkspacePermissionDenialReason }
  | { ok: false; status: 500; error: "db_read_failed" | "supabase_client_missing" };

export type DiagnosisCatalogSearchGateway = {
  search(input: {
    workspaceId: string;
    query: string | null;
    systemId: string | null;
    diseaseGroupId: string | null;
    cursor: string | null;
    limit: number;
  }): Promise<
    | { ok: true; page: DiagnosisCatalogSearchPage }
    | { ok: false; error: "db_read_failed" }
  >;
};

export type SupabaseDiagnosisCatalogRpcClient = {
  rpc(
    functionName: "clair_search_diagnosis_catalog",
    args: {
      p_workspace_id: string;
      p_query: string | null;
      p_system_id: string | null;
      p_disease_group_id: string | null;
      p_cursor: string | null;
      p_limit: number;
    },
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function searchDiagnosisCatalog({
  actorUserId,
  gateway = createEmptyDiagnosisCatalogGateway(),
  input,
  permissionAdapter = createDemoDiagnosisCatalogPermissionAdapter(),
  workspaceId,
}: {
  actorUserId: string | null;
  gateway?: DiagnosisCatalogSearchGateway;
  input: DiagnosisCatalogSearchInput;
  permissionAdapter?: WorkspacePermissionAdapter;
  workspaceId: string;
}): Promise<DiagnosisCatalogSearchResult> {
  const normalized = normalizeInput(input);
  if (!normalized) return { ok: false, status: 400, error: "invalid_input" };

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

  const result = await gateway.search({ ...normalized, workspaceId });
  if (!result.ok) return { ok: false, status: 500, error: "db_read_failed" };
  return { ok: true, status: 200, page: result.page, enforcedBy: "diagnosis-catalog-search" };
}

export function createSupabaseDiagnosisCatalogGateway(
  client: SupabaseDiagnosisCatalogRpcClient,
): DiagnosisCatalogSearchGateway {
  return {
    async search(input) {
      const { data, error } = await client.rpc("clair_search_diagnosis_catalog", {
        p_workspace_id: input.workspaceId,
        p_query: input.query,
        p_system_id: input.systemId,
        p_disease_group_id: input.diseaseGroupId,
        p_cursor: input.cursor,
        p_limit: input.limit,
      });
      if (error) return { ok: false, error: "db_read_failed" };
      const page = mapPage(data);
      return page ? { ok: true, page } : { ok: false, error: "db_read_failed" };
    },
  };
}

function createEmptyDiagnosisCatalogGateway(): DiagnosisCatalogSearchGateway {
  return {
    async search() {
      return {
        ok: true,
        page: { systems: [], diseaseGroups: [], diagnoses: [], nextCursor: null },
      };
    },
  };
}

function createDemoDiagnosisCatalogPermissionAdapter() {
  return createMockWorkspacePermissionAdapter({
    users: [
      { id: "playwright-default-session", status: "active", displayName: "Playwright Admin" },
      { id: "user-admin", status: "active", displayName: "송민재" },
      { id: "user-vet", status: "active", displayName: "이수지" },
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
        id: "membership-vet",
        workspaceId: "clair-demo",
        userId: "user-vet",
        roles: ["vet"],
        status: "active",
      },
    ],
  });
}

function normalizeInput(input: DiagnosisCatalogSearchInput) {
  const query = typeof input.query === "string" ? input.query.trim() : "";
  const systemId = typeof input.systemId === "string" && input.systemId ? input.systemId : null;
  const diseaseGroupId = typeof input.diseaseGroupId === "string" && input.diseaseGroupId
    ? input.diseaseGroupId
    : null;
  const cursor = typeof input.cursor === "string" && input.cursor ? input.cursor : null;
  const limit = input.limit ?? 50;
  if (query.length > 120 || !Number.isInteger(limit) || limit < 1 || limit > 50) return null;
  if (systemId && !uuidPattern.test(systemId)) return null;
  if (diseaseGroupId && !uuidPattern.test(diseaseGroupId)) return null;
  if (cursor) {
    const separatorIndex = cursor.lastIndexOf("|");
    const cursorName = cursor.slice(0, separatorIndex);
    const cursorId = cursor.slice(separatorIndex + 1);
    if (
      cursor.length > 200
      || separatorIndex < 1
      || cursorName.length > 120
      || !uuidPattern.test(cursorId)
    ) return null;
  }
  return { query: query || null, systemId, diseaseGroupId, cursor, limit };
}

function mapPage(value: unknown): DiagnosisCatalogSearchPage | null {
  if (!value || typeof value !== "object") return null;
  const page = value as Record<string, unknown>;
  if (!Array.isArray(page.systems) || !Array.isArray(page.diseaseGroups) || !Array.isArray(page.diagnoses)) {
    return null;
  }
  const systems = page.systems.flatMap(mapFacet);
  const diseaseGroups = page.diseaseGroups.flatMap(mapFacet);
  const diagnoses = page.diagnoses.flatMap(mapDiagnosis);
  return {
    systems,
    diseaseGroups,
    diagnoses,
    nextCursor: typeof page.nextCursor === "string" ? page.nextCursor : null,
  };
}

function mapFacet(value: unknown): DiagnosisCatalogFacet[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.count !== "number") return [];
  return [{
    id: row.id,
    name: row.name,
    count: row.count,
    systemId: typeof row.systemId === "string" ? row.systemId : undefined,
  }];
}

function mapDiagnosis(value: unknown): DiagnosisCatalogSearchItem[] {
  if (!value || typeof value !== "object") return [];
  const row = value as Record<string, unknown>;
  const system = mapClassification(row.system);
  const diseaseGroup = mapClassification(row.diseaseGroup);
  if (
    typeof row.catalogId !== "string" || typeof row.masterId !== "string"
    || typeof row.masterRevision !== "number" || typeof row.name !== "string"
    || !system || !diseaseGroup
  ) return [];
  return [{
    catalogId: row.catalogId,
    masterId: row.masterId,
    masterRevision: row.masterRevision,
    code: typeof row.code === "string" ? row.code : null,
    name: row.name,
    synonyms: Array.isArray(row.synonyms)
      ? row.synonyms.filter((item): item is string => typeof item === "string")
      : [],
    system,
    diseaseGroup,
  }];
}

function mapClassification(value: unknown): DiagnosisCatalogClassification | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.name === "string"
    ? { id: row.id, name: row.name }
    : null;
}
