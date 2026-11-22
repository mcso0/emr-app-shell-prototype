"use client";

import { useCallback, useSyncExternalStore } from "react";

const changeEvent = "clair:chart-search-favorites";
function subscribe(update: () => void) {
  window.addEventListener(changeEvent, update);
  window.addEventListener("storage", update);
  return () => {
    window.removeEventListener(changeEvent, update);
    window.removeEventListener("storage", update);
  };
}
function decode(raw: string | null): string[] {
  try {
    const data: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(data)
      ? data.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}
export function useChartFavorites(workspaceId: string, userId?: string) {
  const key = userId
    ? "clair.chart-favorites." + JSON.stringify([workspaceId, userId])
    : null;
  const read = useCallback(() => {
    try {
      return key ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }, [key]);
  const ids = decode(useSyncExternalStore(subscribe, read, () => null));
  return {
    ids,
    toggle(id: string) {
      if (!key) throw new Error("user_missing");
      const current = decode(localStorage.getItem(key));
      localStorage.setItem(
        key,
        JSON.stringify(
          current.includes(id)
            ? current.filter((v) => v !== id)
            : [...current, id],
        ),
      );
      window.dispatchEvent(new Event(changeEvent));
    },
  };
}
