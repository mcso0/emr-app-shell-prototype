import type { DiagnosisType } from "@/types/emr-domain";

export type AssessmentClassificationCatalogItem = {
  id: string;
  code?: string;
  categoryId?: string;
  name: string;
  masterId?: string;
  masterRevision?: number;
  systemId?: string;
  systemLabel: string;
  categoryLabel: string;
  synonyms: string[];
  defaultType: DiagnosisType;
  hint?: string;
};

export type AssessmentClassificationCatalogFacet = {
  id: string;
  name: string;
  count: number;
  systemId?: string;
};

export type AssessmentClassificationCatalogPage = {
  catalog: AssessmentClassificationCatalogItem[];
  systems: AssessmentClassificationCatalogFacet[];
  diseaseGroups: AssessmentClassificationCatalogFacet[];
  nextCursor: string | null;
};

export type DiagnosisCatalogClientStatus = "error" | "permission";

export type DiagnosisCatalogClientResult =
  | { ok: true; page: AssessmentClassificationCatalogPage }
  | {
      ok: false;
      status: number;
      catalogStatus: DiagnosisCatalogClientStatus;
      error?: string;
    };

export type DiagnosisCatalogClientQuery = {
  query?: string;
  systemId?: string;
  diseaseGroupId?: string;
  cursor?: string;
  limit?: number;
};

type LoadDiagnosisCatalogPageInput = DiagnosisCatalogClientQuery & {
  actorHeaders?: Record<string, string>;
  actorKey: string;
  force?: boolean;
  signal?: AbortSignal;
  workspaceId: string;
};

type RawCatalogItem = {
  id?: string;
  catalogId?: string;
  code?: string | null;
  name?: string;
  masterId?: string | null;
  masterRevision?: number | null;
  systemId?: string | null;
  systemLabel?: string | null;
  system?: { id?: string | null; name?: string | null } | null;
  categoryId?: string | null;
  categoryLabel?: string | null;
  diseaseGroup?: { id?: string | null; name?: string | null } | null;
  synonyms?: string[] | null;
  defaultType?: DiagnosisType;
  hint?: string | null;
};

type RawFacet = {
  id?: string;
  name?: string;
  count?: number;
  systemId?: string | null;
};

type RawRouteResponse =
  | {
      ok: true;
      systems?: RawFacet[];
      diseaseGroups?: RawFacet[];
      catalog?: RawCatalogItem[];
      diagnoses?: RawCatalogItem[];
      nextCursor?: string | null;
    }
  | {
      ok: false;
      denialReason?: string;
      error?: string;
    };

const initialPageCache = new Map<string, AssessmentClassificationCatalogPage>();
const inflightRequests = new Map<
  string,
  Promise<DiagnosisCatalogClientResult>
>();

const buildActorWorkspaceKey = (actorKey: string, workspaceId: string) =>
  `${actorKey}:${workspaceId}`;

const buildRequestKey = ({
  actorKey,
  cursor,
  diseaseGroupId,
  limit = 50,
  query,
  systemId,
  workspaceId,
}: LoadDiagnosisCatalogPageInput) =>
  JSON.stringify([
    actorKey,
    workspaceId,
    query?.trim() ?? "",
    systemId ?? "",
    diseaseGroupId ?? "",
    cursor ?? "",
    limit,
  ]);

const isInitialQuery = ({
  cursor,
  diseaseGroupId,
  query,
  systemId,
}: DiagnosisCatalogClientQuery) =>
  !query?.trim() && !systemId && !diseaseGroupId && !cursor;

export function getCachedDiagnosisCatalogPage({
  actorKey,
  workspaceId,
}: {
  actorKey: string;
  workspaceId: string;
}) {
  return initialPageCache.get(buildActorWorkspaceKey(actorKey, workspaceId));
}

export function clearCachedDiagnosisCatalogPage({
  actorKey,
  workspaceId,
}: {
  actorKey: string;
  workspaceId: string;
}) {
  initialPageCache.delete(buildActorWorkspaceKey(actorKey, workspaceId));
}

export async function loadDiagnosisCatalogPage(
  input: LoadDiagnosisCatalogPageInput,
): Promise<DiagnosisCatalogClientResult> {
  const cacheKey = buildActorWorkspaceKey(input.actorKey, input.workspaceId);
  if (!input.force && isInitialQuery(input)) {
    const cached = initialPageCache.get(cacheKey);
    if (cached) return { ok: true, page: cached };
  }

  const requestKey = buildRequestKey(input);
  const inflight = inflightRequests.get(requestKey);
  if (inflight) return inflight;

  const request = requestDiagnosisCatalogPage(input).finally(() => {
    inflightRequests.delete(requestKey);
  });
  inflightRequests.set(requestKey, request);

  const result = await request;
  if (result.ok && isInitialQuery(input)) {
    initialPageCache.set(cacheKey, result.page);
  }
  if (!result.ok && result.catalogStatus === "permission") {
    initialPageCache.delete(cacheKey);
  }
  return result;
}

async function requestDiagnosisCatalogPage({
  actorHeaders,
  cursor,
  diseaseGroupId,
  limit = 50,
  query,
  signal,
  systemId,
  workspaceId,
}: LoadDiagnosisCatalogPageInput): Promise<DiagnosisCatalogClientResult> {
  try {
    const searchParams = new URLSearchParams({ limit: String(limit) });
    if (query?.trim()) searchParams.set("q", query.trim());
    if (systemId) searchParams.set("systemId", systemId);
    if (diseaseGroupId) searchParams.set("diseaseGroupId", diseaseGroupId);
    if (cursor) searchParams.set("cursor", cursor);

    const response = await fetch(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/chart/diagnosis-catalog?${searchParams.toString()}`,
      {
        cache: "no-store",
        headers: actorHeaders,
        signal,
      },
    );
    const body = (await response.json()) as RawRouteResponse;

    if (!response.ok || !body.ok) {
      if (!body.ok) {
        return {
          ok: false,
          status: response.status,
          catalogStatus:
            body.denialReason === "permission_missing" ||
            body.denialReason === "workspace_membership_missing" ||
            body.denialReason === "unauthenticated"
              ? "permission"
              : "error",
          error: body.error,
        };
      }
      return {
        ok: false,
        status: response.status,
        catalogStatus: "error",
        error: "db_read_failed",
      };
    }

    return { ok: true, page: mapRoutePage(body) };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    return {
      ok: false,
      status: 500,
      catalogStatus: "error",
      error: "db_read_failed",
    };
  }
}

function mapRoutePage(body: Extract<RawRouteResponse, { ok: true }>) {
  const catalog = (body.catalog ?? body.diagnoses ?? []).flatMap(
    mapCatalogItem,
  );
  const systems = (body.systems ?? []).flatMap(mapFacet);
  const diseaseGroups = (body.diseaseGroups ?? []).flatMap(mapFacet);

  return {
    catalog,
    systems: systems.length ? systems : deriveSystemFacets(catalog),
    diseaseGroups: diseaseGroups.length
      ? diseaseGroups
      : deriveDiseaseGroupFacets(catalog),
    nextCursor: typeof body.nextCursor === "string" ? body.nextCursor : null,
  } satisfies AssessmentClassificationCatalogPage;
}

function mapCatalogItem(item: RawCatalogItem) {
  const id = item.id ?? item.catalogId;
  const systemLabel = item.systemLabel ?? item.system?.name;
  const categoryLabel = item.categoryLabel ?? item.diseaseGroup?.name;
  if (!id || !item.name || !systemLabel || !categoryLabel) return [];

  return [
    {
      categoryId: item.categoryId ?? item.diseaseGroup?.id ?? undefined,
      categoryLabel,
      code: item.code ?? undefined,
      defaultType: item.defaultType ?? "suspected",
      hint: item.hint ?? undefined,
      id,
      masterId: item.masterId ?? undefined,
      masterRevision: item.masterRevision ?? undefined,
      name: item.name,
      synonyms: item.synonyms ?? [],
      systemId: item.systemId ?? item.system?.id ?? undefined,
      systemLabel,
    } satisfies AssessmentClassificationCatalogItem,
  ];
}

function mapFacet(facet: RawFacet) {
  if (!facet.id || !facet.name || typeof facet.count !== "number") return [];
  return [
    {
      id: facet.id,
      name: facet.name,
      count: facet.count,
      systemId: facet.systemId ?? undefined,
    } satisfies AssessmentClassificationCatalogFacet,
  ];
}

function deriveSystemFacets(catalog: AssessmentClassificationCatalogItem[]) {
  const counts = new Map<string, AssessmentClassificationCatalogFacet>();
  catalog.forEach((item) => {
    const id = item.systemId ?? item.systemLabel;
    const current = counts.get(id);
    counts.set(id, {
      id,
      name: item.systemLabel,
      count: (current?.count ?? 0) + 1,
    });
  });
  return Array.from(counts.values());
}

function deriveDiseaseGroupFacets(
  catalog: AssessmentClassificationCatalogItem[],
) {
  const counts = new Map<string, AssessmentClassificationCatalogFacet>();
  catalog.forEach((item) => {
    const id = item.categoryId ?? item.categoryLabel;
    const current = counts.get(id);
    counts.set(id, {
      id,
      name: item.categoryLabel,
      count: (current?.count ?? 0) + 1,
      systemId: item.systemId,
    });
  });
  return Array.from(counts.values());
}
