"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HomeHospitalStatusSidePanel,
  HomeKanbanWorkspace,
} from "@/features/home/components/home-kanban-workspace";
import { mapOperationsResponseToHomeDashboardData } from "@/features/home/home-operations-adapter";
import { getHomeMockData } from "@/features/home/home.mock";
import {
  HOME_ROLE_LABELS,
  HOME_ROLE_USER_NAMES,
  mapAuthRoleToHomeRole,
} from "@/features/home/home.presets";
import { useAuthClient } from "@/features/auth/auth-client";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkspaceOperatingDate } from "@/lib/emr-domain/demo-date";
import { isLegacySalesDemoWorkspace } from "@/lib/emr-domain/demo-workspaces";
import type { ShellComponentProps } from "@/types/emr";
import type {
  HomeOperationsWorkItemsResponse,
} from "@/features/home/home.types";

export function HomeContent({ workspaceId }: ShellComponentProps) {
  const { hydrated, session, hydrate } = useAuthClient();
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [includeCancelled, setIncludeCancelled] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <HomeLoadingState />;
  }

  const role = mapAuthRoleToHomeRole(session?.role);
  if (isLegacySalesDemoWorkspace(workspaceId)) {
    const data = getHomeMockData(role, workspaceId);

    return (
      <HomeKanbanWorkspace
        data={data}
        includeCancelled={includeCancelled}
        includeCompleted={includeCompleted}
        onIncludeCancelledChange={setIncludeCancelled}
        onIncludeCompletedChange={setIncludeCompleted}
        sourceStatus="live"
      />
    );
  }

  return (
    <HomeOperationsContent
      includeCancelled={includeCancelled}
      includeCompleted={includeCompleted}
      role={role}
      workspaceId={workspaceId}
      onIncludeCancelledChange={setIncludeCancelled}
      onIncludeCompletedChange={setIncludeCompleted}
    />
  );
}

function HomeOperationsContent({
  includeCancelled,
  includeCompleted,
  onIncludeCancelledChange,
  onIncludeCompletedChange,
  role,
  workspaceId,
}: {
  includeCancelled: boolean;
  includeCompleted: boolean;
  onIncludeCancelledChange: (value: boolean) => void;
  onIncludeCompletedChange: (value: boolean) => void;
  role: ReturnType<typeof mapAuthRoleToHomeRole>;
  workspaceId: string;
}) {
  const operatingDate = getWorkspaceOperatingDate(workspaceId);
  const { loading, refresh, response } = useHomeOperationsWorkItems({
    includeCancelled,
    includeCompleted,
    operatingDate,
    workspaceId,
  });
  const data = useMemo(
    () =>
      mapOperationsResponseToHomeDashboardData({
        items: response?.ok ? response.items : [],
        operatingDate: response?.operatingDate ?? operatingDate,
        role,
        roleLabel: HOME_ROLE_LABELS[role],
        userName: HOME_ROLE_USER_NAMES[role],
      }),
    [operatingDate, response, role],
  );

  if (loading && !response) {
    return <HomeLoadingState />;
  }

  return (
    <HomeKanbanWorkspace
      data={data}
      errorMessage={!response?.ok ? response?.error.message : undefined}
      includeCancelled={includeCancelled}
      includeCompleted={includeCompleted}
      loading={loading}
      sourceStatus={response?.sourceStatus ?? "error"}
      onIncludeCancelledChange={onIncludeCancelledChange}
      onIncludeCompletedChange={onIncludeCompletedChange}
      onRefresh={refresh}
    />
  );
}

export function HomeSidePanel({ workspaceId }: ShellComponentProps) {
  const { hydrated, session, hydrate } = useAuthClient();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return <HomeSidePanelLoadingState />;
  }

  const role = mapAuthRoleToHomeRole(session?.role);
  if (!isLegacySalesDemoWorkspace(workspaceId)) {
    return (
      <HomeOperationsSidePanel
        role={role}
        workspaceId={workspaceId}
      />
    );
  }

  const data = getHomeMockData(role, workspaceId);
  const tasks = [...data.tasks, ...data.hospitalTasks]
    .filter((task, index, allTasks) => allTasks.findIndex((item) => item.id === task.id) === index);

  return <HomeHospitalStatusSidePanel sourceStatus="live" tasks={tasks} />;
}

function HomeOperationsSidePanel({
  role,
  workspaceId,
}: {
  role: ReturnType<typeof mapAuthRoleToHomeRole>;
  workspaceId: string;
}) {
  const operatingDate = getWorkspaceOperatingDate(workspaceId);
  const { loading, refresh, response } = useHomeOperationsWorkItems({
    includeCancelled: false,
    includeCompleted: false,
    operatingDate,
    workspaceId,
  });
  const data = useMemo(
    () =>
      mapOperationsResponseToHomeDashboardData({
        items: response?.ok ? response.items : [],
        operatingDate: response?.operatingDate ?? operatingDate,
        role,
        roleLabel: HOME_ROLE_LABELS[role],
        userName: HOME_ROLE_USER_NAMES[role],
      }),
    [operatingDate, response, role],
  );

  if (loading && !response) {
    return <HomeSidePanelLoadingState />;
  }

  return (
    <HomeHospitalStatusSidePanel
      errorMessage={!response?.ok ? response?.error.message : undefined}
      loading={loading}
      sourceStatus={response?.sourceStatus ?? "error"}
      tasks={data.hospitalTasks}
      onRefresh={refresh}
    />
  );
}

function useHomeOperationsWorkItems({
  includeCancelled,
  includeCompleted,
  operatingDate,
  workspaceId,
}: {
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
  }, [includeCancelled, includeCompleted, operatingDate, requestKey, workspaceId]);

  return {
    loading: response?.requestKey !== requestKey,
    refresh,
    response: response?.body ?? null,
  };
}

function HomeLoadingState() {
  return (
    <div className="grid h-full min-h-0 overflow-hidden bg-[var(--emr-surface-workspace)]">
      <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3 p-4">
        <div className="flex items-start justify-between">
          <Skeleton className="h-9 w-48 rounded-[var(--clair-radius-sm)]" />
          <div className="flex gap-2">
            <Skeleton className="h-12 w-24 rounded-[var(--clair-radius-md)]" />
            <Skeleton className="h-12 w-24 rounded-[var(--clair-radius-md)]" />
            <Skeleton className="h-12 w-24 rounded-[var(--clair-radius-md)]" />
          </div>
        </div>
        <Skeleton className="h-20 rounded-[var(--clair-radius-md)]" />
        <div className="grid grid-flow-col auto-cols-[280px] gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-full rounded-[var(--clair-radius-md)]" />
          ))}
        </div>
      </div>
    </div>
  );
}

function HomeSidePanelLoadingState() {
  return (
    <div className="grid h-full min-h-0 grid-rows-[48px_minmax(0,1fr)] gap-3 bg-[var(--emr-surface-sidepanel)] p-3">
        <Skeleton className="h-6 w-28 rounded-[var(--clair-radius-sm)]" />
        <div className="grid content-start gap-2">
          <Skeleton className="h-28 rounded-[var(--clair-radius-md)]" />
          <Skeleton className="h-28 rounded-[var(--clair-radius-md)]" />
          <Skeleton className="h-28 rounded-[var(--clair-radius-md)]" />
        </div>
    </div>
  );
}
