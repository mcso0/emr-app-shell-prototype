"use client";

import type { ProfileDrawerState } from "@/types/emr";

export function readProfileDrawerParam(value: string | null): ProfileDrawerState {
  if (!value) return null;
  const separator = value.indexOf(":");
  const type = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (separator < 1 || !id.trim()) return null;
  if (type === "patient" || type === "reception-patient") return { type: "patient", id };
  if (type === "guardian" || type === "reception-guardian") return { type: "guardian", id };
  if (type === "staff-operational-profile") return { type, id };
  return null;
}

type SearchParamsLike = string | { toString: () => string };

type BuildWorkspaceSurfaceRouteInput = {
  moduleId: string;
  params?: Record<string, string | null | undefined>;
  removeParams?: string[];
  search?: SearchParamsLike;
  workspaceId: string;
};

type BuildWorkspaceSwitchRouteInput = {
  contentAsideOpen?: boolean;
  hasContentAside: boolean;
  hasRightPanel: boolean;
  moduleId: string;
  modulePanelOpen: boolean;
  rightPanelOpen?: boolean;
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

export function buildWorkspaceSwitchRoute({
  contentAsideOpen,
  hasContentAside,
  hasRightPanel,
  moduleId,
  modulePanelOpen,
  rightPanelOpen,
  workspaceId,
}: BuildWorkspaceSwitchRouteInput) {
  const searchParams = new URLSearchParams({
    modulePanel: modulePanelOpen ? "open" : "closed",
  });

  if (hasContentAside) {
    searchParams.set("aside", contentAsideOpen ? "history" : "closed");
  }

  if (hasRightPanel) {
    searchParams.set("right", rightPanelOpen ? "open" : "closed");
  }

  return `/w/${encodeURIComponent(workspaceId)}/${encodeURIComponent(moduleId)}?${searchParams.toString()}`;
}
