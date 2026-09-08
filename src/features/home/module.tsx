"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HomeKanbanWorkspace, HomeNavigationSidePanel } from "@/features/home/components/home-kanban-workspace";
import { useHomeWorkspaceStore } from "@/features/home/home-workspace-store";
import { mapOperationsResponseToHomeDashboardData } from "@/features/home/home-operations-adapter";
import { getHomeMockData } from "@/features/home/home.mock";
import { HOME_ROLE_LABELS, HOME_ROLE_USER_NAMES, mapAuthRoleToHomeRole } from "@/features/home/home.presets";
import { useAuthClient } from "@/features/auth/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
import { isLegacySalesDemoWorkspace } from "@/lib/emr-domain/demo-workspaces";
import type { ShellComponentProps } from "@/types/emr";
import type { HomeOperationsWorkItemsResponse } from "@/features/home/home.types";

export function HomeContent({ workspaceId }: ShellComponentProps) {
  const { hydrated, session, hydrate } = useAuthClient();
  const activate = useHomeWorkspaceStore((state) => state.activate);
  const activeScope = useHomeWorkspaceStore((state) => state.scopeKey);
  const today = getWorkspaceOperatingDate(workspaceId);
  const actor = session && "userId" in session ? session.userId : session?.role;
  const scopeKey = actor ? `${actor}:${workspaceId}` : null;
  useEffect(() => { hydrate(); }, [hydrate]);
  useEffect(() => { if (hydrated && scopeKey) activate(scopeKey, today); }, [activate, hydrated, scopeKey, today]);
  if (!hydrated || !scopeKey || activeScope !== scopeKey) return <HomeLoadingState />;
  return <HomeOperationsContent key={scopeKey} workspaceId={workspaceId} today={today} role={mapAuthRoleToHomeRole(session?.role)} />;
}

function HomeOperationsContent({ workspaceId, today, role }: { workspaceId: string; today: string; role: ReturnType<typeof mapAuthRoleToHomeRole> }) {
  const view = useHomeWorkspaceStore((state) => state.view);
  const query = useHomeWorkspaceStore((state) => state.queries[state.view]);
  const operatingDate = view === "mine" ? today : query.date;
  const legacy = isLegacySalesDemoWorkspace(workspaceId);
  const { loading, refresh, response } = useHomeOperationsWorkItems({ includeCompleted: query.includeCompleted, includeCancelled: false, operatingDate, workspaceId, enabled: !legacy });
  const data = useMemo(() => {
    if (legacy) {
      const mock = getHomeMockData(role, workspaceId);
      const mine = new Set(mock.tasks.map((task) => task.id));
      return { ...mock, hospitalTasks: mock.hospitalTasks.map((task) => ({ ...task, isMyWork: mine.has(task.id), isRequestedWork: task.requestedBy === mock.userName })) };
    }
    return mapOperationsResponseToHomeDashboardData({ items: response?.ok ? response.items : [], operatingDate, role, roleLabel: HOME_ROLE_LABELS[role], userName: HOME_ROLE_USER_NAMES[role] });
  }, [legacy, operatingDate, response, role, workspaceId]);
  return <HomeKanbanWorkspace data={data} today={today} loading={!legacy && loading} onRefresh={refresh}
    sourceStatus={legacy ? "live" : response?.sourceStatus ?? (loading ? "live" : "error")}
    errorMessage={response && !response.ok ? response.error.message : undefined}
    patientSummary={response?.ok ? response.currentPatients : null}
  />;
}

export function HomeSidePanel() { return <HomeNavigationSidePanel />; }

function useHomeOperationsWorkItems({
  includeCancelled,
  includeCompleted,
  operatingDate,
  workspaceId,
  enabled = true,
}: {
  enabled?: boolean;
  includeCancelled: boolean;
  includeCompleted: boolean;
  operatingDate: string;
  workspaceId: string;
}) {
  const [nonce, setNonce] = useState(0);
  const requestKey = `${workspaceId}:${operatingDate}:${includeCompleted}:${includeCancelled}:${nonce}`;
  const [response, setResponse] = useState<{
    body: HomeOperationsWorkItemsResponse;
    requestKey: string;
  } | null>(null);
  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      date: operatingDate,
      includeCancelled: String(includeCancelled),
      includeCompleted: String(includeCompleted),
      scope: "all",
    });

    void fetch(`/api/workspaces/${workspaceId}/operations/work-items?${params.toString()}`, {
      credentials: "same-origin",
      signal: controller.signal,
    })
      .then(async (result) => (await result.json()) as HomeOperationsWorkItemsResponse)
      .then((body) => {
        if (!controller.signal.aborted) setResponse({ body, requestKey });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResponse({
            requestKey,
            body: {
              ok: false,
              workspaceId,
              operatingDate,
              sourceStatus: "error",
              error: {
                code: "network_error",
                message: "원내 현황 데이터를 불러오지 못했습니다.",
                retryable: true,
              },
            },
          });
        }
      });

    return () => controller.abort();
  }, [enabled, includeCancelled, includeCompleted, operatingDate, requestKey, workspaceId]);

  return {
    loading: response?.requestKey !== requestKey,
    refresh,
    response: response?.requestKey === requestKey ? response.body : null,
  };
}


function HomeLoadingState() {
  return <div className="flex h-full flex-col gap-5 p-6" role="status" aria-label="홈 불러오는 중"><Skeleton className="h-8 w-40" /><Skeleton className="h-8 w-full" /><Skeleton className="min-h-48 flex-1" /></div>;
}
