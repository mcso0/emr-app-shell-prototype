"use client";

type SearchParamsLike = string | { toString: () => string };

type BuildWorkspaceSurfaceRouteInput = {
  moduleId: string;
  params?: Record<string, string | null | undefined>;
  removeParams?: string[];
  search?: SearchParamsLike;
  workspaceId: string;
};

export function buildWorkspaceHomeRoute(workspaceId: string) {
  return `/w/${workspaceId}/home?modulePanel=open`;
}

export function buildWorkspaceSurfaceRoute({
  moduleId,
  params = {},
  removeParams = [],
  search = "",
  workspaceId,
}: BuildWorkspaceSurfaceRouteInput) {
  const searchParams = new URLSearchParams(typeof search === "string" ? search : search.toString());

  removeParams.forEach((key) => searchParams.delete(key));
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim()) {
      searchParams.set(key, value);
    } else {
      searchParams.delete(key);
    }
  });

  const query = searchParams.toString();
  return `/w/${workspaceId}/${moduleId}${query ? `?${query}` : ""}`;
}
