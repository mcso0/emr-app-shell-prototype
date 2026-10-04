"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomerProfileOverview, CustomerProfileSubjectType } from "@/features/customer/server-profile-overview-core";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
import { subscribeVisibleRefresh } from "@/lib/visible-refresh";
import type { ProfileTodayItem } from "./profile-today";
import { useReceptionStore } from "./store";

type TodayState = { owner: string; status: "loading" | "ready" | "error" | "denied"; items: ProfileTodayItem[] };

export function useProfileToday({ enabled, overview, subjectId, subjectType, workspaceId }: {
  enabled: boolean;
  overview: CustomerProfileOverview | null;
  subjectId: string;
  subjectType: CustomerProfileSubjectType;
  workspaceId: string;
}) {
  const draftCheckIns = useReceptionStore((state) => state.draftCheckIns);
  const appointments = useReceptionStore((state) => state.persistedCalendarAppointments);
  const [state, setState] = useState<TodayState>({ owner: "", status: "loading", items: [] });
  const controller = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  const ready = enabled && overview?.subjectId === subjectId && overview.subjectType === subjectType && overview.profile.workspaceId === workspaceId;
  const allowed = ready && overview.access.reservations.allowed;
  const owner = `${workspaceId}:${subjectType}:${subjectId}:${getWorkspaceOperatingDate(workspaceId)}`;

  const reload = useCallback(() => {
    if (!allowed) return;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    const version = ++requestVersion.current;
    const date = getWorkspaceOperatingDate(workspaceId);
    const requestOwner = `${workspaceId}:${subjectType}:${subjectId}:${date}`;
    setState((current) => ({ owner: requestOwner, status: current.owner === requestOwner && current.status === "ready" ? "ready" : "loading", items: current.owner === requestOwner ? current.items : [] }));
    void fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/customer/${subjectType}/${encodeURIComponent(subjectId)}/profile-overview/today`, { cache: "no-store", signal: nextController.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (version !== requestVersion.current || nextController.signal.aborted) return;
        if (response.status === 401 || response.status === 403) {
          setState({ owner: requestOwner, status: "denied", items: [] });
          return;
        }
        if (!response.ok || payload?.ok !== true || payload.workspaceId !== workspaceId || payload.subjectId !== subjectId || payload.subjectType !== subjectType || payload.date !== date || !Array.isArray(payload.items)) {
          setState({ owner: requestOwner, status: "error", items: [] });
          return;
        }
        setState({ owner: requestOwner, status: "ready", items: payload.items });
      })
      .catch(() => {
        if (version !== requestVersion.current || nextController.signal.aborted) return;
        setState({ owner: requestOwner, status: "error", items: [] });
      });
  }, [allowed, subjectId, subjectType, workspaceId]);

  useEffect(() => {
    if (!allowed) return;
    const timer = window.setTimeout(reload, 0);
    const unsubscribe = subscribeVisibleRefresh({ intervalMs: 60_000, onRefresh: reload });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      controller.current?.abort();
      requestVersion.current += 1;
    };
  }, [allowed, reload, draftCheckIns, appointments, overview]);

  return {
    items: allowed && state.owner === owner ? state.items : [],
    status: ready && !allowed ? "denied" as const : state.owner !== owner || !ready ? "loading" as const : state.status,
    reload,
  };
}
